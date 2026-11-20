// Smoke test against the RUNNING stack (real PostgreSQL + real ML service): `npm run smoke`
// Creates a throwaway account, runs signup -> onboarding -> analysis (twice, to check caching), then deletes it.
import assert from 'node:assert/strict';
import { createPool } from '../src/db/pool.js';

const BASE = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
const email = `smoke-${Date.now()}@example.test`;
const pool = createPool(process.env.DATABASE_URL);

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

try {
  const health = await call('/health');
  assert.deepEqual(health.body, { status: 'ok', db: true, ml: true }, 'backend, database and ML service must all be up');

  const signup = await call('/auth/signup', { method: 'POST', body: { name: 'Smoke Test', email, password: 'smoke-test-123' } });
  assert.equal(signup.status, 201, JSON.stringify(signup.body));
  const token = signup.body.token;

  const before = await call('/user/profile', { token });
  assert.equal(before.body.profile, null);

  const onboarding = await call('/user/onboarding', {
    method: 'POST',
    token,
    body: {
      name: 'Smoke Test', age: 22, education: 'postgraduate', state: 'Gujarat', city: 'Ahmedabad',
      skills: ['sql', 'excel', 'power bi', 'python'], interests: ['data', 'business'],
      experienceType: 'practical', projectTitle: 'Sales dashboard', techStack: ['pandas'],
    },
  });
  assert.equal(onboarding.status, 200, JSON.stringify(onboarding.body));
  const profile = (await call('/user/profile', { token })).body.profile;
  assert.equal(profile.completed, true);
  assert.deepEqual(profile.skills, ['sql', 'excel', 'power bi', 'python']); // JSONB round-trips as arrays

  const first = await call('/ai/career-analysis', { method: 'POST', token, body: {} });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.cached, false);
  const d = first.body.data;
  assert.ok(d.recommendedRole && d.roadmap.length && d.jobRoles.length);
  console.log(`analysis: ${d.recommendedRole} ${d.matchPercent}% (confidence ${d.confidence}), ${d.roadmap.length} roadmap phases, ${d.jobRoles.length} job roles`);

  const second = await call('/ai/career-analysis', { method: 'POST', token, body: {} });
  assert.equal(second.body.cached, true);

  const unauth = await call('/user/profile');
  assert.equal(unauth.status, 401);
  console.log('SMOKE OK');
} finally {
  await pool.query('DELETE FROM users WHERE email = $1', [email]); // cascades to profile, resumes, recommendations
  await pool.end();
}
