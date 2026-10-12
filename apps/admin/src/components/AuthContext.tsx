'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  UserRole,
  Permission,
  canAccessModule,
  hasPermission,
  getDefaultModuleForRole,
  ROLE_DISPLAY_NAMES,
} from '@calyvia/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  department?: string;
  jobTitle?: string;
}

export interface RequestAccessData {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  jobTitle: string;
  justification: string;
  requestedRole?: string;
  password?: string;
}

export interface UpdateProfileData {
  fullName?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
}

interface StoredSession {
  user: AuthenticatedUser;
  token: string;
  refreshToken?: string;
  expiresAt: number;
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<{ success: boolean; message?: string; error?: string }>;
  requestAccess: (data: RequestAccessData) => Promise<{ success: boolean; message?: string; error?: string }>;
  canAccess: (moduleId: string) => boolean;
  hasPerm: (permission: Permission) => boolean;
  defaultModule: string;
}

const defaultAuthValue: AuthContextType = {
  user: null,
  token: null,
  isLoading: true,
  login: async () => ({ success: false, error: 'Auth context not initialized' }),
  logout: async () => {},
  updateProfile: async () => ({ success: false, error: 'Auth context not initialized' }),
  requestAccess: async () => ({ success: false, error: 'Auth context not initialized' }),
  canAccess: () => false,
  hasPerm: () => false,
  defaultModule: 'dashboard',
};

const AuthContext = createContext<AuthContextType>(defaultAuthValue);

