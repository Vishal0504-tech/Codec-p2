// pages/DocumentEditor.jsx - Formal Collaborative Document & API Documentation Editor
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Import Socket.IO client to connect to our websocket server.
import { io } from 'socket.io-client';

// Import Yjs core for conflict-free replicated data sync.
import * as Y from 'yjs';

// Import yjs awareness protocol helpers for collaborative cursor carets.
import * as awarenessProtocol from 'y-protocols/awareness';

// Import Tiptap core classes, hook wrapper, and editor layouts.
import { Editor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Markdown } from 'tiptap-markdown';

// Import our global authentication hook.
import { useAuth } from '../context/AuthContext';

// Import Axios API client.
import api from '../services/api';

// Import modals and sub-panels
import ActiveUsers from '../components/ActiveUsers';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import ShareModal from '../components/ShareModal';

// Define a custom Tiptap extension to handle custom keyboard shortcuts like Ctrl+S.
const createCustomSave = (onSave) => {
  return Extension.create({
    name: 'customSave',
    addKeyboardShortcuts() {
      return {
        'Mod-s': () => {
          onSave();
          return true; // Prevent default browser save action
        },
      };
    },
  });
};

// Helper to convert Uint8Array to base64 string safely without stack size limits
const base64FromUint8Array = (arr) => {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
};

