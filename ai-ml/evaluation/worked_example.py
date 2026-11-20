"""Step-by-step score calculation for one student, for the report and the viva.

Run from ai-ml/:   python evaluation/worked_example.py
Every number is computed with the real recommender functions and then checked against
recommend(), so this document cannot drift away from the code.
"""
from __future__ import annotations

import os

os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.knowledge_base import get_kb  # noqa: E402
from app.services.recommender import (  # noqa: E402
    W_COSINE,
    W_INTEREST,
    W_SKILL,
    interest_score,
    recommend,
    tfidf_cosine_scores,
    weighted_skill_score,
)

STUDENT = {
    "skills": ["SQL", "Excel", "Power BI", "Python"],
    "interests": ["data", "business"],
    "tech_stack": [],
    "experience_type": "theoretical",
}
SHOW = ["data_analyst", "data_scientist"]


def main() -> None:
    kb = get_kb()
    user = kb.canonical_set(STUDENT["skills"])
    cos = tfidf_cosine_scores(kb, user, set())
    L = [
        "# Worked example: how one student's score is calculated",
        "",
        f"**Student:** skills = {', '.join(STUDENT['skills'])}; interests = {', '.join(STUDENT['interests'])}; theoretical experience.",
        "",
        f"Formula: `final = {W_SKILL} x weighted_skill + {W_COSINE} x tfidf_cosine + {W_INTEREST} x interest`",
        "",
    ]
    official = {r["career_id"]: r for r in recommend(kb, STUDENT["skills"], STUDENT["interests"], top_n=5)}

    for cid in SHOW:
        required = kb.required_skills(cid)
        total = sum(r["weight"] for r in required)
        have = [r for r in required if r["skill"] in user]
        have_w = sum(r["weight"] for r in have)
        weighted = weighted_skill_score(required, user)
        interest = interest_score(kb.career_tags[cid], STUDENT["interests"])
        final = W_SKILL * weighted + W_COSINE * cos[cid] + W_INTEREST * interest

        # the document must agree with the real service
        assert abs(final * 100 - official[cid]["score"]) < 0.06, (cid, final, official[cid]["score"])

        L += [
            f"## {kb.career_titles[cid]}",
            "",
            "**1. Weighted skill match.** Each career lists skills with an importance weight (1-5). We add up the weights of the skills the student has.",
            "",
            "| Skill | Weight | Student has it? |",
            "|---|---|---|",
        ]
        for r in sorted(required, key=lambda r: -r["weight"]):
            L.append(f"| {r['skill']} | {r['weight']} | {'yes' if r['skill'] in user else 'no'} |")
        L += [
            "",
            f"Weighted skill = {have_w} / {total} = **{weighted:.3f}**",
            "",
            "**2. TF-IDF cosine similarity.** The career and the student are each turned into a vector over the skill vocabulary. "
            "TF-IDF gives rare, distinctive skills more weight than common ones, and cosine similarity measures the angle between the two vectors "
            f"(1 = identical direction, 0 = nothing in common). Result: **{cos[cid]:.3f}**",
            "",
            f"**3. Interest match.** The career's interest tags are {', '.join(kb.career_tags[cid])}. The student's interests touch "
            f"{round(interest * len(kb.career_tags[cid]))} of {len(kb.career_tags[cid])} of them = **{interest:.3f}**",
            "",
            f"**4. Final score** = {W_SKILL} x {weighted:.3f} + {W_COSINE} x {cos[cid]:.3f} + {W_INTEREST} x {interest:.3f} = {final:.3f} -> **{final * 100:.1f}%**",
            "",
            f"Missing core skills the student should learn: {', '.join(official[cid]['missing_core_skills']) or 'none'}.",
            "",
        ]
    ranking = ", ".join(f"{r['title']} {r['score']}%" for r in sorted(official.values(), key=lambda r: -r["score"])[:3])
    L += [f"**Ranking:** {ranking}.", ""]
    out = ROOT / "evaluation" / "results" / "WORKED_EXAMPLE.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(L), encoding="utf-8")
    print("\n".join(L))


if __name__ == "__main__":
    main()
