// controllers/versionController.js - Document Version History Controls

const Document = require('../models/Document');
const DocumentVersion = require('../models/DocumentVersion');

/**
 * Get all saved versions for a document.
 * Excludes the heavy 'content' binary snapshot field to optimize bandwidth.
 * ROUTE: GET /api/documents/:id/versions
 * (Access checks pre-handled by checkAccess middleware)
 */
exports.getVersions = async (req, res) => {
  try {
    const documentId = req.params.id;

    // Retrieve all version documents linked to this document ID.
    // We select '-content' to omit the heavy base64 snapshot strings from the list view.
    const versions = await DocumentVersion.find({ document: documentId })
      .select('-content')
      .populate('savedBy', 'name email')
      .sort({ versionNumber: -1 }); // Display newest versions first

    return res.status(200).json(versions);
  } catch (error) {
    console.error('Fetch versions error:', error);
    return res.status(500).json({ message: 'Server error while fetching version history' });
  }
};

/**
 * Get a specific version snapshot's full content.
 * ROUTE: GET /api/documents/:id/versions/:versionId
 * (Access checks pre-handled by checkAccess middleware)
 */
exports.getVersionById = async (req, res) => {
  try {
    const { id: documentId, versionId } = req.params;

    // Find the specific version snapshot.
    const version = await DocumentVersion.findOne({
      _id: versionId,
      document: documentId,
    }).populate('savedBy', 'name email');

    if (!version) {
      return res.status(404).json({ message: 'Version snapshot not found' });
    }

    return res.status(200).json(version);
  } catch (error) {
    console.error('Fetch version by ID error:', error);
    return res.status(500).json({ message: 'Server error while fetching version details' });
  }
};

/**
 * Restore a document to a previous version snapshot.
 * Overwrites the active document content and broadcasts changes to active Socket.IO clients.
 * ROUTE: POST /api/documents/:id/versions/:versionId/restore
 * (Restricted to: 'owner' only via checkAccess('owner') middleware)
 */
exports.restoreVersion = async (req, res) => {
  try {
    const { id: documentId, versionId } = req.params;
    const document = req.document; // Loaded by checkAccess middleware

    // 1. FETCH THE SNAPSHOT
    const version = await DocumentVersion.findOne({
      _id: versionId,
      document: documentId,
    });

    if (!version) {
      return res.status(404).json({ message: 'Version snapshot not found' });
    }

    // 2. OVERWRITE DB DOCUMENT CONTENT
    document.content = version.content;
    await document.save();

    // 3. BROADCAST TO SOCKET.IO ROOM
    // We retrieve the 'io' instance registered on the app object during startup.
    const io = req.app.get('io');
    if (io) {
      // Emit the 'document-restored' event carrying the base64 content
      // to all connected clients inside this document room.
      io.to(documentId.toString()).emit('document-restored', {
        content: version.content,
        restoredBy: req.user.name,
      });
      console.log(`[Socket Broadcast] Broadcasted document-restored for room: ${documentId}`);
    }

    return res.status(200).json({
      message: `Document successfully restored to Version ${version.versionNumber}`,
      content: version.content,
    });
  } catch (error) {
    console.error('Restore version error:', error);
    return res.status(500).json({ message: 'Server error during document restoration' });
  }
};
