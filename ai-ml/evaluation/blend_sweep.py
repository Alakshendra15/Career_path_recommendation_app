"""Choose how much of the final score comes from the trained model (ML_WEIGHT).

Real held-out postings are split by skill-set hash: fold 8 is used to TUNE the blend, fold 9 is REPORTED
(neither was seen when the model was trained). The 52 hand-written personas are scored alongside as a
student-style sanity check. Output: evaluation/results/blend_sweep.csv

    python evaluation/blend_sweep.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent / "training"))
sys.path.insert(0, str(HERE))

import train as T  # noqa: E402
from evaluate import load_personas, rank_careers, score_rankings  # noqa: E402
from app.services.recommender import recommend  # noqa: E402

BETAS = [0.0, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0]


def real_scores(kb, df: pd.DataFrame, beta: float) -> tuple[float, float]:
    h1 = h3 = 0
    for ss, career in zip(df.skills, df.career):
        top = [r["career_id"] for r in recommend(kb, list(ss), top_n=3, ml_weight=beta)]
        h1 += top[0] == career
        h3 += career in top
    return h1 / len(df), h3 / len(df)


def main() -> None:
    kb = T.get_kb()
    real = T.load_real(kb)
    pers = load_personas()
    is_core = (pers["set"] == "core").to_numpy()
    samples = {f: real[real.fold == f].sample(n=3000, weights="n", replace=True, random_state=T.SEED) for f in (8, 9)}
    rows = []
    for b in BETAS:
        r8 = real_scores(kb, samples[8], b)
        r9 = real_scores(kb, samples[9], b)
        ranks = [rank_careers_ml(kb, r, b) for r in pers.itertuples()]
        core = score_rankings(pers[is_core], [x for x, c in zip(ranks, is_core) if c])
        hard = score_rankings(pers[~is_core], [x for x, c in zip(ranks, is_core) if not c])
        rows.append({"ml_weight": b, "real_tune_top1": r8[0], "real_tune_top3": r8[1], "real_report_top1": r9[0], "real_report_top3": r9[1],
                     "core_top1": core["top1_strict"], "hard_strict": hard["top1_strict"], "hard_lenient": hard["top1_lenient"], "hard_top3": hard["top3"]})
        print({k: round(v, 3) for k, v in rows[-1].items()})
    pd.DataFrame(rows).to_csv(HERE / "results" / "blend_sweep.csv", index=False)


def rank_careers_ml(kb, row, beta):
    from evaluate import split
    res = recommend(kb, split(row.skills), split(row.interests), split(row.tech_stack), row.experience_type, top_n=len(kb.career_ids()), ml_weight=beta)
    return [r["career_id"] for r in res]


if __name__ == "__main__":
    main()
