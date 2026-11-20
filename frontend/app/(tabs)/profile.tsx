import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Badge, Button, Card, FadeIn, Heading, Row, Screen, Text } from '../../src/components/ui';
import { labelSkill } from '../../src/constants/options';
import { api } from '../../src/lib/api';
import { useAnalysis } from '../../src/store/analysis';
import { useAuth } from '../../src/store/auth';
import { colors, font, gradient, radius, shadow, spacing, tint } from '../../src/theme';
import type { ResumeResult } from '../../src/types';

function Info({ label, value, last }: { label: string; value: string | null | undefined; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: font.sm }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value || '-'}</Text>
    </View>
  );
}

export default function ProfileTab() {
  const router = useRouter();
  const { user, profile, refresh, logout } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [resume, setResume] = useState<ResumeResult | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  async function pickResume() {
    setResumeError(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if (file.size && file.size > 10 * 1024 * 1024) return setResumeError('That PDF is larger than 10 MB');

    setUploading(true);
    try {
      let result: ResumeResult;
      try {
        result = await api.uploadResume({ uri: file.uri, name: file.name, mimeType: file.mimeType }, true);
      } catch (err) {
        return setResumeError((err as Error).message);
      }
      setResume(result);
      if (result.merged) {
        try {
          await refresh(); // pick up the merged skills
        } catch {
          setResumeError('Your resume was read and its skills were added, but your profile could not refresh. Reopen this tab to see them.');
        }
        void useAnalysis.getState().load(true); // and re-run the analysis with them (waits if one is already running)
      }
    } finally {
      setUploading(false);
    }
  }

  async function doLogout() {
    await logout();
    router.replace('/');
  }

  function confirmLogout() {
    // Alert.alert buttons do not work on web, so use the browser confirm there
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Log out? You will need to log in again.')) void doLogout();
      return;
    }
    Alert.alert('Log out', 'You will need to log in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void doLogout() },
    ]);
  }

  const education = profile?.education ? profile.education[0].toUpperCase() + profile.education.slice(1) : null;
  const experience = profile?.experienceType ? profile.experienceType[0].toUpperCase() + profile.experienceType.slice(1) : null;
  return (
    <Screen>
      <FadeIn from="none">
        <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.xl, overflow: 'hidden', ...shadow.raised }}>
          <View pointerEvents="none" style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)', top: -60, right: -40 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }}>
              <Text style={{ color: colors.white, fontSize: font.xxl, fontWeight: '800' }}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.white, fontSize: font.xl, fontWeight: '800' }} numberOfLines={1}>{user?.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: font.sm }} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>
        </LinearGradient>
      </FadeIn>

      <FadeIn delay={100}>
        <Heading icon="person-circle">About you</Heading>
        <Card>
          <Info label="Age" value={profile?.age?.toString()} />
          <Info label="Education" value={education} />
          <Info label="Location" value={profile?.city && profile.state ? `${profile.city}, ${profile.state}` : null} />
          <Info label="Experience" value={experience} last={!profile?.projectTitle} />
          {profile?.projectTitle ? <Info label="Project" value={profile.projectTitle} last /> : null}
        </Card>
      </FadeIn>

      <FadeIn delay={200}>
        <Heading icon="construct">Skills</Heading>
        <Card>
          <Row>{profile?.skills.map((s) => <Badge key={s} text={labelSkill(s)} />)}</Row>
          {profile?.interests.length ? (
            <>
              <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: spacing.lg, marginBottom: spacing.sm }}>Interests</Text>
              <Row>{profile.interests.map((s) => <Badge key={s} text={labelSkill(s)} color={colors.cyan} />)}</Row>
            </>
          ) : null}
        </Card>
      </FadeIn>

      <FadeIn delay={300}>
        <Heading icon="document-text">Resume</Heading>
        <Card>
          <Text style={{ color: colors.muted, fontSize: font.sm, lineHeight: 21, marginBottom: spacing.lg }}>
            Upload a PDF resume. We read your skills from it, add them to your profile and refresh your analysis.
          </Text>
          <Button title={uploading ? 'Reading resume...' : 'Upload PDF resume'} icon="cloud-upload" variant="outline" onPress={pickResume} loading={uploading} />
          {resumeError ? <Text style={{ color: colors.danger, marginTop: spacing.md, fontSize: font.sm }}>{resumeError}</Text> : null}
          {resume && (
            <FadeIn>
              <View style={{ marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: tint(colors.success, 0.08), borderWidth: 1, borderColor: tint(colors.success, 0.25) }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: spacing.sm }}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Found {resume.skills.length} skills</Text>
                </View>
                <Row>{resume.skills.map((s) => <Badge key={s} text={labelSkill(s)} color={colors.success} />)}</Row>
                {resume.education.length > 0 && <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: spacing.md }}>Education: {resume.education.join(', ')}</Text>}
              </View>
            </FadeIn>
          )}
        </Card>
      </FadeIn>

      <FadeIn delay={400}>
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          <Button title="Edit profile" icon="create" onPress={() => router.push('/onboarding')} />
          <Button title="Log out" icon="log-out" variant="outline" onPress={confirmLogout} />
        </View>
      </FadeIn>
    </Screen>
  );
}
