// models/User.js - Mongoose Schema for User accounts

// Mongoose is the library we use to model our MongoDB schemas and talk to the database.
const mongoose = require('mongoose');

// Define the blueprint (Schema) for how user data will be stored in our MongoDB collection.
const userSchema = new mongoose.Schema(
  {
    // The display name of the user.
    // It is required, and trim will auto-remove any leading or trailing whitespace.
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    // The email of the user, used for logging in.
    // Must be unique across all users, converted to lowercase to avoid duplicates, and trimmed.
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      // Simple regex pattern to validate email format before saving.
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    // The hashed password of the user.
    // Required to verify logins. We never store plain text passwords for security reasons.
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    // Timestamp recording when the account was registered.
    // Defaults to the current date/time when the user is created.
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Automatically adds 'createdAt' and 'updatedAt' fields, managed by Mongoose.
    timestamps: true,
  }
);

// Create and export the 'User' model using the schema.
// Mongoose will automatically look for or create a collection named 'users' in MongoDB.
module.exports = mongoose.model('User', userSchema);
