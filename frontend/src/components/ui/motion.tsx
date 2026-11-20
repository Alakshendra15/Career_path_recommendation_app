import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from './Text';

// The native driver is unavailable on web; passing it there only logs a warning.
const native = Platform.OS !== 'web';

/** Fades and slides its children in. Give list items an increasing `delay` for a staggered entrance. */
export function FadeIn({
  children,
  delay = 0,
  duration = 450,
  from = 'up',
  distance = 18,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      // JS driver on purpose: content that mounts after a loading skeleton must never get stuck at opacity 0
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) progress.setValue(1);
    });
    return () => progress.stopAnimation();
  }, [progress, delay, duration]);

  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  const translate =
    from === 'up' ? { translateY: offset }
    : from === 'down' ? { translateY: Animated.multiply(offset, -1) }
    : from === 'left' ? { translateX: offset }
    : from === 'right' ? { translateX: Animated.multiply(offset, -1) }
    : undefined;

  return <Animated.View style={[style, { opacity: progress, transform: translate ? [translate] : [] }]}>{children}</Animated.View>;
}

/**
 * Pressable that springs down slightly while held. `style` positions the whole thing
 * (margins, width); `innerStyle` is its look (background, padding, border).
 */
export function PressScale({
  children,
  onPress,
  disabled,
  style,
  innerStyle,
  scaleTo = 0.97,
  accessibilityRole,
  accessibilityLabel,
  hitSlop,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  accessibilityRole?: 'button' | 'link';
  accessibilityLabel?: string;
  hitSlop?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, speed: 40, bounciness: 6, useNativeDriver: native }).start();
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        hitSlop={hitSlop}
        onPress={onPress}
        onPressIn={() => to(scaleTo)}
        onPressOut={() => to(1)}
        style={innerStyle}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Counts up from zero to `value`, e.g. a 53% match. */
export function AnimatedNumber({
  value,
  duration = 1000,
  suffix = '%',
  style,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    anim.setValue(0);
    Animated.timing(anim, { toValue: value, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [anim, value, duration]);
  return <Text style={style}>{shown}{suffix}</Text>;
}

/** Gentle up-and-down drift, used on the welcome logo. */
export function Float({ children, amplitude = 6, period = 2600 }: { children: ReactNode; amplitude?: number; period?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(t, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, period]);
  const y = t.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] });
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
}
