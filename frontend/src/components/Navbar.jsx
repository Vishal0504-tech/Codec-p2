// components/Navbar.jsx - Top Navigation Bar Component

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Import our custom authentication context hook.
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login'); // Redirect to login page after logout
  };

  return (
    <nav className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand Name */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-xl font-bold tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors duration-200">
              CollabDoc 📝
            </Link>
          </div>

          {/* Navigation Links and Authentication Controls */}
          <div className="flex items-center space-x-4">
            {user ? (
              // Renders if the user is authenticated (logged in)
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-300">
                  Welcome, <strong className="text-white font-medium">{user.name}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow"
                >
                  Logout
                </button>
              </div>
            ) : (
              // Renders if the user is a guest (logged out)
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 shadow-sm hover:shadow"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
