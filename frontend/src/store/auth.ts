import { create } from 'zustand';
import { api, setUnauthorizedHandler } from '../lib/api';
import { clearToken, getToken, saveToken } from '../lib/session';
import type { AuthUser, Profile } from '../types';
import { useAnalysis } from './analysis';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  profile: Profile | null;
  /** Shown on the welcome screen, e.g. when the server could not be reached at launch. */
  notice: string | null;
  clearNotice: () => void;
  /** Restore a saved session on app launch. */
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Reload user + profile from the server (after onboarding, resume merge, ...). */
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  profile: null,
  notice: null,
  clearNotice: () => set({ notice: null }),

  async init() {
    const token = await getToken();
    if (!token) return set({ status: 'signedOut' });
    try {
      const data = await api.profile();
      set({ status: 'signedIn', user: { id: data.id, name: data.name, email: data.email }, profile: data.profile });
    } catch (err) {
      // an expired token already signs out via the 401 handler; a network error keeps the session for next time
      if ((err as { status?: number }).status === 401) await get().logout();
      else set({ status: 'signedOut', notice: 'We could not reach the server. Check your connection and the backend, then log in again.' });
    }
  },

  async login(email, password) {
    const { user, token } = await api.login({ email, password });
    await saveToken(token);
    // Load the profile BEFORE marking the user signed in. Otherwise a failed profile request would leave an existing user
    // "signed in" with no profile, and the app would send them through onboarding as if they were new.
    try {
      const data = await api.profile();
      set({ status: 'signedIn', user: { id: data.id, name: data.name, email: data.email }, profile: data.profile, notice: null });
    } catch (err) {
      await clearToken();
      throw err;
    }
  },

  async signup(name, email, password) {
    const { user, token } = await api.signup({ name, email, password });
    await saveToken(token);
    set({ user, profile: null, status: 'signedIn' });
  },

  async logout() {
    await clearToken();
    useAnalysis.getState().reset();
    set({ status: 'signedOut', user: null, profile: null });
  },

  async refresh() {
    const data = await api.profile();
    set({ user: { id: data.id, name: data.name, email: data.email }, profile: data.profile });
  },
}));

setUnauthorizedHandler(() => {
  if (useAuth.getState().status === 'signedIn') void useAuth.getState().logout();
});
