import { create } from 'zustand';
import { ApiError, api } from '../lib/api';
import type { CareerAnalysis } from '../types';

interface AnalysisState {
  data: CareerAnalysis | null;
  generatedAt: string | null;
  loading: boolean;
  error: string | null;
  /** 'ONBOARDING_REQUIRED' etc, so a screen can react without parsing the message */
  errorCode: string | null;
  load: (refresh?: boolean) => Promise<void>;
  reset: () => void;
}

// bumped by reset(): a response that arrives after a logout / reset belongs to the previous session and is dropped
let epoch = 0;
let inflight: Promise<void> | null = null;

export const useAnalysis = create<AnalysisState>((set, get) => ({
  data: null,
  generatedAt: null,
  loading: false,
  error: null,
  errorCode: null,

  async load(refresh = false) {
    if (get().loading) {
      if (!refresh) return;
      await inflight; // an explicit refresh (e.g. after a resume merge) must not be lost: run it once the current load ends
      if (get().loading) return;
    }
    const mine = epoch;
    set({ loading: true, error: null, errorCode: null });
    inflight = (async () => {
      try {
        const res = await api.analysis(refresh);
        if (mine === epoch) set({ data: res.data, generatedAt: res.generatedAt, loading: false });
      } catch (err) {
        if (mine !== epoch) return;
        const e = err instanceof ApiError ? err : new ApiError(0, 'Something went wrong');
        set({ loading: false, error: e.message, errorCode: e.code ?? null });
      }
    })();
    await inflight;
  },

  reset: () => {
    epoch++;
    inflight = null;
    set({ data: null, generatedAt: null, loading: false, error: null, errorCode: null });
  },
}));
