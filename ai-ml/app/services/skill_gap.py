"""Skill gap analysis: compare the student's skills with a career's weighted requirements."""
from __future__ import annotations

from app.services.knowledge_base import KnowledgeBase
from app.services.recommender import weighted_skill_score


def analyze_gap(kb: KnowledgeBase, career_id: str, skills: list[str]) -> dict:
    if career_id not in kb.career_titles:
        raise KeyError(career_id)
    user_skills = kb.canonical_set(skills)
    required = kb.required_skills(career_id)

    have = [r for r in required if r["skill"] in user_skills]
    missing = [r for r in required if r["skill"] not in user_skills]
    # core skills first, then heavier weight first
    missing.sort(key=lambda r: (r["type"] != "core", -r["weight"], r["skill"]))

    # "partial": missing skills the student is ready to learn next (knows at least one prerequisite)
    partial = [
        r["skill"] for r in missing
        if any(p in user_skills for p in kb.prereq_map.get(r["skill"], []))
    ]
    return {
        "career_id": career_id,
        "career": kb.career_titles[career_id],
        "readiness_percent": round(weighted_skill_score(required, user_skills) * 100, 1),
        "current_skills": [r["skill"] for r in have],
        "missing_skills": [{"skill": r["skill"], "weight": r["weight"], "type": r["type"]} for r in missing],
        "partial_skills": partial,
    }
