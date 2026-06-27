// components/PrivateRoute.jsx - Protected Route Wrapper

import React from 'react';
import { Navigate } from 'react-router-dom';

// Import our authentication context hook to verify user registration state.
import { useAuth } from '../context/AuthContext';

/**
 * Route protection wrapper component.
 * If the user is authenticated, it renders the protected child components.
 * If the user is not authenticated, it redirects them to the login screen.
 */
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // 1. LOADING STATE
  // While the context is verifying localStorage tokens on app mount, display a spinner.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          {/* Tailwind animation spin wrapper representing a loading spinner */}
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-slate-500 text-sm font-medium">Verifying login status...</p>
        </div>
      </div>
    );
  }

  // 2. REDIRECT OR RENDER
  // If the user profile exists in context, render the dashboard page views.
  // Otherwise, use React Router's Navigate component to redirect to '/login'.
  // 'replace' prevents the login redirection from polluting the browser's back button history stack.
  return user ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
