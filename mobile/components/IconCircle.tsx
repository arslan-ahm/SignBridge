import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/theme';

interface IconCircleProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  tone?: 'accent' | 'violet' | 'muted' | 'warning';
}

/**
 * Icon-in-a-rounded-square treatment used anywhere we need a "feature icon"
 * (option cards, empty states). Centralizing this means every icon badge in
 * the app shares the same proportions and tint logic instead of each screen
 * reinventing its own wrapper View.
 */
export function IconCircle({ name, size = 56, tone = 'accent' }: IconCircleProps) {
  const colors = useThemeColors();
  const toneMap = {
    accent: { bg: colors.accentSoft, fg: colors.accent },
    violet: { bg: colors.violetSoft, fg: colors.violet },
    muted: { bg: colors.surfaceSunken, fg: colors.textFaint },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  };
  const t = toneMap[tone];

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.bg },
      ]}
    >
      <Ionicons name={name} size={size * 0.46} color={t.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
