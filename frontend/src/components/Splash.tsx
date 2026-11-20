import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Logo } from './ui/Logo';
import { Text } from './ui/Text';

const native = Platform.OS !== 'web';
const MIN_VISIBLE_MS = 1700;

/**
 * Branded launch screen shown over the app until fonts and the saved session are ready.
 * The logo springs in, the name and tagline fade up, then the whole screen fades away.
 */
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const logo = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const shownAt = useRef(Date.now());
  const leaving = useRef(false);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logo, { toValue: 1, friction: 5, tension: 70, useNativeDriver: native }),
      Animated.timing(text, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.timing(tag, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start();
  }, [logo, text, tag]);

  // leave once the app is ready AND the intro has had time to play
  useEffect(() => {
    if (!ready || leaving.current) return;
    leaving.current = true;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    const timer = setTimeout(() => {
      Animated.timing(out, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }).start(onDone);
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, out, onDone]);

  const logoScale = logo.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const logoSpin = logo.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] });
  const rise = (v: Animated.Value) => v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { opacity: out, zIndex: 100 }]}>
      <LinearGradient colors={['#4F46E5', '#6D5CE8', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
        <View pointerEvents="none" style={[styles.bubble, { width: 320, height: 320, top: -110, right: -90 }]} />
        <View pointerEvents="none" style={[styles.bubble, { width: 220, height: 220, bottom: -80, left: -70 }]} />
        <Animated.View style={{ opacity: logo, transform: [{ scale: logoScale }, { rotate: logoSpin }] }}>
          <View style={styles.logoShadow}>
            <Logo size={104} variant="light" />
          </View>
        </Animated.View>
        <Animated.View style={{ opacity: text, transform: [{ translateY: rise(text) }], marginTop: 28 }}>
          <Text style={styles.name}>CareerPath</Text>
        </Animated.View>
        <Animated.View style={{ opacity: tag, transform: [{ translateY: rise(tag) }], marginTop: 6 }}>
          <Text style={styles.tagline}>Find the career that fits you</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoShadow: { borderRadius: 28, boxShadow: '0 14px 36px rgba(30, 20, 120, 0.45)' },
  name: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500' },
});
