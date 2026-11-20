import { Router } from 'express';
import { AppError } from '../utils/errors.js';
import { onboardingSchema } from '../validators/schemas.js';

export const rowToProfile = (r) => ({
  age: r.age,
  education: r.education,
  state: r.state,
  city: r.city,
  skills: r.skills,
  interests: r.interests,
  experienceType: r.experience_type,
  projectTitle: r.project_title,
  techStack: r.tech_stack,
  completed: r.completed,
});

export async function loadProfile(pool, userId) {
  const { rows } = await pool.query('SELECT * FROM student_profiles WHERE user_id = $1', [userId]);
  return rows[0] ? rowToProfile(rows[0]) : null;
}

export function userRoutes({ pool }) {
  const router = Router();

  router.get('/profile', async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) throw new AppError(401, 'Account no longer exists', 'UNAUTHORIZED');
    res.json({ ...rows[0], profile: await loadProfile(pool, req.userId) });
  });

  router.post('/onboarding', async (req, res) => {
    const d = onboardingSchema.parse(req.body);
    // theoretical students have no project, so ignore any project fields they sent
    const practical = d.experienceType === 'practical';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET name = $1, updated_at = now() WHERE id = $2', [d.name, req.userId]);
      await client.query(
        `INSERT INTO student_profiles
           (user_id, age, education, state, city, skills, interests, experience_type, project_title, tech_stack, completed, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,now())
         ON CONFLICT (user_id) DO UPDATE SET
           age = EXCLUDED.age, education = EXCLUDED.education, state = EXCLUDED.state, city = EXCLUDED.city,
           skills = EXCLUDED.skills, interests = EXCLUDED.interests, experience_type = EXCLUDED.experience_type,
           project_title = EXCLUDED.project_title, tech_stack = EXCLUDED.tech_stack, completed = true, updated_at = now()`,
        [
          req.userId,
          d.age,
          d.education,
          d.state,
          d.city,
          JSON.stringify(d.skills),
          JSON.stringify(d.interests),
          d.experienceType,
          practical ? (d.projectTitle ?? null) : null,
          JSON.stringify(practical ? d.techStack : []),
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ success: true });
  });

  return router;
}
