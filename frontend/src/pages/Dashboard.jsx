// pages/Dashboard.jsx - Main Dashboard Page

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Import our global authentication hook to retrieve logged-in credentials.
import { useAuth } from '../context/AuthContext';

// Import our custom API client.
import api from '../services/api';

// Import the sharing modal dialog component.
import ShareModal from '../components/ShareModal';

// Import Socket.IO client to connect to our websocket server for real-time dashboard updates
import { io } from 'socket.io-client';

const Dashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Document states
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Creation and sharing states
  const [isCreating, setIsCreating] = useState(false);
  const [shareDoc, setShareDoc] = useState(null); // When set to a document object, the ShareModal will display.

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Establish Socket connection to listen for real-time document sharing/unsharing events
  useEffect(() => {
    if (!token) return;

    // Connect to the WebSocket server using the environment URL or fallback
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'https://codec-p2.onrender.com', {
      auth: { token },
    });

    socket.on('document-shared', (updatedDoc) => {
      console.log('Real-time: Document shared with you:', updatedDoc);
      // Re-fetch all documents to update dashboard list in real-time
      fetchDocuments();
    });

    socket.on('document-unshared', ({ documentId }) => {
      console.log('Real-time: Document unshared or deleted:', documentId);
      // Instantly remove the document from the dashboard list
      setDocuments((prev) => prev.filter((doc) => doc._id !== documentId));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  /**
   * Fetch all documents owned by or shared with the user.
   */
  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/documents');
      setDocuments(response.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err.response?.data?.message || 'Failed to retrieve documents.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a new document and redirect to the editor page.
   */
  const handleCreateDocument = async () => {
    const title = prompt('Enter a title for your document:', 'Untitled Document');
    
    // If the user cancelled the prompt (title is null), exit.
    if (title === null) return;

    setIsCreating(true);
    try {
      const response = await api.post('/documents', {
        title: title.trim() || 'Untitled Document',
      });
      
      // Redirect directly to the collaborative editor page with the document's unique ID.
      navigate(`/document/${response.data._id}`);
    } catch (err) {
      console.error('Error creating document:', err);
      alert(err.response?.data?.message || 'Failed to create new document.');
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Delete a document.
   * @param {string} docId - The ID of the document to delete.
   */
  const handleDeleteDocument = async (docId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this document? This action is permanent.');
    if (!confirmDelete) return;

    try {
      await api.delete(`/documents/${docId}`);
      
      // Filter out the deleted document from the local state list.
      setDocuments((prev) => prev.filter((doc) => doc._id !== docId));
    } catch (err) {
      console.error('Error deleting document:', err);
      alert(err.response?.data?.message || 'Failed to delete document.');
    }
  };

  /**
   * Callback to sync updated document structure (like new collaborators) inside our local array.
   */
  const handleDocumentUpdate = (updatedDoc) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc._id === updatedDoc._id ? updatedDoc : doc))
    );
    // Keep the active shareDoc state refreshed in case the modal is open.
    setShareDoc(updatedDoc);
  };

  /**
   * Determine the current user's role badge on a document card.
   * @param {object} doc - The document schema object.
   */
  const getUserRole = (doc) => {
    if (doc.owner?._id === user?.id || doc.owner === user?.id) {
      return { text: 'Owner', style: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    
    const collab = doc.collaborators?.find(
      (c) => c.user?._id === user?.id || c.user === user?.id
    );

    if (collab?.role === 'editor') {
      return { text: 'Editor', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    
    return { text: 'Viewer', style: 'bg-amber-50 text-amber-700 border-amber-200' };
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Welcome Section */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">My Documents</h1>
            <p className="text-slate-500 text-sm">
              Welcome back, <span className="font-semibold text-indigo-600">{user?.name}</span>! Here are the files you can edit and share.
            </p>
          </div>
          
          <button
            onClick={handleCreateDocument}
            disabled={isCreating}
            className="self-start sm:self-center bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : '➕ New Document'}
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md text-sm text-red-700 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Main Grid View */}
        {loading ? (
          // Spinner displayed while loading API data
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
            <p className="text-slate-500 text-sm font-medium">Fetching documents...</p>
          </div>
        ) : documents.length > 0 ? (
          // Grid panel for document lists
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => {
              const roleBadge = getUserRole(doc);
              const isDocOwner = doc.owner?._id === user?.id || doc.owner === user?.id;

              return (
                <div key={doc._id} className="bg-white rounded-xl shadow-sm hover:shadow-md border border-slate-100 p-6 flex flex-col justify-between transition-all duration-200 group">
                  <div className="space-y-4">
                    {/* Header: Role Badge and Date */}
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadge.style}`}>
                        {roleBadge.text}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Title and Owner Info */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors duration-150 line-clamp-1">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Owned by: <span className="font-medium">{isDocOwner ? 'You' : doc.owner?.name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => navigate(`/document/${doc._id}`)}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors cursor-pointer"
                    >
                      Open Document →
                    </button>

                    {isDocOwner && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShareDoc(doc)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-all duration-150 cursor-pointer text-sm"
                          title="Share Document"
                        >
                          👥 Share
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc._id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all duration-150 cursor-pointer text-sm"
                          title="Delete Document"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Premium Visual Empty State Template
          <div className="bg-white rounded-2xl border border-slate-100 p-12 sm:p-20 flex flex-col items-center justify-center text-center shadow-xs">
            {/* SVG Visual Illustration */}
            <div className="w-40 h-40 mb-6 relative hover:scale-105 transition-transform duration-300">
              <svg className="w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background decorative blob */}
                <circle cx="100" cy="100" r="70" fill="url(#gradient-blob)" opacity="0.15" className="animate-pulse" />
                {/* Floating sheet 1 (Back) */}
                <rect x="55" y="45" width="60" height="80" rx="6" fill="#EEF2FF" stroke="#E0E7FF" strokeWidth="2" transform="rotate(-10 55 45)" />
                <line x1="65" y1="65" x2="95" y2="60" stroke="#C7D2FE" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-10 55 45)" />
                <line x1="65" y1="80" x2="105" y2="73" stroke="#C7D2FE" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-10 55 45)" />
                
                {/* Floating sheet 2 (Front) */}
                <rect x="80" y="60" width="65" height="85" rx="8" fill="#FFFFFF" stroke="#6366F1" strokeWidth="3" className="drop-shadow-md" />
                {/* Folder Lines */}
                <line x1="95" y1="80" x2="130" y2="80" stroke="#818CF8" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="95" y1="95" x2="135" y2="95" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="95" y1="110" x2="120" y2="110" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" />
                
                {/* Sparkle decorative icons */}
                <path d="M150 50L153 58L161 61L153 64L150 72L147 64L139 61L147 58L150 50Z" fill="#F59E0B" />
                <path d="M40 130L42 135L47 137L42 139L40 144L38 139L33 137L38 135L40 130Z" fill="#10B981" />
                
                {/* Gradients */}
                <defs>
                  <linearGradient id="gradient-blob" x1="30" y1="30" x2="170" y2="170" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-2">No documents here yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
              Create a document to start writing. You can invite your teammates to edit, review, and comment in real-time.
            </p>
            <button
              onClick={handleCreateDocument}
              className="bg-indigo-600 hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all duration-150 shadow-lg shadow-indigo-200 cursor-pointer flex items-center space-x-2"
            >
              <span>Create Your First Document</span>
              <span className="text-base">🚀</span>
            </button>
          </div>
        )}

        {/* Modal layer rendered overlay screen when triggered */}
        {shareDoc && (
          <ShareModal
            isOpen={!!shareDoc}
            onClose={() => setShareDoc(null)}
            document={shareDoc}
            onUpdate={handleDocumentUpdate}
          />
        )}

      </div>
    </div>
  );
};

export default Dashboard;
