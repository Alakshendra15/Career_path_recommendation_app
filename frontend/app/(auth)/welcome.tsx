import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, FadeIn, Float, Logo, Screen, Text, type IconName } from '../../src/components/ui';
import { useAuth } from '../../src/store/auth';
import { colors, font, gradient, radius, shadow, spacing, tint } from '../../src/theme';

const FEATURES: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: 'sparkles', color: colors.primary, title: 'Career match', text: 'See which careers fit your skills best, with a score for each.' },
  { icon: 'trending-up', color: colors.cyan, title: 'Skill gap', text: 'Know exactly which skills you still need to learn.' },
  { icon: 'map', color: colors.success, title: 'Learning roadmap', text: 'A step-by-step plan with free resources.' },
  { icon: 'document-text', color: colors.warning, title: 'Resume reader', text: 'Upload your PDF resume and we pick out your skills.' },
];

export default function Welcome() {
  const router = useRouter();
  const notice = useAuth((s) => s.notice);
  return (
    <Screen
      padded={false}
      footer={
        <FadeIn delay={700} from="up" distance={12}>
          <View style={{ gap: spacing.md }}>
            <Button title="Get started" icon="arrow-forward" onPress={() => router.push('/signup')} />
            <Button title="I already have an account" variant="outline" onPress={() => router.push('/login')} />
          </View>
        </FadeIn>
      }
    >
      {notice ? (
        <View style={{ margin: spacing.lg, marginBottom: 0, padding: spacing.md, borderRadius: radius.md, backgroundColor: tint(colors.warning, 0.1), borderWidth: 1, borderColor: tint(colors.warning, 0.35) }}>
          <Text style={{ color: colors.text, fontSize: font.sm, lineHeight: 20 }}>{notice}</Text>
        </View>
      ) : null}
      <LinearGradient colors={gradient.brandSoft} style={styles.heroBg}>
        <View style={styles.hero}>
          <FadeIn from="none" delay={0} duration={600}>
            <Float>
              <View style={[shadow.raised, { borderRadius: 22 }]}>
                <Logo size={84} />
              </View>
            </Float>
          </FadeIn>
          <FadeIn delay={120}>
            <Text style={styles.pill}>AI career guidance for students</Text>
          </FadeIn>
          <FadeIn delay={200}>
            <Text style={styles.headline}>
              Chart your <Text style={{ color: colors.primary }}>career path</Text>
            </Text>
          </FadeIn>
          <FadeIn delay={280}>
            <Text style={styles.sub}>Tell us what you know. We show the careers you fit, what to learn next and the jobs to aim for.</Text>
          </FadeIn>
        </View>
      </LinearGradient>

      <View style={{ padding: spacing.lg, paddingTop: spacing.sm }}>
        {FEATURES.map((f, i) => (
          <FadeIn key={f.title} delay={380 + i * 90} from={i % 2 ? 'right' : 'left'} distance={24}>
            <View style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: tint(f.color, 0.12) }]}>
                <Ionicons name={f.icon} size={22} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            </View>
          </FadeIn>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBg: { paddingBottom: spacing.xl },
  hero: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.md },
  pill: {
    color: colors.primary,
    backgroundColor: tint(colors.primary, 0.1),
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: font.xs,
    fontWeight: '700',
    overflow: 'hidden',
  },
  headline: { color: colors.text, fontSize: font.hero, fontWeight: '800', textAlign: 'center', letterSpacing: -1 },
  sub: { color: colors.muted, fontSize: font.md, textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.sm },
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  featureIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  featureText: { color: colors.muted, fontSize: font.sm, marginTop: 2, lineHeight: 19 },
});
