import { newDb } from 'pg-mem';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { runMigrations } from '../src/db/migrate.js';
import { AppError } from '../src/utils/errors.js';

export const ML_RESULT = {
  top_career: 'Data Analyst',
  confidence: 'ok',
  recognised_skills: ['sql', 'excel'],
  unrecognised_skills: [],
  recommendations: [
    {
      career_id: 'data_analyst',
      title: 'Data Analyst',
      description: 'Analyses data',
      score: 62.5,
      breakdown: { weighted_skill: 60, tfidf_cosine: 70, interest: 40, project_bonus: 0 },
      matched_skills: ['sql', 'excel'],
      missing_core_skills: ['power bi'],
    },
    {
      career_id: 'data_scientist',
      title: 'Data Scientist',
      description: 'Models data',
      score: 30,
      breakdown: { weighted_skill: 25, tfidf_cosine: 30, interest: 20, project_bonus: 0 },
      matched_skills: ['sql'],
      missing_core_skills: [],
    },
  ],
  skill_gap: {
    career_id: 'data_analyst',
    career: 'Data Analyst',
    readiness_percent: 60,
    current_skills: ['sql', 'excel'],
    missing_skills: [{ skill: 'power bi', weight: 4, type: 'core' }],
    partial_skills: ['power bi'],
  },
  roadmap: [{ phase: 1, title: 'Foundation', skills: ['power bi'], durationWeeks: 3, actions: ['Learn power bi'], resources: [] }],
  job_roles: [
    {
      title: 'Junior Data Analyst',
      career: 'Data Analyst',
      level: 'entry',
      fit_percent: 40,
      skill_match_percent: 75,
      matched_skills: ['sql'],
      missing_skills: ['statistics'],
    },
  ],
};

export function fakeMl() {
  const ml = {
    calls: 0,
    down: false,
    version: 'v1', // the ML service's data/model fingerprint; change it to simulate a retrain
    override: {}, // merged over the default result, e.g. { confidence: 'none' }
    async analyze() {
      ml.calls++;
      if (ml.down) throw new AppError(502, 'Recommendation service is unavailable, please try again shortly', 'ML_UNAVAILABLE');
      return { ...structuredClone(ML_RESULT), model_version: ml.version, ...ml.override };
    },
    async analyzeResume() {
      return { skills: ['python', 'sql'], email: 'a@b.com', phone: '9876543210', text_preview: 'Rahul a@b.com', education: ['MCA'], has_projects: true, has_internship: false };
    },
    async dataVersion() {
      return ml.down ? null : ml.version;
    },
    async isHealthy() {
      return !ml.down;
    },
  };
  return ml;
}

export async function setup(overrides = {}) {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  await runMigrations(pool);
  const ml = fakeMl();
  const config = loadConfig({ jwtSecret: 'test-secret-test-secret', authRateLimit: 1000, ...overrides });
  const app = createApp({ pool, config, ml });
  return { app, pool, ml, config };
}

export async function signup(app, overrides = {}) {
  const res = await request(app)
    .post('/auth/signup')
    .send({ name: 'Rahul Sharma', email: 'rahul@example.com', password: 'password123', ...overrides });
  return res;
}

export const onboardingBody = {
  name: 'Rahul Sharma',
  age: 22,
  education: 'postgraduate',
  state: 'Maharashtra',
  city: 'Pune',
  skills: ['SQL', 'Excel'],
  interests: ['data'],
  experienceType: 'practical',
  projectTitle: 'Sales dashboard',
  techStack: ['Power BI'],
};
