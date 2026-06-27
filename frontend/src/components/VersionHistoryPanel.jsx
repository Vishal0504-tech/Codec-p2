// components/VersionHistoryPanel.jsx - Sidebar displaying document version histories and rollback actions

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as Y from 'yjs';

/**
 * VersionHistoryPanel Component
 * Renders a premium sliding sidebar panel displaying saved versions of the document.
 * Includes preview parsing of binary Yjs states and owner-only rollback capabilities.
 * 
 * @param {string} documentId - ID of the active document.
 * @param {boolean} isOpen - Panel visibility toggle.
 * @param {function} onClose - Closes the panel.
 * @param {boolean} isOwner - Boolean indicating if the current user is the document owner.
 * @param {function} onRestore - Callback triggered when a rollback completes.
 */
const VersionHistoryPanel = ({ documentId, isOpen, onClose, isOwner, onRestore }) => {
  // Lists of versions retrieved from the backend (excluding heavy content field)
  const [versions, setVersions] = useState([]);
  // State tracking the currently selected version for previewing
  const [selectedVersion, setSelectedVersion] = useState(null);
  // HTML content of the selected version, translated from binary Yjs state
  const [previewHtml, setPreviewHtml] = useState('');
  // Loading status states
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  // Modal toggle for confirming the rollback action
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch the version list when the panel opens or the document changes
  useEffect(() => {
    if (isOpen && documentId) {
      fetchVersions();
    }
  }, [isOpen, documentId]);

  // Fetch versions (lists metadata like version number, save timestamp, and user initials)
  const fetchVersions = async () => {
    setIsLoadingList(true);
    try {
      const response = await api.get(`/documents/${documentId}/versions`);
      setVersions(response.data);
      setSelectedVersion(null); // Clear selected preview on reload
      setPreviewHtml('');
    } catch (error) {
      console.error('Error fetching document versions:', error);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Fetch the full details (including the base64 content string) of a specific version
  const handleSelectVersion = async (version) => {
    setIsLoadingPreview(true);
    try {
      const response = await api.get(`/documents/${documentId}/versions/${version._id}`);
      const fullVersion = response.data;
      setSelectedVersion(fullVersion);

      // Convert the base64 string snapshot back into human-readable HTML for the preview box.
      // 1. Decode base64 to binary character stream, then map it into a Uint8Array.
      const binaryUpdate = Uint8Array.from(
        atob(fullVersion.content),
        (c) => c.charCodeAt(0)
      );

      // 2. Load the binary updates into a temporary in-memory Yjs Document.
      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, binaryUpdate);

      // 3. Extract the Tiptap shared node tree from the Yjs XML fragment.
      // Tiptap stores contents under the 'default' fragment by default.
      const html = tempDoc.getXmlFragment('default').toString();
      
      // If the document is blank or has no nodes, output a placeholder string
      setPreviewHtml(html || '<p class="text-zinc-400 italic">This version has no text.</p>');
    } catch (error) {
      console.error('Error loading version snapshot content:', error);
      setPreviewHtml('<p class="text-red-500 font-medium">Failed to load preview for this version.</p>');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Perform the document restore request
  const handleConfirmRestore = async () => {
    if (!selectedVersion) return;
    setIsRestoring(true);
    try {
      const response = await api.post(`/documents/${documentId}/versions/${selectedVersion._id}/restore`);
      
      // Invoke the callback to update the active document editor and close panel
      if (onRestore) {
        onRestore(response.data.content);
      }
      
      setShowConfirmModal(false);
      onClose();
    } catch (error) {
      console.error('Error restoring document version:', error);
      alert('Failed to restore this version. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* 1. BACKDROP OVERLAY */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* 2. SLIDING SIDEBAR CONTAINER */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[400px] border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* PANEL HEADER */}
        <div className="flex items-center justify-between border-b border-zinc-100 p-5">
          <h2 className="text-lg font-bold text-zinc-900">Version History</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* PANEL CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoadingList ? (
            // Loading Spinner for Version List
            <div className="flex h-32 flex-col items-center justify-center space-y-2">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
              <p className="text-xs font-medium text-zinc-500">Loading version records...</p>
            </div>
          ) : selectedVersion ? (
            // VIEW B: VERSION DETAIL & PREVIEW
            <div className="flex flex-col h-full space-y-4">
              {/* Back Button and Metadata card */}
              <div className="flex flex-col space-y-2 rounded-xl bg-zinc-50 p-4 border border-zinc-100">
                <button
                  onClick={() => setSelectedVersion(null)}
                  className="flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-800 transition space-x-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to all versions</span>
                </button>
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Version #{selectedVersion.versionNumber}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {formatDate(selectedVersion.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-zinc-700">
                    Saved by: <span className="text-indigo-600 font-semibold">{selectedVersion.savedBy?.name || 'Unknown'}</span>
                  </p>
                </div>
              </div>

              {/* READ-ONLY PREVIEW CONTAINER */}
              <div className="flex-1 flex flex-col border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/50">
                <div className="bg-zinc-100/80 px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">Document Preview (Read-Only)</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                {isLoadingPreview ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <span className="text-xs text-zinc-400">Fetching preview state...</span>
                  </div>
                ) : (
                  <div 
                    className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none text-zinc-700 focus:outline-none"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
              </div>

              {/* ACTION RESTORE BAR */}
              {isOwner ? (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 active:bg-indigo-800 transition duration-150"
                >
                  Restore this version
                </button>
              ) : (
                <p className="text-center text-xs text-zinc-400 italic">
                  Only the document owner can restore past versions.
                </p>
              )}
            </div>
          ) : versions.length === 0 ? (
            // Empty State
            <div className="flex h-48 flex-col items-center justify-center text-center space-y-2">
              <div className="rounded-full bg-zinc-100 p-3 text-zinc-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-zinc-700">No version history available</p>
              <p className="text-xs text-zinc-400">Snapshots are created automatically when auto-saves run.</p>
            </div>
          ) : (
            // VIEW A: LIST ALL SNAPSHOTS
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version._id}
                  onClick={() => handleSelectVersion(version)}
                  className="flex items-center justify-between rounded-xl border border-zinc-150 p-4 hover:border-indigo-200 hover:bg-indigo-50/20 cursor-pointer transition"
                >
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-bold text-zinc-800">
                      Version #{version.versionNumber}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {formatDate(version.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-semibold text-zinc-700">
                        {version.savedBy?.name || 'Unknown'}
                      </span>
                    </div>
                    {/* User initials bubble avatar */}
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 uppercase">
                      {(version.savedBy?.name || 'U').substring(0, 2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. CONFIRMATION DIALOG MODAL (ONLY VISIBLE ON ROLLBACK ACTION) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blur background layer */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setShowConfirmModal(false)} />
          
          {/* Alert Content Box */}
          <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all border border-zinc-100">
            <h3 className="text-lg font-bold text-zinc-950">Confirm Rollback</h3>
            <p className="mt-3 text-sm text-zinc-500">
              Are you sure you want to restore this document to <strong>Version #{selectedVersion?.versionNumber}</strong>? 
              This will overwrite the current content, and all connected editors will immediately sync to this version.
            </p>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isRestoring}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="inline-flex justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-md transition"
              >
                {isRestoring ? (
                  <div className="flex items-center space-x-1.5">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Restoring...</span>
                  </div>
                ) : (
                  'Yes, restore content'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VersionHistoryPanel;
