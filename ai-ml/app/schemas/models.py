from typing import Literal, Optional

from pydantic import BaseModel, Field


class ProfileIn(BaseModel):
    skills: list[str] = Field(default_factory=list, description="Skills the student knows, e.g. ['Python', 'SQL']")
    interests: list[str] = Field(default_factory=list, description="e.g. ['data', 'web']")
    education: Optional[str] = None
    experience_type: Optional[Literal["theoretical", "practical"]] = None
    tech_stack: list[str] = Field(default_factory=list, description="Technologies used in projects")
    weekly_hours: int = Field(10, ge=1, le=60, description="Study hours per week for the roadmap")
    top_n: int = Field(3, ge=1, le=5)


class SkillGapIn(BaseModel):
    career_id: str
    skills: list[str] = Field(default_factory=list)


class RoadmapIn(BaseModel):
    career_id: str
    skills: list[str] = Field(default_factory=list, description="Skills the student already has")
    weekly_hours: int = Field(10, ge=1, le=60)


class JobRolesIn(BaseModel):
    skills: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    experience_type: Optional[Literal["theoretical", "practical"]] = None
    top_n: int = Field(5, ge=1, le=10)
