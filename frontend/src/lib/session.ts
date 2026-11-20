import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'career_token';

// SecureStore (Keychain / Keystore) on phones; localStorage only as a fallback for Expo web testing.
export async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') return void globalThis.localStorage?.setItem(KEY, token);
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') return void globalThis.localStorage?.removeItem(KEY);
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* nothing to clear */
  }
}
