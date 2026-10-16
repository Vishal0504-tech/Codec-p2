// components/Navbar.jsx - Modern Top Navigation Bar
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="w-full select-none z-30">
      {/* TOP APP BAR - ROYAL BLUE BRAND BAR */}
      <div className="bg-[#3366FF] text-white px-4 sm:px-6 h-14 flex items-center justify-between shadow-xs">
        {/* Left: Brand Icon, Name & Navigation */}
        <div className="flex items-center space-x-6">
          <Link to="/dashboard" className="flex items-center space-x-2.5 group">
            {/* Pill Logo */}
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <span className="text-[#3366FF] font-extrabold text-base leading-none">S</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight group-hover:opacity-95">
            SyncWrite
            </span>
          </Link>

          {/* Documents Direct Link */}
          {user && (
            <Link
              to="/dashboard"
              className="text-white/90 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors flex items-center space-x-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Documents</span>
            </Link>
          )}

          {/* Search Bar */}
          
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-3">
          {user ? (
            <>
              {/* User Avatar Circle */}
              <div className="flex items-center space-x-2 pl-2">
                <div
                  className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold text-white shadow-xs"
                  title={user.email}
                >
                  {user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <span className="hidden lg:inline text-xs font-medium text-white/90">
                  {user.name}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="text-xs bg-white/10 hover:bg-red-500/80 text-white px-2.5 py-1.5 rounded-md transition-colors font-medium ml-1 cursor-pointer"
                title="Log out"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="text-white/90 hover:text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-white text-[#3366FF] hover:bg-white/90 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
