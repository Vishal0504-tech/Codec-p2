// server.js - Entry point for the Collaborative Document Editor Backend

// 1. IMPORT REQUIRED MODULES
// dotenv loads environment variables from a .env file into process.env.
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables before importing any config-dependent modules

// express is the standard web framework for Node.js, used to define HTTP routes and middleware.
const express = require('express');

// http is a built-in Node.js module used to create an HTTP server that can be shared between Express and Socket.IO.
const http = require('http');

// cors (Cross-Origin Resource Sharing) is middleware that allows our frontend (running on a different port/domain) to communicate with this backend.
const cors = require('cors');

// mongoose is an Object Data Modeling (ODM) library for MongoDB and Node.js. It helps us manage database connections and schemas.
const mongoose = require('mongoose');

// socket.io is a library that enables real-time, bi-directional, event-based communication between the web browser and the server.
const { Server } = require('socket.io');

// jsonwebtoken (JWT) is used here to secure our Socket.IO connections.
const jwt = require('jsonwebtoken');

// Import authentication HTTP routes.
const authRoutes = require('./routes/authRoutes');

// Import document HTTP routes.
const documentRoutes = require('./routes/documentRoutes');

// Import version history HTTP routes.
const versionRoutes = require('./routes/versionRoutes');

// Import document Socket.IO event handler registry.
const registerDocumentSocket = require('./sockets/documentSocket');

// 2. INITIALIZE EXPRESS APP & HTTP SERVER
const app = express();



// Create an HTTP server using the Express app. 
// Socket.IO cannot run directly on an Express app instance; it needs a standard HTTP server instance.
const server = http.createServer(app);

// 3. CONFIGURE MIDDLEWARE AND DYNAMIC CORS
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed list or is a Vercel deployment domain
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith('.vercel.app');
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

// Express middleware to parse incoming JSON payloads in HTTP requests.
app.use(express.json());

// Register authentication routes with the Express router.
app.use('/api/auth', authRoutes);

// Register document management routes with the Express router.
app.use('/api/documents', documentRoutes);

// Register document version history routes with the Express router.
app.use('/api/documents', versionRoutes);


// 4. DATABASE CONNECTION
// Connect to MongoDB using the URI from the environment variables.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collab_doc_editor';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch((error) => console.error('MongoDB connection error:', error));

// 5. INITIALIZE SOCKET.IO
// Mount Socket.IO onto the HTTP server.
// We must configure CORS separately for Socket.IO so the frontend client can establish a WebSocket connection.
const io = new Server(server, {
  cors: corsOptions
});

// Expose the io instance to the Express app object.
// This allows standard HTTP route controllers (like versionController) to access the WebSocket pipeline to broadcast events.
app.set('io', io);


// 5.1 SOCKET.IO AUTHENTICATION MIDDLEWARE
// Before a client connects via WebSocket, they go through a "handshake" process.
// We use this middleware to verify their JWT token. If the token is invalid or missing, we refuse the connection.
io.use((socket, next) => {
  // Retrieve the token from the connection handshake auth parameter.
  // Standard format: socket.handshake.auth.token
  const token = socket.handshake.auth?.token;

  if (!token) {
    // If no token is provided, reject the connection and pass an error to the client.
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    // Verify the JWT signature.
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret_key_for_jwt_development'
    );
    
    // Attach the verified user payload (which contains their ID) directly to the socket instance.
    // This lets us identify who is sending updates on subsequent socket events.
    socket.user = decoded;
    next(); // Authenticated successfully, allow connection.
  } catch (error) {
    console.error('Socket handshake JWT verification failed:', error.message);
    return next(new Error('Authentication error: Token verification failed'));
  }
});

// 6. DEFINE SOCKET.IO EVENT HANDLERS
// Hook up our modular document real-time collaboration listeners.
registerDocumentSocket(io);


// 7. HTTP BASE ROUTE
// A simple health check route to verify that the Express server is up and running.
app.get('/', (req, res) => {
  res.status(200).json({ status: 'active', message: 'Collaborative Document Editor API is running.' });
});

// 8. START THE SERVER
// Listen on the port specified in .env, falling back to 5000 if not defined.
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});

