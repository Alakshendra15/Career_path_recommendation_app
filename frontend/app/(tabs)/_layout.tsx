import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ColorValue } from 'react-native';
import { useAnalysis } from '../../src/store/analysis';
import { colors, fontFor, shadow } from '../../src/theme';

const icon = (name: keyof typeof Ionicons.glyphMap, focused: keyof typeof Ionicons.glyphMap) =>
  ({ color, focused: f, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={f ? focused : name} size={size} color={color as string} />
  );

export default function TabsLayout() {
  const load = useAnalysis((s) => s.load);
  const insets = useSafeAreaInsets(); // keeps the tab bar above the system nav bar / gesture area

  // fetch once when the tabs open; every tab reads the same result
  useEffect(() => {
    const { data, loading } = useAnalysis.getState();
    if (!data && !loading) void load();
  }, [load]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade', // cross-fade between tabs
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { backgroundColor: colors.card, borderTopWidth: 0, height: 56 + Math.max(insets.bottom, 10), paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), ...shadow.bar },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fontFor('600') },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="career" options={{ title: 'Career', tabBarIcon: icon('sparkles-outline', 'sparkles') }} />
      <Tabs.Screen name="roadmap" options={{ title: 'Roadmap', tabBarIcon: icon('map-outline', 'map') }} />
      <Tabs.Screen name="roles" options={{ title: 'Jobs', tabBarIcon: icon('briefcase-outline', 'briefcase') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
