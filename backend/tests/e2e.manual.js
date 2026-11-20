// Manual end-to-end check against the REAL ML service (not run by `npm test`).
//   1. start it:  cd ai-ml && uvicorn main:app --port 8000
//   2. run this:  node tests/e2e.manual.js          (uses an in-memory Postgres, so no DB install needed)
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { runMigrations } from '../src/db/migrate.js';
import { createMlClient } from '../src/services/mlClient.js';

function textPdf(lines) {
  const content = `BT /F1 12 Tf 14 TL 50 740 Td ${lines.map((l) => `(${l}) Tj T*`).join(' ')} ET`;
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
      `4 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj\n` +
      `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF`,
  );
}

const config = loadConfig({ jwtSecret: 'e2e-secret-e2e-secret', mlServiceUrl: process.env.ML_SERVICE_URL ?? 'http://localhost:8000' });
const { Pool } = newDb().adapters.createPg();
const pool = new Pool();
await runMigrations(pool);
const ml = createMlClient(config);
assert.ok(await ml.isHealthy(), 'ML service is not running on ' + config.mlServiceUrl);
const app = createApp({ pool, config, ml });

const { body: signup } = await request(app).post('/auth/signup').send({ name: 'Asha Patel', email: 'asha@example.com', password: 'password123' });
const auth = { Authorization: `Bearer ${signup.token}` };

const onboarding = await request(app).post('/user/onboarding').set(auth).send({
  name: 'Asha Patel', age: 23, education: 'postgraduate', state: 'Gujarat', city: 'Ahmedabad',
  skills: ['Python', 'SQL', 'Excel'], interests: ['data', 'analytics'], experienceType: 'practical',
  projectTitle: 'Sales dashboard', techStack: ['Pandas', 'Power BI'],
});
assert.equal(onboarding.status, 200, JSON.stringify(onboarding.body));

const analysis = await request(app).post('/ai/career-analysis').set(auth).send({});
assert.equal(analysis.status, 200, JSON.stringify(analysis.body));
const d = analysis.body.data;
console.log('Recommended:', d.recommendedRole, `${d.matchPercent}%`, '| readiness', `${d.readinessPercent}%`);
console.log('Missing:', d.missingSkills.join(', '));
console.log('Related:', d.relatedRoles.map((r) => `${r.title} ${r.matchPercent}%`).join(', '));
console.log('Roadmap:', d.roadmap.map((p) => `${p.title} (${p.durationWeeks}w)`).join(' -> '));
console.log('Job roles:', d.jobRoles.map((j) => j.title).join(', '));
assert.ok(d.recommendedRole && d.roadmap.length && d.jobRoles.length);
assert.equal((await request(app).post('/ai/career-analysis').set(auth).send({})).body.cached, true);

const pdf = textPdf(['Rahul Verma', 'rahul.verma@example.com', 'MCA student. Skills: Python, Django, REST API, PostgreSQL, Git, Docker.']);
const resume = await request(app).post('/resume?merge=true').set(auth).attach('resume', pdf, { filename: 'cv.pdf', contentType: 'application/pdf' });
assert.equal(resume.status, 200, JSON.stringify(resume.body));
console.log('Resume skills:', resume.body.skills.join(', '), '| email:', resume.body.email, '| merged:', resume.body.merged);
assert.ok(resume.body.skills.includes('django'));

const bad = await request(app).post('/resume').set(auth).attach('resume', Buffer.from('%PDF-1.4 garbage'), { filename: 'bad.pdf', contentType: 'application/pdf' });
console.log('Corrupt PDF ->', bad.status, bad.body.error);
assert.equal(bad.status, 422);

console.log('\nE2E OK');
await pool.end();
