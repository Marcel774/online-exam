import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from '../services/api';
import type { User } from '../types';

interface SetupStatus {
  initialized: boolean;
  requiresPasscode: boolean;
  allowSelfRegistration: boolean;
  institutionName: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  setupStatus: SetupStatus | null;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    classId?: string;
  }) => Promise<User>;
  bootstrapWorkspace: (payload: {
    name: string;
    email: string;
    password: string;
    bootstrapPasscode?: string;
    includeSampleData: boolean;
  }) => Promise<{ user: User; sampleAccounts: { role: string; email: string; name: string }[] }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSetupStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);

  const refreshSetupStatus = useCallback(async () => {
    try {
      const { data } = await api.get<SetupStatus>('/auth/setup-status');
      setSetupStatus(data);
    } catch {
      // ignore setup status failure during offline transient
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
      setAuthToken(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [statusRes, meRes] = await Promise.allSettled([
          api.get<SetupStatus>('/auth/setup-status'),
          api.get<{ user: User }>('/auth/me'),
        ]);
        if (!active) return;
        if (statusRes.status === 'fulfilled') {
          setSetupStatus(statusRes.value.data);
        }
        if (meRes.status === 'fulfilled') {
          setUser(meRes.value.data.user);
        } else {
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      classId?: string;
    }) => {
      const { data } = await api.post<{ token: string; user: User }>('/auth/register', payload);
      setAuthToken(data.token);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const bootstrapWorkspace = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      bootstrapPasscode?: string;
      includeSampleData: boolean;
    }) => {
      const { data } = await api.post<{
        token: string;
        user: User;
        sampleAccounts: { role: string; email: string; name: string }[];
      }>('/auth/bootstrap', payload);
      setAuthToken(data.token);
      setUser(data.user);
      setSetupStatus((prev) => (prev ? { ...prev, initialized: true } : prev));
      return { user: data.user, sampleAccounts: data.sampleAccounts };
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setupStatus,
        login,
        register,
        bootstrapWorkspace,
        logout,
        refreshUser,
        refreshSetupStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
