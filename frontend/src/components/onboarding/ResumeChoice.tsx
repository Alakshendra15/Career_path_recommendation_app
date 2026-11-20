import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { api } from '../../lib/api';
import { prefillFromResume } from '../../lib/resumePrefill';
import { useOnboarding } from '../../store/onboarding';
import { colors, font, radius, spacing, tint } from '../../theme';
import { OptionCard, Text } from '../ui';

const MAX_BYTES = 10 * 1024 * 1024;

/** First onboarding screen for a new account: upload a resume to auto-fill, or fill the form by hand. */
export function ResumeChoice() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickResume() {
    if (busy) return;
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if (file.size && file.size > MAX_BYTES) return setError('That PDF is larger than 10 MB');

    setBusy(true);
    try {
      // merge=false: nothing is added to the profile until the student confirms it on the next screen
      const result = await api.uploadResume({ uri: file.uri, name: file.name, mimeType: file.mimeType }, false);
      const { patch, filled } = prefillFromResume(result);
      // experience / interests alone are not proof that this was a resume: need a name, skills or a degree
      if (!patch.name && !patch.skills && !patch.education) {
        setError('We could not find a name, skills or education in that PDF. Is it a resume? Try another PDF, or fill it in yourself.');
        return;
      }
      useOnboarding.getState().applyResume(patch, filled);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <OptionCard
        icon="document-text"
        title="Upload my resume"
        description="Quickest. We read your PDF and fill in your details. You check them before anything is saved."
        selected={false}
        onPress={() => void pickResume()}
      />
      <OptionCard
        icon="create"
        title="Fill it in myself"
        description="Answer a few short questions, one at a time."
        selected={false}
        onPress={() => useOnboarding.getState().setMode('steps')}
      />

      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: font.sm }}>Reading your resume...</Text>
        </View>
      ) : null}
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: tint(colors.danger, 0.08) }}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.danger, fontSize: font.sm, flex: 1, lineHeight: 20 }}>{error}</Text>
        </View>
      ) : null}
      <Text style={{ color: colors.muted, fontSize: font.xs, textAlign: 'center', marginTop: spacing.lg, lineHeight: 17 }}>
        Your resume is only used to fill in this form. Text-based PDFs work best; scanned images can not be read.
      </Text>
    </View>
  );
}
