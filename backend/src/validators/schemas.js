import { z } from 'zod';

const tag = z.string().trim().min(1).max(50);
// lower-cased, so 'Python' and 'python' are one skill
const tagList = (max) => z.array(tag).max(max).transform((a) => [...new Set(a.map((s) => s.toLowerCase()))]);

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const onboardingSchema = z.object({
  name: z.string().trim().min(2).max(100),
  age: z.number().int().min(15, 'Age must be between 15 and 60').max(60, 'Age must be between 15 and 60'),
  education: z.enum(['undergraduate', 'graduate', 'postgraduate']),
  state: z.string().trim().min(1, 'State is required').max(60),
  city: z.string().trim().min(1, 'City is required').max(60),
  skills: tagList(100).refine((a) => a.length >= 1, 'Add at least one skill'),
  interests: tagList(20).default([]),
  experienceType: z.enum(['theoretical', 'practical']),
  projectTitle: z.string().trim().max(150).optional(),
  techStack: tagList(30).default([]),
}).superRefine((d, ctx) => {
  // the app asks for these, but the API must not rely on that
  if (d.experienceType === 'practical') {
    if (!d.projectTitle?.trim()) ctx.addIssue({ code: 'custom', path: ['projectTitle'], message: 'Enter your project title' });
    if (!d.techStack.length) ctx.addIssue({ code: 'custom', path: ['techStack'], message: 'Add at least one technology you used' });
  }
});

export const analysisSchema = z.object({
  refresh: z.boolean().optional(),
  weeklyHours: z.number().int().min(1).max(60).optional(),
});
