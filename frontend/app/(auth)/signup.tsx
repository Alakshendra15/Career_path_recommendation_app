import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, FadeIn, Input, Logo, Screen, Text, Title } from '../../src/components/ui';
import { useAuth } from '../../src/store/auth';
import { colors, font, spacing, tint } from '../../src/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  const router = useRouter();
  const signup = useAuth((s) => s.signup);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const next = {
      name: name.trim().length >= 2 ? undefined : 'Name must be at least 2 characters',
      email: EMAIL_RE.test(email.trim()) ? undefined : 'Enter a valid email',
      password: password.length >= 8 ? undefined : 'Password must be at least 8 characters',
    };
    setErrors(next);
    setServerError(null);
    if (next.name || next.email || next.password) return;

    setLoading(true);
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password);
      router.replace('/'); // new accounts have no profile, so index sends them to onboarding
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
        <Title sub="It takes about two minutes to set up your profile">Create your account</Title>
      </FadeIn>
      <FadeIn delay={160}>
        <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" placeholder="Rahul Sharma" error={errors.name} />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" error={errors.email} />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" error={errors.password} onSubmitEditing={submit} />
      </FadeIn>
      {serverError ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: tint(colors.danger, 0.08), marginBottom: spacing.lg }}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, flex: 1, fontSize: font.sm }}>{serverError}</Text>
        </View>
      ) : null}
      <FadeIn delay={260}>
        <Button title="Create account" onPress={submit} loading={loading} />
        <Pressable onPress={() => router.replace('/login')} style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: font.sm }}>
            Already registered? <Text style={{ color: colors.primary, fontWeight: '700' }}>Log in</Text>
          </Text>
        </Pressable>
      </FadeIn>
    </Screen>
  );
}
