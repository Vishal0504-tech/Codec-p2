// context/AuthContext.jsx - Global Authentication State Provider

// Import core React hooks:
// createContext initializes a context namespace.
// useState manages state changes.
// useEffect runs side effects (like checking localStorage on launch).
// useContext lets components subscribe to context values.
import React, { createContext, useState, useEffect, useContext } from 'react';

// Import our custom Axios client instance.
import api from '../services/api';

// 1. CREATE CONTEXT
const AuthContext = createContext(null);

// 2. EXPORT THE PROVIDER COMPONENT
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Synchronize authentication status when the provider component loads.
  useEffect(() => {
    const initializeAuth = () => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');

      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }
      setLoading(false); // Stop rendering loading states
    };

    initializeAuth();
  }, []);

  /**
   * Register a new account.
   * @param {string} name - Display name of the user.
   * @param {string} email - Login email.
   * @param {string} password - Login password.
   */
  const register = async (name, email, password) => {
    try {
      const response = await api.post('/auth/register', { name, email, password });
      const { token: receivedToken, user: receivedUser } = response.data;

      // Save credentials in browser cache
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));

      // Update provider states
      setToken(receivedToken);
      setUser(receivedUser);
      return { success: true };
    } catch (error) {
      console.error('Registration API error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to register account';
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Login an existing user.
   * @param {string} email - Login email.
   * @param {string} password - Login password.
   */
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: receivedToken, user: receivedUser } = response.data;

      // Save credentials in browser cache
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));

      // Update provider states
      setToken(receivedToken);
      setUser(receivedUser);
      return { success: true };
    } catch (error) {
      console.error('Login API error:', error);
      const errorMessage = error.response?.data?.message || 'Invalid email or password';
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Log out the active session.
   */
  const logout = () => {
    // Clear localStorage values
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Wipe provider states
    setToken(null);
    setUser(null);
  };

  // Provide state data and auth functions to child components.
  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. EXPORT A CUSTOM HOOK FOR CONSUMING AUTH CONTEXT EASILY
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
