import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, StyleSheet, View } from 'react-native';
import { AnalysisGate } from '../../src/components/career/AnalysisGate';
import { Badge, FadeIn, PressScale, Row, Text, Title, type IconName } from '../../src/components/ui';
import { labelSkill } from '../../src/constants/options';
import { colors, font, gradient, radius, shadow, spacing } from '../../src/theme';
import type { CareerAnalysis, RoadmapResource } from '../../src/types';

const RESOURCE_ICON: Record<RoadmapResource['type'], IconName> = {
  course: 'school-outline',
  doc: 'document-text-outline',
  video: 'play-circle-outline',
  project: 'code-slash-outline',
};

function Content({ d }: { d: CareerAnalysis }) {
  const totalWeeks = d.roadmap.reduce((sum, p) => sum + p.durationWeeks, 0);
  return (
    <>
      <FadeIn from="none">
        <Title sub={`About ${totalWeeks} weeks at your study pace to become job-ready as a ${d.recommendedRole}.`}>Learning roadmap</Title>
      </FadeIn>

      {d.roadmap.map((phase, i) => {
        const last = i === d.roadmap.length - 1;
        return (
          <FadeIn key={phase.phase} delay={100 + i * 130} from="left" distance={22}>
            <View style={styles.row}>
              <View style={styles.rail}>
                <LinearGradient colors={gradient.brand} style={styles.dot}>
                  {last ? <Ionicons name="flag" size={15} color={colors.white} /> : <Text style={styles.dotText}>{phase.phase}</Text>}
                </LinearGradient>
                {!last && <View style={styles.line} />}
              </View>

              <View style={styles.body}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.phaseTitle}>{phase.title}</Text>
                  <Badge text={`${phase.durationWeeks} wk`} color={colors.cyan} icon="time-outline" />
                </View>

                {phase.skills.length > 0 && (
                  <Row style={{ marginTop: spacing.md }}>
                    {phase.skills.map((s) => <Badge key={s} text={labelSkill(s)} />)}
                  </Row>
                )}

                {phase.actions.map((a) => (
                  <View key={a} style={styles.action}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                    <Text style={styles.actionText}>{a}</Text>
                  </View>
                ))}

                {phase.resources.map((r) => (
                  <PressScale
                    key={r.url}
                    scaleTo={0.98}
                    style={{ marginTop: spacing.sm }}
                    onPress={() => void Linking.openURL(r.url)}
                    innerStyle={styles.resource}
                  >
                    <Ionicons name={RESOURCE_ICON[r.type] ?? 'link-outline'} size={16} color={colors.primary} />
                    <Text style={styles.resourceText} numberOfLines={1}>{r.title}</Text>
                    <Ionicons name="open-outline" size={14} color={colors.muted} />
                  </PressScale>
                ))}
              </View>
            </View>
          </FadeIn>
        );
      })}
    </>
  );
}

export default function RoadmapTab() {
  return <AnalysisGate>{(d) => <Content d={d} />}</AnalysisGate>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 34 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.white, fontWeight: '800', fontSize: font.sm },
  line: { flex: 1, width: 2, backgroundColor: '#C7D2FE', marginVertical: 4, borderRadius: 1 },
  body: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  phaseTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700', flex: 1 },
  action: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionText: { color: colors.muted, fontSize: font.sm, flex: 1, lineHeight: 20 },
  resource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  resourceText: { color: colors.text, fontSize: font.sm, flex: 1, fontWeight: '500' },
});
