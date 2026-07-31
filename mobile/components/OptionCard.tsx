import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useThemeColors } from '../theme/theme';

interface OptionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

/** Large, tappable home-screen option card. */
export function OptionCard({ icon, title, subtitle, onPress }: OptionCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    minHeight: 160,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
