import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';

export function signToken(userId, config) {
  return jwt.sign({}, config.jwtSecret, { subject: userId, expiresIn: config.jwtExpiresIn, algorithm: 'HS256' });
}

/** Reads `Authorization: Bearer <token>` (the mobile app has no cookie jar) and sets req.userId. */
export function requireAuth(config) {
  return (req, _res, next) => {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      req.userId = payload.sub;
      next();
    } catch {
      next(new AppError(401, 'Session expired, please log in again', 'UNAUTHORIZED'));
    }
  };
}
