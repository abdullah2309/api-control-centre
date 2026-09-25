import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Workspace } from '../types';
import { api } from '../api';

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (params: { email: string; password: string; firstName: string; workspaceName?: string }) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserData = async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setWorkspace(data.currentWorkspace);
    } catch {
      setUser(null);
      setWorkspace(null);
    }
  };

  useEffect(() => {
    async function initAuth() {
      const token = localStorage.getItem('statusmith_token');
      if (token) {
        try {
          await refreshUserData();
          setIsLoading(false);
          return;
        } catch {
          // Token invalid, fall through to demo login
        }
      }

      // Auto-authenticate as default demo user for instant live preview
      try {
        const res = await api.login('demo@statusmith.com', 'password123');
        setUser(res.user);
        setWorkspace(res.workspace);
      } catch (err) {
        console.error('Failed to auto-authenticate demo user:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, pass);
      setUser(res.user);
      setWorkspace(res.workspace);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (params: { email: string; password: string; firstName: string; workspaceName?: string }) => {
    setIsLoading(true);
    try {
      const res = await api.register(params);
      setUser(res.user);
      setWorkspace(res.workspace);
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async () => {
    return login('demo@statusmith.com', 'password123');
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setWorkspace(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        isLoading,
        login,
        register,
        loginDemo,
        logout,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
