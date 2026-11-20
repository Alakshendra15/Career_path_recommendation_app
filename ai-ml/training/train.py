"""Train the career classifier on real job postings and measure it honestly.

    python training/train.py

Data
  * REAL: lukebarousse/data_jobs (Apache-2.0). Each posting = list of skills + a job-title category.
      Data Analyst -> data_analyst, Data Scientist -> data_scientist, Data Engineer -> data_engineer,
      Machine Learning Engineer -> ml_engineer, Cloud Engineer -> cloud_engineer  ("Senior ..." merged)
  * SYNTHETIC: python_developer and web_developer have no label in that dataset, so they are generated
      from the hand-written knowledge base (clearly marked in the report; real-data accuracy excludes them).

Honesty rules
  * train / test are split by *skill set* (hash), so an identical posting never sits on both sides
  * the rule-based recommender is scored on the very same held-out postings for a fair comparison
  * job-title labels are noisy (two 'Data Analyst' and 'Data Scientist' postings can list the same
    skills), so top-3 accuracy is reported next to top-1

Output: app/models/career_model.joblib, evaluation/results/model_metrics.json
"""
from __future__ import annotations

import ast
import hashlib
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.services.knowledge_base import get_kb  # noqa: E402
from app.services.recommender import recommend  # noqa: E402

PARQUET = ROOT / "data" / "real" / "data_jobs.parquet"
MODEL_PATH = ROOT / "app" / "models" / "career_model.joblib"
METRICS_PATH = ROOT / "evaluation" / "results" / "model_metrics.json"
SEED = 42

TITLE_TO_CAREER = {
    "Data Analyst": "data_analyst", "Senior Data Analyst": "data_analyst",
    "Data Scientist": "data_scientist", "Senior Data Scientist": "data_scientist",
    "Data Engineer": "data_engineer", "Senior Data Engineer": "data_engineer",
    "Machine Learning Engineer": "ml_engineer",
    "Cloud Engineer": "cloud_engineer",
}
SYNTHETIC_CAREERS = ["python_developer", "web_developer"]
WEB_SKILLS = {"javascript", "typescript", "react", "angular", "vue", "html", "css", "node.js", "express", "responsive design"}
PY_SKILLS = {"python", "django", "flask", "fastapi"}


def fold_of(skillset: tuple[str, ...]) -> int:
    """0-9, stable. Folds 0-6 train, 7 validation, 8-9 test (grouped by skill set)."""
    return int(hashlib.md5("|".join(skillset).encode()).hexdigest(), 16) % 10


def load_real(kb) -> pd.DataFrame:
    df = pd.read_parquet(PARQUET, columns=["job_title_short", "job_skills"]).dropna(subset=["job_skills"])
    df = df[df.job_title_short.isin(TITLE_TO_CAREER)]
    df["career"] = df.job_title_short.map(TITLE_TO_CAREER)
    canon_cache: dict[str, str | None] = {}

    def canon(raw: str) -> tuple[str, ...]:
        out = set()
        for s in ast.literal_eval(raw):
            if s not in canon_cache:
                canon_cache[s] = kb.canonical(s)
            if canon_cache[s]:
                out.add(canon_cache[s])
        return tuple(sorted(out))

    df["skills"] = df.job_skills.map(canon)
    df = df[df.skills.map(len) > 0]
    # compact: one row per unique (skill set, career) with its posting count
    g = df.groupby(["skills", "career"]).size().rename("n").reset_index()
    g["fold"] = g.skills.map(fold_of)
    return g


