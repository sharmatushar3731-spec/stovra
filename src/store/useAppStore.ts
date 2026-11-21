import { create } from 'zustand';
import { authApi, setMemoryAccessToken } from '../services/api';
import type { User } from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  user: User | null;
  sessionChecked: boolean;
  theme: 'light' | 'dark';
  compareIds: string[];
  toasts: ToastMessage[];
  pendingSandboxOtp: string | null;
  initSession: () => Promise<void>;
  setAuthSession: (user: User, accessToken: string, sandboxOtp?: string | null) => void;
  setUser: (user: User | null) => void;
  clearSandboxOtp: () => void;
  logout: () => Promise<void>;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleCompare: (facilityId: string) => void;
  clearCompare: () => void;
  pushToast: (type: ToastMessage['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('stovra_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDom(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const initialTheme = getInitialTheme();
applyThemeToDom(initialTheme);

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  sessionChecked: false,
  theme: initialTheme,
  compareIds: [],
  toasts: [],
  pendingSandboxOtp: null,

  initSession: async () => {
    try {
      const { data } = await authApi.session();
      if (data.authenticated && data.user && data.accessToken) {
        setMemoryAccessToken(data.accessToken);
        set({ user: data.user, sessionChecked: true });
      } else {
        setMemoryAccessToken(null);
        set({ user: null, sessionChecked: true });
      }
    } catch {
      setMemoryAccessToken(null);
      set({ user: null, sessionChecked: true });
    }
  },

  setAuthSession: (user, accessToken, sandboxOtp = null) => {
    setMemoryAccessToken(accessToken);
    set({ user, sessionChecked: true, pendingSandboxOtp: sandboxOtp });
  },

  setUser: (user) => set({ user }),

  clearSandboxOtp: () => set({ pendingSandboxOtp: null }),

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore network error on logout
    }
    setMemoryAccessToken(null);
    set({ user: null, pendingSandboxOtp: null });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    window.localStorage.setItem('stovra_theme', next);
    applyThemeToDom(next);
    set({ theme: next });
  },

  setTheme: (theme) => {
    window.localStorage.setItem('stovra_theme', theme);
    applyThemeToDom(theme);
    set({ theme });
  },

  toggleCompare: (facilityId) => {
    const curr = get().compareIds;
    if (curr.includes(facilityId)) {
      set({ compareIds: curr.filter((id) => id !== facilityId) });
      return;
    }
    if (curr.length >= 3) {
      get().pushToast('info', 'You can compare up to 3 storage facilities at once.');
      return;
    }
    set({ compareIds: [...curr, facilityId] });
  },

  clearCompare: () => set({ compareIds: [] }),

  pushToast: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4500);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
