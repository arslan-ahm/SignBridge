import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, radius, shadow, spacing, useThemeColors } from '../theme/theme';
import { VocabEntry } from '../data/vocabulary';

interface SignCardProps {
  word: string;
  entry?: VocabEntry;
  active?: boolean;
}

/**
 * Displays a single word as a sign card. Falls back to a friendly
 * "sign not available yet" state when the word isn't in the known
 * vocabulary, instead of crashing or showing nothing.
 */
export function SignCard({ word, entry, active }: SignCardProps) {
  const colors = useThemeColors();
  const known = Boolean(entry);

  return (
    <View
      style={[
        styles.card,
        shadow.sm,
        {
          backgroundColor: colors.surface,
          borderColor: active ? colors.accent : colors.border,
          borderWidth: active ? 2 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.glyphWrap,
          { backgroundColor: known ? colors.accentSoft : colors.warningSoft },
        ]}
      >
        {known ? (
          <Text style={styles.glyph}>{entry!.illustration}</Text>
        ) : (
          <Ionicons name="help" size={24} color={colors.warning} />
        )}
      </View>
      <Text style={[styles.word, { color: colors.text }]} numberOfLines={1}>
        {word}
      </Text>
      {!known && (
        <Text style={[styles.notAvailable, { color: colors.warning }]} numberOfLines={2}>
          not available yet
        </Text>
      )}
      {active && (
        <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 104,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  glyphWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  glyph: { fontSize: 24 },
  word: { fontSize: 13, fontFamily: fontFamily.semibold, textAlign: 'center' },
  notAvailable: { fontSize: 10, fontFamily: fontFamily.medium, textAlign: 'center', marginTop: 2 },
  activeDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
});
