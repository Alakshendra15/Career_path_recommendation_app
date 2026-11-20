import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { labelSkill } from '../../constants/options';
import { firstInvalidStep, stepsFor, useOnboarding, type Draft, type StepId } from '../../store/onboarding';
import { colors, font, radius, shadow, spacing, tint } from '../../theme';
import { Badge, Row, Text } from '../ui';

const EDUCATION_LABEL = { undergraduate: 'Undergraduate', graduate: 'Graduate', postgraduate: 'Postgraduate' } as const;
const SHOWN_SKILLS = 14;

interface Field {
  step: StepId;
  label: string;
  /** which draft keys the resume could have filled for this row */
  keys: (keyof Draft)[];
  value: React.ReactNode | null;
}

/** "Is this correct?" screen: what the resume gave us, what is still missing, tap a row to change it. */
export function ResumeReview() {
  const d = useOnboarding();
  const filled = new Set(d.autoFilled);

  function edit(step: StepId) {
    const steps = stepsFor(d.experienceType);
    d.setFromReview(true);
    d.setStepIndex(Math.max(0, steps.indexOf(step)));
    d.setMode('steps');
  }

  const skillBadges = (items: string[], color: string) => (
    <Row>
      {items.slice(0, SHOWN_SKILLS).map((s) => <Badge key={s} text={labelSkill(s)} color={color} />)}
      {items.length > SHOWN_SKILLS ? <Badge text={`+${items.length - SHOWN_SKILLS} more`} color={colors.muted} /> : null}
    </Row>
  );

  const fields: Field[] = [
    { step: 'personal', label: 'Name', keys: ['name'], value: d.name.trim().length >= 2 ? d.name : null },
    { step: 'personal', label: 'Age', keys: ['age'], value: Number.isInteger(Number(d.age)) && Number(d.age) >= 15 && Number(d.age) <= 60 && d.age !== '' ? d.age : null },
    { step: 'education', label: 'Education', keys: ['education'], value: d.education ? EDUCATION_LABEL[d.education] : null },
    { step: 'location', label: 'Location', keys: ['state', 'city'], value: d.state && d.city ? `${d.city}, ${d.state}` : null },
    { step: 'skills', label: 'Skills', keys: ['skills'], value: d.skills.length ? skillBadges(d.skills, colors.primary) : null },
    {
      step: 'interests',
      label: 'Interests',
      keys: ['interests'],
      value: d.interests.length ? skillBadges(d.interests, colors.cyan) : <Text style={{ color: colors.muted, fontSize: font.sm }}>None, optional</Text>,
    },
    {
      step: 'experience',
      label: 'How you learned',
      keys: ['experienceType'],
      value: d.experienceType ? (d.experienceType === 'practical' ? 'By building projects' : 'Mostly theory and courses') : null,
    },
  ];
  if (d.experienceType === 'practical') {
    const ok = d.projectTitle.trim() && d.techStack.length;
    fields.push({
      step: 'projects',
      label: 'Project',
      keys: ['projectTitle', 'techStack'],
      value: ok ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{d.projectTitle}</Text>
          {skillBadges(d.techStack, colors.success)}
        </View>
      ) : null,
    });
  }

  return (
    <View style={{ gap: spacing.md }}>
      {fields.map((f) => {
        const missing = f.value === null;
        const fromResume = !missing && f.keys.some((k) => filled.has(k));
        return (
          <Pressable
            key={f.label}
            onPress={() => edit(f.step)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${f.label}`}
            style={[
              {
                padding: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: colors.card,
                borderWidth: 1.5,
                borderColor: missing ? tint(colors.warning, 0.6) : 'transparent',
              },
              shadow.card,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.4, flex: 1 }}>{f.label.toUpperCase()}</Text>
              {missing ? (
                <Badge text="Needed" color={colors.warning} icon="alert-circle" />
              ) : fromResume ? (
                <Badge text="From your resume" color={colors.success} icon="checkmark-circle" />
              ) : null}
              <Ionicons name="create-outline" size={16} color={colors.muted} style={{ marginLeft: spacing.sm }} />
            </View>
            {missing ? (
              <Text style={{ color: colors.warning, fontSize: font.sm, fontWeight: '600' }}>Not found on your resume. Tap to add.</Text>
            ) : typeof f.value === 'string' ? (
              <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '600' }}>{f.value}</Text>
            ) : (
              f.value
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** True when every required answer is present (so "Yes, this is correct" can save). */
export function reviewIsComplete(d: Draft): boolean {
  return firstInvalidStep(d) === null;
}
