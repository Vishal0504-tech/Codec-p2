// pages/DocumentPage.jsx - Document Page Workspace Placeholder

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Import our custom API client.
import api from '../services/api';

const DocumentPage = () => {
  const { id } = useParams(); // Retrieves document ID from the URL params
  const navigate = useNavigate();

  // Document state management
  const [doc, setDoc] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch document details on component mount
  useEffect(() => {
    const fetchDocumentDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/documents/${id}`);
        // Response contains document schema and user's role badge ('owner', 'editor', 'viewer')
        setDoc(response.data.document);
        setUserRole(response.data.role);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError(err.response?.data?.message || 'Access denied or document not found.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-slate-500 text-sm font-medium">Loading document workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center border border-slate-100">
          <span className="text-4xl mb-4 inline-block">❌</span>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-200 cursor-pointer w-full"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* Workspace Toolbar Header */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-slate-500 hover:text-slate-700 text-sm font-semibold cursor-pointer border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 line-clamp-1">{doc?.title}</h1>
            <span className={`px-2.5 py-0.5 rounded text-xs font-semibold capitalize border ${
              userRole === 'owner' 
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                : userRole === 'editor' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {userRole}
            </span>
          </div>
          
          <div className="text-xs text-slate-400">
            Owner: <span className="font-medium text-slate-600">{doc?.owner?.name}</span>
          </div>
        </div>

        {/* Editor Screen Placeholder Area */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-12 min-h-[500px] flex flex-col items-center justify-center text-center">
          <span className="text-6xl mb-6 animate-pulse">✍️</span>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Collaborative Workspace</h2>
          <p className="text-slate-400 text-sm max-w-md">
            The rich text editor integration using Tiptap, Yjs, and real-time syncing via Socket.IO is configured in Phase 4.
          </p>
          <div className="mt-8 p-4 bg-slate-50 border border-slate-100 rounded-lg text-left text-xs max-w-sm w-full font-mono text-slate-500 space-y-1">
            <p>• Document ID: {doc?._id}</p>
            <p>• User Access: {userRole.toUpperCase()}</p>
            <p>• Owner: {doc?.owner?.email}</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DocumentPage;
