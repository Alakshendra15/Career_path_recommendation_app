"""Resume analysis: PDF -> text -> skills plus the details the onboarding form asks for.

Everything beyond `skills` is a best guess (name, age, education level, experience type, project,
interests). The app shows them to the student as "is this correct?" and never saves them unconfirmed.
A field is left empty (None / []) rather than guessed when the text gives no evidence for it.
"""
from __future__ import annotations

import io
import re
from datetime import date

from app.services.knowledge_base import KnowledgeBase
from app.services.skill_extractor import extract_skills

MAX_PAGES = 10  # a resume is a few pages; refuse to crunch hundreds

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+?91[\s-]?)?[6-9]\d{9}\b")
YEARS_RE = re.compile(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\b", re.I)

# (label, regex on lower-cased text). 'B.E.' needs its dot: a bare "be" is an ordinary English word.
EDUCATION_PATTERNS = [
    ("MCA", r"\bmca\b|master of computer applications"),
    ("M.Tech", r"\bm\.?\s?tech\b"),
    ("MBA", r"\bmba\b"),
    ("M.Sc", r"\bm\.?\s?sc\b"),
    ("B.Tech/B.E.", r"\bb\.?\s?tech\b|\bb\.\s?e\b\.?|bachelor of engineering"),
    ("BCA", r"\bbca\b|bachelor of computer applications"),
    ("B.Sc", r"\bb\.?\s?sc\b"),
    ("Diploma", r"\bdiploma\b"),
]
# "BE (CSE)", "BE - 2020", "BE in ...", "BE Computer Science": upper-case only, so "to BE ABLE" and "be" never match
BE_UPPER_RE = re.compile(r"\bBE\b(?=\s*[(\-–,]|\s+in\b|\s+[A-Z][a-z])")
PG_LABELS = {"MCA", "M.Tech", "MBA", "M.Sc"}

HEADING_WORDS = {
    "resume", "curriculum", "vitae", "cv", "summary", "profile", "objective", "contact", "education", "skills",
    "experience", "projects", "professional", "career", "personal", "details", "about", "me", "page", "biodata",
}
# words that make a phrase a job title or an address, never a person's name
JOB_WORDS = {
    "developer", "engineer", "scientist", "analyst", "designer", "manager", "intern", "student", "fresher",
    "consultant", "architect", "administrator", "specialist", "associate", "executive", "officer", "lead",
    "senior", "junior", "full", "stack", "software", "web", "frontend", "backend", "front", "back", "end",
    "machine", "learning", "data", "ai", "ml", "cloud", "devops", "mobile", "android", "ios", "python", "java",
    "programmer", "tester", "trainee", "graduate", "freelancer", "technologist", "researcher",
}
PLACE_WORDS = {
    "india", "delhi", "mumbai", "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata", "pune", "noida",
    "gurgaon", "gurugram", "dehradun", "road", "street", "nagar", "pradesh", "university", "college", "institute",
    "school", "city", "state", "district", "sector", "phase", "block", "uttarakhand", "maharashtra", "karnataka",
    "tamil", "nadu", "kerala", "gujarat", "rajasthan", "punjab", "haryana", "bihar", "assam", "odisha",
    "telangana", "lane", "colony", "village", "town", "campus",
}
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z.' -]{2,40}$")
NAME_SPLIT_RE = re.compile(r"[|•·,;]|\s{3,}| - ")
NAME_PREFIX_RE = re.compile(r"^(?:curriculum vitae|resume|cv|bio-?data)\s*(?:of\b|[:\-])\s*", re.I)
DOB_RE = re.compile(
    r"(?:dob|d\.o\.b|date of birth|born(?: on)?)\s*[:\-]?\s*(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})", re.I
)
PROJECT_HEADING_RE = re.compile(r"^(?:academic |personal |key |major |mini )?projects?\s*:?\s*$", re.I)
INTEREST_HEADING_RE = re.compile(
    r"^(?:areas? of interests?|interests?(?: (?:&|and) hobbies)?|hobbies(?: (?:&|and) interests?)?)\s*:?\s*$", re.I
)
SECTION_HEADING_RE = re.compile(
    r"^(?:education|skills?|technical skills|experience|work experience|internships?|certifications?|achievements?|"
    r"awards?|summary|professional summary|profile|objective|languages|interests|hobbies|references|declaration|"
    r"projects?)\s*:?\s*$",
    re.I,
)
TITLE_SPLIT_RE = re.compile(r"\s[|–—:-]\s|\|")


class ResumeError(ValueError):
    pass


def pdf_to_text(data: bytes) -> str:
    import pdfplumber  # imported lazily so the rest of the service works without it

    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join((page.extract_text() or "") for page in pdf.pages[:MAX_PAGES])
    except Exception as exc:  # corrupt / not a pdf
        raise ResumeError("Could not read the PDF file") from exc


def mask_contact_details(text: str) -> str:
    """Emails and phone numbers replaced, so a snippet of the resume can be sent on without them."""
    return PHONE_RE.sub("[phone]", EMAIL_RE.sub("[email]", text))


def guess_name(text: str) -> str | None:
    """First short, letters-only phrase near the top ('Jane Doe | jane@x.com | +91...' -> 'Jane Doe').
    Job titles ('Data Scientist') and places ('New Delhi') are skipped: better no name than a wrong one."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()][:6]
    for line in lines:
        for seg in NAME_SPLIT_RE.split(line):
            seg = NAME_PREFIX_RE.sub("", seg.strip()).strip()
            words = seg.split()
            if not (2 <= len(words) <= 4) or not NAME_RE.match(seg):
                continue
            lowered = {w.lower().strip(".") for w in words}
            if lowered & (HEADING_WORDS | JOB_WORDS | PLACE_WORDS):
                continue
            return seg.title() if seg.isupper() else seg
    return None


def guess_age(text: str, today: date | None = None) -> int | None:
    """Age from an explicit date of birth ('DOB: 14/03/2002'). Resumes rarely state age, so None is common."""
    m = DOB_RE.search(text)
    if not m:
        return None
    first, second, year = (int(g) for g in m.groups())
    today = today or date.today()
    born = None
    for day, month in ((first, second), (second, first)):  # dd/mm/yyyy, then mm/dd/yyyy
        try:
            born = date(year, month, day)
            break
        except ValueError:
            continue
    if born is None:
        return None
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age if 15 <= age <= 60 else None


def education_labels(text: str) -> list[str]:
    lowered = text.lower()
    found = {label for label, pat in EDUCATION_PATTERNS if re.search(pat, lowered)}
    if BE_UPPER_RE.search(text):
        found.add("B.Tech/B.E.")
    return [label for label, _ in EDUCATION_PATTERNS if label in found]


def suggested_education(labels: list[str]) -> str | None:
    """Maps degrees found to the app's three levels: any master's -> postgraduate, a bachelor's/diploma -> undergraduate."""
    if not labels:
        return None
    return "postgraduate" if any(label in PG_LABELS for label in labels) else "undergraduate"


def project_section(text: str, kb: KnowledgeBase) -> tuple[bool, str | None, list[str]]:
    """(has a Projects section, title of the first project, technologies in that section): a guess the student confirms."""
    lines = [ln.strip() for ln in text.splitlines()]
    for i, line in enumerate(lines):
        if not PROJECT_HEADING_RE.match(line):
            continue
        block: list[str] = []
        for nxt in lines[i + 1 : i + 16]:
            if SECTION_HEADING_RE.match(nxt):
                break
            block.append(nxt)
        first = next((b for b in block if b), "")
        title = TITLE_SPLIT_RE.split(first)[0].strip(" •●-") if first else ""
        if "(" in title and ")" not in title:  # a title cut mid-bracket: 'App (Group Project'
            title = title.split("(")[0].strip()
        return True, (title[:80] or None), extract_skills("\n".join(block), kb)
    return False, None, []


def stated_interests(text: str, kb: KnowledgeBase) -> list[str]:
    """Interest tags found in an explicit 'Interests' / 'Hobbies' section. Nothing is inferred from skills."""
    tags = {t for tags in kb.career_tags.values() for t in tags}
    lines = [ln.strip() for ln in text.splitlines()]
    for i, line in enumerate(lines):
        if not INTEREST_HEADING_RE.match(line):
            continue
        found: set[str] = set()
        for nxt in lines[i + 1 : i + 8]:
            if SECTION_HEADING_RE.match(nxt):
                break
            for token in re.split(r"[,|;•·]", nxt.lower()):
                token = token.strip(" -●")
                found.update(t for t in tags if token and (t == token or t in token.split() or f" {t} " in f" {token} "))
        return sorted(found)[:6]
    return []


def analyze_text(text: str, kb: KnowledgeBase) -> dict:
    lowered = text.lower()
    email = EMAIL_RE.search(text)
    phone = PHONE_RE.search(text)
    years = [float(y) for y in YEARS_RE.findall(text)]
    skills = extract_skills(text, kb)
    education = education_labels(text)
    has_section, project_title, project_tech = project_section(text, kb)
    # evidence of projects: a Projects section, a "Projects:" label, or the word at least twice (one stray mention is not enough)
    has_projects = has_section or bool(re.search(r"\bprojects?\s*:", lowered)) or len(re.findall(r"\bprojects?\b", lowered)) >= 2
    has_internship = bool(re.search(r"\binternship\b|\bintern\b", lowered))
    looks_like_resume = bool(skills or education or has_projects or has_internship)
    if has_projects or has_internship:
        experience = "practical"
    else:
        experience = "theoretical" if looks_like_resume else None  # no evidence at all: say nothing
    return {
        "name": guess_name(text),
        "age": guess_age(text),
        "suggested_education": suggested_education(education),
        "suggested_experience_type": experience,
        "project_title": project_title,
        "tech_stack": project_tech,
        "interests": stated_interests(text, kb),
        "location_text": mask_contact_details(" ".join(text.split())[:500]),  # the app looks for a city / state here
        "skills": skills,
        "email": email.group(0) if email else None,
        "phone": phone.group(0) if phone else None,
        "education": education,
        "has_projects": has_projects,
        "has_internship": has_internship,
        "max_years_mentioned": max(years) if years else None,
    }


def analyze_pdf(data: bytes, kb: KnowledgeBase) -> dict:
    text = pdf_to_text(data)
    if not text.strip():
        raise ResumeError("No text found in the PDF (scanned images are not supported)")
    return analyze_text(text, kb)
