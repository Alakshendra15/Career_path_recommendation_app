import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { labelSkill } from '../../constants/options';
import { useAnalysis } from '../../store/analysis';
import type { CareerAnalysis } from '../../types';
import { colors, font, radius, spacing, tint } from '../../theme';
import { Button, Card, ErrorState, Screen, Skeleton, Text } from '../ui';

/** Shared loading / error / low-confidence handling for the screens that show the career analysis. */
export function AnalysisGate({ children }: { children: (data: CareerAnalysis) => ReactNode }) {
  const { data, loading, error, load } = useAnalysis();
  const router = useRouter();

  if (!data && error) {
    return (
      <Screen scroll={false}>
        <ErrorState message={error} onRetry={() => void load()} />
      </Screen>
    );
  }
  if (!data && !loading) {
    // nothing loaded and nothing in flight (e.g. the first request never started): offer a manual load
    return (
      <Screen scroll={false}>
        <ErrorState message="Your career analysis has not loaded yet." onRetry={() => void load(true)} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Text style={{ color: colors.muted, fontSize: font.sm, marginBottom: spacing.lg }}>Analysing your profile...</Text>
        <Skeleton height={190} style={{ marginBottom: spacing.lg }} />
        <Skeleton height={150} style={{ marginBottom: spacing.lg }} />
        <Skeleton height={150} />
      </Screen>
    );
  }

  // None of the skills were recognised, so any "best match" would be meaningless: don't show one.
  if (data.confidence === 'none') {
    return (
      <Screen onRefresh={() => void load(true)} refreshing={loading}>
        <Card style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <Ionicons name="help-circle-outline" size={48} color={colors.warning} />
          <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' }}>
            We could not match your skills yet
          </Text>
          <Text style={{ color: colors.muted, fontSize: font.sm, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm }}>
            {data.unrecognisedSkills.length
              ? `We did not recognise: ${data.unrecognisedSkills.map(labelSkill).join(', ')}. `
              : ''}
            Add technical skills such as Python, SQL, HTML or Excel, and we will find the careers that fit you.
          </Text>
          <Button title="Update my skills" icon="create" onPress={() => router.push('/onboarding')} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void load(true)} refreshing={loading}>
      {error ? <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error} Showing your last result.</Text> : null}
      {data.confidence === 'low' ? (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            padding: spacing.md,
            marginBottom: spacing.lg,
            borderRadius: radius.md,
            backgroundColor: tint(colors.warning),
            borderWidth: 1,
            borderColor: tint(colors.warning, 0.4),
          }}
        >
          <Ionicons name="warning-outline" size={18} color={colors.warning} />
          <Text style={{ color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 20 }}>
            Limited information: these suggestions are based on very few matching skills. Add more skills in your profile for a more reliable result.
            {data.unrecognisedSkills.length ? ` Not recognised: ${data.unrecognisedSkills.map(labelSkill).join(', ')}.` : ''}
          </Text>
        </View>
      ) : null}
      {children(data)}
      <Button
        title={loading ? 'Refreshing...' : 'Refresh analysis'}
        icon="refresh"
        variant="outline"
        loading={loading}
        onPress={() => void load(true)}
      />
    </Screen>
  );
}
