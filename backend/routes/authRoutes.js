// routes/authRoutes.js - Authentication Route Definitions

// Express is required to initialize a Router instance.
const express = require('express');
const router = express.Router();

// Import controller functions for registration and login.
const { register, login } = require('../controllers/authController');

// 1. REGISTRATION ROUTE
// Maps a POST request to "/api/auth/register" directly to the 'register' controller logic.
router.post('/register', register);

// 2. LOGIN ROUTE
// Maps a POST request to "/api/auth/login" directly to the 'login' controller logic.
router.post('/login', login);

// Export the router configuration so we can register it inside our main server.js file.
module.exports = router;
