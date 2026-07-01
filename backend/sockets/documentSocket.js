// sockets/documentSocket.js - WebSocket Event Handlers for Real-Time Sync

const Document = require('../models/Document');
const User = require('../models/User');
const DocumentVersion = require('../models/DocumentVersion');

// Keep an in-memory map of active users inside document rooms.
// Key: Room/Document ID -> Value: Array of User objects { socketId, userId, name, email, color }
const activeUsers = new Map();

// Keep a map of timeout timers for debouncing database save operations.
// Key: Room/Document ID -> Value: setTimeout reference
const saveTimers = new Map();

// Pre-defined color palette for assigning unique caret colors deterministically.
const caretColors = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
];

/**
 * Deterministic helper to assign a color based on user email.
 * @param {string} email - Collaborator's email.
 */
const getUserColor = (email) => {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % caretColors.length);
  return caretColors[index];
};

/**
 * Debounced database save helper.
 * If a user types, we wait for a 2-second pause before executing the MongoDB update,
 * generating a version history snapshot, and pruning history lists.
 * 
 * @param {string} documentId - The document database ID.
 * @param {string} content - The current document content string.
 * @param {string} userId - The user ID who triggered the save.
 * @param {object} socket - The active client's socket instance.
 */
const debouncedSave = (documentId, content, userId, socket) => {
  // If a save timer was already scheduled, clear it.
  if (saveTimers.has(documentId)) {
    clearTimeout(saveTimers.get(documentId));
  }

  // Schedule a new save timer.
  const timer = setTimeout(async () => {
    try {
      // 1. UPDATE ACTIVE DOCUMENT CONTENT
      await Document.findByIdAndUpdate(documentId, { content });
      console.log(`[DB Save] Debounced document content save completed for room: ${documentId}`);
      
      // 2. CREATE A NEW DOCUMENT VERSION SNAPSHOT
      const lastVersion = await DocumentVersion.findOne({ document: documentId }).sort({ versionNumber: -1 });
      const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

      await DocumentVersion.create({
        document: documentId,
        content,
        savedBy: userId,
        versionNumber: nextVersionNumber,
      });
      console.log(`[Snapshot Save] Created document version snapshot #${nextVersionNumber} for document: ${documentId}`);

      // 3. PRUNE HISTORIES (Only keep the last 20 snapshots per document)
      const versions = await DocumentVersion.find({ document: documentId }).sort({ versionNumber: -1 });
      if (versions.length > 20) {
        const versionsToDelete = versions.slice(20);
        const idsToDelete = versionsToDelete.map((v) => v._id);
        await DocumentVersion.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`[History Pruning] Pruned ${idsToDelete.length} older version records for document: ${documentId}`);
      }

      // 4. BROADCAST PERSISTENCE NOTIFICATION TO ROOM
      if (socket && socket.server) {
        // Emit to all collaborators in the room that changes are successfully saved in DB.
        socket.server.to(documentId).emit('document-saved');
      }

      saveTimers.delete(documentId); // Clear timer from memory
    } catch (error) {
      console.error('[DB Save Error] Failed to auto-save document content and version snapshot:', error);
    }
  }, 2000); // 2-second delay

  saveTimers.set(documentId, timer);
};

/**
 * Registers all Socket.IO listeners.
 * @param {object} io - The Socket.IO server instance.
 */
