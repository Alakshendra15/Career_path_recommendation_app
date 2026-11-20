import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../utils/errors.js';

export function notFound(_req, _res, next) {
  next(new AppError(404, 'Route not found', 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = 500;
  let message = 'Something went wrong';
  let code;

  if (err instanceof ZodError) {
    status = 400;
    message = err.issues[0]?.message ?? 'Invalid request';
    code = 'VALIDATION_ERROR';
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB' : 'Invalid file upload';
  } else if (err instanceof AppError) {
    ({ status, message, code } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  } else {
    console.error(err);
  }

  res.status(status).json(code ? { error: message, code } : { error: message });
}
