"""Dictionary-based skill extraction.

Every canonical skill and alias in skills.csv is searched in the text with a regex that
requires non-alphanumeric characters on both sides, so 'c' or 'r' never match inside
other words. Longer phrases are tried first so 'machine learning' wins over 'ml'.

Some entries are also ordinary English words ('express my interest', 'excel in', 'go beyond',
'react to feedback', 'Shell plc', 'agile team'). Those WEAK phrases only count when they sit in a
skills-style context: a short list line ('Python, SQL, Excel'), a one-word line, or the lines under a
'Skills' heading. Skills the user typed themselves are not affected: they go through KnowledgeBase.canonical().
"""
from __future__ import annotations

import re

from app.services.knowledge_base import KnowledgeBase
from app.utils.text import normalize_text

# phrases that are common words (or company names) outside a skills list
WEAK_PHRASES = {
    "express", "react", "excel", "go", "r", "sap", "sas", "shell", "oracle", "lambda", "hive",
    "macros", "agile", "scrum", "sheets", "confluence", "testing", "automation", "scripting",
}

_LIST_SEPARATORS = re.compile(r"[,|;/•·●]")
_SKILLS_HEADING = re.compile(
    r"^(?:(?:technical|key|core|it|computer|professional)\s+)?(?:skills?|technologies|tools|tech stack)"
    r"(?:\s*(?:&|and)\s*(?:tools|technologies|skills))?\s*:?\s*$"
)
_OTHER_HEADING = re.compile(
    r"^(?:education|experience|work experience|projects?|academic projects?|internships?|summary|"
    r"professional summary|profile|objective|certifications?|achievements?|awards?|languages|interests|"
    r"hobbies|references|declaration)\s*:?\s*$"
)
_MAX_LIST_SEGMENT_WORDS = 5
_MAX_LIST_LINE_WORDS = 30


def _pattern(phrase: str) -> re.Pattern:
    return re.compile(r"(?<![a-z0-9+#])" + re.escape(phrase) + r"(?![a-z0-9+#])")


_cache: dict[int, tuple[list[tuple[str, re.Pattern]], list[tuple[str, re.Pattern]]]] = {}


def _patterns(kb: KnowledgeBase):
    """(strong patterns, weak patterns), longest phrase first."""
    key = id(kb)
    if key not in _cache:
        phrases = sorted(kb.alias_map, key=len, reverse=True)
        strong = [(p, _pattern(p)) for p in phrases if p not in WEAK_PHRASES]
        weak = [(p, _pattern(p)) for p in phrases if p in WEAK_PHRASES]
        _cache[key] = (strong, weak)
    return _cache[key]


def looks_like_skill_list(line: str) -> bool:
    """'Python, SQL, Excel' / 'Skills: Python | SQL' / a lone 'Excel' yes; a sentence that merely has commas no."""
    words = line.split()
    if not words:
        return False
    if len(words) <= 2:  # one-per-line bullet lists ('Excel', 'Power BI')
        return True
    if len(words) > _MAX_LIST_LINE_WORDS or not _LIST_SEPARATORS.search(line):
        return False
    segments = [s for s in _LIST_SEPARATORS.split(line) if s.strip()]
    return len(segments) >= 2 and all(len(s.split()) <= _MAX_LIST_SEGMENT_WORDS for s in segments)


def extract_skills(text: str, kb: KnowledgeBase) -> list[str]:
    """Return the canonical skills found in free text (sorted, no duplicates)."""
    strong, weak = _patterns(kb)
    found: set[str] = set()

    clean = normalize_text(text)
    for phrase, pattern in strong:
        if pattern.search(clean):
            found.add(kb.alias_map[phrase])

    in_skills_section = False
    for raw in (text or "").splitlines():
        line = normalize_text(raw)
        if not line:
            continue
        if _SKILLS_HEADING.match(line):
            in_skills_section = True
            continue
        if _OTHER_HEADING.match(line):
            in_skills_section = False
            continue
        if not (in_skills_section or looks_like_skill_list(line)):
            continue
        for phrase, pattern in weak:
            if pattern.search(line):
                found.add(kb.alias_map[phrase])
    return sorted(found)
