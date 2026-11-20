# System architecture

## Components

```mermaid
flowchart LR
    App["Android app<br/>(Expo / React Native)"] -->|"REST + Bearer token"| API["Express API<br/>(Node.js)"]
    API -->|"pg (SQL)"| DB[("PostgreSQL<br/>users, profiles,<br/>resumes, cached results")]
    API -->|"REST (JSON / PDF)"| ML["ML service<br/>(FastAPI + scikit-learn)"]
    ML --> KB[["Knowledge base<br/>CSV files:<br/>careers, skills, weights,<br/>prerequisites, resources, roles"]]
```

The ML service is stateless. All user data lives in PostgreSQL, owned by the Express API.

## Career analysis request

```mermaid
sequenceDiagram
    participant A as App
    participant E as Express API
    participant D as PostgreSQL
    participant M as ML service
    A->>E: POST /ai/career-analysis (Bearer token)
    E->>D: load student profile
    alt profile hash unchanged and cache under 7 days old
        E->>D: read cached ML result
    else new or changed profile
        E->>M: POST /analyze (skills, interests, tech stack)
        M-->>E: recommendations, skill gap, roadmap, job roles, confidence
        E->>D: store result with profile hash
    end
    E-->>A: mapped result (recommendedRole, missingSkills, roadmap, confidence ...)
```

## Inside the ML service

```mermaid
flowchart TD
    P["Student profile<br/>skills, interests, projects"] --> N["Normalise skills<br/>(aliases: JS to javascript)"]
    N --> W["Weighted skill match"]
    N --> T["TF-IDF cosine similarity"]
    P --> I["Interest match"]
    W --> F["Final score per career<br/>0.5 W + 0.3 T + 0.2 I"]
    T --> F
    I --> F
    F --> R["Ranked careers + score breakdown"]
    R --> G["Skill gap for top career"]
    G --> RM["Roadmap<br/>(prerequisites first, phased)"]
    R --> J["Entry-level job roles"]
    N --> C["Confidence check<br/>none / low / ok"]
    R --> C
```

Resume analysis is a separate path: PDF, then text extraction (`pdfplumber`), then dictionary skill matching against the same skill vocabulary, then the skills are merged into the profile.

## Where things live

| Part | Folder | Run / test |
|---|---|---|
| Mobile app | `frontend/` | `npx expo start`, `npx tsc --noEmit` |
| API | `backend/` | `npm run dev`, `npm test` |
| ML service | `ai-ml/` | `uvicorn main:app --port 8000`, `python -m pytest -q` |
| Evaluation | `ai-ml/evaluation/` | `python evaluation/evaluate.py` |
