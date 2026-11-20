import { Router } from 'express';
import { mapAnalysis } from '../services/careerMapper.js';
import { AppError } from '../utils/errors.js';
import { profileHash } from '../utils/profileHash.js';
import { analysisSchema } from '../validators/schemas.js';
import { loadProfile } from './user.js';

export function aiRoutes({ pool, config, ml }) {
  const router = Router();
  const maxAgeMs = config.analysisCacheDays * 24 * 60 * 60 * 1000;

  router.post('/career-analysis', async (req, res) => {
    const { refresh = false, weeklyHours = 10 } = analysisSchema.parse(req.body ?? {});
    const profile = await loadProfile(pool, req.userId);
    if (!profile?.completed) throw new AppError(400, 'Please complete onboarding first', 'ONBOARDING_REQUIRED');

    const hash = profileHash(profile, weeklyHours, config.mlVersion);
    if (!refresh) {
      const { rows } = await pool.query(
        'SELECT profile_hash, result, generated_at FROM recommendations WHERE user_id = $1',
        [req.userId],
      );
      const cached = rows[0];
      // a result made with a different knowledge base / model is stale even if the profile is unchanged.
      // If the ML service cannot be reached we cannot tell, so the cached result is better than an error.
      const currentVersion = await ml.dataVersion?.();
      const sameData = !currentVersion || cached?.result?.model_version === currentVersion;
      if (cached && sameData && cached.profile_hash === hash && Date.now() - new Date(cached.generated_at).getTime() < maxAgeMs) {
        return res.json({ cached: true, generatedAt: cached.generated_at, data: mapAnalysis(cached.result) });
      }
    }

    const result = await ml.analyze({
      skills: profile.skills,
      interests: profile.interests,
      tech_stack: profile.techStack,
      experience_type: profile.experienceType,
      weekly_hours: weeklyHours,
      top_n: 3,
    });

    const { rows } = await pool.query(
      `INSERT INTO recommendations (user_id, profile_hash, result, generated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE SET profile_hash = EXCLUDED.profile_hash, result = EXCLUDED.result, generated_at = now()
       RETURNING generated_at`,
      [req.userId, hash, JSON.stringify(result)],
    );
    res.json({ cached: false, generatedAt: rows[0].generated_at, data: mapAnalysis(result) });
  });

  return router;
}
