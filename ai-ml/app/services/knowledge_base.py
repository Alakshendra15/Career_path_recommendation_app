"""Loads the career knowledge base (CSV files in ai-ml/data) into memory with Pandas.

The knowledge base is the "dataset" of this project: careers, the weighted skills each
career needs, a skill vocabulary with aliases, prerequisites, free resources and
entry-level job roles. Everything is plain CSV so it can be reviewed and edited by hand.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "data"

LEVEL_ORDER = {"beginner": 0, "intermediate": 1, "advanced": 2}


def _split(value, sep: str = "|") -> list[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    return [part.strip().lower() for part in str(value).split(sep) if part.strip()]


@dataclass
class KnowledgeBase:
    skills: pd.DataFrame
    careers: pd.DataFrame
    career_skills: pd.DataFrame
    prereqs: pd.DataFrame
    resources: pd.DataFrame
    job_roles: pd.DataFrame

    # derived lookups, filled in __post_init__
    alias_map: dict[str, str] = field(default_factory=dict)      # alias/skill name -> canonical skill
    skill_info: dict[str, dict] = field(default_factory=dict)    # skill -> {level, est_hours, category}
    career_skill_map: dict[str, list[dict]] = field(default_factory=dict)
    career_tags: dict[str, list[str]] = field(default_factory=dict)
    career_titles: dict[str, str] = field(default_factory=dict)
    career_descriptions: dict[str, str] = field(default_factory=dict)
    prereq_map: dict[str, list[str]] = field(default_factory=dict)
    resource_map: dict[str, list[dict]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for row in self.skills.itertuples():
            skill = str(row.skill).strip().lower()
            self.alias_map[skill] = skill
            for alias in _split(row.aliases):
                self.alias_map[alias] = skill
            self.skill_info[skill] = {
                "level": str(row.level).strip().lower(),
                "est_hours": int(row.est_hours),
                "category": str(row.category),
            }

        for row in self.careers.itertuples():
            self.career_titles[row.career_id] = row.title
            self.career_descriptions[row.career_id] = row.description
            self.career_tags[row.career_id] = _split(row.interest_tags)

        for row in self.career_skills.itertuples():
            self.career_skill_map.setdefault(row.career_id, []).append(
                {"skill": row.skill.strip().lower(), "weight": int(row.weight), "type": row.type}
            )

        for row in self.prereqs.itertuples():
            self.prereq_map.setdefault(row.skill.strip().lower(), []).append(row.prerequisite.strip().lower())

        for row in self.resources.itertuples():
            self.resource_map.setdefault(row.skill.strip().lower(), []).append(
                {"title": row.title, "url": row.url, "type": row.type}
            )

    # ---- helpers -------------------------------------------------------
    def canonical(self, name: str) -> str | None:
        """Map a user-typed skill ('JS', 'Sklearn') to its canonical name, or None if unknown."""
        return self.alias_map.get(name.strip().lower())

    def canonical_set(self, names: list[str]) -> set[str]:
        return {c for n in names if (c := self.canonical(n))}

    def required_skills(self, career_id: str) -> list[dict]:
        return self.career_skill_map.get(career_id, [])

    def career_ids(self) -> list[str]:
        return list(self.career_titles)


def load_kb(data_dir: Path = DATA_DIR) -> KnowledgeBase:
    read = lambda name: pd.read_csv(data_dir / name)
    return KnowledgeBase(
        skills=read("skills.csv"),
        careers=read("careers.csv"),
        career_skills=read("career_skills.csv"),
        prereqs=read("skill_prereqs.csv"),
        resources=read("skill_resources.csv"),
        job_roles=read("job_roles.csv"),
    )


@lru_cache(maxsize=1)
def get_kb() -> KnowledgeBase:
    return load_kb()
