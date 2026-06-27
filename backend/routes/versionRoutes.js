// routes/versionRoutes.js - Version History Route Mappings

const express = require('express');
const router = express.Router();

// Import controller handlers.
const {
  getVersions,
  getVersionById,
  restoreVersion,
} = require('../controllers/versionController');

// Import authentication security checks.
const { protect } = require('../middleware/authMiddleware');

// Import access check middleware helpers.
const { checkAccess } = require('../middleware/documentAccess');

// Protect all routes in this file. Requesters must be logged in.
router.use(protect);

// 1. GET ALL VERSIONS
// GET /api/documents/:id/versions -> Lists all version snapshots. Minimum access: 'viewer'.
router.get('/:id/versions', checkAccess('viewer'), getVersions);

// 2. GET SPECIFIC VERSION DETAILS
// GET /api/documents/:id/versions/:versionId -> Loads specific snapshot content. Minimum access: 'viewer'.
router.get('/:id/versions/:versionId', checkAccess('viewer'), getVersionById);

// 3. RESTORE DOCUMENT TO OLD VERSION
// POST /api/documents/:id/versions/:versionId/restore -> Rolls back. Restricted strictly to: 'owner'.
router.post('/:id/versions/:versionId/restore', checkAccess('owner'), restoreVersion);

module.exports = router;
