import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Splash } from '../src/components/Splash';
import { useAuth } from '../src/store/auth';
import { colors } from '../src/theme';

// keep the native launch screen up until our animated one has mounted
void SplashScreen.preventAutoHideAsync().catch(() => {});

const MAX_WIDTH = 480;

/** On a wide browser window, keep the app phone-sized and centred instead of stretching it edge to edge. */
function Frame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#E6EAF3' }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: MAX_WIDTH,
          backgroundColor: colors.background,
          overflow: 'hidden',
          boxShadow: '0 0 40px rgba(15, 23, 42, 0.14)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const status = useAuth((s) => s.status);
  const completed = useAuth((s) => !!s.profile?.completed);
  const init = useAuth((s) => s.init);
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    void init();
  }, [init]);

  const ready = fontsLoaded && status !== 'loading';

  // the animated splash takes over from the native one as soon as the layout exists
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  const signedIn = status === 'signedIn';
  return (
    <SafeAreaProvider>
      <StatusBar style={splashDone ? 'dark' : 'light'} />
      <Frame>
        {ready ? (
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="index" />
            {/* route guards: the router refuses screens the current session may not see */}
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && completed}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            </Stack.Protected>
          </Stack>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.background }} />
        )}
        {!splashDone && <Splash ready={ready} onDone={finishSplash} />}
      </Frame>
    </SafeAreaProvider>
  );
}