def load_weak(kb) -> pd.DataFrame:
    """Weak labels for the two careers the dataset has no title for, from real 'Software Engineer' postings:
    Python (no web skills) -> python_developer, web skills (no Python) -> web_developer; mixed ones are skipped.
    The label is derived from the skills themselves, so this teaches realistic co-occurring skills (cloud, git,
    docker ...) but is NOT an independent test, and is never counted in the accuracy figures."""
    df = pd.read_parquet(PARQUET, columns=["job_title_short", "job_skills"]).dropna(subset=["job_skills"])
    df = df[df.job_title_short == "Software Engineer"]
    rows = []
    for raw in df.job_skills:
        ss = {c for s in ast.literal_eval(raw) if (c := kb.canonical(s))}
        has_py, has_web = bool(ss & PY_SKILLS), bool(ss & WEB_SKILLS)
        if has_py and not has_web:
            rows.append((tuple(sorted(ss)), "python_developer"))
        elif has_web and not has_py:
            rows.append((tuple(sorted(ss)), "web_developer"))
    g = pd.DataFrame(rows, columns=["skills", "career"]).groupby(["skills", "career"]).size().rename("n").reset_index()
    g["fold"] = g.skills.map(fold_of)
    return g


def make_synthetic(kb, real_skill_freq: dict[str, float], per_career: int = 3000) -> pd.DataFrame:
    """Profiles for careers without real labels: required skills (by weight) plus real-world noise skills."""
    rng = np.random.default_rng(SEED)
    vocab = sorted(kb.skill_info)
    noise_p = np.array([real_skill_freq.get(s, 0.01) for s in vocab])
    noise_p = noise_p / noise_p.sum()
    rows = []
    for cid in SYNTHETIC_CAREERS:
        req = kb.required_skills(cid)
        for _ in range(per_career):
            keep = 0.45 + 0.4 * rng.random()  # beginner .. experienced
            s = {r["skill"] for r in req if rng.random() < (0.8 if r["type"] == "core" else 0.45) * keep}
            for extra in rng.choice(vocab, size=rng.integers(0, 3), p=noise_p):  # 0-2 unrelated skills
                s.add(str(extra))
            if s:
                rows.append((tuple(sorted(s)), cid))
    g = pd.DataFrame(rows, columns=["skills", "career"]).groupby(["skills", "career"]).size().rename("n").reset_index()
    g["fold"] = g.skills.map(fold_of)
    return g


def matrix(skill_sets, vocab_idx: dict[str, int]) -> np.ndarray:
    X = np.zeros((len(skill_sets), len(vocab_idx)), dtype=np.float32)
    for i, ss in enumerate(skill_sets):
        for s in ss:
            if s in vocab_idx:
                X[i, vocab_idx[s]] = 1
    return X


def topk_acc(proba: np.ndarray, y_idx: np.ndarray, w: np.ndarray, k: int) -> float:
    top = np.argsort(-proba, axis=1)[:, :k]
    return float(((top == y_idx[:, None]).any(axis=1) * w).sum() / w.sum())


