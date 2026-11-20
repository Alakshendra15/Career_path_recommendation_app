import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import request from 'supertest';
import { onboardingBody, setup, signup } from './helpers.js';

describe('auth', () => {
  let ctx;
  before(async () => {
    ctx = await setup();
  });

  it('signs up and returns a token in the body', async () => {
    const res = await signup(ctx.app);
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'rahul@example.com');
    assert.equal(res.body.user.password_hash, undefined);
  });

  it('rejects a duplicate email (case-insensitive)', async () => {
    const res = await signup(ctx.app, { email: 'RAHUL@example.com' });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'EMAIL_TAKEN');
  });

  it('validates input', async () => {
    const res = await signup(ctx.app, { email: 'x@y.com', password: 'short' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /8 characters/);
  });

  it('logs in and rejects bad credentials with the same message', async () => {
    const ok = await request(ctx.app).post('/auth/login').send({ email: 'rahul@example.com', password: 'password123' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    const wrongPw = await request(ctx.app).post('/auth/login').send({ email: 'rahul@example.com', password: 'nope-nope' });
    const noUser = await request(ctx.app).post('/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope' });
    assert.equal(wrongPw.status, 401);
    assert.deepEqual(wrongPw.body, noUser.body);
  });

  it('protects routes and validates the token', async () => {
    assert.equal((await request(ctx.app).get('/user/profile')).status, 401);
    assert.equal((await request(ctx.app).get('/user/profile').set('Authorization', 'Bearer garbage')).status, 401);
    const { body } = await request(ctx.app).post('/auth/login').send({ email: 'rahul@example.com', password: 'password123' });
    const me = await request(ctx.app).get('/auth/me').set('Authorization', `Bearer ${body.token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.name, 'Rahul Sharma');
  });

  it('reports health and 404s unknown routes as JSON', async () => {
    const health = await request(ctx.app).get('/health');
    assert.deepEqual(health.body, { status: 'ok', db: true, ml: true });
    const missing = await request(ctx.app).get('/nope');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'NOT_FOUND');
  });
});

describe('profile + analysis', () => {
  let ctx;
  let auth;
  before(async () => {
    ctx = await setup();
    const { body } = await signup(ctx.app);
    auth = { Authorization: `Bearer ${body.token}` };
  });

  it('has no profile before onboarding and refuses analysis', async () => {
    const profile = await request(ctx.app).get('/user/profile').set(auth);
    assert.equal(profile.body.profile, null);
    const res = await request(ctx.app).post('/ai/career-analysis').set(auth).send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'ONBOARDING_REQUIRED');
  });

  it('validates onboarding', async () => {
    const res = await request(ctx.app).post('/user/onboarding').set(auth).send({ ...onboardingBody, age: 10 });
    assert.equal(res.status, 400);
    const noSkills = await request(ctx.app).post('/user/onboarding').set(auth).send({ ...onboardingBody, skills: [] });
    assert.equal(noSkills.status, 400);
  });

  it('saves onboarding and returns the profile', async () => {
    const res = await request(ctx.app).post('/user/onboarding').set(auth).send(onboardingBody);
    assert.equal(res.status, 200);
    const { body } = await request(ctx.app).get('/user/profile').set(auth);
    assert.equal(body.profile.completed, true);
    assert.deepEqual(body.profile.skills, ['sql', 'excel']); // stored lower-cased
    assert.equal(body.profile.experienceType, 'practical');
  });

  it('drops project data for theoretical students', async () => {
    const theo = { ...onboardingBody, experienceType: 'theoretical' };
    await request(ctx.app).post('/user/onboarding').set(auth).send(theo);
    const { body } = await request(ctx.app).get('/user/profile').set(auth);
    assert.equal(body.profile.projectTitle, null);
    assert.deepEqual(body.profile.techStack, []);
    await request(ctx.app).post('/user/onboarding').set(auth).send(onboardingBody);
  });

  it('maps the ML result and caches it by profile hash', async () => {
    const first = await request(ctx.app).post('/ai/career-analysis').set(auth).send({});
    assert.equal(first.status, 200);
    assert.equal(first.body.cached, false);
    assert.equal(first.body.data.recommendedRole, 'Data Analyst');
    assert.deepEqual(first.body.data.missingSkills, ['power bi']);
    assert.equal(first.body.data.relatedRoles[0].title, 'Data Scientist');
    assert.equal(first.body.data.jobRoles[0].fitPercent, 40);

    const second = await request(ctx.app).post('/ai/career-analysis').set(auth).send({});
    assert.equal(second.body.cached, true);
    assert.equal(ctx.ml.calls, 1);
  });

  it('passes the ML confidence flag through, and defaults to ok for older cached results', async () => {
    const ok = await request(ctx.app).post('/ai/career-analysis').set(auth).send({});
    assert.equal(ok.body.data.confidence, 'ok');
    assert.deepEqual(ok.body.data.recognisedSkills, ['sql', 'excel']);

    ctx.ml.override = { confidence: 'none', recognised_skills: [], unrecognised_skills: ['kotlin'] };
    const none = await request(ctx.app).post('/ai/career-analysis').set(auth).send({ refresh: true });
    assert.equal(none.body.data.confidence, 'none');
    assert.deepEqual(none.body.data.unrecognisedSkills, ['kotlin']);

    // an old cached row stored before the field existed
    ctx.ml.override = { confidence: undefined, recognised_skills: undefined, unrecognised_skills: undefined };
    const legacy = await request(ctx.app).post('/ai/career-analysis').set(auth).send({ refresh: true });
    assert.equal(legacy.body.data.confidence, 'ok');
    assert.deepEqual(legacy.body.data.unrecognisedSkills, []);
    ctx.ml.override = {};
  });

  it('recomputes when the profile changes or refresh is requested', async () => {
    await request(ctx.app).post('/user/onboarding').set(auth).send({ ...onboardingBody, city: 'Mumbai' });
    assert.equal((await request(ctx.app).post('/ai/career-analysis').set(auth).send({})).body.cached, true, 'city does not affect ML');

    await request(ctx.app).post('/user/onboarding').set(auth).send({ ...onboardingBody, skills: ['SQL', 'Excel', 'Python'] });
    assert.equal((await request(ctx.app).post('/ai/career-analysis').set(auth).send({})).body.cached, false);

    const before = ctx.ml.calls;
    const refreshed = await request(ctx.app).post('/ai/career-analysis').set(auth).send({ refresh: true });
    assert.equal(refreshed.body.cached, false);
    assert.equal(ctx.ml.calls, before + 1);
  });

  it('returns 502 when the ML service is down, but still serves a cached result', async () => {
    ctx.ml.down = true;
    const cached = await request(ctx.app).post('/ai/career-analysis').set(auth).send({});
    assert.equal(cached.status, 200);
    assert.equal(cached.body.cached, true);

    const fresh = await request(ctx.app).post('/ai/career-analysis').set(auth).send({ refresh: true });
    assert.equal(fresh.status, 502);
    assert.equal(fresh.body.code, 'ML_UNAVAILABLE');
    ctx.ml.down = false;
  });
});

describe('resume', () => {
  let ctx;
  let auth;
  before(async () => {
    ctx = await setup();
    const { body } = await signup(ctx.app);
    auth = { Authorization: `Bearer ${body.token}` };
  });

  it('requires a file and only accepts PDFs', async () => {
    assert.equal((await request(ctx.app).post('/resume').set(auth)).status, 400);
    const txt = await request(ctx.app).post('/resume').set(auth).attach('resume', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
    assert.equal(txt.status, 400);
    assert.match(txt.body.error, /PDF/);
  });

  it('parses a PDF and merges skills into the profile on request', async () => {
    await request(ctx.app).post('/user/onboarding').set(auth).send(onboardingBody);
    const pdf = Buffer.from('%PDF-1.4 fake');
    const plain = await request(ctx.app).post('/resume').set(auth).attach('resume', pdf, { filename: 'cv.pdf', contentType: 'application/pdf' });
    assert.equal(plain.status, 200);
    assert.deepEqual(plain.body.skills, ['python', 'sql']);
    assert.equal(plain.body.merged, false);

    const merged = await request(ctx.app).post('/resume?merge=true').set(auth).attach('resume', pdf, { filename: 'cv.pdf', contentType: 'application/pdf' });
    assert.equal(merged.body.merged, true);
    const { body } = await request(ctx.app).get('/user/profile').set(auth);
    assert.deepEqual(body.profile.skills, ['sql', 'excel', 'python']); // 'sql' already present
  });
});

describe('stale results, privacy and limits', () => {
  const pdf = Buffer.from('%PDF-1.4 fake');
  const attachPdf = (ctx, auth, url = '/resume') =>
    request(ctx.app).post(url).set(auth).attach('resume', pdf, { filename: 'cv.pdf', contentType: 'application/pdf' });

  async function ready(overrides) {
    const ctx = await setup(overrides);
    const { body } = await signup(ctx.app);
    const auth = { Authorization: `Bearer ${body.token}` };
    await request(ctx.app).post('/user/onboarding').set(auth).send(onboardingBody);
    return { ctx, auth };
  }

  it('recomputes a cached analysis when the ML data / model fingerprint changes', async () => {
    const { ctx, auth } = await ready();
    const run = () => request(ctx.app).post('/ai/career-analysis').set(auth).send({});
    assert.equal((await run()).body.cached, false);
    assert.equal((await run()).body.cached, true);

    ctx.ml.version = 'v2'; // the knowledge base was edited or the model retrained
    assert.equal((await run()).body.cached, false, 'same profile, new model: must be recomputed');
    assert.equal((await run()).body.cached, true);
  });

  it('treats a result stored before fingerprints existed as stale, but still serves it if the ML service is down', async () => {
    const { ctx, auth } = await ready();
    await request(ctx.app).post('/ai/career-analysis').set(auth).send({});
    const { rows } = await ctx.pool.query('SELECT user_id, result FROM recommendations');
    const legacy = rows[0].result;
    delete legacy.model_version;
    await ctx.pool.query('UPDATE recommendations SET result = $1 WHERE user_id = $2', [JSON.stringify(legacy), rows[0].user_id]);

    ctx.ml.down = true; // cannot tell whether it is stale: better to show it than an error
    assert.equal((await request(ctx.app).post('/ai/career-analysis').set(auth).send({})).body.cached, true);
    ctx.ml.down = false;
    assert.equal((await request(ctx.app).post('/ai/career-analysis').set(auth).send({})).body.cached, false);
  });

  it('saves nothing for a preview upload and never stores or returns contact details', async () => {
    const { ctx, auth } = await ready();
    const preview = await attachPdf(ctx, auth);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.id, null);
    for (const key of ['email', 'phone', 'text_preview']) assert.equal(preview.body[key], undefined, key);
    assert.equal((await ctx.pool.query('SELECT count(*)::int AS n FROM resumes')).rows[0].n, 0);

    const merged = await attachPdf(ctx, auth, '/resume?merge=true');
    assert.equal(merged.body.merged, true);
    assert.ok(merged.body.id);
    const { rows } = await ctx.pool.query('SELECT parsed FROM resumes');
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0].parsed).sort(), ['education', 'has_internship', 'has_projects', 'skills']);
  });

  it('answers 401, not 500, for a valid token whose account was deleted', async () => {
    const { ctx, auth } = await ready();
    await ctx.pool.query('DELETE FROM users');
    const res = await attachPdf(ctx, auth, '/resume?merge=true');
    assert.equal(res.status, 401);
  });

  it('limits analysis and resume calls per user', async () => {
    const { ctx, auth } = await ready({ aiRateLimit: 2, resumeRateLimit: 1 });
    const run = () => request(ctx.app).post('/ai/career-analysis').set(auth).send({});
    assert.equal((await run()).status, 200);
    assert.equal((await run()).status, 200);
    const limited = await run();
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, 'RATE_LIMITED');

    assert.equal((await attachPdf(ctx, auth)).status, 200);
    assert.equal((await attachPdf(ctx, auth)).status, 429);

    // another user is not affected
    const other = await signup(ctx.app, { email: 'other@example.com' });
    assert.equal((await attachPdf(ctx, { Authorization: `Bearer ${other.body.token}` })).status, 200);
  });

  it('requires a project for practical profiles and treats skills case-insensitively', async () => {
    const { ctx, auth } = await ready();
    const noProject = await request(ctx.app).post('/user/onboarding').set(auth).send({ ...onboardingBody, projectTitle: undefined });
    assert.equal(noProject.status, 400);
    assert.match(noProject.body.error, /project title/i);
    const noTech = await request(ctx.app).post('/user/onboarding').set(auth).send({ ...onboardingBody, techStack: [] });
    assert.equal(noTech.status, 400);

    const dup = await request(ctx.app).post('/user/onboarding').set(auth).send({ ...onboardingBody, skills: ['Python', 'python', ' PYTHON '] });
    assert.equal(dup.status, 200);
    const { body } = await request(ctx.app).get('/user/profile').set(auth);
    assert.deepEqual(body.profile.skills, ['python']);
  });

  it('accepts a full resume worth of skills (more than 50)', async () => {
    const { ctx, auth } = await ready();
    const many = Array.from({ length: 80 }, (_, i) => `skill${i}`);
    const res = await request(ctx.app).post('/user/onboarding').set(auth).send({ ...onboardingBody, skills: many });
    assert.equal(res.status, 200);
  });
});
