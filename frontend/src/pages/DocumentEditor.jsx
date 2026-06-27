// pages/DocumentEditor.jsx - Real-Time Collaborative Document Editor Workspace

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

// Import ActiveUsers avatar display component.
import ActiveUsers from '../components/ActiveUsers';

// Import VersionHistoryPanel sidebar drawer.
import VersionHistoryPanel from '../components/VersionHistoryPanel';

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

const DocumentEditor = () => {
  const { id: documentId } = useParams(); // Extract document ID from URL path params
  const navigate = useNavigate();
  const { user } = useAuth();

  // Component UI and metadata states
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docTitle, setDocTitle] = useState('Loading document...');
  const [activeUsersList, setActiveUsersList] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [restorationBanner, setRestorationBanner] = useState('');
  const [saveStatus, setSaveStatus] = useState('Saved just now');

  // Use refs to persist socket, Yjs document, and awareness structures across re-renders
  const socketRef = useRef(null);
  const ydocRef = useRef(null);
  const awarenessRef = useRef(null);

  // Manual save handler triggered by toolbar or Ctrl+S shortcut
  const handleManualSave = () => {
    if (socketRef.current && ydocRef.current) {
      setSaveStatus('Saving...');
      const fullDocState = Y.encodeStateAsUpdate(ydocRef.current);
      const base64Content = btoa(String.fromCharCode(...fullDocState));
      socketRef.current.emit('save-document', base64Content);
      console.log('[Manual Save] Triggered immediate save via shortcut/toolbar.');
    }
  };

  useEffect(() => {
    let editorInstance = null;

    const initializeEditor = async () => {
      try {
        // 1. FETCH DOCUMENT METADATA
        // Check database connection and verify user has access rights.
        const response = await api.get(`/documents/${documentId}`);
        const documentData = response.data.document;
        setDocTitle(documentData.title);
        setUserRole(response.data.role); // Save role state ('owner', 'editor', or 'viewer')

        // 2. INITIALIZE YJS DOCUMENT AND AWARENESS STATE
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        const awareness = new awarenessProtocol.Awareness(ydoc);
        awarenessRef.current = awareness;

        // 3. ESTABLISH SOCKET.IO CONNECTION WITH AUTH HANDSHAKE
        const socket = io(import.meta.env.VITE_SOCKET_URL || 'https://codec-p2.onrender.com', {
          auth: {
            token: localStorage.getItem('token'), // Pass JWT for connection authentication
          },
        });
        socketRef.current = socket;

        // 4. EMIT JOIN ROOM REQUEST
        socket.emit('join-document', { documentId });

        // 5. DEFINE SOCKET SYNC LISTENERS
        // Listen for database content loaded from server on first connection.
        socket.on('load-document', (savedBase64Content) => {
          if (savedBase64Content) {
            try {
              // Convert the base64 string back into a binary Uint8Array update vector
              const binaryUpdate = Uint8Array.from(atob(savedBase64Content), (c) => c.charCodeAt(0));
              
              // Apply the update to the Yjs doc
              Y.applyUpdate(ydoc, binaryUpdate);
            } catch (e) {
              console.error('Yjs initial state loading error:', e);
            }
          }
          setLoading(false); // Stop loading indicator once synchronized
        });

        // Listen for real-time document changes emitted by other editors
        socket.on('document-change', (binaryUpdate) => {
          try {
            // Apply the update vector to our local Yjs document.
            // We pass the socket instance as the origin to prevent a feedback broadcast loop!
            Y.applyUpdate(ydoc, new Uint8Array(binaryUpdate), socket);
          } catch (e) {
            console.error('Error applying remote document change:', e);
          }
        });

        // Listen for collaborator carets / cursor updates
        socket.on('awareness-change', (binaryUpdate) => {
          try {
            // Apply the awareness status update vector
            awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(binaryUpdate), socket);
          } catch (e) {
            console.error('Error applying remote awareness update:', e);
          }
        });

        // Listen for collaborator title renames
        socket.on('title-update', (newTitle) => {
          setDocTitle(newTitle);
        });

        // Listen for active users updates
        socket.on('active-users-updated', (users) => {
          setActiveUsersList(users);
        });

        // Listen for validation/permissions errors from server
        socket.on('error', (errMsg) => {
          setError(errMsg);
          setLoading(false);
        });

        // Listen for save completion confirmation from the server
        socket.on('document-saved', () => {
          setSaveStatus('Saved just now');
        });

        // Listen for document restoration rollbacks triggered by the owner
        socket.on('document-restored', ({ content, restoredBy }) => {
          try {
            // Convert restored base64 updates to binary and apply to temporary Yjs document
            const binaryUpdate = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
            const tempDoc = new Y.Doc();
            Y.applyUpdate(tempDoc, binaryUpdate);
            const restoredHtml = tempDoc.getXmlFragment('default').toString();

            // Set content on editorInstance
            if (editorInstance) {
              editorInstance.commands.setContent(restoredHtml || '<p></p>');
            }

            // Set premium notification banner toast
            setRestorationBanner(`Document restored to a previous version by ${restoredBy}`);
            // Dismiss after 4 seconds
            setTimeout(() => {
              setRestorationBanner('');
            }, 4000);
          } catch (err) {
            console.error('Error applying restored document state:', err);
          }
        });

        // 6. DETECT LOCAL EDITS AND SYNC TO SERVER
        // Fires whenever a local keystroke or edit modifies the Yjs document
        ydoc.on('update', (update, origin) => {
          // If the change didn't originate from the socket connection (it is a local edit)
          if (origin !== socket) {
            // Emit the binary update to all other room collaborators
            socket.emit('document-change', update);

            // Update save indicator to show saving progress
            setSaveStatus('Saving...');

            // Encode the full Yjs state vector and convert it to a base64 string
            const fullDocState = Y.encodeStateAsUpdate(ydoc);
            const base64Content = btoa(String.fromCharCode(...fullDocState));
            
            // Emit the current document content to trigger a debounced save in MongoDB
            socket.emit('save-document', base64Content);
          }
        });

        // 7. DETECT LOCAL CURSOR MOVEMENTS AND SYNC TO SERVER
        // Fires when local caret positions or selections change
        awareness.on('update', ({ added, updated, removed }, origin) => {
          if (origin !== socket) {
            const changedClients = added.concat(updated).concat(removed);
            const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
            
            // Emit cursor vectors to other collaborators
            socket.emit('awareness-change', awarenessUpdate);
          }
        });

        // 8. CONFIGURE AND INITIALIZE TIPTAP EDITOR
        // Find our client's profile in the active users list to read their assigned caret color
        const myCaretColor = activeUsersList.find((u) => u.userId === user?.id)?.color || '#6366f1';

        editorInstance = new Editor({
          extensions: [
            StarterKit.configure({
              // Disable standard history undo manager.
              // We use Yjs's collaborative history instead to prevent overwriting others' undos.
              history: false,
            }),
            Underline,
            Collaboration.configure({
              document: ydoc, // Bind Tiptap to our Yjs CRDT structure
            }),
            CollaborationCursor.configure({
              provider: { awareness }, // Bind Tiptap presence to Yjs awareness
              user: {
                name: user?.name || 'Anonymous User',
                color: myCaretColor, // Assign caret border highlight color
              },
            }),
            Markdown, // Enables markdown copy/paste and input shortcuts (e.g. typing # heading)
            createCustomSave(handleManualSave), // Registers Ctrl+S custom keyboard shortcut handler
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

  /**
   * Sync document title updates.
   * @param {object} e - Input change event.
   */
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setDocTitle(newTitle);
    
    // Broadcast renamed title to other active collaborators.
    // The server will handle updating MongoDB.
    if (socketRef.current) {
      socketRef.current.emit('title-update', newTitle);
    }
  };

  // Triggers when the user clicks away from the title input (onBlur)
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

  // Convert Tiptap editor content to Markdown and trigger file download
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

  // Convert Tiptap editor content to Plain Text and trigger file download
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

  // Calculate live word and character counts from the editor instance
  const editorText = editor?.getText() || '';
  const charCount = editorText.length;
  const wordCount = editorText.trim() === '' ? 0 : editorText.trim().split(/\s+/).filter(Boolean).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-slate-500 text-sm font-medium">Entering collaborative workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center border border-slate-100">
          <span className="text-4xl mb-4 inline-block">⚠️</span>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 cursor-pointer w-full"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-4">
        
        {/* TOP BAR BAR LAYOUT */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex items-center space-x-3 flex-1 flex-wrap gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-slate-500 hover:text-slate-700 text-sm font-semibold cursor-pointer border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ← Dashboard
            </button>
            <input
              type="text"
              value={docTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              className="font-bold text-slate-800 text-lg sm:text-xl border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none transition-colors px-1 py-0.5 min-w-[150px] max-w-[280px] md:max-w-none"
              title="Click to rename document"
            />
            {/* Live save indicator status badge */}
            <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full transition-all duration-200 ${
              saveStatus === 'Saving...'
                ? 'bg-amber-100 text-amber-800 animate-pulse'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {saveStatus}
            </span>
          </div>
          
          {/* Active Collaborators Avatars Circle stack */}
          <div className="flex items-center justify-end">
            <ActiveUsers users={activeUsersList} />
          </div>
        </div>

        {/* EDITOR CONTROLS TOOLBAR */}
        {editor && (
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-1 items-center">
            {/* Bold Toggle */}
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-2 rounded hover:bg-slate-100 text-sm font-bold cursor-pointer transition-colors ${
                editor.isActive('bold') ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
              }`}
              title="Bold (Ctrl+B)"
            >
              B
            </button>

            {/* Italic Toggle */}
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-2 rounded hover:bg-slate-100 text-sm italic cursor-pointer transition-colors ${
                editor.isActive('italic') ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
              }`}
              title="Italic (Ctrl+I)"
            >
              I
            </button>

            {/* Underline Toggle */}
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-2 rounded hover:bg-slate-100 text-sm underline cursor-pointer transition-colors ${
                editor.isActive('underline') ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
              }`}
              title="Underline (Ctrl+U)"
            >
              U
            </button>

            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

            {/* Heading 1 */}
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-2 rounded hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors ${
                editor.isActive('heading', { level: 1 }) ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
              }`}
              title="Heading 1"
            >
              H1
            </button>

            {/* Heading 2 */}
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-2 rounded hover:bg-slate-100 text-sm font-semibold cursor-pointer transition-colors ${
                editor.isActive('heading', { level: 2 }) ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
              }`}
              title="Heading 2"
            >
              H2
            </button>

            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

            {/* Bullet List */}
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded hover:bg-slate-100 text-sm cursor-pointer transition-colors ${
                editor.isActive('bulletList') ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
              }`}
              title="Bullet List"
            >
              • List
            </button>

            {/* Ordered List */}
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-2 rounded hover:bg-slate-100 text-sm cursor-pointer transition-colors ${
                editor.isActive('orderedList') ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
              }`}
              title="Ordered List"
            >
              1. List
            </button>

            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

            {/* Undo Trigger */}
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-2 rounded hover:bg-slate-100 text-slate-600 text-sm cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo"
            >
              ↩
            </button>

            {/* Redo Trigger */}
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-2 rounded hover:bg-slate-100 text-slate-600 text-sm cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo"
            >
              ↪
            </button>

            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

            {/* Manual Save Action */}
            <button
              onClick={handleManualSave}
              className="p-1.5 px-3 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 border border-slate-250 bg-slate-50/50"
              title="Save Document (Ctrl+S)"
            >
              <span>💾 Save</span>
            </button>

            {/* Version History Trigger */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-1.5 px-3 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 border border-slate-250 bg-slate-50/50"
              title="View Version History"
            >
              <span>🕒 History</span>
            </button>

            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

            {/* Export as Markdown Trigger */}
            <button
              onClick={exportAsMarkdown}
              className="p-1.5 px-3 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 border border-slate-250 bg-slate-50/50 hover:text-indigo-600 hover:border-indigo-200"
              title="Export as Markdown (.md)"
            >
              <span>📥 Export .MD</span>
            </button>

            {/* Export as Plain Text Trigger */}
            <button
              onClick={exportAsPlainText}
              className="p-1.5 px-3 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 border border-slate-250 bg-slate-50/50 hover:text-indigo-600 hover:border-indigo-200"
              title="Export as Text (.txt)"
            >
              <span>📥 Export .TXT</span>
            </button>
          </div>
        )}

        {/* EDITOR AREA PAGE WRAPPER */}
        <div className="bg-white rounded-xl shadow-md border border-slate-100 p-8 sm:p-12 min-h-[550px] focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all duration-200">
          <EditorContent editor={editor} className="prose max-w-none text-slate-700" />
        </div>

        {/* Editor Metrics Footer */}
        {editor && (
          <div className="max-w-4xl mx-auto mt-4 px-4 py-3 border border-slate-200 rounded-xl bg-white flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider shadow-xs">
            <div className="flex space-x-4">
              <span>Words: <strong className="text-slate-600">{wordCount}</strong></span>
              <span>Characters: <strong className="text-slate-600">{charCount}</strong></span>
            </div>
            <div className="flex space-x-1.5 items-center text-indigo-500">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
              <span>Collab-Sync Active</span>
            </div>
          </div>
        )}

      </div>

      {/* FLOATING BANNER NOTIFICATION (RESTORATION TOAST) */}
      {restorationBanner && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-2xl border border-slate-800">
          <span className="text-base">🔄</span>
          <span>{restorationBanner}</span>
        </div>
      )}

      {/* VERSION HISTORY PANEL SIDEBAR */}
      <VersionHistoryPanel
        documentId={documentId}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        isOwner={userRole === 'owner'}
        onRestore={(restoredBase64) => {
          // The Socket listener will handle setContent for us.
          setIsHistoryOpen(false);
        }}
      />
    </div>
  );
};

export default DocumentEditor;
