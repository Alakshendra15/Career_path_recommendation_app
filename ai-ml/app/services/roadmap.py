"""Personalised learning roadmap.

1. Take the missing skills and add any prerequisite the student also lacks.
2. Order them with a topological sort (prerequisites always come first).
3. Group into phases by skill level: Foundation -> Core -> Advanced, then a portfolio project.
4. Estimate duration = total hours / weekly study hours.
"""
from __future__ import annotations

import math

from app.services.knowledge_base import LEVEL_ORDER, KnowledgeBase

PHASE_TITLES = ["Foundation", "Core Skills", "Advanced Skills"]


def _expand_with_prereqs(kb: KnowledgeBase, targets: list[str], known: set[str]) -> set[str]:
    needed: set[str] = set()
    stack = list(targets)
    while stack:
        skill = stack.pop()
        if skill in needed or skill in known:
            continue
        needed.add(skill)
        stack.extend(kb.prereq_map.get(skill, []))
    return needed


def _topo_order(kb: KnowledgeBase, skills: set[str], weights: dict[str, int]) -> list[str]:
    indegree = {s: 0 for s in skills}
    children: dict[str, list[str]] = {s: [] for s in skills}
    for s in skills:
        for p in kb.prereq_map.get(s, []):
            if p in skills:
                indegree[s] += 1
                children[p].append(s)

    def key(s: str):  # easier level first, then heavier weight, then name
        return (LEVEL_ORDER[kb.skill_info[s]["level"]], -weights.get(s, 0), s)

    ready = sorted((s for s, d in indegree.items() if d == 0), key=key)
    order: list[str] = []
    while ready:
        s = ready.pop(0)
        order.append(s)
        for c in children[s]:
            indegree[c] -= 1
            if indegree[c] == 0:
                ready.append(c)
        ready.sort(key=key)
    return order


def build_roadmap(
    kb: KnowledgeBase,
    career_id: str,
    missing_skills: list[str],
    known_skills: list[str] | None = None,
    weekly_hours: int = 10,
) -> list[dict]:
    known = kb.canonical_set(known_skills or [])
    targets = [s for s in (kb.canonical(m) for m in missing_skills) if s and s not in known]
    weights = {r["skill"]: r["weight"] for r in kb.required_skills(career_id)}
    skills = _expand_with_prereqs(kb, targets, known)
    order = _topo_order(kb, skills, weights)
    weekly_hours = max(1, weekly_hours)

    # phase = level of the skill, but never earlier than the phase of its prerequisites
    phase_of: dict[str, int] = {}
    for s in order:
        phase = LEVEL_ORDER[kb.skill_info[s]["level"]]
        for p in kb.prereq_map.get(s, []):
            if p in phase_of:
                phase = max(phase, phase_of[p])
        phase_of[s] = phase

    roadmap: list[dict] = []
    for idx, title in enumerate(PHASE_TITLES):
        phase_skills = [s for s in order if phase_of[s] == idx]
        if not phase_skills:
            continue
        hours = sum(kb.skill_info[s]["est_hours"] for s in phase_skills)
        roadmap.append(
            {
                "phase": len(roadmap) + 1,
                "title": title,
                "skills": phase_skills,
                "durationWeeks": max(1, math.ceil(hours / weekly_hours)),
                "actions": [f"Learn {s} (about {kb.skill_info[s]['est_hours']} hours)" for s in phase_skills],
                "resources": [res for s in phase_skills for res in kb.resource_map.get(s, [])[:2]],
            }
        )

    career_title = kb.career_titles.get(career_id, "your target role")
    roadmap.append(
        {
            "phase": len(roadmap) + 1,
            "title": "Portfolio Project",
            "skills": [],
            "durationWeeks": 3,
            "actions": [
                f"Build 1-2 projects that show {career_title} skills and publish them on GitHub",
                "Write a short README explaining the problem, approach and results",
            ],
            "resources": [],
        }
    )
    return roadmap
