// Design tokens: clean light theme, indigo/violet brand, Plus Jakarta Sans.
export const colors = {
  background: '#F5F7FB',
  surface: '#F1F5F9', // inputs and nested panels
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  violet: '#7C3AED',
  cyan: '#0891B2',
  success: '#059669',
  warning: '#D97706',
  danger: '#E11D48',
  white: '#FFFFFF',
};

export const gradient = {
  brand: ['#4F46E5', '#7C3AED'] as const,
  brandSoft: ['#EEF2FF', '#F5F3FF'] as const,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const font = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, hero: 34 };

/** Soft elevation that works on web and native (RN's boxShadow style). */
export const shadow = {
  card: { boxShadow: '0 2px 12px rgba(15, 23, 42, 0.06)' },
  raised: { boxShadow: '0 6px 20px rgba(79, 70, 229, 0.28)' },
  bar: { boxShadow: '0 -2px 14px rgba(15, 23, 42, 0.06)' },
} as const;

/** Tinted background for chips/badges, e.g. tint('#059669') -> 15% opacity. */
export const tint = (hex: string, alpha = 0.15) => {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
};

/**
 * Colour for a match / fit percentage. Deliberately not a red-amber-green traffic light:
 * typical scores sit around 20-60%, and red would make a normal result look like a failure.
 */
export function scoreColor(percent: number) {
  if (percent >= 60) return colors.success;
  if (percent >= 30) return colors.primary;
  return colors.muted;
}

// ---- fonts. React Native selects a weight by font file, so each weight is its own family name.
export const FONT_FILES = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export function fontFor(weight?: string | number): string {
  const w = String(weight ?? '400');
  if (w === 'bold' || w === '700') return FONT_FILES.bold;
  if (w === '800' || w === '900') return FONT_FILES.extrabold;
  if (w === '600') return FONT_FILES.semibold;
  if (w === '500') return FONT_FILES.medium;
  return FONT_FILES.regular;
}
