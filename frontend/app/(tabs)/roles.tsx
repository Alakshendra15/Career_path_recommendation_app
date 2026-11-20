import { View } from 'react-native';
import { AnalysisGate } from '../../src/components/career/AnalysisGate';
import { Badge, Card, EmptyState, FadeIn, ProgressBar, Row, Text, Title } from '../../src/components/ui';
import { labelSkill } from '../../src/constants/options';
import { colors, font, scoreColor, spacing } from '../../src/theme';
import type { CareerAnalysis } from '../../src/types';

function Content({ d }: { d: CareerAnalysis }) {
  return (
    <>
      <FadeIn from="none">
        <Title sub="Entry-level roles ranked by how well your skills and best-fit careers match.">Jobs to aim for</Title>
      </FadeIn>

      {d.jobRoles.length === 0 ? (
        <EmptyState icon="briefcase-outline" title="No roles yet" text="Add more skills to your profile to see matching job titles." />
      ) : (
        d.jobRoles.map((j, i) => (
          <FadeIn key={j.title} delay={80 + i * 90}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700' }}>{j.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 2 }}>{j.career}</Text>
                </View>
                <Badge text={`${Math.round(j.fitPercent)}% fit`} color={scoreColor(j.fitPercent * 2)} />
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: colors.muted, fontSize: font.xs }}>Skills you have for this role</Text>
                  <Text style={{ color: colors.text, fontSize: font.xs, fontWeight: '700' }}>{Math.round(j.skillMatchPercent)}%</Text>
                </View>
                <ProgressBar value={j.skillMatchPercent / 100} color={scoreColor(j.skillMatchPercent)} delay={250 + i * 90} />
              </View>

              {j.matchedSkills.length > 0 && (
                <Row style={{ marginTop: spacing.md }}>
                  {j.matchedSkills.map((s) => <Badge key={s} text={labelSkill(s)} color={colors.success} icon="checkmark" />)}
                </Row>
              )}
              {j.missingSkills.length > 0 && (
                <Row style={{ marginTop: spacing.sm }}>
                  {j.missingSkills.map((s) => <Badge key={s} text={labelSkill(s)} color={colors.warning} icon="add" />)}
                </Row>
              )}
            </Card>
          </FadeIn>
        ))
      )}
    </>
  );
}

export default function RolesTab() {
  return <AnalysisGate>{(d) => <Content d={d} />}</AnalysisGate>;
}
