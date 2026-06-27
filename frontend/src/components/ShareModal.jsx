// components/ShareModal.jsx - Document Sharing Dialog Component

import React, { useState } from 'react';

// Import our custom API Axios client instance.
import api from '../services/api';

const ShareModal = ({ isOpen, onClose, document, onUpdate }) => {
  // If the modal is not open, do not render anything.
  if (!isOpen || !document) return null;

  // Form input states
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');

  // UI Feedback states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle adding a collaborator.
   */
  const handleShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter an email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      // POST request to invite a collaborator by email.
      const response = await api.post(`/documents/${document._id}/share`, {
        email,
        role,
      });

      // Update document state in parent component
      onUpdate(response.data);

      setEmail('');
      setSuccess('Collaborator added successfully!');
      
      // Auto-clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error sharing document:', err);
      setError(err.response?.data?.message || 'Failed to share document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle removing a collaborator.
   * @param {string} userId - The unique ID of the collaborator to remove.
   */
  const handleRemoveCollaborator = async (userId) => {
    setError('');
    setSuccess('');

    try {
      // POST request to remove the collaborator.
      const response = await api.post(`/documents/${document._id}/unshare`, {
        userId,
      });

      // Update document state in parent component
      onUpdate(response.data);
      setSuccess('Collaborator removed successfully!');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error removing collaborator:', err);
      setError(err.response?.data?.message || 'Failed to remove collaborator.');
    }
  };

  return (
    // Fixed container layer covering the entire screen
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Modal Card wrapper */}
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            Share "{document.title}"
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 focus:outline-none text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-sm text-red-700 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded text-sm text-green-700 font-medium">
              ✅ {success}
            </div>
          )}

          {/* Share Form: Form controls to add new collaborator */}
          <form onSubmit={handleShare} className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Add Collaborator</h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collaborator@example.com"
                className="flex-1 appearance-none rounded-md px-3 py-2 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="rounded-md px-3 py-2 border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm bg-white"
              >
                <option value="editor">Editor (Can edit)</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Sharing...' : 'Add'}
              </button>
            </div>
          </form>

          {/* Collaborator List Panel */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Current Collaborators</h4>
            
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md">
              {/* Render Document Owner details first */}
              <div className="p-3 flex items-center justify-between bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{document.owner?.name}</p>
                  <p className="text-xs text-slate-400">{document.owner?.email}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                  Owner
                </span>
              </div>

              {/* Render Collaborators array if populated */}
              {document.collaborators && document.collaborators.length > 0 ? (
                document.collaborators.map((collab) => (
                  <div key={collab.user?._id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{collab.user?.name}</p>
                      <p className="text-xs text-slate-400">{collab.user?.email}</p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        collab.role === 'editor' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {collab.role === 'editor' ? 'Editor' : 'Viewer'}
                      </span>
                      
                      <button
                        onClick={() => handleRemoveCollaborator(collab.user?._id)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer border border-transparent hover:border-red-200 px-2 py-1 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-slate-400 bg-white">
                  No collaborators added yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-200 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
