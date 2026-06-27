// middleware/documentAccess.js - Role-Based Access Control (RBAC) Middleware

// Import our Document model to query document records from MongoDB.
const Document = require('../models/Document');

/**
 * Access verification middleware creator.
 * It takes a 'requiredRole' ('viewer', 'editor', or 'owner') and returns a custom Express middleware function.
 * 
 * @param {string} requiredRole - The minimum level of access required to proceed.
 */
const checkAccess = (requiredRole) => {
  return async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const userId = req.user._id;

      // 1. QUERY DOCUMENT: Retrieve the document. We populate the owner field to check credentials.
      const document = await Document.findById(documentId);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // 2. CHECK OWNER ACCESS: Owners have all privileges.
      // If the user is the owner, they bypass collaborator role checks.
      const isOwner = document.owner.toString() === userId.toString();

      if (isOwner) {
        req.document = document; // Attach document to request object for easy controller access
        req.userRole = 'owner';   // Attach user role for context
        return next();
      }

      // 3. COLLABORATOR CHECK: If not the owner, check if the user is listed in the collaborators array.
      const collaborator = document.collaborators.find(
        (collab) => collab.user.toString() === userId.toString()
      );

      if (!collaborator) {
        // If the user is neither the owner nor a collaborator, block access completely.
        return res.status(403).json({ message: 'Access denied: You do not have permission to view this document' });
      }

      const userRole = collaborator.role; // Extract role: 'editor' or 'viewer'
      req.userRole = userRole;            // Attach user role for context
      req.document = document;            // Attach document to request

      // 4. CHECK REQUIRED ROLE TIER:
      // - If 'owner' is required, only owners are allowed (already caught by isOwner check).
      if (requiredRole === 'owner') {
        return res.status(403).json({ message: 'Access denied: Owner privileges required' });
      }

      // - If 'editor' is required, collaborator's role must be 'editor'.
      if (requiredRole === 'editor' && userRole !== 'editor') {
        return res.status(403).json({ message: 'Access denied: Editor privileges required' });
      }

      // - If 'viewer' is required, both 'editor' and 'viewer' are allowed.
      // (Both roles pass since they are registered collaborators).
      
      next(); // Access approved, continue to route handler
    } catch (error) {
      console.error('Access control middleware error:', error);
      return res.status(500).json({ message: 'Server error during access verification' });
    }
  };
};

module.exports = { checkAccess };
