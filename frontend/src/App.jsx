// App.jsx - Main Application Component & Router Configuration

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import our custom authentication provider wrapper.
import { AuthProvider } from './context/AuthProvider';

// Import reusable layout and protection components.
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';

// Import our page-level view components.
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DocumentEditor from './pages/DocumentEditor';

function App() {
  return (
    // Wrap the entire application in the AuthProvider.
    // This makes the logged-in user state and functions (login, logout, register) accessible to all nested routes.
    <AuthProvider>
      <BrowserRouter>
        {/* The Navbar component displays on every page and adapts based on the active user session */}
        <Navbar />

        {/* Define the main routing switchboard for the single-page application */}
        <Routes>
          {/* Public Auth Routes: Accessible by anyone, redirects handles login submission */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes: Locked by PrivateRoute. Users trying to visit without a token are redirected to /login */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/document/:id"
            element={
              <PrivateRoute>
                <DocumentEditor />
              </PrivateRoute>
            }
          />


          {/* Root Fallback Route: Redirects any traffic on "/" to "/dashboard", which then redirects to "/login" if not authenticated */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
