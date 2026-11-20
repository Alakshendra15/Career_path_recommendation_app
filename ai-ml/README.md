# AI/ML Service (FastAPI)

Explainable career recommendation for 7 careers: hand-written scoring rules (weighted skill matching + TF-IDF cosine similarity
+ interest match) blended with a logistic regression trained on ~580k real job postings. The rules are driven by a knowledge base
in `data/*.csv`. The model is optional: without `app/models/career_model.joblib` the service uses the rules only and logs a warning.

## Run
```
pip install -r requirements.txt
uvicorn main:app --reload --port 8000     # Swagger docs: http://localhost:8000/docs
python -m pytest -q -s                    # tests + persona accuracy
```

## Endpoints
`GET /health`, `GET /careers`, `POST /resume/analyze` (PDF, field `resume`), `POST /recommend`,
`POST /skill-gap`, `POST /roadmap`, `POST /job-roles`, `POST /analyze` (everything in one call).

## Scoring
`rule = 0.50*weighted_skill + 0.30*tfidf_cosine + 0.20*interest (+ up to 5% project bonus)`; with no interests the weights become 0.625 / 0.375.
`final = (1 - ML_WEIGHT) * rule + ML_WEIGHT * P(career | skills)` with `ML_WEIGHT = 0.5`. See `app/services/recommender.py`.

Note on the percentage: the model part is a probability shared across the 7 careers, so for careers that overlap with others
(e.g. Data Scientist vs ML Engineer) even a student who knows every listed skill scores below 100%. Read the match as
"how well this career fits compared with the others", not as a share of required skills.

Training, data download and accuracy: `training/README.md` and `evaluation/results/MODEL_RESULTS.md`.
Retrain after any change to `careers.csv` / `skills.csv`. `/health` reports a `data_version` fingerprint of the CSVs and the model;
the backend recomputes cached analyses when it changes.

## Resume reading
`POST /resume/analyze` returns skills plus guesses for the onboarding form (name, age from an explicit date of birth, education level,
project, interests from an explicit Interests section). A field is left empty when the text gives no evidence. Words that are also
ordinary English (express, react, excel, go, shell, agile ...) only count as skills inside a skills-style list; see `app/services/skill_extractor.py`.

## Evaluation
`python evaluation/evaluate.py` runs 52 personas (32 core, 20 hard) through an ablation, weight sensitivity, confusion matrix,
a supervised baseline and the confidence-flag check. `python evaluation/worked_example.py` prints a step-by-step score.
Interpretation and limitations: `../documentation/project-report/ml-evaluation.md`.

## Layout
`app/services/` one module per feature - knowledge_base, skill_extractor, resume_parser, recommender,
skill_gap, roadmap, job_roles, engine, ml_model (trained classifier), version (data fingerprint). `app/api/routes.py` REST layer. `tests/` pytest suite.
