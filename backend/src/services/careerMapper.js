/**
 * Converts the ML service's /analyze response into the shape the app screens use
 * (same field names as the website's CareerAnalysisResult, plus extra ML detail).
 * The raw ML result is what we store, so this mapping can change without re-running the model.
 */
export function mapAnalysis(ml) {
  const [best, ...others] = ml.recommendations;
  const gap = ml.skill_gap;
  return {
    recommendedRole: best.title,
    roleDescription: best.description,
    matchPercent: best.score,
    // results cached before this field existed have no confidence, so default to 'ok'
    confidence: ml.confidence ?? 'ok', // 'none' | 'low' | 'ok': how far to trust the result
    recognisedSkills: ml.recognised_skills ?? [],
    unrecognisedSkills: ml.unrecognised_skills ?? [],
    readinessPercent: gap.readiness_percent,
    currentSkills: gap.current_skills,
    missingSkills: gap.missing_skills.map((m) => m.skill),
    missingSkillDetails: gap.missing_skills, // [{skill, weight, type}] core first
    partialSkills: gap.partial_skills,
    scoreBreakdown: best.breakdown,
    roadmap: ml.roadmap,
    relatedRoles: others.map((r) => ({
      title: r.title,
      matchPercent: r.score,
      reason: r.matched_skills.length
        ? `You already know ${r.matched_skills.slice(0, 4).join(', ')}`
        : 'Matches your interests',
    })),
    jobRoles: ml.job_roles.map((j) => ({
      title: j.title,
      career: j.career,
      level: j.level,
      fitPercent: j.fit_percent,
      skillMatchPercent: j.skill_match_percent,
      matchedSkills: j.matched_skills,
      missingSkills: j.missing_skills,
    })),
  };
}