const STORAGE_KEY = 'calyvia_auth_session';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount and verify cryptographic validity
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (!stored) {
          if (isMounted) setIsLoading(false);
          return;
        }

        const session: StoredSession = JSON.parse(stored);
        if (!session || !session.user || !session.token) {
          localStorage.removeItem(STORAGE_KEY);
          if (isMounted) setIsLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

        // Legacy staging tokens are never trusted: purge and require real authentication
        if (session.token === 'staging-auth-token-local') {
          localStorage.removeItem(STORAGE_KEY);
          if (isMounted) {
            setUser(null);
            setToken(null);
            setIsLoading(false);
          }
          return;
        }

        // Verify token validity with backend /auth/me
        try {
          const res = await fetch(`${apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${session.token}` },
          });

          if (res.ok) {
            if (isMounted) {
              setUser(session.user);
              setToken(session.token);
            }
          } else if (res.status === 401 && session.refreshToken) {
            // Access token expired, attempt token refresh using refresh token
            const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: session.refreshToken }),
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              session.token = refreshData.accessToken;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
              if (isMounted) {
                setUser(session.user);
                setToken(refreshData.accessToken);
              }
            } else {
              localStorage.removeItem(STORAGE_KEY);
              if (isMounted) {
                setUser(null);
                setToken(null);
              }
            }
          } else {
            localStorage.removeItem(STORAGE_KEY);
            if (isMounted) {
              setUser(null);
              setToken(null);
            }
          }
        } catch {
          // Fail closed: without live server verification no cached session is trusted
          localStorage.removeItem(STORAGE_KEY);
          if (isMounted) {
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        console.warn('Failed to restore session from localStorage:', err);
        localStorage.removeItem(STORAGE_KEY);
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Proactive token refresh interval (refreshes 2 minutes before the 15-minute token expires)
  useEffect(() => {
    if (!token || token === 'staging-auth-token-local') return;

    const interval = setInterval(async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const session: StoredSession = JSON.parse(stored);
        if (!session.refreshToken) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
        const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          session.token = refreshData.accessToken;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          setToken(refreshData.accessToken);
        }
      } catch (err) {
        console.warn('Proactive token refresh attempt deferred:', err);
      }
    }, 10 * 60 * 1000); // Check every 10 minutes

    return () => clearInterval(interval);
  }, [token]);

  const login = async (
    email: string,
    password: string,
    rememberMe = true,
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsLoading(false);
        return {
          success: false,
          error: data.message || 'Authentication failed. Please verify your institutional credentials.',
        };
      }

      if (data && data.user && data.tokens) {
        const authUser: AuthenticatedUser = {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.fullName,
          role: data.user.role as UserRole,
          department: data.user.department,
          jobTitle: data.user.jobTitle,
        };

        const session: StoredSession = {
          user: authUser,
          token: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          expiresAt: rememberMe
            ? Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days persistent
            : Date.now() + 24 * 60 * 60 * 1000,   // 24 hours standard
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setUser(authUser);
        setToken(data.tokens.accessToken);
        setIsLoading(false);
        return { success: true };
      }

      setIsLoading(false);
      return { success: false, error: 'Malformed authentication response received.' };
    } catch (err: any) {
      console.warn('Primary API authentication request failed:', err);
      setIsLoading(false);
      return {
        success: false,
        error: 'Unable to reach Calyvia authentication service. Please check network connectivity or contact IT.',
      };
    }
  };

  const logout = async (): Promise<void> => {
    const currentToken = token;
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);

    if (currentToken && currentToken !== 'staging-auth-token-local') {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
        await fetch(`${apiUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
        });
      } catch (err) {
        console.warn('Backend logout notification error:', err);
      }
    }
  };

  const requestAccess = async (_data: RequestAccessData): Promise<{ success: boolean; message?: string; error?: string }> => {
    return {
      success: false,
      error: 'Self-service staff account registration is disabled. Staff accounts and credentials must be provisioned directly by an authorized Facility Administrator.',
    };
  };

  const updateProfile = async (
    data: UpdateProfileData,
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

    try {
      if (token && token !== 'staging-auth-token-local') {
        const res = await fetch(`${apiUrl}/auth/profile`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          const body = await res.json();
          const updatedUser: AuthenticatedUser = {
            ...user,
            fullName: data.fullName !== undefined ? data.fullName : user.fullName,
            phone: data.phone !== undefined ? data.phone : user.phone,
            department: data.department !== undefined ? data.department : user.department,
            jobTitle: data.jobTitle !== undefined ? data.jobTitle : user.jobTitle,
          };

          // Persist to localStorage
          try {
            const rawSession = localStorage.getItem(STORAGE_KEY);
            if (rawSession) {
              const session: StoredSession = JSON.parse(rawSession);
              session.user = updatedUser;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
            }
          } catch {}

          setUser(updatedUser);
          return { success: true, message: body.message || 'Profile updated successfully' };
        } else {
          const errBody = await res.json().catch(() => ({}));
          return {
            success: false,
            error: errBody.message || 'Failed to save profile changes.',
          };
        }
      } else {
        // Offline / local staging mode update
        const updatedUser: AuthenticatedUser = {
          ...user,
          fullName: data.fullName !== undefined ? data.fullName : user.fullName,
          phone: data.phone !== undefined ? data.phone : user.phone,
          department: data.department !== undefined ? data.department : user.department,
          jobTitle: data.jobTitle !== undefined ? data.jobTitle : user.jobTitle,
        };

        try {
          const rawSession = localStorage.getItem(STORAGE_KEY);
          if (rawSession) {
            const session: StoredSession = JSON.parse(rawSession);
            session.user = updatedUser;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          }
        } catch {}

        setUser(updatedUser);
        return { success: true, message: 'Profile updated successfully (local session)' };
      }
    } catch (err: any) {
      console.warn('Profile update network error:', err);
      // Resilient fallback: update local session state
      const updatedUser: AuthenticatedUser = {
        ...user,
        fullName: data.fullName !== undefined ? data.fullName : user.fullName,
        phone: data.phone !== undefined ? data.phone : user.phone,
        department: data.department !== undefined ? data.department : user.department,
        jobTitle: data.jobTitle !== undefined ? data.jobTitle : user.jobTitle,
      };

      try {
        const rawSession = localStorage.getItem(STORAGE_KEY);
        if (rawSession) {
          const session: StoredSession = JSON.parse(rawSession);
          session.user = updatedUser;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        }
      } catch {}

      setUser(updatedUser);
      return { success: true, message: 'Profile updated and saved to session.' };
    }
  };

  const canAccess = useCallback(
    (moduleId: string): boolean => {
      if (!user) return false;
      return canAccessModule(user.role, moduleId);
    },
    [user],
  );

  const hasPerm = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      return hasPermission(user.role, permission);
    },
    [user],
  );

  const defaultModule = user ? getDefaultModuleForRole(user.role) : 'dashboard';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        updateProfile,
        requestAccess,
        canAccess,
        hasPerm,
        defaultModule,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  return context || defaultAuthValue;
};
