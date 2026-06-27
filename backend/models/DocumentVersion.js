// models/DocumentVersion.js - Schema for Document Version Snapshots

const mongoose = require('mongoose');

// Define the schema for storing document version snapshots.
// Each snapshot stores the complete binary state of the collaborative document at a specific point in time.
const documentVersionSchema = new mongoose.Schema(
  {
    // Reference to the Document being saved.
    // 'index: true' enables fast queries when searching for the version history of a specific document.
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'A version must be linked to a document'],
      index: true,
    },
    // The serialized Yjs document state update vector, stored as a base64 string.
    // This snapshot contains the complete document state at this specific version.
    content: {
      type: String,
      required: [true, 'Version content snapshot cannot be empty'],
    },
    // Reference to the User who made the edits that triggered this version snapshot save.
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A version snapshot must record who saved it'],
    },
    // The sequential index number of this version (e.g. Version 1, Version 2, etc.)
    // We increment this integer sequentially per document during creation.
    versionNumber: {
      type: Number,
      required: [true, 'A version must have a version number'],
    },
    // The timestamp when this specific snapshot was created.
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Auto-create standard createdAt timestamps.
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model('DocumentVersion', documentVersionSchema);
