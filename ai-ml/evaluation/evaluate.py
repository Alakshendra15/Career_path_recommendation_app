"""Evaluation of the career recommender.

Run from ai-ml/:   python evaluation/evaluate.py
Writes evaluation/results/ (CSVs, RESULTS.md, figures/).

What it measures
  1. Ablation    - does the hybrid formula beat each of its parts on its own?
  2. Sensitivity - how much do results change when the 0.5/0.3/0.2 weights change?
  3. Per-persona misses and a confusion matrix, to see which careers get confused.
  4. Optional supervised baseline (Logistic Regression / Random Forest) trained on synthetic
     profiles, then tested on the hand-written personas.
  5. Profiles with no recognisable skills: does the system admit it has no signal?

Personas come in two sets: "core" (typical, clean profiles) and "hard" (career-changers,
single-skill profiles, skills outside the knowledge base, conflicting interests, typos).

Honest limits (also printed in RESULTS.md): the personas and the knowledge base were written by
the same team, the sample is small, and the synthetic training data is generated from the same
knowledge base, so synthetic-test accuracy is optimistic by construction.
"""
from __future__ import annotations

import os

os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")  # must be set before numpy loads

import itertools
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.knowledge_base import KnowledgeBase, get_kb  # noqa: E402
from app.services.engine import analyze_profile  # noqa: E402
from app.services.recommender import recommend  # noqa: E402

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
FIGURES = RESULTS / "figures"
SEED = 42

CONFIGS: dict[str, tuple[float, float, float]] = {
    "Weighted skills only": (1.0, 0.0, 0.0),
    "TF-IDF cosine only": (0.0, 1.0, 0.0),
    "Interests only": (0.0, 0.0, 1.0),
    "Skills + cosine (no interests)": (0.625, 0.375, 0.0),
    "Hybrid (0.5 / 0.3 / 0.2)": (0.5, 0.3, 0.2),
}

NO_SIGNAL = {
    "S1 soft skills only": ["communication", "leadership", "ms word"],
    "S2 skills outside the knowledge base": ["kotlin", "swift", "flutter"],
}


def split(value) -> list[str]:
    return [] if pd.isna(value) else [v.strip() for v in str(value).split("|") if v.strip()]


def pct(v: float) -> str:
    return f"{v * 100:.1f}%"


def load_personas() -> pd.DataFrame:
    return pd.read_csv(HERE / "personas.csv")


def rank_careers(kb: KnowledgeBase, row, weights, ml_weight: float | None = 0.0) -> list[str]:
    """ml_weight=0 (default) keeps every experiment in this file rules-only; None = production blend."""
    res = recommend(
        kb,
        split(row.skills),
        split(row.interests),
        split(row.tech_stack),
        row.experience_type,
        top_n=len(kb.career_ids()),
        weights=weights,
        ml_weight=ml_weight,
    )
    return [r["career_id"] for r in res]


def score_rankings(personas: pd.DataFrame, rankings: list[list[str]]) -> dict:
    strict1, lenient1, top3, rr = [], [], [], []
    for row, ranked in zip(personas.itertuples(), rankings):
        ok = {row.expected, *split(row.acceptable)}
        strict1.append(ranked[0] == row.expected)
        lenient1.append(ranked[0] in ok)
        top3.append(row.expected in ranked[:3])
        rr.append(1 / (ranked.index(row.expected) + 1))
    return {
        "top1_strict": float(np.mean(strict1)),
        "top1_lenient": float(np.mean(lenient1)),
        "top3": float(np.mean(top3)),
        "mrr": float(np.mean(rr)),
        "_strict_flags": strict1,
        "_top3_flags": top3,
    }


def bootstrap_ci(flags: list[bool], n: int = 2000) -> tuple[float, float]:
    rng = np.random.default_rng(SEED)
    arr = np.array(flags, dtype=float)
    means = [rng.choice(arr, size=len(arr), replace=True).mean() for _ in range(n)]
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