const registerDocumentSocket = (io) => {
  io.on('connection', (socket) => {
    // Note: socket.user is populated by the handshake middleware in server.js
    console.log(`[Socket] Client connected to socket pipeline: ${socket.id} (User ID: ${socket.user?.id})`);

    // Automatically join a user-specific room to receive real-time notifications (like document sharing)
    if (socket.user?.id) {
      socket.join(`user_${socket.user.id}`);
      console.log(`[Socket] User ${socket.user.id} joined personal notification room user_${socket.user.id}`);
    }

    // 1. JOIN DOCUMENT ROOM
    socket.on('join-document', async ({ documentId }) => {
      try {
        const userId = socket.user?.id;

        if (!userId) {
          return socket.emit('error', 'Authentication error: Invalid session credentials');
        }

        // Verify document exists and requester has access rights.
        const doc = await Document.findById(documentId);
        if (!doc) {
          return socket.emit('error', 'Document not found');
        }

        const isOwner = doc.owner.toString() === userId.toString();
        const isCollaborator = doc.collaborators.some(
          (c) => c.user.toString() === userId.toString()
        );

        if (!isOwner && !isCollaborator) {
          return socket.emit('error', 'Access denied: You are not authorized to view this document');
        }

        // Add the socket to the document's room channel.
        socket.join(documentId);
        socket.roomId = documentId; // Bind room reference to the socket instance

        // Look up detailed user profile for caret labeling
        const userObj = await User.findById(userId).select('name email');
        if (!userObj) {
          return socket.emit('error', 'User details not found');
        }

        // Add user profile to in-memory active list
        if (!activeUsers.has(documentId)) {
          activeUsers.set(documentId, []);
        }
        const roomUsers = activeUsers.get(documentId);

        // Remove any previous duplicate sockets for this user ID to keep lists clean
        const cleanUsers = roomUsers.filter((u) => u.userId !== userId.toString());
        
        const userColor = getUserColor(userObj.email);
        cleanUsers.push({
          socketId: socket.id,
          userId: userId.toString(),
          name: userObj.name,
          email: userObj.email,
          color: userColor,
        });
        activeUsers.set(documentId, cleanUsers);

        // Broadcast the active users list to everyone in the room.
        io.to(documentId).emit('active-users-updated', cleanUsers);

        // Send the current saved document content back to the client.
        socket.emit('load-document', doc.content);

        console.log(`[Socket] User ${userObj.name} joined room: ${documentId}`);
      } catch (error) {
        console.error('Socket join-document error:', error);
        socket.emit('error', 'Failed to join document room');
      }
    });

    // 2. RECEIVE AND BROADCAST YJS STATE UPDATE VECTORS
    // Executed whenever a client makes a keystroke.
    socket.on('document-change', (update) => {
      if (socket.roomId) {
        // socket.to(room) sends to all clients in the room EXCEPT the sender.
        // This is important: the sender has already applied the edit locally;
        // sending it back to them would duplicate inputs.
        socket.to(socket.roomId).emit('document-change', update);
      }
    });

    // 3. RECEIVE AND BROADCAST COLLABORATOR CURSOR UPDATES (YJS AWARENESS PROTOCOL)
    socket.on('awareness-change', (update) => {
      if (socket.roomId) {
        // Broadcast cursor movement vectors to other collaborators.
        socket.to(socket.roomId).emit('awareness-change', update);
      }
    });

    // 4. DEBOUNCED DATABASE SAVE
    // Receives full text document content and triggers a debounced save to MongoDB.
    socket.on('save-document', (content) => {
      if (socket.roomId && socket.user?.id) {
        debouncedSave(socket.roomId, content, socket.user.id, socket);
      }
    });

    // 5. SYNCHRONIZE TITLE RENAMES
    socket.on('title-update', async (title) => {
      if (socket.roomId) {
        try {
          // Update database document title
          await Document.findByIdAndUpdate(socket.roomId, { title: title.trim() });
          // Broadcast the renamed title to all other active editors in the room
          socket.to(socket.roomId).emit('title-update', title);
        } catch (error) {
          console.error('Title sync error:', error);
        }
      }
    });

    // 6. CLEAN UP CLIENT LEAVING (DISCONNECTING)
    // Runs when a client tab closes or they navigate away.
    socket.on('disconnect', () => {
      const documentId = socket.roomId;
      
      if (documentId && activeUsers.has(documentId)) {
        const roomUsers = activeUsers.get(documentId);
        // Filter out this client's socket ID from active list.
        const remainingUsers = roomUsers.filter((u) => u.socketId !== socket.id);
        
        if (remainingUsers.length > 0) {
          activeUsers.set(documentId, remainingUsers);
          // Broadcast the updated collaborators list to remaining editors.
          io.to(documentId).emit('active-users-updated', remainingUsers);
        } else {
          // If no one is left, delete the room list from memory.
          activeUsers.delete(documentId);
        }
        console.log(`[Socket] Client disconnected: ${socket.id} (Left room: ${documentId})`);
      }
    });
  });
};

module.exports = registerDocumentSocket;
