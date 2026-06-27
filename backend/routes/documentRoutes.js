// routes/documentRoutes.js - Document Endpoint Definitions

const express = require('express');
const router = express.Router();

// Import controller handlers.
const {
  createDocument,
  getAllDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  shareDocument,
  removeCollaborator,
} = require('../controllers/documentController');

// Import authentication security checks.
const { protect } = require('../middleware/authMiddleware');

// Import role checking access control.
const { checkAccess } = require('../middleware/documentAccess');

// ALL routes inside this file require user authentication.
// Placing 'router.use(protect)' here applies auth check to every route listed below.
router.use(protect);

// 1. CREATE NEW DOCUMENT
// POST /api/documents -> Creates an empty document.
router.post('/', createDocument);

// 2. GET ALL DOCUMENTS
// GET /api/documents -> Returns all documents owned by or shared with the authenticated user.
router.get('/', getAllDocuments);

// 3. GET SINGLE DOCUMENT BY ID
// GET /api/documents/:id -> Returns document details. Minimum access role: 'viewer' (all collaborators can view).
router.get('/:id', checkAccess('viewer'), getDocumentById);

// 4. UPDATE DOCUMENT TITLE
// PUT /api/documents/:id -> Renames document. Minimum access role: 'editor' (owner and editors can rename).
router.put('/:id', checkAccess('editor'), updateDocument);

// 5. DELETE DOCUMENT
// DELETE /api/documents/:id -> Deletes document entry. Restricted strictly to: 'owner'.
router.delete('/:id', checkAccess('owner'), deleteDocument);

// 6. SHARE DOCUMENT WITH COLLABORATOR
// POST /api/documents/:id/share -> Invites a collaborator. Restricted strictly to: 'owner'.
router.post('/:id/share', checkAccess('owner'), shareDocument);

// 7. REMOVE COLLABORATOR FROM DOCUMENT
// POST /api/documents/:id/unshare -> Removes collaborator. Restricted strictly to: 'owner'.
router.post('/:id/unshare', checkAccess('owner'), removeCollaborator);

module.exports = router;
