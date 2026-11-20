import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, FadeIn, Input, Logo, Screen, Text, Title } from '../../src/components/ui';
import { useAuth } from '../../src/store/auth';
import { colors, font, spacing, tint } from '../../src/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const next = {
      email: EMAIL_RE.test(email.trim()) ? undefined : 'Enter a valid email',
      password: password ? undefined : 'Enter your password',
    };
    setErrors(next);
    setServerError(null);
    if (next.email || next.password) return;

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/'); // index decides: onboarding or dashboard
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <FadeIn from="none">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Logo size={44} />
        </View>
      </FadeIn>
      <FadeIn delay={80}>
        <Title sub="Log in to see your career analysis">Welcome back</Title>
      </FadeIn>
      <FadeIn delay={160}>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" error={errors.email} />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Your password" error={errors.password} onSubmitEditing={submit} />
      </FadeIn>
      {serverError ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: tint(colors.danger, 0.08), marginBottom: spacing.lg }}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, flex: 1, fontSize: font.sm }}>{serverError}</Text>
        </View>
      ) : null}
      <FadeIn delay={240}>
        <Button title="Log in" onPress={submit} loading={loading} />
        <Pressable onPress={() => router.replace('/signup')} style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: font.sm }}>
            New here? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create an account</Text>
          </Text>
        </Pressable>
      </FadeIn>
    </Screen>
  );
}
