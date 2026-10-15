// pages/Login.jsx - Login Component

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Import our custom authentication hook.
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Form input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI States for feedback
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Input verification check
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard'); // Route user to Dashboard on success
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-100 transition-all duration-300 hover:shadow-xl">
        
        {/* Title Header with Logo */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2.5 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#3366FF] flex items-center justify-center shadow-md">
              <span className="text-white font-extrabold text-xl leading-none">D</span>
            </div>
            <span className="text-slate-900 font-extrabold text-2xl tracking-tight">DocuRocket</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Or{' '}
            <Link to="/register" className="font-semibold text-[#3366FF] hover:text-blue-700 transition-colors">
              create a new account
            </Link>
          </p>
        </div>

        {/* Error Alert Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-500 font-bold">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-input" className="block text-sm font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="email-input"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3366FF] focus:border-[#3366FF] focus:z-10 sm:text-sm transition-all duration-200"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label htmlFor="password-input" className="block text-sm font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password-input"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3366FF] focus:border-[#3366FF] focus:z-10 sm:text-sm transition-all duration-200"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-md text-white bg-[#3366FF] hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3366FF] transition-all duration-200 shadow-md cursor-pointer ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
