import { AppError } from '../utils/errors.js';

const UNAVAILABLE = new AppError(502, 'Recommendation service is unavailable, please try again shortly', 'ML_UNAVAILABLE');

/** Thin REST client for the FastAPI service. `fetchImpl` is injectable for tests. */
export function createMlClient(config, fetchImpl = fetch) {
  let versionCache = { at: 0, value: null };

  async function call(path, init) {
    let res;
    try {
      res = await fetchImpl(`${config.mlServiceUrl}${path}`, { ...init, signal: AbortSignal.timeout(config.mlTimeoutMs) });
    } catch (err) {
      console.error(`ML service request to ${path} failed:`, err.message);
      throw UNAVAILABLE;
    }
    if (res.ok) return res.json();

    const body = await res.json().catch(() => ({}));
    // 4xx from FastAPI means the input was bad (e.g. unreadable PDF): pass the reason on
    if (res.status >= 400 && res.status < 500) {
      throw new AppError(res.status === 422 ? 422 : 400, typeof body.detail === 'string' ? body.detail : 'Invalid request', 'ML_REJECTED');
    }
    console.error(`ML service ${path} returned ${res.status}`);
    throw UNAVAILABLE;
  }

  return {
    analyze: (payload) =>
      call('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),

    analyzeResume(buffer, filename) {
      const form = new FormData();
      form.append('resume', new Blob([buffer], { type: 'application/pdf' }), filename || 'resume.pdf');
      return call('/resume/analyze', { method: 'POST', body: form });
    },

    /** Fingerprint of the ML service's knowledge base + model, or null if it cannot be reached. Cached for 30 s. */
    async dataVersion() {
      if (Date.now() - versionCache.at < 30_000) return versionCache.value;
      let value = null;
      try {
        const res = await fetchImpl(`${config.mlServiceUrl}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) value = (await res.json()).data_version ?? null;
      } catch {
        /* unreachable: callers fall back to whatever they have cached */
      }
      versionCache = { at: Date.now(), value };
      return value;
    },

    async isHealthy() {
      try {
        const res = await fetchImpl(`${config.mlServiceUrl}/health`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
