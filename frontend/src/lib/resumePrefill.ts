import { INDIA_LOCATIONS } from '../constants/india-locations';
import { INTEREST_OPTIONS } from '../constants/options';
import type { Draft } from '../store/onboarding';
import type { ResumeResult } from '../types';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Finds the first Indian city (then state) mentioned in the resume header. Whole words only, so 'Pune' never matches 'Punekar'. */
export function findLocation(text: string): { state: string; city: string } | null {
  if (!text) return null;
  let best: { state: string; city: string; at: number } | null = null;
  for (const loc of INDIA_LOCATIONS) {
    for (const city of loc.cities) {
      const m = new RegExp(`(?<![A-Za-z])${escape(city)}(?![A-Za-z])`, 'i').exec(text);
      if (m && (!best || m.index < best.at)) best = { state: loc.state, city, at: m.index };
    }
  }
  if (best) return { state: best.state, city: best.city };
  for (const loc of INDIA_LOCATIONS) {
    if (new RegExp(`(?<![A-Za-z])${escape(loc.state)}(?![A-Za-z])`, 'i').test(text)) return { state: loc.state, city: '' };
  }
  return null;
}

export type DraftKey = keyof Draft;

/** Turns a parsed resume into onboarding answers, plus which fields it managed to fill (so the review can say so). */
export function prefillFromResume(r: ResumeResult): { patch: Partial<Draft>; filled: DraftKey[] } {
  const patch: Partial<Draft> = {};
  const filled: DraftKey[] = [];
  const put = <K extends DraftKey>(key: K, value: Draft[K]) => {
    patch[key] = value;
    filled.push(key);
  };

  if (r.name) put('name', r.name);
  if (r.age) put('age', String(r.age));
  if (r.suggested_education) put('education', r.suggested_education);
  const loc = findLocation(r.location_text ?? '');
  if (loc) {
    put('state', loc.state);
    if (loc.city) put('city', loc.city);
  }
  if (r.skills?.length) put('skills', r.skills.slice(0, 100)); // the API accepts up to 100
  // only interests the resume itself lists under Interests / Hobbies; nothing is inferred from the skills
  const interests = (r.interests ?? []).filter((i) => INTEREST_OPTIONS.includes(i));
  if (interests.length) put('interests', interests);
  if (r.suggested_experience_type) {
    put('experienceType', r.suggested_experience_type);
    if (r.suggested_experience_type === 'practical') {
      if (r.project_title) put('projectTitle', r.project_title);
      if (r.tech_stack?.length) put('techStack', r.tech_stack);
    }
  }
  return { patch, filled };
}
