"""Career recommendation: weighted skill match + TF-IDF cosine similarity + interest match.

rule = 0.50 * weighted_skill + 0.30 * tfidf_cosine + 0.20 * interest   (+ small project bonus)
final = (1 - ML_WEIGHT) * rule + ML_WEIGHT * P(career | skills) from the model trained on real job postings
If the student gave no interests, the interest weight is redistributed (0.625 / 0.375).
Every component is returned so the result can be explained skill by skill.
"""
from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.services import ml_model
from app.services.knowledge_base import KnowledgeBase

W_SKILL, W_COSINE, W_INTEREST = 0.50, 0.30, 0.20
MAX_PROJECT_BONUS = 0.05
ML_WEIGHT = 0.5  # share of the final score that comes from the trained model (0 = rules only)


def weighted_skill_score(required: list[dict], user_skills: set[str]) -> float:
    """Sum of weights of skills the student has / sum of all weights the career needs."""
    total = sum(r["weight"] for r in required)
    have = sum(r["weight"] for r in required if r["skill"] in user_skills)
    return have / total if total else 0.0


def interest_score(career_tags: list[str], interests: list[str]) -> float:
    """Fraction of the career's interest tags that the student's interests touch."""
    interests = [i.strip().lower() for i in interests if i.strip()]
    if not career_tags or not interests:
        return 0.0
    hit = sum(1 for tag in career_tags if any(tag in i or i in tag for i in interests))
    return hit / len(career_tags)


def _career_doc(required: list[dict]) -> list[str]:
    # each skill repeated by its weight -> heavier skills get a higher term frequency
    return [r["skill"] for r in required for _ in range(r["weight"])]


def tfidf_cosine_scores(kb: KnowledgeBase, user_skills: set[str], project_skills: set[str]) -> dict[str, float]:
    career_ids = kb.career_ids()
    docs = [_career_doc(kb.required_skills(cid)) for cid in career_ids]
    # analyzer=identity: documents are already lists of (possibly multi-word) skill tokens
    vectorizer = TfidfVectorizer(analyzer=lambda doc: doc, vocabulary=sorted(kb.skill_info))
    career_matrix = vectorizer.fit_transform(docs)

    user_doc = sorted(user_skills) + sorted(project_skills)  # project techs count a second time
    if not user_doc:
        return {cid: 0.0 for cid in career_ids}
    sims = cosine_similarity(vectorizer.transform([user_doc]), career_matrix)[0]
    return {cid: float(s) for cid, s in zip(career_ids, sims)}


def recommend(
    kb: KnowledgeBase,
    skills: list[str],
    interests: list[str] | None = None,
    tech_stack: list[str] | None = None,
    experience_type: str | None = None,
    top_n: int = 3,
    weights: tuple[float, float, float] | None = None,
    ml_weight: float | None = None,
) -> list[dict]:
    """`weights` = (skill, cosine, interest) overrides the defaults; `ml_weight` overrides ML_WEIGHT (0 = rules only).
    Both exist for the evaluation experiments."""
    interests = interests or []
    user_skills = kb.canonical_set(skills) | kb.canonical_set(tech_stack or [])
    project_skills = kb.canonical_set(tech_stack or [])
    cosines = tfidf_cosine_scores(kb, user_skills, project_skills)
    use_interest = any(i.strip() for i in interests)
    w_s, w_c, w_i = weights or (W_SKILL, W_COSINE, W_INTEREST)
    if not use_interest:  # no interests given: spread the interest weight over the other two components
        w_i = 0.0
        total = w_s + w_c
        w_s, w_c = (w_s / total, w_c / total) if total else (0.0, 0.0)

    beta = ML_WEIGHT if ml_weight is None else ml_weight
    ml_probs = ml_model.predict_proba(user_skills, kb.career_ids()) if beta > 0 else None
    if ml_probs is None:
        beta = 0.0

    results = []
    for cid in kb.career_ids():
        required = kb.required_skills(cid)
        weighted = weighted_skill_score(required, user_skills)
        cosine = cosines[cid]
        interest = interest_score(kb.career_tags[cid], interests)

        bonus = 0.0
        if experience_type == "practical":
            core = {r["skill"] for r in required if r["type"] == "core"}
            bonus = MAX_PROJECT_BONUS * min(1.0, len(core & project_skills) / 3)

        rule_score = min(1.0, w_s * weighted + w_c * cosine + w_i * interest + bonus)
        ml_p = ml_probs[cid] if ml_probs else 0.0
        final = (1 - beta) * rule_score + beta * ml_p
        results.append(
            {
                "career_id": cid,
                "title": kb.career_titles[cid],
                "description": kb.career_descriptions[cid],
                "score": round(final * 100, 1),
                "breakdown": {
                    "weighted_skill": round(weighted * 100, 1),
                    "tfidf_cosine": round(cosine * 100, 1),
                    "interest": round(interest * 100, 1),
                    "project_bonus": round(bonus * 100, 1),
                    "ml_model": round(ml_p * 100, 1),
                },
                "matched_skills": sorted(r["skill"] for r in required if r["skill"] in user_skills),
                "missing_core_skills": sorted(
                    r["skill"] for r in required if r["type"] == "core" and r["skill"] not in user_skills
                ),
            }
        )
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:top_n]
