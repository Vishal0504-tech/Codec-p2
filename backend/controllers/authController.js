// controllers/authController.js - Authentication Handlers (Register & Login)

// Import the User mongoose model to interact with the users collection in the database.
const User = require('../models/User');

// bcryptjs is used to hash passwords so they are never stored in plain text.
const bcrypt = require('bcryptjs');

// jsonwebtoken (JWT) is used to create secure, signed tokens containing user info.
const jwt = require('jsonwebtoken');

/**
 * Helper function to generate a JWT token signed with the user's database ID.
 * @param {string} userId - The unique ID of the user from MongoDB.
 * @returns {string} - The signed JSON Web Token.
 */
const generateToken = (userId) => {
  // Sign a new token containing the user's ID as payload.
  // We use the secret key from environment variables to sign the token.
  // The token will automatically expire after 30 days.
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fallback_secret_key_for_jwt_development',
    { expiresIn: '30d' }
  );
};

/**
 * Register a new user.
 * ROUTE: POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. INPUT VALIDATION: Ensure all fields are filled
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields (name, email, password)' });
    }

    // 2. PASSWORD STRENGTH VALIDATION: Minimum 6 characters
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // 3. DUPLICATE CHECK: Verify if email is already registered in our database
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'A user with that email already exists' });
    }

    // 4. BCRYPT HASHING: Hash the user's password before writing it to MongoDB.
    // '10' is the salt rounds. It controls the computational cost of hashing (strength vs speed).
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. DATABASE SAVE: Create the new user document with the hashed password
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword, // Store ONLY the hashed password
    });

    // 6. GENERATE JWT: Create a token so the user is logged in automatically after registration
    const token = generateToken(newUser._id);

    // 7. RESPOND: Return the user's info (without the password) and the token to the client
    return res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server error during user registration' });
  }
};

/**
 * Login an existing user.
 * ROUTE: POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. INPUT VALIDATION: Ensure email and password are provided
    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter email and password' });
    }

    // 2. USER LOOKUP: Find the user by their email in MongoDB
    // We explicitly request the document to see if it exists
    const user = await User.findOne({ email });
    if (!user) {
      // Security Tip: Do not reveal whether the email or password was wrong to prevent email guessing attacks.
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // 3. PASSWORD VERIFICATION: Compare the plain-text password from the login form with the hashed password in MongoDB.
    // bcrypt.compare takes the plain-text password, hashes it using the same algorithm, and checks if it matches the stored hash.
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // 4. GENERATE JWT: Create a login session token
    const token = generateToken(user._id);

    // 5. RESPOND: Return the user info and the token to the client
    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during user login' });
  }
};
