// context/AuthContext.jsx - Global Authentication Context and Hook
import { createContext, useContext } from 'react';

// 1. CREATE CONTEXT
export const AuthContext = createContext(null);

// 2. EXPORT A CUSTOM HOOK FOR CONSUMING AUTH CONTEXT EASILY
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