const DocumentEditor = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Component UI and metadata states
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docTitle, setDocTitle] = useState('Loading document...');
  const [documentObj, setDocumentObj] = useState(null);
  const [activeUsersList, setActiveUsersList] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [restorationBanner, setRestorationBanner] = useState('');
  const [saveStatus, setSaveStatus] = useState('Saved just now');

  // Use refs to persist socket, Yjs document, and awareness structures across re-renders
  const socketRef = useRef(null);
  const ydocRef = useRef(null);
  const awarenessRef = useRef(null);
  const localSaveTimeoutRef = useRef(null);

  // Manual save handler triggered by toolbar or Ctrl+S shortcut
  const handleManualSave = () => {
    if (socketRef.current && ydocRef.current) {
      setSaveStatus('Saving...');

      if (localSaveTimeoutRef.current) {
        clearTimeout(localSaveTimeoutRef.current);
      }

      const fullDocState = Y.encodeStateAsUpdate(ydocRef.current);
      const base64Content = base64FromUint8Array(fullDocState);
      socketRef.current.emit('save-document', base64Content);
      console.log('[Manual Save] Triggered immediate save via shortcut/toolbar.');

      setTimeout(() => {
        setSaveStatus('Saved just now');
      }, 500);
    }
  };

  // Quick Block Inserters
  const insertEndpointCallout = () => {
    if (!editor) return;
    editor.chain().focus().insertContent(
      `<blockquote><p><strong>POST</strong> &nbsp; <code>https://api.docurocket.com/v2/payments</code></p></blockquote><p>Authentication: <code>API keys</code> &nbsp; <code>OAuth access tokens</code></p>`
    ).run();
  };

  useEffect(() => {
    let editorInstance = null;

    const initializeEditor = async () => {
      try {
        // 1. FETCH DOCUMENT METADATA
        const response = await api.get(`/documents/${documentId}`);
        const documentData = response.data.document;
        setDocumentObj(documentData);
        setDocTitle(documentData.title || 'Untitled Document');
        setUserRole(response.data.role);

        // 2. INITIALIZE YJS DOCUMENT AND AWARENESS STATE
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        const awareness = new awarenessProtocol.Awareness(ydoc);
        awarenessRef.current = awareness;

        // 3. ESTABLISH SOCKET.IO CONNECTION WITH AUTH HANDSHAKE
        const socket = io(import.meta.env.VITE_SOCKET_URL || 'https://codec-p2-1.onrender.com', {
          auth: {
            token: localStorage.getItem('token'),
          },
        });
        socketRef.current = socket;

        // 4. EMIT JOIN ROOM REQUEST
        socket.emit('join-document', { documentId });

        // 5. DEFINE SOCKET SYNC LISTENERS
        socket.on('load-document', (savedBase64Content) => {
          if (savedBase64Content) {
            try {
              const binaryUpdate = Uint8Array.from(atob(savedBase64Content), (c) => c.charCodeAt(0));
              Y.applyUpdate(ydoc, binaryUpdate);
            } catch (e) {
              console.error('Yjs initial state loading error:', e);
            }
          }
          setLoading(false);
        });

        // Listen for incremental real-time edits from other collaborators
        socket.on('document-update', (incomingBase64Update) => {
          try {
            const binaryUpdate = Uint8Array.from(atob(incomingBase64Update), (c) => c.charCodeAt(0));
            Y.applyUpdate(ydoc, binaryUpdate, 'server');
          } catch (e) {
            console.error('Error applying remote Yjs binary update:', e);
          }
        });

        // Listen for title changes from other users
        socket.on('title-updated', (newTitle) => {
          setDocTitle(newTitle);
        });

        // Listen for active users list updates
        socket.on('users-update', (users) => {
          setActiveUsersList(users);

          const awarenessStates = new Map();
          users.forEach((u) => {
            if (u.socketId) {
              awarenessStates.set(u.socketId, {
                user: {
                  id: u.userId,
                  name: u.name,
                  color: u.color,
                },
              });
            }
          });
          awareness.setLocalStateField('user', {
            id: user?.id,
            name: user?.name,
            color: users.find((u) => u.userId === user?.id)?.color || '#3366FF',
          });
        });

        // Version restoration listener
        socket.on('document-restored', ({ versionNumber, restoredBy }) => {
          setRestorationBanner(`Document restored to Version #${versionNumber} by ${restoredBy || 'a collaborator'}`);
          setTimeout(() => setRestorationBanner(''), 6000);
        });

        // Handle socket errors
        socket.on('error', (err) => {
          console.error('Socket room access error:', err);
          setError(err.message || 'Error communicating with collaboration server.');
          setLoading(false);
        });

        // 6. SYNC LOCAL YJS CHANGES TO SERVER
        ydoc.on('update', (update, origin) => {
          if (origin !== 'server') {
            const base64Update = base64FromUint8Array(update);
            socket.emit('document-update', base64Update);

            setSaveStatus('Saving...');
            if (localSaveTimeoutRef.current) {
              clearTimeout(localSaveTimeoutRef.current);
            }
            localSaveTimeoutRef.current = setTimeout(() => {
              const fullDocState = Y.encodeStateAsUpdate(ydoc);
              const fullBase64Content = base64FromUint8Array(fullDocState);
              socket.emit('save-document', fullBase64Content);
              setSaveStatus('Saved just now');
            }, 1000);
          }
        });

        // 7. SYNC CURSOR PRESENCE
        awareness.on('change', () => {
          // Awareness updates handled automatically via Tiptap CollaborationCursor
        });

        // 8. INITIALIZE TIPTAP EDITOR INSTANCE
        const myCaretColor = activeUsersList.find((u) => u.userId === user?.id)?.color || '#3366FF';

        editorInstance = new Editor({
          editable: response.data.role !== 'viewer',
          extensions: [
            StarterKit.configure({
              history: false, // Let Yjs handle undo/redo to avoid overwriting peers
            }),
            Underline,
            Collaboration.configure({
              document: ydoc,
            }),
            CollaborationCursor.configure({
              provider: { awareness },
              user: {
                name: user?.name || 'Anonymous User',
                color: myCaretColor,
              },
            }),
            Markdown,
            createCustomSave(handleManualSave),
          ],
        });

        setEditor(editorInstance);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err.response?.data?.message || 'Access denied or document not found.');
        setLoading(false);
      }
    };

    initializeEditor();

    // 9. CLEANUP CONNECTIONS ON UNMOUNT
    return () => {
      if (editorInstance) {
        editorInstance.destroy();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [documentId, user]);

  // Rename document title
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setDocTitle(newTitle);
    if (socketRef.current) {
      socketRef.current.emit('title-update', newTitle);
    }
  };

  const handleTitleBlur = async () => {
    const trimmedTitle = docTitle.trim();
    if (trimmedTitle === '') {
      setDocTitle('Untitled Document');
      if (socketRef.current) {
        socketRef.current.emit('title-update', 'Untitled Document');
      }
      try {
        await api.put(`/documents/${documentId}`, { title: 'Untitled Document' });
      } catch (err) {
        console.error('Error saving empty document title:', err);
      }
      return;
    }

    try {
      setSaveStatus('Saving...');
      await api.put(`/documents/${documentId}`, { title: trimmedTitle });
      setSaveStatus('Saved just now');
    } catch (err) {
      console.error('Error auto-saving document title:', err);
      setSaveStatus('Failed to save title');
    }
  };

  // Convert Tiptap editor content to Markdown and download
  const exportAsMarkdown = () => {
    if (!editor) return;
    try {
      const markdown = editor.storage.markdown.getMarkdown();
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${docTitle || 'document'}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Markdown export error:', e);
    }
  };

  // Convert Tiptap editor content to Plain Text and download
  const exportAsPlainText = () => {
    if (!editor) return;
    try {
      const text = editor.getText();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${docTitle || 'document'}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Plain text export error:', e);
    }
  };

  // Calculate live word and character counts
  const editorText = editor?.getText() || '';
  const charCount = editorText.length;
  const wordCount = editorText.trim() === '' ? 0 : editorText.trim().split(/\s+/).filter(Boolean).length;
  const pageEstimate = Math.max(1, Math.ceil(wordCount / 350));

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-6rem)] bg-[#f4f6fb] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-[#3366FF]"></div>
          <p className="text-slate-600 text-sm font-semibold">Opening collaborative document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-6rem)] bg-[#f4f6fb] py-12 px-4 flex flex-col items-center justify-center">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center border border-slate-200">
          <span className="text-4xl mb-4 inline-block">⚠️</span>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-[#3366FF] hover:bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-semibold transition-all duration-200 w-full"
          >
            Return to Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col bg-[#f4f6fb]">
      
      {/* 1. DOCUMENT ACTION & METADATA BAR (Matching the reference screenshot) */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-2.5 flex items-center justify-between gap-4 flex-wrap z-20">
        
        {/* Left Side: Back button, Green Save button, and Inline Document Name */}
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          {/* < Back Button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded shadow-2xs flex items-center space-x-1 transition-colors"
          >
            <span>&lt; Back</span>
          </button>

          {/* Vibrant Green Save Button */}
          <button
            onClick={handleManualSave}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs font-bold px-4 py-1.5 rounded shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Save changes (Ctrl+S)"
          >
            {saveStatus === 'Saving...' ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>

          {/* Document Name label & input */}
          <div className="flex items-center space-x-1.5 ml-1">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Document Name:</span>
            <input
              type="text"
              value={docTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              className="text-xs sm:text-sm font-semibold text-slate-800 bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#3366FF] px-2 py-0.5 rounded outline-none transition-colors max-w-[180px] sm:max-w-xs md:max-w-md truncate"
              title="Click to rename document"
            />
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center space-x-2.5">
          {/* Active Collaborators Avatars Circle stack */}
          <div className="hidden lg:block">
            <ActiveUsers users={activeUsersList} />
          </div>

          {/* Share Modal Trigger */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#3366FF] text-[#3366FF] text-xs font-semibold px-3 py-1 rounded shadow-2xs flex items-center space-x-1 transition-all"
            title="Share with collaborators"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>Share</span>
          </button>

          {/* Version History Trigger */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 hover:text-slate-800 text-xs font-semibold px-2.5 py-1 rounded shadow-2xs flex items-center space-x-1 transition-all"
            title="View revision history"
          >
            <span>🕒 History</span>
          </button>
        </div>
      </div>

      {/* 2. RICH ACTION FORMATTING TOOLBAR (Matching reference image) */}
      {editor && (
        <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-1.5 flex items-center gap-1 flex-wrap sticky top-0 z-10 shadow-2xs text-slate-700">
          
          {/* History undo/redo */}
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent font-bold text-sm"
            title="Undo"
          >
            ↺
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent font-bold text-sm"
            title="Redo"
          >
            ↻
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          {/* Bold, Italic, Underline, Strike, Font */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 px-2 rounded text-xs font-bold transition-colors ${
              editor.isActive('bold') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Bold"
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 px-2 rounded text-xs italic font-serif transition-colors ${
              editor.isActive('italic') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Italic"
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 px-2 rounded text-xs underline transition-colors ${
              editor.isActive('underline') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Underline"
          >
            U
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 px-2 rounded text-xs line-through transition-colors ${
              editor.isActive('strike') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Strikethrough"
          >
            S
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          {/* Heading Levels H1, H2, H3, H4, P */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 px-2 rounded text-xs font-extrabold transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 px-2 rounded text-xs font-bold transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 px-2 rounded text-xs font-semibold transition-colors ${
              editor.isActive('heading', { level: 3 }) ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Heading 3"
          >
            H3
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            className={`p-1.5 px-1.5 rounded text-[11px] font-medium transition-colors ${
              editor.isActive('heading', { level: 4 }) ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Heading 4"
          >
            H4
          </button>
          <button
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`p-1.5 px-2 rounded text-xs font-bold transition-colors ${
              editor.isActive('paragraph') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Paragraph"
          >
            P
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          {/* Lists */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 px-2 rounded text-xs transition-colors ${
              editor.isActive('bulletList') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Bullet list"
          >
            •≡
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 px-2 rounded text-xs transition-colors ${
              editor.isActive('orderedList') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Numbered list"
          >
            1≡
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          {/* Code, Quote, Divider */}
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 px-2 rounded text-xs font-mono transition-colors ${
              editor.isActive('codeBlock') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Code Block"
          >
            &lt;&nbsp;&gt;
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 px-2 rounded text-xs font-serif transition-colors ${
              editor.isActive('blockquote') ? 'bg-[#3366FF]/10 text-[#3366FF]' : 'hover:bg-slate-100'
            }`}
            title="Blockquote"
          >
            &rdquo;
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 px-2 rounded text-xs hover:bg-slate-100"
            title="Insert Horizontal Divider"
          >
            —
          </button>

          <div className="flex-1" />

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center space-x-1 text-xs">
            <button
              onClick={exportAsMarkdown}
              className="px-2 py-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 font-medium"
              title="Download as Markdown"
            >
              📥 MD
            </button>
            <button
              onClick={exportAsPlainText}
              className="px-2 py-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 font-medium"
              title="Download as Plain Text"
            >
              📄 TXT
            </button>
          </div>
        </div>
      )}

      {/* 3. WORKSPACE BODY: DOCUMENT PAPER CANVAS */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center relative">
          
          <div className="w-full max-w-4xl relative">
            
            {/* FLOATING LEFT-GUTTER QUICK-INSERT HELPER (Matching screenshot) */}
            <div className="hidden lg:flex flex-col items-center space-y-1 absolute -left-12 top-24 bg-white border border-slate-200 rounded-md p-1 shadow-xs z-10 text-slate-600">
              <button
                onClick={insertEndpointCallout}
                className="w-7 h-7 rounded hover:bg-[#3366FF]/10 hover:text-[#3366FF] flex items-center justify-center text-xs font-bold transition-colors"
                title="Insert Block"
              >
                +
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                className="w-7 h-7 rounded hover:bg-[#3366FF]/10 hover:text-[#3366FF] flex items-center justify-center text-[10px] font-bold transition-colors"
                title="Heading 1"
              >
                H1
              </button>
              <button
                onClick={() => editor?.chain().focus().setParagraph().run()}
                className="w-7 h-7 rounded hover:bg-[#3366FF]/10 hover:text-[#3366FF] flex items-center justify-center text-[10px] font-bold transition-colors"
                title="Paragraph"
              >
                P
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                className="w-7 h-7 rounded hover:bg-[#3366FF]/10 hover:text-[#3366FF] flex items-center justify-center text-[9px] font-mono transition-colors"
                title="Code snippet"
              >
                &lt;&gt;
              </button>
            </div>

            {/* DOCUMENT PAPER SHEET */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200/90 p-8 sm:p-14 min-h-[900px] transition-all focus-within:shadow-md">
              
              {/* Tiptap Collaborative Editor Content */}
              <EditorContent editor={editor} className="prose max-w-none text-slate-700 outline-none" />

            </div>

            {/* Document Metrics & Sync Status Footer */}
            <div className="mt-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-400 font-medium shadow-2xs">
              <div className="flex items-center space-x-4">
                <span>Words: <strong className="text-slate-600 font-semibold">{wordCount}</strong></span>
                <span>Characters: <strong className="text-slate-600 font-semibold">{charCount}</strong></span>
                <span>Est. Pages: <strong className="text-slate-600 font-semibold">{pageEstimate}</strong></span>
              </div>
              <div className="flex items-center space-x-2 text-[#3366FF]">
                <span className="h-2 w-2 rounded-full bg-[#3366FF] animate-pulse" />
                <span className="font-semibold text-[11px] tracking-wide">Real-time Sync Active</span>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* FLOATING RESTORATION BANNER */}
      {restorationBanner && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-2">
          <span>🔄</span>
          <span>{restorationBanner}</span>
        </div>
      )}

      {/* VERSION HISTORY PANEL SIDEBAR DRAWER */}
      <VersionHistoryPanel
        documentId={documentId}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        isOwner={userRole === 'owner'}
        onRestore={() => {
          setIsHistoryOpen(false);
        }}
      />

      {/* SHARE MODAL DIALOG */}
      {isShareOpen && documentObj && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          document={documentObj}
          onUpdate={(updated) => setDocumentObj(updated)}
        />
      )}

    </div>
  );
};

export default DocumentEditor;
