import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, fontFor, gradient, radius, shadow, spacing, tint } from '../../theme';
import { FadeIn, PressScale } from './motion';
import { Text } from './Text';

export { AnimatedNumber, FadeIn, Float, PressScale } from './motion';
export { Logo } from './Logo';
export { Text } from './Text';

export type IconName = keyof typeof Ionicons.glyphMap;

export const tap = () => void Haptics.selectionAsync().catch(() => {});

const native = Platform.OS !== 'web';

/** Safe-area aware page. Scroll pages also lift above the keyboard. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  footer,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.pad, { paddingBottom: spacing.xxl }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // react-native-web renders a RefreshControl as nothing and takes the scroll content with it,
      // so pull-to-refresh is native-only; the web gets a visible refresh button instead
      // NOTE: pull-to-refresh (RefreshControl) disabled: it rendered the whole scroll content blank on Expo Go (SDK 58, Android).
      // Screens use the visible "Refresh analysis" button instead.
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.pad]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: footer ? 0 : insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

function RefreshCtl({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} colors={[colors.primary]} />;
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Heading({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.heading}>
      {icon ? (
        <View style={styles.headingIcon}>
          <Ionicons name={icon} size={15} color={colors.primary} />
        </View>
      ) : null}
      <Text style={styles.headingText}>{children}</Text>
    </View>
  );
}

/** White card with a soft shadow. Pass `delay` (ms) to fade it in, staggered with its siblings. */
export function Card({ children, style, delay }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const card = <View style={[styles.card, style]}>{children}</View>;
  return delay === undefined ? card : <FadeIn delay={delay}>{card}</FadeIn>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  const labelColor = primary ? colors.white : variant === 'outline' ? colors.primary : colors.muted;
  const content = loading ? (
    <ActivityIndicator color={labelColor} />
  ) : (
    <>
      {icon ? <Ionicons name={icon} size={18} color={labelColor} /> : null}
      <Text style={[styles.buttonText, { color: labelColor }]}>{title}</Text>
    </>
  );
  return (
    <PressScale
      accessibilityRole="button"
      disabled={inactive}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[inactive && { opacity: 0.55 }, style]}
      innerStyle={[
        styles.buttonShell,
        primary && shadow.raised,
        variant === 'outline' && { backgroundColor: colors.card, borderWidth: 1.5, borderColor: tint(colors.primary, 0.35) },
      ]}
    >
      {primary ? (
        <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonFill}>
          {content}
        </LinearGradient>
      ) : (
        <View style={styles.buttonFill}>{content}</View>
      )}
    </PressScale>
  );
}

export function Input({ label, error, style, onFocus, onBlur, ...props }: TextInputProps & { label?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? { borderColor: colors.danger } : null,
          style,
        ]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Badge({ text, color = colors.primary, icon }: { text: string; color?: string; icon?: IconName }) {
  return (
    <View style={[styles.badge, { backgroundColor: tint(color, 0.1), borderColor: tint(color, 0.25) }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, style]}>{children}</View>;
}

/** Selectable / removable pill used in the skill pickers. */
export function Chip({
  label,
  selected = false,
  onPress,
  onRemove,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}) {
  return (
    <PressScale
      scaleTo={0.94}
      onPress={() => {
        tap();
        (onRemove ?? onPress)?.();
      }}
      innerStyle={[styles.chip, selected && { backgroundColor: tint(colors.primary, 0.1), borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.primary, fontWeight: '600' }]}>{label}</Text>
      {onRemove ? <Ionicons name="close" size={14} color={selected ? colors.primary : colors.muted} /> : null}
    </PressScale>
  );
}

/** Large tappable option card (education level, experience type). */
export function OptionCard({
  title,
  description,
  icon,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale
      scaleTo={0.98}
      style={{ marginBottom: spacing.md }}
      onPress={() => {
        tap();
        onPress();
      }}
      innerStyle={[styles.option, selected ? [{ borderColor: colors.primary, backgroundColor: tint(colors.primary, 0.06) }, shadow.card] : shadow.card]}
    >
      <View style={[styles.optionIcon, selected && { backgroundColor: colors.primary }]}>
        <Ionicons name={icon} size={22} color={selected ? colors.white : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? colors.primary : '#CBD5E1'} />
    </PressScale>
  );
}

export function ProgressBar({ value, color = colors.primary, delay = 150 }: { value: number; color?: string; delay?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(1, value)),
      duration: 700,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating width
    }).start();
  }, [value, anim, delay]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

