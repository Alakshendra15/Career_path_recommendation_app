# Career Path Recommendation System

A mobile app that tells a student which career fits them best, which skills they are missing, what to learn next and which entry-level jobs to aim for. The student either uploads a PDF resume (the system fills in the details and asks "is this correct?") or answers a few questions by hand.

MCA final-year project. Everything runs on one laptop with free software and no paid API.

---

## Contents

1. [What it does](#1-what-it-does)
2. [Technology used](#2-technology-used)
3. [How the parts fit together](#3-how-the-parts-fit-together)
4. [Project layout](#4-project-layout)
5. [Prerequisites](#5-prerequisites)
6. [First-time setup](#6-first-time-setup)
7. [Running the project](#7-running-the-project)
8. [Running the app on an emulator or a phone](#8-running-the-app-on-an-emulator-or-a-phone)
9. [Configuration](#9-configuration)
10. [How it works](#10-how-it-works)
11. [API reference](#11-api-reference)
12. [Data, training and accuracy](#12-data-training-and-accuracy)
13. [Testing](#13-testing)
14. [Troubleshooting](#14-troubleshooting)
15. [Known limitations](#15-known-limitations)
16. [Credits and licences](#16-credits-and-licences)

---

## 1. What it does

| Screen | What the student sees |
|---|---|
| **Sign up / log in** | Email and password account. |
| **Set-up choice** | *Upload my resume* (fast) or *Fill it in myself* (step-by-step form). |
| **Review ("Is this correct?")** | After a resume upload: every detail the system found, marked **From your resume** or **Needed**. Tap any row to fix it. Nothing is saved until the student confirms. |
| **Career** | Best-matching career, a match percentage, *why* it matched (four score bars), the skills the student has and the ones to learn, and two other careers worth considering. |
| **Roadmap** | A phase-by-phase learning plan with time estimates and free learning links. |
| **Jobs** | Entry-level job titles ranked by fit, with matched and missing skills. |
| **Profile** | The saved profile, resume upload (adds skills to the profile), edit profile, log out. |

Seven careers are covered: Data Analyst, Data Scientist, Data Engineer, ML Engineer, Cloud Engineer, Python Developer and Web Developer.

---

## 2. Technology used

| Layer | Technology |
|---|---|
| **Mobile app** | React Native 0.88 + Expo SDK 58 (Expo Go for development), TypeScript, Expo Router (file-based navigation), Zustand (state), `expo-secure-store` (token storage), `expo-document-picker` |
| **Backend API** | Node.js 20+ (developed on 24), Express 5, `pg` (PostgreSQL driver), Zod (validation), `jsonwebtoken` + `bcryptjs` (login), `multer` (uploads), Helmet, `express-rate-limit` |
| **Database** | PostgreSQL. For development it runs from the `embedded-postgres` npm package (no installer). Tests use `pg-mem` (in memory). |
| **ML service** | Python 3.11+ (developed on 3.14), FastAPI + Uvicorn, scikit-learn (TF-IDF, logistic regression), pandas, NumPy, joblib, pdfplumber (PDF text) |
| **Training data** | `lukebarousse/data_jobs` on Hugging Face: about 785,000 real job postings with skill lists (Apache-2.0). Download is free and needs no account. |
| **Tests** | pytest (ML), Node's built-in test runner + supertest (backend), TypeScript compiler (app) |

No paid service and no API key is used anywhere.

---

## 3. How the parts fit together

```
 Phone / emulator                 Your laptop
 +----------------+      +-------------------+      +--------------------+
 |  Expo app      | HTTP |  Backend API      | HTTP |  ML service        |
 |  (React Native)|----->|  Node + Express   |----->|  FastAPI + sklearn |
 |                | JSON |  port 4000        |      |  port 8000         |
 +----------------+      +---------+---------+      +--------------------+
                                   |
                                   v
                          +-------------------+
                          |  PostgreSQL       |
                          |  port 5433 (dev)  |
                          +-------------------+
```

* The **app** only talks to the **backend**. It never contacts the ML service or the database.
* The **backend** handles accounts, stores profiles, caches results and forwards work to the **ML service**.
* The **ML service** has no database. Its only state is the knowledge base (CSV files) and the trained model file.

**What happens when a student opens the Career tab**

1. The app calls `POST /ai/career-analysis` with the saved login token.
2. The backend loads the student's profile and checks the cache (one result per user).
3. If there is no fresh cached result, it calls the ML service's `/analyze`.
4. The ML service scores the careers, finds the skill gap, builds the roadmap and job list, and returns one JSON document.
5. The backend saves it, reshapes it for the screens and returns it. The app draws it.

---

## 4. Project layout

```
CareerPathRecommendationSystem/
├── frontend/                  Expo / React Native app
│   ├── app/                   Screens (file = route)
│   │   ├── (auth)/            welcome, login, signup
│   │   ├── (tabs)/            career, roadmap, roles ("Jobs"), profile
│   │   ├── onboarding.tsx     set-up choice, resume review, step-by-step form
│   │   └── _layout.tsx        route guards (signed out / onboarding / tabs)
│   └── src/
│       ├── components/        UI kit, onboarding steps, resume choice + review
│       ├── store/             auth, analysis and onboarding state (Zustand)
│       ├── lib/               api client, secure token storage, resume prefill
│       └── constants/         skill / interest lists, Indian states and cities
├── backend/                   Node + Express API
│   ├── src/
│   │   ├── routes/            auth, user, ai, resume
│   │   ├── services/          ML client, result mapper
│   │   ├── middleware/        auth, error handling
│   │   ├── validators/        Zod schemas
│   │   └── db/                pool + migration runner
│   ├── migrations/            SQL files, applied automatically at start
│   ├── scripts/               dev-db.js (local PostgreSQL), smoke-live.js
│   └── tests/                 API tests
├── ai-ml/                     Python ML service
│   ├── app/
│   │   ├── api/routes.py      REST endpoints
│   │   ├── services/          recommender, ml_model, skill_extractor, resume_parser,
│   │   │                      skill_gap, roadmap, job_roles, engine, version
│   │   └── models/            career_model.joblib (the trained model, 8 KB)
│   ├── data/                  Knowledge base CSV files (see section 12)
│   ├── training/              extend_kb.py, train.py, README.md
│   ├── evaluation/            personas, evaluation scripts, results/
│   └── tests/                 pytest suite
└── documentation/             Architecture notes and the ML evaluation write-up
```

---

## 5. Prerequisites

| Need | Version | Check |
|---|---|---|
| Node.js | 20 or newer | `node --version` |
| Python | 3.11 or newer | `python --version` |
| Android emulator **or** a phone with **Expo Go** | | See section 8 |

You do **not** need to install PostgreSQL: the project starts its own local copy.
To use the emulator you need Android Studio (or just its SDK command-line tools) with an Android system image.

---

## 6. First-time setup

Run these once. Commands work in PowerShell or Git Bash.

```bash
# 1. backend dependencies
cd backend
npm install
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Open `backend/.env` and set two things:

```ini
DATABASE_URL=postgres://postgres:postgres@localhost:5433/career_path
JWT_SECRET=<at least 16 random characters>
```

Make a secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

```bash
# 2. ML service dependencies
cd ../ai-ml
pip install -r requirements.txt

# 3. app dependencies
cd ../frontend
npm install
```

The trained model (`ai-ml/app/models/career_model.joblib`) is included, so nothing needs training to run the project.

---

## 7. Running the project

Four programs run together. Open **four terminals** and start them in this order.

| # | Terminal | Command | Ready when you see |
|---|---|---|---|
| 1 | `backend/` | `npm run dev:db` | `PostgreSQL ready: postgres://...localhost:5433/career_path` |
| 2 | `ai-ml/` | `python -m uvicorn main:app --port 8000` | `Application startup complete` |
| 3 | `backend/` | `npm run dev` | `API listening on port 4000` |
| 4 | `frontend/` | `npx expo start` | a QR code and `Metro waiting` |

Database tables are created automatically when the backend starts (`migrations/*.sql`).

**Check that it is healthy** (in a fifth terminal or a browser):

```
http://localhost:8000/health   ->  {"status":"ok","careers":7,"data_version":"..."}
http://localhost:4000/health   ->  {"status":"ok","db":true,"ml":true}
```

`"ml": false` means the ML service is not running (or still starting: it takes several seconds to load).

**Stopping:** press `Ctrl+C` in each terminal. Your data is kept in `backend/.pgdata/`. Delete that folder to start with an empty database.

Notes
* `npm run dev` restarts the backend whenever you edit its files. Add `--reload` to the uvicorn command if you want the same for the ML service.
* Metro (terminal 4) reloads the app when you save a file. If it ever does not, press `r` in that terminal.

---

## 8. Running the app on an emulator or a phone

### Android emulator

1. In Android Studio open **Device Manager** and create a virtual device (for example *Pixel 7* with an Android 14+ image), or create one from the command line with `avdmanager`.
2. Start it (`emulator -avd <name>`), wait until the home screen appears.
3. In the `frontend/` terminal press **`a`**. Expo installs *Expo Go* on the emulator and opens the app.

The emulator reaches your laptop's servers through your laptop's IP address, which Expo detects for you. If it ever cannot, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000` (the emulator's name for "the laptop") in `frontend/.env` and restart Expo.

To test a resume upload on the emulator, copy a PDF onto it: `adb push resume.pdf /sdcard/Download/` (on Git Bash prefix the command with `MSYS_NO_PATHCONV=1`), then choose it from *Downloads* in the file picker.

### A real phone

1. Install **Expo Go** from the Play Store or App Store.
2. The phone and the laptop must be on the **same Wi-Fi network** (a phone hotspot works too).
3. Scan the QR code from the `frontend/` terminal with Expo Go.
4. The app finds the backend by itself at `http://<laptop IP>:4000`.

**Windows firewall.** Windows blocks other devices from reaching Node.js on networks it classes as *Public*. If the phone shows *"Cannot reach the server"*:

1. Check the address works first: open `http://<laptop IP>:4000/health` in the phone's browser.
2. If it does not load, open **PowerShell as Administrator** and run:
   ```powershell
   Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private
   New-NetFirewallRule -DisplayName 'CareerPath backend 4000' -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private
   New-NetFirewallRule -DisplayName 'CareerPath Metro 8081'   -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
   ```
3. The laptop's IP can change when you reconnect to Wi-Fi. Restart Expo (`Ctrl+C`, `npx expo start`) after any network change.

---

## 9. Configuration

### Backend (`backend/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | none (required) | PostgreSQL connection string. Dev: `postgres://postgres:postgres@localhost:5433/career_path` |
| `JWT_SECRET` | none (required) | Signs login tokens. At least 16 characters. Never commit it. |
| `PORT` | `4000` | API port |
| `JWT_EXPIRES_IN` | `7d` | How long a login lasts |
| `ML_SERVICE_URL` | `http://localhost:8000` | Where the ML service is |
| `ML_TIMEOUT_MS` | `20000` | Give up on the ML service after this long |
| `ANALYSIS_CACHE_DAYS` | `7` | How long a cached analysis is reused |
| `ML_VERSION` | `3` | Extra salt for the cache key. Bump it to force everyone to be recomputed. (Changes to the model or CSVs are detected automatically.) |
| `AUTH_RATE_LIMIT` | `20` | Login/signup attempts per IP per 15 minutes |
| `AI_RATE_LIMIT` | `60` | Analyses per signed-in user per 15 minutes |
| `RESUME_RATE_LIMIT` | `20` | Resume uploads per signed-in user per 15 minutes |
| `TRUST_PROXY` | off | Set to `1` behind a reverse proxy so rate limits see real client IPs |
| `CORS_ORIGINS` | any | Comma-separated allowed browser origins (production) |
| `REQUEST_LOG` | off | `1` prints every request (method, path, status, time, client IP). Useful to see whether a phone's request arrived. |

### App (`frontend/.env`, optional)

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend address. Leave unset in Expo Go, which detects it. Set it for a build or a fixed server, e.g. `http://192.168.1.5:4000`. |

### Local database port

`npm run dev:db` listens on **5433** (so it never clashes with a normal PostgreSQL on 5432). Change it with `DEV_DB_PORT`.

---

## 10. How it works

### 10.1 Signing up and the two ways to set up a profile

1. **Sign up** creates the account. The password is stored only as a bcrypt hash (cost 12). The server returns a JWT (HS256, 7 days) which the app keeps in the phone's secure storage (Keychain / Keystore).
2. The first screen offers **Upload my resume** or **Fill it in myself**.
3. **Resume path**
   * The app sends the PDF to `POST /resume` (no merge). The backend forwards it to the ML service.
   * The ML service extracts the text and returns skills plus best guesses: name, age (only from an explicit date of birth), education level, learning style, project title and technologies, and interests (only from an explicit *Interests* section).
   * The **review screen** lists everything. Found details are tagged *From your resume*; missing ones are tagged *Needed* and highlighted. Tapping a row jumps to that single question and returns to the review.
   * **Yes, this is correct** saves the profile. **Edit details** runs the full form with the answers pre-filled.
   * Nothing is written to the database until that confirmation.
4. **Manual path:** seven short steps (about you, education, location, skills, interests, experience, and a project if the student has built one).

A field is left empty rather than guessed when the resume gives no evidence. A PDF with no name, skills or education (for example a bill) is rejected with a message instead of producing a review screen.

### 10.2 Reading a resume

* Text comes from the PDF with `pdfplumber` (first 10 pages, maximum 10 MB). Scanned images have no text and are refused.
* **Skills** are found with a dictionary: every skill and alias in `data/skills.csv` is matched as a whole word. A handful of entries are also ordinary English or company names (*express, react, excel, go, shell, oracle, lambda, agile, hive...*). Those only count inside a skills-style list (`Python, SQL, Excel`) or under a *Skills* heading, so "I express my interest" does not add Express.
* **Education:** MCA, M.Tech, MBA, M.Sc map to *postgraduate*; B.Tech/B.E., BCA, B.Sc and diplomas map to *undergraduate*. "B.E." needs its dot (or upper-case `BE (CSE)`), because a plain "be" is an English word.
* **Name:** the first short phrase near the top that is not a heading, job title or place (`Data Scientist` and `New Delhi` are skipped).
* **Privacy:** email and phone are not returned to the app or stored. The text snippet used to find a city has them masked. A preview upload is not saved at all. Merging (Profile tab) saves only the extracted skills and education.

### 10.3 Choosing the best career

Two independent scorers are blended.

**A. Rules (explainable)**

```
rule = 0.50 x weighted_skill + 0.30 x tfidf_cosine + 0.20 x interest   (+ up to 5% project bonus)
```

| Part | Meaning |
|---|---|
| `weighted_skill` | Importance-weighted share of the career's skills the student already has. Weights (1-5) and `core`/`supporting` labels live in `data/career_skills.csv`. |
| `tfidf_cosine` | How closely the student's skill list resembles the career's typical skill profile (TF-IDF vectors compared with cosine similarity). |
| `interest` | Share of the career's interest tags the student's interests touch. |
| project bonus | Up to 5% for students who built projects using the career's core skills. |

Without interests the weights become 0.625 / 0.375.

**B. Trained model.** A logistic regression over 84 yes/no skill features outputs `P(career | skills)` for the seven careers. It was trained on real job postings (section 12).

**Final score**

```
final = 0.5 x rule + 0.5 x model        (ML_WEIGHT in ai-ml/app/services/recommender.py)
```

The four bars on the Career tab are: *Skills you have* (`weighted_skill`), *Profile similarity* (`tfidf_cosine`), *Interests* and *AI model*. If the model file is missing the service uses the rules only and logs a warning, so it never breaks.

A note on the percentage: the model part is a probability shared between all seven careers, so for careers that overlap (e.g. Data Scientist vs ML Engineer) even a student who knows every listed skill scores below 100%. Read it as "how well this career fits compared with the others".

**Confidence flag.** The result says how far to trust it:
* `none`: no recognised technical skill (soft skills and unknown skills do not count). The app shows "We could not match your skills yet" instead of a meaningless best match.
* `low`: fewer than two recognised technical skills, or a best score under 20.
* `ok`: otherwise.

### 10.4 Skill gap, roadmap and job roles

* **Skill gap** compares the student's skills with the winning career's list. Missing skills are sorted core first, then by weight. A missing skill is marked *ready to start* when the student already knows one of its prerequisites (`data/skill_prereqs.csv`).
* **Roadmap:** missing skills plus any missing prerequisites are put in dependency order (topological sort), grouped into *Foundation → Core → Advanced* by each skill's level, then a *Portfolio Project* phase. Weeks per phase = estimated hours (`data/skills.csv`) divided by weekly study hours (default 10). Links come from `data/skill_resources.csv` (free docs and courses).
* **Job roles:** each entry-level title in `data/job_roles.csv` is scored as `skill match x score of its parent career`, so a role only ranks high if the student has its skills **and** fits its career.

### 10.5 Caching and keeping results fresh

The backend stores one analysis per user. It is reused only if **all** of these hold:
* the profile inputs that matter (skills, interests, tech stack, experience type, weekly hours) are unchanged, and
* it is less than `ANALYSIS_CACHE_DAYS` old, and
* it was produced by the same knowledge base and model. The ML service reports a fingerprint of its CSV files and model (`data_version` in `/health`). Edit a CSV or retrain and every cached result is recomputed on next use.

If the ML service is unreachable, a cached result is still shown (better than an error); a new analysis returns 502.

### 10.6 Security measures

bcrypt password hashing; JWT in secure storage; Helmet headers; Zod validation on every input; login timing does not reveal whether an email exists; login rate limit per IP and analysis/resume rate limits per user; PDFs are processed in memory and never written to disk; the ML service is only called by the backend.

### 10.7 Database

PostgreSQL tables (`backend/migrations/`):

| Table | Purpose |
|---|---|
| `users` | account (id, name, email, password hash) |
| `student_profiles` | one profile per user: age, education, location, skills, interests, experience type, project, tech stack, `completed` |
| `resumes` | one row per resume *merged* into a profile: filename, skills, education |
| `recommendations` | one cached analysis per user with its profile hash |
| `schema_migrations` | which migration files have run |

---

## 11. API reference

### Backend (port 4000)

Responses are JSON. Errors look like `{"error": "message", "code": "..."}`. Everything except `/health`, `/auth/signup` and `/auth/login` needs `Authorization: Bearer <token>`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | | `{status, db, ml}` |
| POST | `/auth/signup` | `{name, email, password}` | `{user, token}` (201) |
| POST | `/auth/login` | `{email, password}` | `{user, token}` |
| GET | `/auth/me` | | `{user}` |
| GET | `/user/profile` | | `{id, name, email, profile}` (`profile` is `null` until onboarding) |
| POST | `/user/onboarding` | name, age (15-60), education (`undergraduate`/`graduate`/`postgraduate`), state, city, skills[] (1-100), interests[], experienceType (`theoretical`/`practical`), projectTitle and techStack[] (required when practical) | `{success: true}` |
| POST | `/ai/career-analysis` | `{refresh?, weeklyHours?}` | `{cached, generatedAt, data}` |
| POST | `/resume` | multipart field `resume` (PDF, 10 MB max) | skills and onboarding guesses; saves nothing |
| POST | `/resume?merge=true` | same | same, and adds the skills to the profile |

Common error codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `INVALID_CREDENTIALS` (401), `EMAIL_TAKEN` (409), `ONBOARDING_REQUIRED` (400), `RATE_LIMITED` (429), `ML_UNAVAILABLE` (502), `ML_REJECTED` (400/422, e.g. unreadable PDF).

### ML service (port 8000), with interactive docs at `http://localhost:8000/docs`

`GET /health`, `GET /careers`, `POST /resume/analyze`, `POST /recommend`, `POST /skill-gap`, `POST /roadmap`, `POST /job-roles`, `POST /analyze` (everything in one call; this is what the backend uses).

---

## 12. Data, training and accuracy

### The knowledge base (`ai-ml/data/*.csv`)

Plain CSV, edited by hand or script:

| File | Content |
|---|---|
| `skills.csv` | 84 skills: name, aliases, category, level, estimated hours |
| `careers.csv` | 7 careers: description and interest tags |
| `career_skills.csv` | weighted skills per career (`core`/`supporting`). For Data Engineer and Cloud Engineer the weights come from real posting frequencies; the others are hand-written. |
| `skill_prereqs.csv` | which skill needs which |
| `skill_resources.csv` | free learning links (a few soft/BI skills still have none) |
| `job_roles.csv` | entry-level job titles and their required skills |

**Adding a skill:** add a row to `skills.csv`, add it to the careers that need it in `career_skills.csv`, add the app's pick-list entry in `frontend/src/constants/options.ts`, then **retrain** (below).

### The trained model

* **Data:** about 583,000 real postings labelled Data Analyst, Data Scientist, Data Engineer, ML Engineer or Cloud Engineer ("Senior ..." merged). Python Developer and Web Developer have no label in that dataset, so they use about 17,000 "Software Engineer" postings labelled from their skills (**weak labels**, never counted in the accuracy figures) plus about 6,000 synthetic profiles.
* **Model:** multinomial logistic regression, classes balanced, regularisation chosen on a validation split.
* **Honest testing:** train / validation / test are split by *skill set*, so an identical posting never appears on both sides. The blend weight is tuned on one held-out fold and reported on another.

**Results** (real postings the model never saw; five real careers):

| | Top-1 | Top-3 |
|---|---|---|
| Always guess the biggest class | 38% | n/a |
| Rules only | ~51% | ~73% |
| Trained model alone | ~53% | ~86% |
| **Rules + model (shipped, 0.5)** on the held-out report fold | **~52%** | **~83%** |

On the hand-written student personas (52 cases): core 96.9% top-1; hard cases 85% top-1 (65% with rules only) and 100% when an accepted alternative counts.

Why top-1 is only around 50%: a "Data Analyst" and a "Data Scientist" posting often list identical skills, so the labels themselves are noisy. Top-3 is the fairer headline. Full tables: `ai-ml/evaluation/results/MODEL_RESULTS.md` and `RESULTS.md`; method and limits: `documentation/project-report/ml-evaluation.md`.

### Retraining (only after changing `careers.csv` or `skills.csv`)

```bash
cd ai-ml
python -c "import urllib.request as u; u.urlretrieve('https://huggingface.co/datasets/lukebarousse/data_jobs/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet','data/real/data_jobs.parquet')"
pip install pyarrow
python training/extend_kb.py          # optional: re-derives data-driven weights (safe to re-run)
python training/train.py              # trains, evaluates, writes app/models/career_model.joblib
python evaluation/blend_sweep.py      # re-checks the rules/model blend weight
python evaluation/model_report.py     # rewrites evaluation/results/MODEL_RESULTS.md
python -m pytest -q
```

`data/real/` (72 MB) is only needed for training and is git-ignored. Details: `ai-ml/training/README.md`. If the model does not cover every career in `careers.csv`, the service ignores it and logs a warning until you retrain.

---

## 13. Testing

```bash
cd ai-ml    && python -m pytest -q        # 25 tests: scoring, accuracy floors, resume parsing, API
cd backend  && npm test                   # 23 tests: auth, onboarding, caching, resume, limits (in-memory DB)
cd frontend && npx tsc --noEmit           # type-check the app
```

The ML tests include **accuracy guards**: they fail if edits to the data or formula drop accuracy on the personas, if the model stops beating the rules on real held-out postings, or if a resume-parsing false positive comes back.
`node backend/tests/e2e.manual.js` and `npm run smoke` (in `backend/`) exercise the running stack end to end.

---

## 14. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| **"Cannot reach the server at http://..."** in the app | Backend not running, phone on a different network, or the Windows firewall (section 8). Open `http://<laptop IP>:4000/health` on the same device to tell which. The message names the address the app tried. |
| `/health` shows `"ml": false` | ML service not started, or still loading (wait ~10 s). |
| Backend exits with `ECONNREFUSED ... 5433` | Start the database first (`npm run dev:db`). |
| `Missing required environment variable JWT_SECRET` | Fill in `backend/.env` (section 6). |
| Career tab is empty or shows an error | Pull the screen or tap **Refresh analysis**. If the profile is complete the cause is shown in the message. |
| Old results after changing the CSVs or model | Automatic: the cache notices the new `data_version`. If not, restart the ML service so it reloads its files. |
| Resume upload says "We could not find a name, skills or education" | The PDF is not a resume, or it is a scan with no text. |
| Resume misses a skill | It is not in `skills.csv` (or the word only appears inside a sentence, see 10.2). Add it to the data. |
| `adb push` fails on Git Bash with a `C:/Program Files/Git/...` path | Prefix with `MSYS_NO_PATHCONV=1`. |
| Phone keeps the wrong address after switching Wi-Fi | Restart Expo; the app takes the address from the Metro server it loaded from. |
| `curl` to Hugging Face fails with a certificate revocation error on Windows | Use the Python download command in section 12 instead. |

---

## 15. Known limitations

* **Development setup only.** Expo Go over plain HTTP, open CORS by default and a local database. A real release needs HTTPS, restricted `CORS_ORIGINS`, a managed PostgreSQL and a built app (the Android manifest currently allows clear-text traffic for development).
* **Seven careers.** Adding more means data work and retraining.
* **Match percentage** is relative to the other careers (section 10.3), not an absolute score.
* **Training data is US job adverts.** Postings list what employers ask for, not what students know. Interests are not in that data, so they only influence the rule part. Python Developer and Web Developer accuracy is checked on the hand-written personas only.
* **Resume reading** is dictionary-based: unknown skills are missed, and location is a guess from the header (a college's city can be picked instead of the student's). Everything is confirmed by the student before saving.
* **Accounts:** no password reset, no email verification, a login token cannot be revoked before it expires (7 days), and sign-up reports "email already registered".
* **Not built:** a live job-listing feed (job *titles* come from the analysis), push notifications, an admin panel.
* The test database `pg-mem` imitates PostgreSQL but is not it; `npm run migrate` against the real database is the true check.

---

## 16. Credits and licences

* Job-posting data: **Luke Barousse, `lukebarousse/data_jobs`**, Hugging Face, Apache-2.0. Used only to learn which skills go with which job title and to weight the Data Engineer and Cloud Engineer skills.
* Learning links point to the official documentation and free courses of their respective owners (Python, MDN, Kaggle Learn, Microsoft Learn, AWS, Google Cloud, and others).
* Built with open-source software: React Native, Expo, Express, PostgreSQL, FastAPI, scikit-learn, pandas, NumPy and the other packages listed in each `package.json` / `requirements.txt`.
