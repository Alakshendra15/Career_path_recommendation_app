"""Entry-level job title suggestions.

role_fit = skill_match(role) * career_score(parent career)
so a role only ranks high if the student both has its skills and fits its career.
"""
from __future__ import annotations

from app.services.knowledge_base import KnowledgeBase, _split


def suggest_roles(kb: KnowledgeBase, skills: list[str], career_scores: dict[str, float], top_n: int = 5) -> list[dict]:
    """career_scores: career_id -> score in 0..100 (from the recommender)."""
    user_skills = kb.canonical_set(skills)
    roles = []
    for row in kb.job_roles.itertuples():
        required = _split(row.required_skills)
        if not required:
            continue
        matched = [s for s in required if s in user_skills]
        match = len(matched) / len(required)
        parent = career_scores.get(row.career_id, 0.0) / 100
        roles.append(
            {
                "title": row.role_title,
                "career": kb.career_titles[row.career_id],
                "level": row.level,
                "fit_percent": round(match * parent * 100, 1),
                "skill_match_percent": round(match * 100, 1),
                "matched_skills": matched,
                "missing_skills": [s for s in required if s not in user_skills],
            }
        )
    roles.sort(key=lambda r: (r["fit_percent"], r["skill_match_percent"]), reverse=True)
    return roles[:top_n]
