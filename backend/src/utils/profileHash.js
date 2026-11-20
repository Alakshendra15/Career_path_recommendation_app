import { createHash } from 'node:crypto';

const norm = (list = []) => [...new Set(list.map((s) => s.trim().toLowerCase()))].sort();

/** Hash of only the inputs the ML service uses, so unrelated edits (e.g. city) don't invalidate the cache. */
export function profileHash(profile, weeklyHours, mlVersion) {
  const payload = {
    v: mlVersion,
    skills: norm(profile.skills),
    interests: norm(profile.interests),
    techStack: norm(profile.techStack),
    experienceType: profile.experienceType ?? null,
    weeklyHours,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
