import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useThemeColors } from '../theme/theme';
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
          { backgroundColor: known ? colors.accent + '22' : colors.warning + '22' },
        ]}
      >
        <Text style={styles.glyph}>{known ? entry!.illustration : '❔'}</Text>
      </View>
      <Text style={[styles.word, { color: colors.text }]} numberOfLines={1}>
        {word}
      </Text>
      {!known && (
        <Text style={[styles.notAvailable, { color: colors.warning }]}>
          sign not available yet
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 108,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  glyphWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  glyph: {
    fontSize: 26,
  },
  word: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  notAvailable: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
});
