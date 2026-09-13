import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, UserRole } from '../types';
import { DEMO_USERS } from './demoUsers';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (emailOrStaffId: string, password: string) => { success: boolean; error?: string };
  demoLogin: (role: UserRole) => void;
  logout: () => void;
}

const STORAGE_KEY = 'abc_hospital_auth_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY);
      if (savedSession) {
        return JSON.parse(savedSession);
      }
    } catch (e) {
      console.error('Failed to parse auth session from storage', e);
    }
    return null;
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to sync auth session to storage', e);
    }
  }, [user]);

  const login = (emailOrStaffId: string, password: string) => {
    const trimmedInput = emailOrStaffId.trim().toLowerCase();
    
    // Find matching user by email or staffId
    const foundEntry = Object.values(DEMO_USERS).find(
      (u) =>
        u.email.toLowerCase() === trimmedInput ||
        u.staffId.toLowerCase() === trimmedInput
    );

    if (!foundEntry) {
      return { success: false, error: 'User not found. Please check your Email / Staff ID.' };
    }

    if (foundEntry.passwordHash !== password) {
      return { success: false, error: 'Invalid password. Please try again or use a demo account.' };
    }

    // Extract user profile without passwordHash
    const { passwordHash, ...userProfile } = foundEntry;
    userProfile.lastLogin = 'Just now';
    setUser(userProfile);
    return { success: true };
  };

  const demoLogin = (role: UserRole) => {
    const roleUserMap: Record<UserRole, string> = {
      receptionist: 'receptionist@demo.hospital',
      doctor: 'doctor@demo.hospital',
      admin: 'admin@demo.hospital',
    };

    const targetEmail = roleUserMap[role];
    const demoEntry = DEMO_USERS[targetEmail];
    if (demoEntry) {
      const { passwordHash, ...userProfile } = demoEntry;
      userProfile.lastLogin = 'Just now';
      setUser(userProfile);
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing session', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        demoLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
