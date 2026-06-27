// models/Document.js - Mongoose Schema for Collaborative Documents

// Mongoose is our Object Data Modeling (ODM) framework to communicate with MongoDB.
const mongoose = require('mongoose');

// Define the blueprint for how collaborative documents will be stored.
const documentSchema = new mongoose.Schema(
  {
    // The title of the document.
    // Defaults to "Untitled Document" if no title is specified during creation.
    title: {
      type: String,
      required: [true, 'Please provide a document title'],
      trim: true,
      default: 'Untitled Document',
    },
    // The main body/state of the document.
    // Yjs (our real-time sync engine) represents document updates. We serialize these
    // updates or contents as a String/JSON representation in MongoDB.
    content: {
      type: String,
      default: '',
    },
    // Reference to the User who created the document.
    // 'ref: User' tells Mongoose that this ID corresponds to a document in the 'users' collection.
    // This allows us to use .populate('owner') to fetch their name and email in one query.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A document must have an owner'],
    },
    // The array of collaborators invited to edit or view this document.
    // This is an array of subdocuments.
    // Storing role details alongside each user ID allows us to enforce access levels (RBAC).
    collaborators: [
      {
        // Reference to the collaborator's user account ID.
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        // The permission tier granted to this collaborator:
        // - 'editor': Can view and edit document contents.
        // - 'viewer': Can read document contents but cannot save edits.
        role: {
          type: String,
          enum: ['editor', 'viewer'],
          default: 'editor',
        },
      },
    ],
  },
  {
    // Mongoose automatically handles 'createdAt' and 'updatedAt' timestamps.
    // 'updatedAt' changes every time a save() or update() event triggers on a document.
    timestamps: true,
  }
);

// Export the 'Document' model so we can query and save documents in our controllers.
module.exports = mongoose.model('Document', documentSchema);
