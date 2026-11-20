import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { signToken, requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { loginSchema, signupSchema } from '../validators/schemas.js';

const BCRYPT_COST = 12;
// compared against when the email is unknown, so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

const publicUser = (row) => ({ id: row.id, name: row.name, email: row.email });

export function authRoutes({ pool, config }) {
  const router = Router();

  router.post('/signup', async (req, res) => {
    const { name, email, password } = signupSchema.parse(req.body);
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    try {
      await pool.query('INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)', [
        id,
        name,
        email,
        passwordHash,
      ]);
    } catch (err) {
      if (err.code === '23505') throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
      throw err;
    }
    res.status(201).json({ user: { id, name, email }, token: signToken(id, config) });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { rows } = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
    const user = rows[0];
    const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    res.json({ user: publicUser(user), token: signToken(user.id, config) });
  });

  // lets the app validate a stored token on launch
  router.get('/me', requireAuth(config), async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) throw new AppError(401, 'Account no longer exists', 'UNAUTHORIZED');
    res.json({ user: publicUser(rows[0]) });
  });

  return router;
}
