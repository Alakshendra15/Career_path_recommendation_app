# Backend (Node.js + Express 5 + PostgreSQL)

REST API for the Android app. Handles accounts, student profiles, caching and storage, and calls the
FastAPI ML service (`../ai-ml`) for resume analysis and career recommendations. Uses the `pg` library
directly, with plain SQL migrations.

## Setup
1. Install PostgreSQL and create a database: `createdb career_path`
2. `cp .env.example .env`, then set `DATABASE_URL` and `JWT_SECRET`
3. `npm install`
4. `npm run dev` (applies pending migrations from `migrations/` on every start; `npm run migrate` runs them alone)
5. Start the ML service too: `cd ../ai-ml && uvicorn main:app --port 8000`

From a phone or emulator use the PC's LAN IP (Android emulator: `10.0.2.2`), e.g. `http://192.168.1.5:4000`.

## API
Auth uses `Authorization: Bearer <token>` (token is returned by signup/login). Errors are `{ error, code? }`.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/signup` `{name,email,password}` | 201 `{user, token}` |
| POST | `/auth/login` `{email,password}` | `{user, token}` |
| GET | `/auth/me` | validate a stored token |
| GET | `/user/profile` | `{id,name,email,profile: null \| {...completed}}` |
| POST | `/user/onboarding` | name, age, education, state, city, skills[], interests[], experienceType, projectTitle?, techStack[] |
| POST | `/ai/career-analysis` `{refresh?, weeklyHours?}` | cached per profile hash for 7 days, and recomputed when the ML service's data/model fingerprint changes; `code: ONBOARDING_REQUIRED` if no profile; limited per user (`AI_RATE_LIMIT`) |
| POST | `/resume` (multipart field `resume`, PDF <= 10 MB) | reads the PDF and returns skills + onboarding guesses. Nothing is saved. `?merge=true` adds the skills to the profile and keeps only skills/education (no contact details, no resume text). Limited per user (`RESUME_RATE_LIMIT`) |
| GET | `/health` | `{status, db, ml}` |

## Tests
- `npm test`: 23 API tests with an in-memory Postgres (`pg-mem`) and a fake ML client. No DB install needed.
- `node tests/e2e.manual.js`: end-to-end against the real ML service (start it first).

## Notes
- `pg-mem` emulates PostgreSQL but is not PostgreSQL: run `npm run migrate` against a real database once to confirm.
- Not built yet: a `/jobs` listing (job *roles* come from the ML analysis), password reset, refresh tokens.