# ---------------------------------------------------------------- supervised baseline
def make_synthetic(kb: KnowledgeBase, per_career: int = 400):
    rng = np.random.default_rng(SEED)
    skills = sorted(kb.skill_info)
    tags = sorted({t for ts in kb.career_tags.values() for t in ts})
    sk_idx = {s: i for i, s in enumerate(skills)}
    tg_idx = {t: i for i, t in enumerate(tags)}
    X, y = [], []
    for cid in kb.career_ids():
        required = kb.required_skills(cid)
        for _ in range(per_career):
            level = rng.choice([0.5, 0.8, 1.0])  # beginner .. experienced
            vec = np.zeros(len(skills) + len(tags))
            for r in required:
                if rng.random() < (0.75 if r["type"] == "core" else 0.45) * level:
                    vec[sk_idx[r["skill"]]] = 1
            for s in skills:  # noise: unrelated skills
                if rng.random() < 0.06:
                    vec[sk_idx[s]] = 1
            for t in tags:
                own = t in kb.career_tags[cid]
                if rng.random() < (0.5 if own else 0.08):
                    vec[len(skills) + tg_idx[t]] = 1
            X.append(vec)
            y.append(cid)
    return np.array(X), np.array(y), skills, tags


def persona_matrix(kb: KnowledgeBase, personas: pd.DataFrame, skills: list[str], tags: list[str]) -> np.ndarray:
    sk_idx = {s: i for i, s in enumerate(skills)}
    rows = []
    for p in personas.itertuples():
        vec = np.zeros(len(skills) + len(tags))
        for s in kb.canonical_set(split(p.skills) + split(p.tech_stack)):
            vec[sk_idx[s]] = 1
        interests = [i.lower() for i in split(p.interests)]
        for j, t in enumerate(tags):
            if any(t in i or i in t for i in interests):
                vec[len(skills) + j] = 1
        rows.append(vec)
    return np.array(rows)


def supervised_baseline(kb: KnowledgeBase, personas: pd.DataFrame) -> list[dict]:
    X, y, skills, tags = make_synthetic(kb)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, stratify=y, random_state=SEED)
    P = persona_matrix(kb, personas, skills, tags)
    is_core = (personas["set"] == "core").to_numpy()
    out = []
    models = {
        "Logistic Regression": LogisticRegression(max_iter=2000),
        "Random Forest": RandomForestClassifier(n_estimators=100, random_state=SEED, n_jobs=1),
    }
    for name, model in models.items():
        model.fit(X_tr, y_tr)
        classes = list(model.classes_)
        rankings = [[classes[i] for i in np.argsort(-proba)] for proba in model.predict_proba(P)]
        m_core = score_rankings(personas[is_core], [r for r, c in zip(rankings, is_core) if c])
        m_hard = score_rankings(personas[~is_core], [r for r, c in zip(rankings, is_core) if not c])
        out.append(
            {
                "model": name,
                "synthetic_test_accuracy": float(model.score(X_te, y_te)),
                "core_top1_strict": m_core["top1_strict"],
                "hard_top1_strict": m_hard["top1_strict"],
                "hard_top1_lenient": m_hard["top1_lenient"],
                "hard_top3": m_hard["top3"],
            }
        )
    return out


# ---------------------------------------------------------------- figures
def fig_ablation(df: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(9, 4.5))
    x = np.arange(len(df))
    w = 0.26
    cols = [("core_top1_strict", "Core top-1"), ("hard_top1_strict", "Hard top-1 (strict)"), ("hard_top3", "Hard top-3")]
    for i, (col, label) in enumerate(cols):
        ax.bar(x + (i - 1) * w, df[col] * 100, w, label=label)
    ax.set_xticks(x)
    ax.set_xticklabels([c.replace(" (", "\n(") for c in df["config"]], fontsize=8)
    ax.set_ylabel("Accuracy (%)")
    ax.set_ylim(0, 118)
    ax.legend(loc="upper center", ncol=3, frameon=False)
    ax.set_title("Ablation: each part of the formula vs the hybrid")
    fig.tight_layout()
    fig.savefig(FIGURES / "ablation.png", dpi=150)
    plt.close(fig)


