function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  return value;
}

export function loadConfig(overrides = {}) {
  const env = process.env;
  const config = {
    port: Number(env.PORT ?? 4000),
    nodeEnv: env.NODE_ENV ?? 'development',
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '7d',
    mlServiceUrl: (env.ML_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
    mlTimeoutMs: Number(env.ML_TIMEOUT_MS ?? 20000),
    analysisCacheDays: Number(env.ANALYSIS_CACHE_DAYS ?? 7),
    // bump this when the ML knowledge base or scoring changes, to invalidate cached results
    // Manual salt for the cache key. Not needed for model/knowledge-base changes: the ML service reports a fingerprint of
    // its data and model files, and a cached analysis from a different fingerprint is recomputed automatically.
    mlVersion: env.ML_VERSION ?? '3',
    authRateLimit: Number(env.AUTH_RATE_LIMIT ?? 20),
    // per signed-in user, per 15 minutes: both routes run the ML service
    aiRateLimit: Number(env.AI_RATE_LIMIT ?? 60),
    resumeRateLimit: Number(env.RESUME_RATE_LIMIT ?? 20),
    // set TRUST_PROXY (e.g. 1) behind a reverse proxy so rate limits see each client's IP; CORS_ORIGINS=a.com,b.com to restrict browsers
    trustProxy: env.TRUST_PROXY ? (Number.isNaN(Number(env.TRUST_PROXY)) ? env.TRUST_PROXY : Number(env.TRUST_PROXY)) : false,
    corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : null,
    ...overrides,
  };
  if (!config.jwtSecret) config.jwtSecret = required('JWT_SECRET');
  if (config.jwtSecret.length < 16) throw new Error('JWT_SECRET must be at least 16 characters');
  return config;
}
