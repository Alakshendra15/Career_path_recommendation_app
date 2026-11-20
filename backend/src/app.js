import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import { aiRoutes } from './routes/ai.js';
import { authRoutes } from './routes/auth.js';
import { resumeRoutes } from './routes/resume.js';
import { userRoutes } from './routes/user.js';

/** Builds the Express app. Dependencies are injected so tests can use an in-memory DB and a fake ML client. */
export function createApp({ pool, config, ml }) {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  // native apps send no Origin; this only matters for Expo web / browser testing (restrict it with CORS_ORIGINS in production)
  app.use(cors(config.corsOrigins ? { origin: config.corsOrigins } : undefined));
  app.use(express.json({ limit: '1mb' }));

  // Dev aid: REQUEST_LOG=1 prints every request (method, path, status, ms, client ip) so you can tell whether a phone's call arrived
  if (process.env.REQUEST_LOG === '1') {
    app.use((req, res, next) => {
      const t = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - t}ms from ${req.ip}`));
      res.on('close', () => { if (!res.writableFinished) console.log(`${req.method} ${req.originalUrl} -> ABORTED by client after ${Date.now() - t}ms from ${req.ip}`); });
      next();
    });
  }

  app.get('/health', async (_req, res) => {
    let db = true;
    try {
      await pool.query('SELECT 1');
    } catch {
      db = false;
    }
    const mlUp = await ml.isHealthy();
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db, ml: mlUp });
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later', code: 'RATE_LIMITED' },
  });
  const auth = requireAuth(config);
  const deps = { pool, config, ml };
  // these routes call the ML service, so they are limited per signed-in user (runs after `auth`, which sets req.userId)
  const perUser = (limit) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.userId,
      message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
    });

  app.use('/auth', authLimiter, authRoutes(deps));
  app.use('/user', auth, userRoutes(deps));
  app.use('/ai', auth, perUser(config.aiRateLimit), aiRoutes(deps));
  app.use('/resume', auth, perUser(config.resumeRateLimit), resumeRoutes(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
