// controllers/documentController.js - Document CRUD and sharing controls

const Document = require('../models/Document');
const User = require('../models/User');

/**
 * Create a new collaborative document.
 * ROUTE: POST /api/documents
 */
exports.createDocument = async (req, res) => {
  try {
    const { title } = req.body;

    // Create the document document using the requester's ID as the owner.
    const newDoc = await Document.create({
      title: title || 'Untitled Document',
      owner: req.user._id,
      content: '', // Starts completely empty
      collaborators: [],
    });

    // Populate owner info before sending response
    const populatedDoc = await Document.findById(newDoc._id).populate('owner', 'name email');

    return res.status(201).json(populatedDoc);
  } catch (error) {
    console.error('Create document error:', error);
    return res.status(500).json({ message: 'Server error while creating document' });
  }
};

/**
 * Fetch all documents where user is the owner OR a collaborator.
 * ROUTE: GET /api/documents
 */
exports.getAllDocuments = async (req, res) => {
  try {
    const userId = req.user._id;

    // $or returns records matching any conditions:
    // - owner field matches the user's ID
    // - 'collaborators.user' array contains the user's ID
    const docs = await Document.find({
      $or: [
        { owner: userId },
        { 'collaborators.user': userId },
      ],
    })
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email')
      .sort({ updatedAt: -1 }); // Order by last updated (descending)

    return res.status(200).json(docs);
  } catch (error) {
    console.error('Get all documents error:', error);
    return res.status(500).json({ message: 'Server error while fetching documents' });
  }
};

/**
 * Get details of a single document.
 * ROUTE: GET /api/documents/:id
 * (Security check is pre-handled by checkAccess middleware)
 */
exports.getDocumentById = async (req, res) => {
  try {
    // req.document is attached to the request by checkAccess middleware.
    // We fetch the document again to populate nested model details.
    const doc = await Document.findById(req.document._id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');

    // Return document details alongside the requester's user role badge ('owner', 'editor', 'viewer')
    return res.status(200).json({
      document: doc,
      role: req.userRole,
    });
  } catch (error) {
    console.error('Get document details error:', error);
    return res.status(500).json({ message: 'Server error while fetching document details' });
  }
};

/**
 * Update the title of a document.
 * ROUTE: PUT /api/documents/:id
 * (Access check is pre-handled by checkAccess('editor') middleware)
 */
exports.updateDocument = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ message: 'Title cannot be empty' });
    }

    const doc = req.document; // Retrieve from middleware
    doc.title = title.trim();
    await doc.save();

    const populatedDoc = await Document.findById(doc._id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');

    return res.status(200).json(populatedDoc);
  } catch (error) {
    console.error('Update document title error:', error);
    return res.status(500).json({ message: 'Server error while updating document title' });
  }
};

/**
 * Delete a document from the database.
 * ROUTE: DELETE /api/documents/:id
 * (Access check is pre-handled by checkAccess('owner') middleware)
 */
exports.deleteDocument = async (req, res) => {
  try {
    const doc = req.document; // Retrieve from middleware
    await Document.deleteOne({ _id: doc._id });

    return res.status(200).json({ message: 'Document deleted successfully', documentId: doc._id });
  } catch (error) {
    console.error('Delete document error:', error);
    return res.status(500).json({ message: 'Server error while deleting document' });
  }
};

/**
 * Share a document with another user by email.
 * ROUTE: POST /api/documents/:id/share
 * (Access check is pre-handled by checkAccess('owner') middleware - only owners can share)
 */
exports.shareDocument = async (req, res) => {
  try {
    const { email, role } = req.body;
    const doc = req.document; // Retrieve from middleware

    if (!email || !role) {
      return res.status(400).json({ message: 'Please provide both email and role' });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be either editor or viewer' });
    }

    // 1. LOOK UP COLLABORATOR: Find the user by their email.
    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    // 2. CHECK OWNER COLLABORATION: Users cannot invite the document owner.
    if (doc.owner.toString() === targetUser._id.toString()) {
      return res.status(400).json({ message: 'You are the owner of this document' });
    }

    // 3. COLLABORATOR CHECK:
    // Check if the user is already in the collaborators array.
    const collaboratorIndex = doc.collaborators.findIndex(
      (collab) => collab.user.toString() === targetUser._id.toString()
    );

    if (collaboratorIndex !== -1) {
      // If already added, update their role to the new selection
      doc.collaborators[collaboratorIndex].role = role;
    } else {
      // Otherwise, add them as a new collaborator object
      doc.collaborators.push({
        user: targetUser._id,
        role: role,
      });
    }

    await doc.save();

    // Populate updated details for the client
    const updatedDoc = await Document.findById(doc._id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');

    return res.status(200).json(updatedDoc);
  } catch (error) {
    console.error('Share document error:', error);
    return res.status(500).json({ message: 'Server error while sharing document' });
  }
};

/**
 * Remove a collaborator from a document.
 * ROUTE: POST /api/documents/:id/unshare
 * (Access check is pre-handled by checkAccess('owner') middleware)
 */
exports.removeCollaborator = async (req, res) => {
  try {
    const { userId } = req.body;
    const doc = req.document; // Retrieve from middleware

    if (!userId) {
      return res.status(400).json({ message: 'Please provide user ID to remove' });
    }

    // Filter out the collaborator matching the target userId.
    doc.collaborators = doc.collaborators.filter(
      (collab) => collab.user.toString() !== userId.toString()
    );

    await doc.save();

    const updatedDoc = await Document.findById(doc._id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');

    return res.status(200).json(updatedDoc);
  } catch (error) {
    console.error('Remove collaborator error:', error);
    return res.status(500).json({ message: 'Server error while removing collaborator' });
  }
};
