import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  AnalysisResponse,
  AuthUser,
  OnboardingPayload,
  ProfileResponse,
  ResumeResult,
} from '../types';
import { getToken } from './session';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // In Expo Go the dev machine's LAN IP is known, so a real phone reaches the backend with no setup.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_URL = resolveBaseUrl();

// Set by the auth store so any 401 signs the user out.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal });
    // the timeout also covers reading the body: a server that sends headers and then stalls must not hang the app
    text = await res.text();
  } catch (e) {
    const reason = e instanceof Error && e.message ? ` (${e.message})` : '';
    throw new ApiError(0, `Cannot reach the server at ${API_URL}${reason}. Check your connection and that the backend is running.`, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }

  let body: { error?: string; code?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* not JSON (e.g. an HTML error page from a proxy): the status code below decides */
  }
  if (!res.ok) {
    // a 401 on login/signup just means wrong credentials, not an expired session
    if (res.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized?.();
    throw new ApiError(res.status, body.error ?? 'Something went wrong', body.code);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const api = {
  signup: (d: { name: string; email: string; password: string }) =>
    request<{ user: AuthUser; token: string }>('/auth/signup', json('POST', d)),
  login: (d: { email: string; password: string }) =>
    request<{ user: AuthUser; token: string }>('/auth/login', json('POST', d)),
  me: () => request<{ user: AuthUser }>('/auth/me'),
  profile: () => request<ProfileResponse>('/user/profile'),
  saveOnboarding: (d: OnboardingPayload) => request<{ success: true }>('/user/onboarding', json('POST', d)),
  // analysis can take a few seconds the first time (ML model + roadmap)
  analysis: (refresh = false) =>
    request<AnalysisResponse>('/ai/career-analysis', json('POST', { refresh }), 60000),
  uploadResume: async (file: { uri: string; name: string; mimeType?: string }, merge: boolean) => {
    const form = new FormData();
    // React Native's FormData accepts {uri,name,type}; the cast is needed because the DOM typings differ
    form.append('resume', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/pdf' } as unknown as Blob);
    const token = await getToken();
    // XMLHttpRequest, not fetch: Expo's fetch (SDK 54+) rejects {uri} file parts ("Unsupported FormDataPart implementation"),
    // while React Native's XHR reads the file from its uri natively. No Content-Type header: XHR sets the multipart boundary.
    return new Promise<ResumeResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/resume${merge ? '?merge=true' : ''}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.timeout = 60000;
      xhr.onload = () => {
        let body: { error?: string; code?: string } & Partial<ResumeResult> = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON body: fall through to the status handling below */
        }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(body as ResumeResult);
        if (xhr.status === 401 && token) onUnauthorized?.();
        reject(new ApiError(xhr.status, body.error ?? 'Could not read that resume', body.code));
      };
      const fail = (why: string) => () =>
        reject(new ApiError(0, `Cannot reach the server at ${API_URL} (${why}). Check your connection and that the backend is running.`, 'NETWORK'));
      xhr.onerror = fail('network error');
      xhr.ontimeout = fail('timed out');
      xhr.send(form);
    });
  },
};