def main() -> None:
    kb = get_kb()
    vocab = sorted(kb.skill_info)
    vocab_idx = {s: i for i, s in enumerate(vocab)}
    classes = sorted(kb.career_ids())
    cls_idx = {c: i for i, c in enumerate(classes)}

    real = load_real(kb)
    freq = {s: 0.0 for s in vocab}
    tot = real.n.sum()
    for ss, n in zip(real.skills, real.n):
        for s in ss:
            freq[s] += n / tot
    syn = make_synthetic(kb, freq)
    print(f"real: {int(real.n.sum()):,} postings / {len(real):,} unique rows; synthetic: {int(syn.n.sum()):,}")
    print(real.groupby("career").n.sum().to_dict())

    weak = load_weak(kb)
    print(f"weak-labelled software-engineer postings: {int(weak.n.sum()):,} {weak.groupby('career').n.sum().to_dict()}")
    data = pd.concat([real.assign(src="real"), weak.assign(src="weak"), syn.assign(src="synthetic")], ignore_index=True)
    data["y"] = data.career.map(cls_idx)

    # class balance: every career gets the same total training weight (students are not "mostly data engineers")
    train = data[data.fold <= 6].copy()
    class_total = train.groupby("career").n.sum()
    train["w"] = train.n / train.career.map(class_total) * class_total.median()
    val = data[data.fold == 7]
    test = data[data.fold >= 8]

    Xtr, Xva, Xte = (matrix(d.skills, vocab_idx) for d in (train, val, test))

    # pick regularisation on the validation fold
    best = None
    for C in (0.05, 0.2, 1.0, 5.0):
        m = LogisticRegression(C=C, max_iter=3000)
        m.fit(Xtr, train.y, sample_weight=train.w)
        acc = topk_acc(m.predict_proba(Xva), val.y.to_numpy(), val.n.to_numpy(float), 1)
        print(f"  C={C}: validation top-1 {acc:.3f}")
        if best is None or acc > best[0]:
            best = (acc, C, m)
    _, C, model = best
    print(f"chosen C={C}")

    # ---------- held-out evaluation (real postings only) ----------
    real_te = test[test.src == "real"]
    P = model.predict_proba(matrix(real_te.skills, vocab_idx))
    y = real_te.y.to_numpy()
    w = real_te.n.to_numpy(float)
    ml = {"top1": topk_acc(P, y, w, 1), "top3": topk_acc(P, y, w, 3)}
    pred = P.argmax(1)
    real_labels = sorted(cls_idx[c] for c in set(real_te.career))
    ml["macro_f1"] = float(f1_score(y, pred, labels=real_labels, average="macro", sample_weight=w))
    per_class = {}
    for c in sorted(set(real_te.career)):
        mask = y == cls_idx[c]
        per_class[c] = float(((pred[mask] == y[mask]) * w[mask]).sum() / w[mask].sum())

    # majority-class and rule-based baselines on the same held-out postings
    maj = real_te.groupby("career").n.sum().max() / real_te.n.sum()
    rng = np.random.default_rng(SEED)
    sample = real_te.sample(n=min(4000, len(real_te)), weights="n", replace=True, random_state=SEED)
    hits1 = hits3 = 0
    for ss, career in zip(sample.skills, sample.career):
        top = [r["career_id"] for r in recommend(kb, list(ss), top_n=3, ml_weight=0)]
        hits1 += top[0] == career
        hits3 += career in top
    rule = {"top1": hits1 / len(sample), "top3": hits3 / len(sample), "n_sampled_postings": len(sample)}

    # same sample for the ML model, for an apples-to-apples row
    Ps = model.predict_proba(matrix(sample.skills, vocab_idx))
    ys = sample.y.to_numpy()
    ml_same = {"top1": float((Ps.argmax(1) == ys).mean()), "top3": float((np.argsort(-Ps, 1)[:, :3] == ys[:, None]).any(1).mean())}

    metrics = {
        "data": {"real_postings": int(real.n.sum()), "unique_real_rows": int(len(real)),
                 "test_postings": int(real_te.n.sum()), "classes": classes,
                 "real_classes": sorted(set(real.career)), "weak_label_classes": SYNTHETIC_CAREERS,
                 "weak_postings": int(weak.n.sum()), "synthetic_samples": int(syn.n.sum())},
        "chosen_C": C,
        "held_out_real": {"model": ml, "per_class_recall": per_class, "majority_class_top1": float(maj)},
        "same_sample_comparison": {"rule_based": rule, "model": ml_same},
    }
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    # final model: refit on train + validation (test stays untouched)
    full = pd.concat([train, val.assign(w=val.n / val.career.map(class_total) * class_total.median())])
    final = LogisticRegression(C=C, max_iter=3000)
    final.fit(matrix(full.skills, vocab_idx), full.y, sample_weight=full.w)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": final, "vocab": vocab, "classes": [classes[i] for i in final.classes_], "metrics": metrics}, MODEL_PATH)

    print(json.dumps(metrics["held_out_real"], indent=2))
    print("same-sample comparison:", json.dumps(metrics["same_sample_comparison"]))
    print(f"saved {MODEL_PATH}")


if __name__ == "__main__":
    main()
