// Shapes returned by the Express backend (see backend/README.md).
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export type Education = 'undergraduate' | 'graduate' | 'postgraduate';
export type ExperienceType = 'theoretical' | 'practical';

export interface Profile {
  age: number | null;
  education: Education | null;
  state: string | null;
  city: string | null;
  skills: string[];
  interests: string[];
  experienceType: ExperienceType | null;
  projectTitle: string | null;
  techStack: string[];
  completed: boolean;
}

export interface ProfileResponse extends AuthUser {
  profile: Profile | null;
}

export interface OnboardingPayload {
  name: string;
  age: number;
  education: Education;
  state: string;
  city: string;
  skills: string[];
  interests: string[];
  experienceType: ExperienceType;
  projectTitle?: string;
  techStack: string[];
}

export interface RoadmapResource {
  title: string;
  url: string;
  type: 'course' | 'doc' | 'video' | 'project';
}

export interface RoadmapPhase {
  phase: number;
  title: string;
  skills: string[];
  durationWeeks: number;
  actions: string[];
  resources: RoadmapResource[];
}

export interface RelatedRole {
  title: string;
  matchPercent: number;
  reason: string;
}

export interface JobRole {
  title: string;
  career: string;
  level: string;
  fitPercent: number;
  skillMatchPercent: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface CareerAnalysis {
  recommendedRole: string;
  roleDescription: string;
  matchPercent: number;
  /** how far to trust the result: none = no recognised skills, low = weak match, ok = fine */
  confidence: 'none' | 'low' | 'ok';
  recognisedSkills: string[];
  unrecognisedSkills: string[];
  readinessPercent: number;
  currentSkills: string[];
  missingSkills: string[];
  missingSkillDetails: { skill: string; weight: number; type: 'core' | 'supporting' }[];
  partialSkills: string[];
  scoreBreakdown: { weighted_skill: number; tfidf_cosine: number; interest: number; project_bonus: number; ml_model?: number };
  roadmap: RoadmapPhase[];
  relatedRoles: RelatedRole[];
  jobRoles: JobRole[];
}

export interface AnalysisResponse {
  cached: boolean;
  generatedAt: string;
  data: CareerAnalysis;
}

export interface ResumeResult {
  id: string;
  skills: string[];
  education: string[];
  merged: boolean;
  // best guesses from the resume for the onboarding form; any of them can be missing
  name?: string | null;
  age?: number | null;
  suggested_education?: Education | null;
  suggested_experience_type?: ExperienceType | null;
  project_title?: string | null;
  tech_stack?: string[];
  interests?: string[];
  location_text?: string;
}
