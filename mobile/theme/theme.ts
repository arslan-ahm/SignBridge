import { useColorScheme } from 'react-native';

/**
 * SignBridge design system.
 *
 * This is the single source of truth for color, type, spacing, radius, and
 * elevation across the app -- screens and components should never hardcode
 * a hex value, font size, or shadow, they should pull from here. Values are
 * kept in sync with the web app's tokens (website/css/style.css: --bg,
 * --accent, --violet, Manrope/JetBrains Mono) so the product feels like one
 * brand across web and mobile, not two different apps that happen to share
 * a name.
 */

export const palette = {
  light: {
    background: '#F5F7FA',
    backgroundElevated: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceSunken: '#EEF2F6',
    text: '#0F172A',
    textMuted: '#5B6B7E',
    textFaint: '#94A3B8',
    accent: '#0E9C8F',
    accentDim: '#0B8378',
    accentSoft: 'rgba(14, 156, 143, 0.12)',
    accentText: '#FFFFFF',
    violet: '#7C5CFC',
    violetSoft: 'rgba(124, 92, 252, 0.12)',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    danger: '#C4453A',
    dangerSoft: 'rgba(196, 69, 58, 0.1)',
    warning: '#B8862E',
    warningSoft: 'rgba(184, 134, 46, 0.12)',
    success: '#1F9D63',
    overlay: 'rgba(15, 23, 42, 0.55)',
  },
  dark: {
    background: '#0A0E14',
    backgroundElevated: '#10151F',
    surface: '#131A26',
    surfaceSunken: '#0D1119',
    text: '#EEF2F7',
    textMuted: '#97A3B6',
    textFaint: '#5C6B82',
    accent: '#2DD4BF',
    accentDim: '#14B8A6',
    accentSoft: 'rgba(45, 212, 191, 0.14)',
    accentText: '#04211D',
    violet: '#A78BFA',
    violetSoft: 'rgba(167, 139, 250, 0.14)',
    border: '#212B3B',
    borderStrong: '#2E3D54',
    danger: '#F87171',
    dangerSoft: 'rgba(248, 113, 113, 0.14)',
    warning: '#E0B25C',
    warningSoft: 'rgba(224, 178, 92, 0.14)',
    success: '#34D399',
    overlay: 'rgba(4, 6, 10, 0.65)',
  },
} as const;

export interface ThemeColors {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentDim: string;
  accentSoft: string;
  accentText: string;
  violet: string;
  violetSoft: string;
  border: string;
  borderStrong: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  overlay: string;
}

/** Returns the active color scheme's palette, defaulting to dark (the brand's primary surface). */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'light' ? palette.light : palette.dark;
}

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/**
 * Type scale. `family` keys map to the loaded font names in App.tsx's
 * useFonts() call -- Manrope for all UI text (headings, body, labels),
 * JetBrains Mono for anything numeric/technical (confidence %, badges),
 * matching the split already established on the web app.
 */
export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_700Bold',
};

export const type = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: fontFamily.extrabold },
  h1: { fontSize: 26, lineHeight: 33, fontFamily: fontFamily.bold },
  h2: { fontSize: 20, lineHeight: 27, fontFamily: fontFamily.bold },
  h3: { fontSize: 17, lineHeight: 23, fontFamily: fontFamily.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.medium },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.medium },
  micro: { fontSize: 11, lineHeight: 15, fontFamily: fontFamily.semibold },
  button: { fontSize: 15, lineHeight: 20, fontFamily: fontFamily.semibold },
  mono: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.mono },
};

/**
 * Elevation presets. iOS reads shadow*; Android reads elevation. Keeping
 * both in one object means components apply a single `shadow.card` instead
 * of hand-rolling platform-specific shadow math everywhere.
 */
export const shadow = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
