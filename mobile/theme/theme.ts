import { useColorScheme } from 'react-native';

/**
 * SignBridge brand palette.
 * Kept in sync with the team's web tracker so the mobile app feels like
 * the same product. Update here if the brand palette changes.
 */
export const palette = {
  light: {
    background: '#F6F8F9',
    surface: '#FFFFFF',
    text: '#122031',
    textMuted: '#5B6B7A',
    accent: '#0E9C8F',
    accentText: '#FFFFFF',
    border: '#E1E6EA',
    danger: '#C4453A',
    warning: '#B8862E',
  },
  dark: {
    background: '#0E1520',
    surface: '#16202C',
    text: '#EAEDF0',
    textMuted: '#93A2B0',
    accent: '#28C4B4',
    accentText: '#0E1520',
    border: '#223142',
    danger: '#E0685C',
    warning: '#E0B25C',
  },
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  border: string;
  danger: string;
  warning: string;
}

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Returns the active color scheme's palette, defaulting to light. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}
