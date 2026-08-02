import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, radius, useThemeColors } from '../theme/theme';

export type BadgeTone = 'accent' | 'muted' | 'danger' | 'warning';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  mono?: boolean;
}

/** Small status pill -- LIVE/PAUSED indicators, confidence readouts, counts. */
export function Badge({ label, tone = 'muted', dot, mono }: BadgeProps) {
  const colors = useThemeColors();

  const toneMap: Record<BadgeTone, { bg: string; fg: string }> = {
    accent: { bg: colors.accentSoft, fg: colors.accent },
    muted: { bg: colors.surfaceSunken, fg: colors.textMuted },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  };
  const t = toneMap[tone];

  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {dot && <View style={[styles.dot, { backgroundColor: t.fg }]} />}
      <Text
        style={[
          styles.label,
          { color: t.fg, fontFamily: mono ? fontFamily.mono : fontFamily.semibold },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, letterSpacing: 0.4 },
});
