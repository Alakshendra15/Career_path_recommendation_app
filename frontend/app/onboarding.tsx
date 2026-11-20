import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { ResumeChoice } from '../src/components/onboarding/ResumeChoice';
import { ResumeReview, reviewIsComplete } from '../src/components/onboarding/ResumeReview';
import { STEP_COMPONENTS, STEP_INFO } from '../src/components/onboarding/steps';
import { Button, FadeIn, ProgressBar, Screen, Text, Title } from '../src/components/ui';
import { api } from '../src/lib/api';
import { useAnalysis } from '../src/store/analysis';
import { useAuth } from '../src/store/auth';
import { firstInvalidStep, stepsFor, useOnboarding, validateStep } from '../src/store/onboarding';
import { colors, font, shadow, spacing, tint } from '../src/theme';

export default function Onboarding() {
  const router = useRouter();
  const draft = useOnboarding();
  const editing = useAuth((s) => !!s.profile?.completed); // coming from "Edit profile"
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const direction = useRef<'forward' | 'back'>('forward'); // decides which way the next step slides in

  // start from the saved profile (pre-fills Edit profile; for new accounts just the name)
  useEffect(() => {
    const { user, profile } = useAuth.getState();
    useOnboarding.getState().hydrate(user, profile);
  }, []);

  const steps = stepsFor(draft.experienceType);
  const index = Math.min(draft.stepIndex, steps.length - 1);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const Body = STEP_COMPONENTS[step];

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api.saveOnboarding(draft.toPayload());
      await useAuth.getState().refresh(); // flips `completed`, which unlocks the tabs
      useAnalysis.getState().reset();
      draft.reset();
      router.replace('/career');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    const problem = validateStep(step, draft);
    if (problem) {
      setError(problem);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    setError(null);
    if (draft.fromReview) {
      // one answer was fixed from the "is this correct?" screen: go back to it
      draft.setFromReview(false);
      return draft.setMode('review');
    }
    if (!isLast) {
      direction.current = 'forward';
      return draft.setStepIndex(index + 1);
    }
    await save();
  }

  /** "Yes, this is correct" on the review screen. */
  async function confirmReview() {
    const missing = firstInvalidStep(draft);
    if (missing) return fixMissing();
    await save();
  }

  /** Jump to the first required answer the resume did not give us. */
  function fixMissing() {
    const missing = firstInvalidStep(draft);
    if (!missing) return;
    draft.setFromReview(true);
    draft.setStepIndex(Math.max(0, stepsFor(draft.experienceType).indexOf(missing)));
    draft.setMode('steps');
  }

  function back() {
    setError(null);
    if (index > 0 && !draft.fromReview) {
      direction.current = 'back';
      draft.setStepIndex(index - 1);
    } else if (editing) router.back();
    else {
      // new account: step 0 (or a step opened from the review) goes back to the review / the first choice
      draft.setFromReview(false);
      draft.setMode(draft.autoFilled.length ? 'review' : 'choose');
    }
  }

  // Android hardware back: step back inside onboarding. On the first screen (or when editing) leave it to the system.
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const { mode } = useOnboarding.getState();
      if (useAuth.getState().profile?.completed || mode === 'choose') return false;
      backRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  if (!editing && draft.mode === 'choose') {
    return (
      <Screen>
        <FadeIn from="none">
          <Title sub="Upload your resume and we fill in the details for you, or answer a few quick questions yourself.">How would you like to set up your profile?</Title>
          <ResumeChoice />
        </FadeIn>
      </Screen>
    );
  }

  if (!editing && draft.mode === 'review') {
    const complete = reviewIsComplete(draft);
    return (
      <Screen
        footer={
          <View style={{ gap: spacing.sm }}>
            {error ? <Text style={{ color: colors.danger, fontSize: font.sm, textAlign: 'center' }}>{error}</Text> : null}
            {complete ? (
              <>
                <Button title="Yes, this is correct" icon="checkmark-circle" onPress={() => void confirmReview()} loading={saving} />
                <Button
                  title="Edit details"
                  icon="create"
                  variant="outline"
                  onPress={() => {
                    draft.setFromReview(false);
                    draft.setStepIndex(0);
                    draft.setMode('steps');
                  }}
                />
              </>
            ) : (
              <Button title="Fill in the missing details" icon="arrow-forward" onPress={fixMissing} />
            )}
          </View>
        }
      >
        <Pressable onPress={back} hitSlop={8} accessibilityLabel="Back" style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }, shadow.card]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <FadeIn from="none">
          <Title sub={complete ? 'We filled this in from your resume. Check it and change anything that is wrong.' : 'We filled in what we could from your resume. A few details are still needed.'}>
            Is this correct?
          </Title>
          <ResumeReview />
        </FadeIn>
      </Screen>
    );
  }

  const info = STEP_INFO[step];
  const slideFrom = direction.current === 'forward' ? 'left' : 'right';
  return (
    <Screen
      footer={
        <View style={{ gap: spacing.sm }}>
          {error ? (
            <FadeIn from="none" duration={200}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderRadius: 10, backgroundColor: tint(colors.danger, 0.08) }}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, fontSize: font.sm, fontWeight: '500' }}>{error}</Text>
              </View>
            </FadeIn>
          ) : null}
          <Button
            title={draft.fromReview ? 'Done' : isLast ? (editing ? 'Save & update analysis' : 'Finish & get my analysis') : 'Continue'}
            icon={draft.fromReview ? 'checkmark' : isLast ? 'sparkles' : 'arrow-forward'}
            onPress={next}
            loading={saving}
          />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
        <Pressable
          onPress={back}
          hitSlop={8}
          accessibilityLabel="Back"
          style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, shadow.card]}
        >
          <Ionicons name={index > 0 || !editing ? 'arrow-back' : 'close'} size={20} color={colors.text} />
        </Pressable>
      
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '600' }}>
              Step {index + 1} of {steps.length}
            </Text>
            <Text style={{ color: colors.primary, fontSize: font.xs, fontWeight: '700' }}>{Math.round(((index + 1) / steps.length) * 100)}%</Text>
          </View>
          <ProgressBar value={(index + 1) / steps.length} delay={0} />
        </View>
      </View>

      {/* keyed by step: each step mounts fresh and slides in */}
      <FadeIn key={step} from={slideFrom} distance={28} duration={320}>
        <Title sub={info.sub}>{info.title}</Title>
        <Body />
      </FadeIn>
    </Screen>
  );
}
