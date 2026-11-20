import pytest
from fastapi.testclient import TestClient

from app.services.knowledge_base import get_kb
from app.services.recommender import recommend
from app.services.resume_parser import analyze_text
from app.services.roadmap import build_roadmap
from app.services.skill_extractor import extract_skills
from app.services.skill_gap import analyze_gap
from main import app

kb = get_kb()

# (skills, interests, expected career) -- hand-labelled personas used for the accuracy check
PERSONAS = [
    (["SQL", "Excel", "Power BI", "Statistics"], ["data", "business"], "data_analyst"),
    (["excel", "tableau", "sql"], ["analytics"], "data_analyst"),
    (["Python", "Pandas", "NumPy", "Machine Learning", "Scikit-learn", "Statistics"], ["data"], "data_scientist"),
    (["python", "statistics", "pandas", "eda"], ["research"], "data_scientist"),
    (["Python", "Django", "REST API", "OOP", "SQL"], ["backend"], "python_developer"),
    (["python", "flask", "git", "testing"], ["software"], "python_developer"),
    (["HTML", "CSS", "JavaScript", "React"], ["web", "design"], "web_developer"),
    (["html", "css", "bootstrap", "javascript"], ["frontend"], "web_developer"),
    (["Python", "TensorFlow", "PyTorch", "Deep Learning", "Linear Algebra"], ["ai"], "ml_engineer"),
    (["python", "deep learning", "pytorch", "docker"], ["deep learning"], "ml_engineer"),
]


def test_alias_normalisation():
    assert kb.canonical("JS") == "javascript"
    assert kb.canonical("Sklearn") == "scikit-learn"
    assert kb.canonical("unknownthing") is None


def test_skill_extraction_uses_word_boundaries():
    text = "Worked with Python, MySQL and React.js. Used ML for html5 pages. I like cricket."
    found = extract_skills(text, kb)
    assert {"python", "sql", "react", "machine learning", "html"} <= set(found)
    assert "c++" not in found and "java" not in found


def test_scores_are_bounded_and_sorted():
    res = recommend(kb, ["python", "sql"], ["data"], top_n=5)
    scores = [r["score"] for r in res]
    assert all(0 <= s <= 100 for s in scores)
    assert scores == sorted(scores, reverse=True)


def test_persona_accuracy():
    top1 = sum(recommend(kb, s, i, top_n=1)[0]["career_id"] == exp for s, i, exp in PERSONAS)
    top3 = sum(exp in [r["career_id"] for r in recommend(kb, s, i, top_n=3)] for s, i, exp in PERSONAS)
    print(f"top-1 {top1}/{len(PERSONAS)}, top-3 {top3}/{len(PERSONAS)}")
    assert top1 / len(PERSONAS) >= 0.8
    assert top3 == len(PERSONAS)


def test_skill_gap():
    gap = analyze_gap(kb, "data_analyst", ["sql", "excel"])
    assert "sql" in gap["current_skills"]
    missing = [m["skill"] for m in gap["missing_skills"]]
    assert "power bi" in missing and "sql" not in missing
    assert 0 < gap["readiness_percent"] < 100


def test_roadmap_puts_prerequisites_first():
    plan = build_roadmap(kb, "ml_engineer", ["tensorflow", "deep learning"], ["python"], 10)
    order = [s for phase in plan for s in phase["skills"]]
    for skill in order:
        for pre in kb.prereq_map.get(skill, []):
            if pre in order:
                assert order.index(pre) < order.index(skill), f"{pre} must come before {skill}"
    assert plan[-1]["title"] == "Portfolio Project"


def test_resume_text_analysis():
    text = "Rahul Sharma rahul@example.com +91 9876543210\nMCA student. Internship at X. Projects: Flask API with PostgreSQL. 1 year experience"
    out = analyze_text(text, kb)
    assert out["email"] == "rahul@example.com"
    assert "MCA" in out["education"]
    assert {"flask", "sql"} <= set(out["skills"])
    assert out["has_internship"] and out["has_projects"]


client = TestClient(app)


def test_api_health_and_analyze():
    assert client.get("/health").json()["status"] == "ok"
    r = client.post("/analyze", json={"skills": ["Python", "Pandas", "SQL"], "interests": ["data"], "experience_type": "practical", "tech_stack": ["pandas"]})
    assert r.status_code == 200
    body = r.json()
    assert len(body["recommendations"]) == 3
    assert body["roadmap"] and body["job_roles"]


def test_api_validation_errors():
    assert client.post("/analyze", json={"skills": []}).status_code == 400
    assert client.post("/skill-gap", json={"career_id": "nope", "skills": []}).status_code == 404
    bad = client.post("/resume/analyze", files={"resume": ("a.txt", b"hello", "text/plain")})
    assert bad.status_code == 400
    corrupt = client.post("/resume/analyze", files={"resume": ("a.pdf", b"not a pdf", "application/pdf")})
    assert corrupt.status_code == 422


def test_confidence_flags():
    from app.services.engine import analyze_profile

    run = lambda skills, **kw: analyze_profile(kb, skills, kw.get("interests", []), [], None)
    none = run(["kotlin", "swift", "flutter"])
    assert none["confidence"] == "none" and none["unrecognised_skills"] == ["flutter", "kotlin", "swift"]
    assert run(["communication", "leadership"])["confidence"] == "none"  # soft skills alone are not a signal
    assert run(["python"])["confidence"] == "low"
    ok = run(["SQL", "Excel", "Power BI", "Statistics"])
    assert ok["confidence"] == "ok" and "sql" in ok["recognised_skills"] and ok["unrecognised_skills"] == []