export function Skeleton({ height = 80, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: native }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ height, borderRadius: radius.lg, backgroundColor: '#E2E8F0', opacity }, style]} />;
}

/** Brand gradient hero card with light text. */
export function GradientCard({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradient, shadow.raised]}>
      {/* decorative circles */}
      <View pointerEvents="none" style={[styles.bubble, { width: 180, height: 180, top: -70, right: -50 }]} />
      <View pointerEvents="none" style={[styles.bubble, { width: 110, height: 110, bottom: -50, left: -30 }]} />
      {children}
    </LinearGradient>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={[styles.stateIcon, { backgroundColor: tint(colors.danger, 0.1) }]}>
        <Ionicons name="alert-circle-outline" size={34} color={colors.danger} />
      </View>
      <Text style={[styles.title, { fontSize: font.lg, marginTop: spacing.lg }]}>Something went wrong</Text>
      <Text style={[styles.sub, { textAlign: 'center', marginBottom: spacing.lg }]}>{message}</Text>
      {onRetry ? <Button title="Try again" icon="refresh" onPress={onRetry} variant="outline" /> : null}
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.center}>
      <View style={[styles.stateIcon, { backgroundColor: tint(colors.primary, 0.08) }]}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={[styles.title, { fontSize: font.lg, marginTop: spacing.lg }]}>{title}</Text>
      <Text style={[styles.sub, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

/** Bottom-sheet picker with search (state / city). */
export function SelectSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  searchable = true,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => setQuery('')}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.sheetGrab} />
        <View style={styles.sheetHeader}>
          <Text style={styles.headingText}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>
        {searchable ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor="#94A3B8"
            style={[styles.input, { marginBottom: spacing.md }]}
          />
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(o) => o}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.sub}>No matches</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                tap();
                onSelect(item);
                onClose();
              }}
              style={styles.sheetItem}
            >
              <Text style={[styles.sheetItemText, item === selected && { color: colors.primary, fontWeight: '700' }]}>{item}</Text>
              {item === selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

/** Field that looks like an input but opens a SelectSheet. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} disabled={disabled} style={[styles.input, styles.selectField, disabled && { opacity: 0.5 }]}>
        <Text style={{ color: value ? colors.text : '#94A3B8', fontSize: font.md }}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pad: { padding: spacing.lg },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    ...shadow.bar,
  },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: font.sm, marginTop: spacing.xs, lineHeight: 21 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.sm },
  headingIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: tint(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  buttonShell: { borderRadius: radius.md, overflow: 'hidden' },
  buttonFill: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: { fontSize: font.md, fontWeight: '700' },
  label: { color: colors.text, fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    color: colors.text,
    fontSize: font.md,
    fontFamily: fontFor('400'),
  },
  inputFocused: { borderColor: colors.primary, boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.12)' },
  selectField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { color: colors.danger, fontSize: font.xs, marginTop: spacing.xs, fontFamily: fontFor('500') },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: { fontSize: font.xs, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { color: colors.muted, fontSize: font.sm, fontWeight: '500' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: tint(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  optionDesc: { color: colors.muted, fontSize: font.sm, marginTop: 2, lineHeight: 19 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: '#E8ECF4', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  gradient: { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  stateIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    maxHeight: '75%',
    width: '100%',
    maxWidth: 480, // keep the sheet phone-sized on wide browser windows
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetItemText: { color: colors.text, fontSize: font.md },
});
