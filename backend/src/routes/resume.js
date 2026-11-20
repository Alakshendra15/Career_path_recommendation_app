import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { loadProfile } from './user.js';

const upload = multer({
  storage: multer.memoryStorage(), // PDFs are forwarded to the ML service, never written to disk
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(isPdf ? null : new AppError(400, 'Only PDF files are supported', 'INVALID_FILE'), isPdf);
  },
});

export function resumeRoutes({ pool, ml }) {
  const router = Router();

  // POST /resume            -> parse and return extracted skills
  // POST /resume?merge=true -> also add the extracted skills to the student's profile
  router.post('/', upload.single('resume'), async (req, res) => {
    if (!req.file) throw new AppError(400, 'Attach a PDF in the "resume" field', 'NO_FILE');
    const parsed = await ml.analyzeResume(req.file.buffer, req.file.originalname);

    // Contact details are never kept or sent back: the app does not use them, and the resume text is not stored.
    const { email: _email, phone: _phone, text_preview: _preview, ...forApp } = parsed;

    // A resume read only to pre-fill onboarding (no merge) is not saved at all. The profile only changes when the student confirms it.
    let id = null;
    let merged = false;
    if (req.query.merge === 'true') {
      id = randomUUID();
      const kept = { skills: parsed.skills, education: parsed.education, has_projects: parsed.has_projects, has_internship: parsed.has_internship };
      try {
        await pool.query('INSERT INTO resumes (id, user_id, filename, parsed) VALUES ($1, $2, $3, $4)', [
          id,
          req.userId,
          req.file.originalname,
          JSON.stringify(kept),
        ]);
      } catch (err) {
        if (err.code === '23503' || /foreign key/i.test(err.message ?? '')) throw new AppError(401, 'Account no longer exists', 'UNAUTHORIZED'); // valid token, deleted user
        throw err;
      }

      const profile = await loadProfile(pool, req.userId);
      if (profile) {
        const have = new Set(profile.skills.map((s) => s.toLowerCase()));
        const skills = [...profile.skills, ...parsed.skills.filter((s) => !have.has(s))].slice(0, 100);
        await pool.query('UPDATE student_profiles SET skills = $1, updated_at = now() WHERE user_id = $2', [
          JSON.stringify(skills),
          req.userId,
        ]);
        merged = true;
      }
    }
    res.json({ id, ...forApp, merged });
  });

  return router;
}
