from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.models import JobRolesIn, ProfileIn, RoadmapIn, SkillGapIn
from app.services import engine
from app.services.job_roles import suggest_roles
from app.services.knowledge_base import get_kb
from app.services.recommender import recommend
from app.services.resume_parser import ResumeError, analyze_pdf
from app.services.roadmap import build_roadmap
from app.services.skill_gap import analyze_gap
from app.services.version import data_version

router = APIRouter()
MAX_PDF_BYTES = 10 * 1024 * 1024


@router.get("/health")
def health():
    return {"status": "ok", "careers": len(get_kb().career_ids()), "data_version": data_version()}


@router.get("/careers")
def careers():
    kb = get_kb()
    return [
        {"career_id": cid, "title": kb.career_titles[cid], "required_skills": kb.required_skills(cid)}
        for cid in kb.career_ids()
    ]


@router.post("/resume/analyze")
def resume_analyze(resume: UploadFile = File(...)):
    # plain `def`: FastAPI runs it in a worker thread, so parsing a PDF never blocks other requests
    if resume.content_type != "application/pdf" and not (resume.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    data = resume.file.read(MAX_PDF_BYTES + 1)  # never read more than one byte past the limit
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(413, "PDF is larger than 10 MB")
    try:
        return analyze_pdf(data, get_kb())
    except ResumeError as exc:
        raise HTTPException(422, str(exc))


@router.post("/recommend")
def recommend_careers(body: ProfileIn):
    return recommend(
        get_kb(), body.skills, body.interests, body.tech_stack, body.experience_type, body.top_n
    )


@router.post("/skill-gap")
def skill_gap(body: SkillGapIn):
    try:
        return analyze_gap(get_kb(), body.career_id, body.skills)
    except KeyError:
        raise HTTPException(404, f"Unknown career_id '{body.career_id}'")


@router.post("/roadmap")
def roadmap(body: RoadmapIn):
    kb = get_kb()
    try:
        gap = analyze_gap(kb, body.career_id, body.skills)
    except KeyError:
        raise HTTPException(404, f"Unknown career_id '{body.career_id}'")
    return build_roadmap(
        kb, body.career_id, [m["skill"] for m in gap["missing_skills"]], body.skills, body.weekly_hours
    )


@router.post("/job-roles")
def job_roles(body: JobRolesIn):
    kb = get_kb()
    scores = recommend(
        kb, body.skills, body.interests, body.tech_stack, body.experience_type, top_n=len(kb.career_ids())
    )
    return suggest_roles(
        kb, list(set(body.skills) | set(body.tech_stack)), {r["career_id"]: r["score"] for r in scores}, body.top_n
    )


@router.post("/analyze")
def analyze(body: ProfileIn):
    if not body.skills and not body.tech_stack:
        raise HTTPException(400, "Provide at least one skill")
    return engine.analyze_profile(
        get_kb(), body.skills, body.interests, body.tech_stack, body.experience_type, body.weekly_hours, body.top_n
    )
