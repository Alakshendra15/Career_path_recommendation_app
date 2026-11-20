import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { AnalysisGate } from '../../src/components/career/AnalysisGate';
import { AnimatedNumber, Badge, Card, FadeIn, GradientCard, Heading, ProgressBar, Row, Text } from '../../src/components/ui';
import { labelSkill } from '../../src/constants/options';
import { useAnalysis } from '../../src/store/analysis';
import { useAuth } from '../../src/store/auth';
import { colors, font, radius, scoreColor, spacing, tint } from '../../src/theme';
import type { CareerAnalysis } from '../../src/types';

function BreakdownBar({ label, value, hint, delay }: { label: string; value: number; hint: string; delay: number }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: '600' }}>{Math.round(value)}%</Text>
      </View>
      <ProgressBar value={value / 100} color={scoreColor(value)} delay={delay} />
      <Text style={{ color: colors.muted, fontSize: font.xs, marginTop: 5, lineHeight: 17 }}>{hint}</Text>
    </View>
  );
}

function Stat({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      {children}
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: font.xs, fontWeight: '600', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Content({ d }: { d: CareerAnalysis }) {
  const generatedAt = useAnalysis((s) => s.generatedAt);
  const name = useAuth((s) => s.user?.name?.split(' ')[0]);
  const partial = new Set(d.partialSkills);
  const b = d.scoreBreakdown;
  const bigNumber = { color: colors.white, fontSize: 38, fontWeight: '800' as const, letterSpacing: -1 };

  return (
    <>
      <FadeIn from="none">
        <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: '500' }}>
          {name ? `Hello, ${name}` : 'Hello'}
          {generatedAt ? `  ·  updated ${new Date(generatedAt).toLocaleDateString()}` : ''}
        </Text>
        <Text style={{ color: colors.text, fontSize: font.xxl, fontWeight: '800', letterSpacing: -0.5, marginBottom: spacing.lg }}>Your career match</Text>
      </FadeIn>

      <FadeIn delay={80}>
        <GradientCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="sparkles" size={14} color="#FDE68A" />
            <Text style={{ color: '#FDE68A', fontSize: font.xs, fontWeight: '700', letterSpacing: 1.2 }}>BEST MATCH</Text>
          </View>
          <Text style={{ color: colors.white, fontSize: font.xxl, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 }}>{d.recommendedRole}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: font.sm, marginTop: spacing.sm, lineHeight: 21 }}>{d.roleDescription}</Text>

          <View
            style={{
              flexDirection: 'row',
              marginTop: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <Stat label="match">
              <AnimatedNumber value={Math.round(d.matchPercent)} style={bigNumber} />
            </Stat>
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
            <Stat label="skills ready">
              <AnimatedNumber value={Math.round(d.readinessPercent)} style={bigNumber} />
            </Stat>
          </View>
        </GradientCard>
      </FadeIn>

      <FadeIn delay={180}>
        <Heading icon="analytics">Why this match</Heading>
        <Card>
          <BreakdownBar delay={400} label="Skills you have" value={b.weighted_skill} hint="Share of this career's skills (weighted by importance) that you already know" />
          <BreakdownBar delay={500} label="Profile similarity" value={b.tfidf_cosine} hint="How closely your skill set resembles this career's typical profile" />
          <BreakdownBar delay={600} label="Interests" value={b.interest} hint="How well your interests line up with this career" />
          {b.ml_model !== undefined && (
            <BreakdownBar
              delay={700}
              label="AI model"
              value={b.ml_model}
              hint="Chance this career fits your skills, learned from hundreds of thousands of real job postings"
            />
          )}
        </Card>
      </FadeIn>

      <FadeIn delay={280}>
        <Heading icon="git-compare">Skill gap</Heading>
        <Card>
          <Text style={{ color: colors.success, fontWeight: '700', marginBottom: spacing.sm }}>You have ({d.currentSkills.length})</Text>
          <Row style={{ marginBottom: spacing.lg }}>
            {d.currentSkills.length ? (
              d.currentSkills.map((s) => <Badge key={s} text={labelSkill(s)} color={colors.success} icon="checkmark-circle" />)
            ) : (
              <Text style={{ color: colors.muted }}>None of this career&apos;s skills yet</Text>
            )}
          </Row>

          <Text style={{ color: colors.warning, fontWeight: '700', marginBottom: spacing.sm }}>To learn ({d.missingSkillDetails.length})</Text>
          <Row>
            {d.missingSkillDetails.map((m) => (
              <Badge
                key={m.skill}
                text={labelSkill(m.skill)}
                color={m.type === 'core' ? colors.danger : colors.warning}
                icon={partial.has(m.skill) ? 'arrow-forward-circle' : 'ellipse-outline'}
              />
            ))}
          </Row>
          {d.missingSkillDetails.length > 0 && (
            <Text style={{ color: colors.muted, fontSize: font.xs, marginTop: spacing.md, lineHeight: 18 }}>
              Red skills are core for this role, amber ones are a bonus. The arrow marks skills you are ready to start now because you know the prerequisite.
            </Text>
          )}
        </Card>
      </FadeIn>

      {d.relatedRoles.length > 0 && (
        <FadeIn delay={380}>
          <Heading icon="compass">Other paths for you</Heading>
          {d.relatedRoles.map((r) => (
            <Card key={r.title} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700', flex: 1 }}>{r.title}</Text>
                <View style={{ backgroundColor: tint(scoreColor(r.matchPercent), 0.12), paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill }}>
                  <Text style={{ color: scoreColor(r.matchPercent), fontWeight: '700', fontSize: font.sm }}>{Math.round(r.matchPercent)}%</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.sm, alignItems: 'center' }}>
                <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: font.sm, flex: 1 }}>{r.reason}</Text>
              </View>
            </Card>
          ))}
        </FadeIn>
      )}
    </>
  );
}

export default function CareerTab() {
  return <AnalysisGate>{(d) => <Content d={d} />}</AnalysisGate>;
}
