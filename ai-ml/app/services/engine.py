"""Glue that runs the whole pipeline for one student profile (used by POST /analyze)."""
from __future__ import annotations

from app.services.job_roles import suggest_roles
from app.services.knowledge_base import KnowledgeBase
from app.services.recommender import recommend
from app.services.roadmap import build_roadmap
from app.services.skill_gap import analyze_gap
from app.services.version import data_version


LOW_CONFIDENCE_SCORE = 20.0  # re-measured on the blended (rules + model) scores: flags 0 of 52 personas (lowest best-score 20.2) and ~1/3 of random 3-skill profiles
MIN_SKILLS_FOR_OK = 2  # a single recognised skill is weak evidence however well it scores


def assess_confidence(kb: KnowledgeBase, skills: list[str], best_score: float) -> dict:
    """Say how much to trust the result, so the app never presents a meaningless match as real.

    none = no recognised technical skill at all (soft skills and unknown skills don't count)
    low  = we recognised something, but the best match is weak or rests on a single skill
    ok   = otherwise
    """
    recognised = kb.canonical_set(skills)
    technical = sorted(s for s in recognised if kb.skill_info[s]["category"] != "soft")
    unrecognised = sorted({s.strip().lower() for s in skills if s.strip() and not kb.canonical(s)})
    if not technical:
        level = "none"
    elif best_score < LOW_CONFIDENCE_SCORE or len(technical) < MIN_SKILLS_FOR_OK:
        level = "low"
    else:
        level = "ok"
    return {"confidence": level, "recognised_skills": technical, "unrecognised_skills": unrecognised}


def analyze_profile(
    kb: KnowledgeBase,
    skills: list[str],
    interests: list[str],
    tech_stack: list[str],
    experience_type: str | None,
    weekly_hours: int = 10,
    top_n: int = 3,
) -> dict:
    # score every career once, so job roles can reuse the scores
    all_scores = recommend(kb, skills, interests, tech_stack, experience_type, top_n=len(kb.career_ids()))
    recommendations = all_scores[:top_n]
    best = recommendations[0]

    all_known = list(set(skills) | set(tech_stack))
    gap = analyze_gap(kb, best["career_id"], all_known)
    roadmap = build_roadmap(
        kb, best["career_id"], [m["skill"] for m in gap["missing_skills"]], all_known, weekly_hours
    )
    roles = suggest_roles(kb, all_known, {r["career_id"]: r["score"] for r in all_scores})
    return {
        "model_version": data_version(),
        **assess_confidence(kb, all_known, best["score"]),
        "recommendations": recommendations,
        "top_career": best["title"],
        "skill_gap": gap,
        "roadmap": roadmap,
        "job_roles": roles,
    }
