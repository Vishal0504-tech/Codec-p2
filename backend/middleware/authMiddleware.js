// middleware/authMiddleware.js - JWT Authentication Security Middleware

// Import jsonwebtoken to verify the signature of incoming client request tokens.
const jwt = require('jsonwebtoken');

// Import the User database model to confirm the user exists in our database.
const User = require('../models/User');

/**
 * Express middleware to protect private API endpoints.
 * It checks for a valid JWT signature and loads the corresponding user profile.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. CHECK HEADER: HTTP request headers usually contain authorization details.
  // We look for the 'Authorization' header and check if it starts with 'Bearer'.
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract the raw token string by removing the "Bearer " prefix (which is 7 characters + space).
      // Example header: "Bearer eyJhbGciOiJIUzI1NiIsInR..." -> token is "eyJhbGciOiJIUzI1NiIsInR..."
      token = req.headers.authorization.split(' ')[1];

      // 2. VERIFY JWT: Decode the token using the secret signature key.
      // If the token is expired or tampered with, jwt.verify will throw an error and enter the catch block.
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fallback_secret_key_for_jwt_development'
      );

      // 3. RETRIEVE USER: Find the matching user in the database.
      // We exclude the password hash field ('-password') from the query results for safety.
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user profile not found' });
      }

      // 4. CONTINUE: Call next() to transfer execution control to the actual controller function.
      next();
    } catch (error) {
      console.error('JWT verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token signature verification failed' });
    }
  }

  // If no Bearer token was found in the authorization header, block the request.
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token signature provided' });
  }
};

module.exports = { protect };