def fig_confusion(cm: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.imshow(cm.values, cmap="Blues")
    ax.set_xticks(range(len(cm.columns)))
    ax.set_xticklabels(cm.columns, rotation=30, ha="right", fontsize=8)
    ax.set_yticks(range(len(cm.index)))
    ax.set_yticklabels(cm.index, fontsize=8)
    for i, j in itertools.product(range(len(cm.index)), range(len(cm.columns))):
        ax.text(j, i, cm.values[i, j], ha="center", va="center", color="white" if cm.values[i, j] > cm.values.max() / 2 else "black")
    ax.set_xlabel("Predicted (top-1)")
    ax.set_ylabel("Expected")
    ax.set_title("Confusion matrix: hybrid recommender, all personas")
    fig.tight_layout()
    fig.savefig(FIGURES / "confusion_matrix.png", dpi=150)
    plt.close(fig)


# ---------------------------------------------------------------- main
def main() -> None:
    RESULTS.mkdir(exist_ok=True)
    FIGURES.mkdir(exist_ok=True)
    kb = get_kb()
    personas = load_personas()
    titles = kb.career_titles
    is_core = (personas["set"] == "core").to_numpy()
    core, hard = personas[is_core], personas[~is_core]

    def split_by_set(rankings):
        return [r for r, c in zip(rankings, is_core) if c], [r for r, c in zip(rankings, is_core) if not c]

    # 1. ablation
    rows, hybrid = [], None
    for name, weights in CONFIGS.items():
        rankings = [rank_careers(kb, p, weights) for p in personas.itertuples()]
        r_core, r_hard = split_by_set(rankings)
        m_core, m_hard = score_rankings(core, r_core), score_rankings(hard, r_hard)
        m_all = score_rankings(personas, rankings)
        rows.append(
            {
                "config": name,
                "core_top1_strict": m_core["top1_strict"],
                "hard_top1_strict": m_hard["top1_strict"],
                "hard_top1_lenient": m_hard["top1_lenient"],
                "hard_top3": m_hard["top3"],
                "all_top3": m_all["top3"],
                "all_mrr": m_all["mrr"],
            }
        )
        if name.startswith("Hybrid"):
            hybrid = (m_all, m_hard, rankings)
    ablation = pd.DataFrame(rows)
    ablation.to_csv(RESULTS / "ablation.csv", index=False)

    # 2. weight sensitivity (step 0.1 over the simplex), scored on the hard set and on all personas
    sweep = []
    for ws in range(11):
        for wc in range(11 - ws):
            weights = (ws / 10, wc / 10, (10 - ws - wc) / 10)
            rankings = [rank_careers(kb, p, weights) for p in personas.itertuples()]
            _, r_hard = split_by_set(rankings)
            sweep.append(
                {
                    "w_skill": weights[0],
                    "w_cosine": weights[1],
                    "w_interest": weights[2],
                    "hard_top1_strict": score_rankings(hard, r_hard)["top1_strict"],
                    "all_top1_strict": score_rankings(personas, rankings)["top1_strict"],
                }
            )
    sweep_df = pd.DataFrame(sweep)
    sweep_df.to_csv(RESULTS / "weight_sweep.csv", index=False)

    # 3. per-persona detail + confusion matrix for the hybrid
    m_all, m_hard, h_rankings = hybrid
    detail = personas[["set", "id", "note", "expected", "acceptable"]].copy()
    detail["predicted_top1"] = [r[0] for r in h_rankings]
    detail["top3"] = ["|".join(r[:3]) for r in h_rankings]
    detail["strict_correct"] = m_all["_strict_flags"]
    detail["lenient_correct"] = [r[0] in {e, *split(a)} for r, e, a in zip(h_rankings, personas.expected, personas.acceptable)]
    detail["in_top3"] = m_all["_top3_flags"]
    detail.to_csv(RESULTS / "per_persona.csv", index=False)
    ids = kb.career_ids()
    cats = [titles[i] for i in ids]
    cm = pd.crosstab(
        pd.Categorical(detail["expected"].map(titles), categories=cats),
        pd.Categorical(detail["predicted_top1"].map(titles), categories=cats),
        dropna=False,
    )
    cm.index.name, cm.columns.name = None, None

    # 4. supervised baseline
    sup = supervised_baseline(kb, personas)
    pd.DataFrame(sup).to_csv(RESULTS / "supervised_baseline.csv", index=False)

    # 5. profiles with no recognisable signal: what does the system say?
    no_signal = {}
    for label, skills in NO_SIGNAL.items():
        out = analyze_profile(kb, skills, [], [], None)
        no_signal[label] = {
            "best": out["recommendations"][0]["title"],
            "best_score": out["recommendations"][0]["score"],
            "confidence": out["confidence"],
        }
    # how often does the flag fire on real-looking personas? (false alarms)
    flag_counts = {"core": {"none": 0, "low": 0, "ok": 0}, "hard": {"none": 0, "low": 0, "ok": 0}}
    for p in personas.itertuples():
        out = analyze_profile(kb, split(p.skills), split(p.interests), split(p.tech_stack), p.experience_type)
        flag_counts[p.set][out["confidence"]] += 1

    fig_ablation(ablation)
    fig_confusion(cm)

    hard_flags = [f for f, c in zip(m_all["_strict_flags"], is_core) if not c]
    ci_hard, ci_all = bootstrap_ci(hard_flags), bootstrap_ci(m_all["_strict_flags"])
    best_hard = float(sweep_df.hard_top1_strict.max())
    hybrid_row = sweep_df[(sweep_df.w_skill == 0.5) & (sweep_df.w_cosine == 0.3)].iloc[0]
    n_tied_hard = int((sweep_df.hard_top1_strict == best_hard).sum())
    summary = {
        "personas": {"core": int(is_core.sum()), "hard": int((~is_core).sum())},
        "hybrid_hard": {k: v for k, v in m_hard.items() if not k.startswith("_")},
        "hybrid_hard_top1_strict_ci95": ci_hard,
        "hybrid_all_top1_strict_ci95": ci_all,
        "sweep_hard_top1_min_max": [float(sweep_df.hard_top1_strict.min()), best_hard],
        "sweep_hybrid_hard_top1": float(hybrid_row.hard_top1_strict),
        "sweep_combos_tied_for_best_on_hard": n_tied_hard,
        "sweep_combinations": len(sweep_df),
        "supervised": sup,
        "no_signal": no_signal,
        "confidence_flag_counts": flag_counts,
    }
    (RESULTS / "summary.json").write_text(json.dumps(summary, indent=2))

    # ---- RESULTS.md: numbers only; interpretation lives in documentation/project-report/ml-evaluation.md
    L = [
        "# Recommender evaluation results",
        "",
        f"Personas: **{len(core)} core** + **{len(hard)} hard** (`evaluation/personas.csv`). Core = typical, clean profiles. "
        "Hard = career-changers, single-skill profiles, skills outside the knowledge base, conflicting interests and typos. "
        "Labels for both sets were fixed before the results were seen. Generated by `python evaluation/evaluate.py`.",
        "",
        "## 1. Ablation",
        "",
        "| Configuration | Core top-1 | Hard top-1 strict | Hard top-1 lenient | Hard top-3 | All top-3 | All MRR |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        L.append(
            f"| {r['config']} | {pct(r['core_top1_strict'])} | {pct(r['hard_top1_strict'])} | {pct(r['hard_top1_lenient'])} "
            f"| {pct(r['hard_top3'])} | {pct(r['all_top3'])} | {r['all_mrr']:.2f} |"
        )
    L += [
        "",
        "Strict = the single expected career. Lenient = expected or a listed acceptable alternative (genuinely ambiguous profiles). "
        "MRR = mean reciprocal rank of the expected career.",
        "",
        f"Hybrid strict top-1, 95% bootstrap interval: hard set {pct(ci_hard[0])}-{pct(ci_hard[1])} (n={len(hard)}); "
        f"all personas {pct(ci_all[0])}-{pct(ci_all[1])} (n={len(personas)}).",
        "",
        "## 2. Weight sensitivity",
        "",
        f"{len(sweep_df)} weight combinations (step 0.1). On the hard set strict top-1 ranged {pct(float(sweep_df.hard_top1_strict.min()))} to {pct(best_hard)}; "
        f"the chosen 0.5/0.3/0.2 scores {pct(float(hybrid_row.hard_top1_strict))}, and {n_tied_hard} combinations tie for the best score. Full table: `weight_sweep.csv`.",
        "",
        "## 3. Misclassified personas (hybrid, strict)",
        "",
    ]
    wrong = detail[~detail.strict_correct]
    if wrong.empty:
        L.append("None.")
    else:
        L += ["| Persona | Expected | Predicted | Acceptable? | Top-3 |", "|---|---|---|---|---|"]
        for r in wrong.itertuples():
            L.append(
                f"| {r.id} {r.note} | {titles[r.expected]} | {titles[r.predicted_top1]} | {'yes' if r.lenient_correct else 'no'} "
                f"| {', '.join(titles[c] for c in r.top3.split('|'))} |"
            )
    L += ["", "![confusion](figures/confusion_matrix.png)", "", "![ablation](figures/ablation.png)", ""]
    L += [
        "## 4. Supervised baseline (synthetic training data)",
        "",
        "| Model | Synthetic test accuracy | Core top-1 | Hard top-1 strict | Hard top-1 lenient | Hard top-3 |",
        "|---|---|---|---|---|---|",
    ]
    for s in sup:
        L.append(
            f"| {s['model']} | {pct(s['synthetic_test_accuracy'])} | {pct(s['core_top1_strict'])} | {pct(s['hard_top1_strict'])} "
            f"| {pct(s['hard_top1_lenient'])} | {pct(s['hard_top3'])} |"
        )
    L += [
        "",
        "The synthetic data comes from the same knowledge base the recommender uses, so the synthetic-test column is optimistic by construction.",
        "",
        "## 5. Confidence flag",
        "",
        "Profiles with no recognisable technical skills (before this flag existed the app would have shown the first career, at 0-10%, as the best match):",
        "",
        "| Profile | Top career returned | Its score | Confidence flag |",
        "|---|---|---|---|",
    ]
    for label, v in no_signal.items():
        L.append(f"| {label} | {v['best']} | {v['best_score']}% | {v['confidence']} |")
    L += [
        "",
        "How often the flag fires on the personas (all of them are real-looking profiles, so `none`/`low` here are false alarms, except where a profile really is thin):",
        "",
        "| Set | none | low | ok |",
        "|---|---|---|---|",
    ]
    for s, c in flag_counts.items():
        L.append(f"| {s} | {c['none']} | {c['low']} | {c['ok']} |")
    L += [
        "",
        "The 20% threshold for `low` is a judgement call chosen after seeing the persona scores; it has not been validated on independent data.",
        "",
        "",
        "## Limitations",
        "",
        "- Personas and the knowledge base were written by the same team; independent labels (classmates, real job postings) would be stronger evidence.",
        f"- {len(personas)} personas in total is a small sample; treat differences of a few percentage points as noise.",
        "- The sensitivity sweep reuses the same personas, so it shows robustness, not an independent test of the chosen weights.",
    ]
    (RESULTS / "RESULTS.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


if __name__ == "__main__":
    main()
