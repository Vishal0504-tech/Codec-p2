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
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'https://codec-p2-1.onrender.com', {
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
    setIsCreating(true);
    try {
      const response = await api.post('/documents', {
        title: 'Untitled Document',
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

  const [searchFilter, setSearchFilter] = useState('');

  const filteredDocs = documents.filter((doc) =>
    (doc.title || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-[#f4f6fb] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Welcome & Action Section */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-[#3366FF] uppercase tracking-wider mb-1">
              <span>Codec Workspace</span>
              <span>•</span>
              <span>Documentation Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Documents & API Guides
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Collaborative workspace for <strong className="text-slate-700">{user?.name}</strong>. Create, edit, and share live documentation.
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCreateDocument}
              disabled={isCreating}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-150 shadow-sm hover:shadow flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>+ New Document</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Filter documents by title..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#3366FF] focus:border-[#3366FF] transition-all"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredDocs.length}</strong> of {documents.length} documents
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md text-sm text-red-700 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Main Grid View */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-[#3366FF]"></div>
            <p className="text-slate-500 text-sm font-medium">Fetching documents...</p>
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocs.map((doc) => {
              const roleBadge = getUserRole(doc);
              const isDocOwner = doc.owner?._id === user?.id || doc.owner === user?.id;

              return (
                <div key={doc._id} className="bg-white rounded-xl shadow-2xs hover:shadow-md border border-slate-200 p-5 flex flex-col justify-between transition-all duration-200 group">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadge.style}`}>
                        {roleBadge.text}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-800 group-hover:text-[#3366FF] transition-colors duration-150 line-clamp-1">
                        {doc.title || 'Untitled Document'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Author: <span className="font-medium text-slate-600">{isDocOwner ? 'You (Owner)' : doc.owner?.name}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => navigate(`/document/${doc._id}`)}
                      className="text-xs font-bold text-[#3366FF] hover:text-blue-700 transition-colors flex items-center space-x-1"
                    >
                      <span>Open Document</span>
                      <span>→</span>
                    </button>

                    {isDocOwner && (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setShareDoc(doc)}
                          className="px-2 py-1 rounded hover:bg-slate-100 text-slate-500 hover:text-[#3366FF] transition-colors text-xs font-semibold"
                          title="Share Document"
                        >
                          Share
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc._id)}
                          className="px-2 py-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors text-xs font-semibold"
                          title="Delete Document"
                        >
                          Delete
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
              className="bg-[#3366FF] hover:bg-blue-600 hover:-translate-y-0.5 active:translate-y-0 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all duration-150 shadow-md shadow-blue-200 cursor-pointer flex items-center space-x-2"
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
