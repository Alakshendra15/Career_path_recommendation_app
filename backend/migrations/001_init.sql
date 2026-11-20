CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age             INTEGER,
  education       TEXT,
  state           TEXT,
  city            TEXT,
  skills          JSONB NOT NULL DEFAULT '[]',
  interests       JSONB NOT NULL DEFAULT '[]',
  experience_type TEXT,
  project_title   TEXT,
  tech_stack      JSONB NOT NULL DEFAULT '[]',
  completed       BOOLEAN NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resumes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename   TEXT,
  parsed     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resumes_user ON resumes(user_id);

-- one cached ML result per user, keyed by a hash of the profile that produced it
CREATE TABLE recommendations (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_hash TEXT NOT NULL,
  result       JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
