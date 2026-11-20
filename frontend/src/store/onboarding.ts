import { create } from 'zustand';
import type { AuthUser, Education, ExperienceType, OnboardingPayload, Profile } from '../types';

export type StepId = 'personal' | 'education' | 'location' | 'skills' | 'interests' | 'experience' | 'projects';

export interface Draft {
  name: string;
  age: string;
  education: Education | null;
  state: string;
  city: string;
  skills: string[];
  interests: string[];
  experienceType: ExperienceType | null;
  projectTitle: string;
  techStack: string[];
}

/** choose = resume or manual, review = "is this correct?" after a resume, steps = the form */
export type Mode = 'choose' | 'review' | 'steps';

interface OnboardingState extends Draft {
  stepIndex: number;
  mode: Mode;
  /** fields the resume filled in, so the review can label them */
  autoFilled: (keyof Draft)[];
  /** true while one step is being fixed from the review screen: Continue returns to the review */
  fromReview: boolean;
  setMode: (mode: Mode) => void;
  setFromReview: (v: boolean) => void;
  applyResume: (patch: Partial<Draft>, filled: (keyof Draft)[]) => void;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  setStepIndex: (i: number) => void;
  /** Start from the saved profile so "Edit profile" is pre-filled. */
  hydrate: (user: AuthUser | null, profile: Profile | null) => void;
  toPayload: () => OnboardingPayload;
  reset: () => void;
}

const empty: Draft = {
  name: '',
  age: '',
  education: null,
  state: '',
  city: '',
  skills: [],
  interests: [],
  experienceType: null,
  projectTitle: '',
  techStack: [],
};

/** The project step only exists for students who have built projects. */
export function stepsFor(experienceType: ExperienceType | null): StepId[] {
  const base: StepId[] = ['personal', 'education', 'location', 'skills', 'interests', 'experience'];
  return experienceType === 'practical' ? [...base, 'projects'] : base;
}

/** The first step whose answers are missing or invalid, or null when the whole form is complete. */
export function firstInvalidStep(d: Draft): StepId | null {
  return stepsFor(d.experienceType).find((step) => validateStep(step, d) !== null) ?? null;
}

/** Returns an error message if the step is incomplete, otherwise null. */
export function validateStep(step: StepId, d: Draft): string | null {
  switch (step) {
    case 'personal': {
      if (d.name.trim().length < 2) return 'Please enter your full name';
      const age = Number(d.age);
      if (!Number.isInteger(age) || age < 15 || age > 60) return 'Age must be between 15 and 60';
      return null;
    }
    case 'education':
      return d.education ? null : 'Choose your education level';
    case 'location':
      return d.state && d.city ? null : 'Choose your state and city';
    case 'skills':
      return d.skills.length ? null : 'Add at least one skill';
    case 'interests':
      return null; // optional
    case 'experience':
      return d.experienceType ? null : 'Choose how you have learned so far';
    case 'projects':
      if (!d.projectTitle.trim()) return 'Enter your project title';
      return d.techStack.length ? null : 'Add at least one technology you used';
  }
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  ...empty,
  stepIndex: 0,
  mode: 'choose',
  autoFilled: [],
  fromReview: false,
  setMode: (mode) => set({ mode }),
  setFromReview: (fromReview) => set({ fromReview }),
  applyResume: (patch, filled) =>
    set({ ...empty, name: get().name, ...patch, autoFilled: filled, stepIndex: 0, mode: 'review', fromReview: false }), // keep the signup name if the resume has none
  set: (key, value) => set({ [key]: value } as Partial<Draft>),
  setStepIndex: (stepIndex) => set({ stepIndex }),

  hydrate(user, profile) {
    set({
      ...empty,
      stepIndex: 0,
      mode: 'choose',
      autoFilled: [],
      fromReview: false,
      name: user?.name ?? '',
      ...(profile && {
        age: profile.age ? String(profile.age) : '',
        education: profile.education,
        state: profile.state ?? '',
        city: profile.city ?? '',
        skills: profile.skills,
        interests: profile.interests,
        experienceType: profile.experienceType,
        projectTitle: profile.projectTitle ?? '',
        techStack: profile.techStack,
      }),
    });
  },

  toPayload() {
    const d = get();
    const practical = d.experienceType === 'practical';
    return {
      name: d.name.trim(),
      age: Number(d.age),
      education: d.education!,
      state: d.state,
      city: d.city,
      skills: d.skills,
      interests: d.interests,
      experienceType: d.experienceType!,
      ...(practical && { projectTitle: d.projectTitle.trim() }),
      techStack: practical ? d.techStack : [],
    };
  },

  reset: () => set({ ...empty, stepIndex: 0, mode: 'choose', autoFilled: [], fromReview: false }),
}));
