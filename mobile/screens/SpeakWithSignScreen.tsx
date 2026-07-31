import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lookupSign } from '../data/vocabulary';
import { SignCard } from '../components/SignCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { radius, spacing, useThemeColors } from '../theme/theme';

const PLAYBACK_STEP_MS = 900;

export function SpeakWithSignScreen() {
  const colors = useThemeColors();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const words = useMemo(
    () => submitted.trim().split(/\s+/).filter(Boolean),
    [submitted]
  );

  const knownCount = useMemo(
    () => words.filter((w) => Boolean(lookupSign(w))).length,
    [words]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleShow = () => {
    Keyboard.dismiss();
    setSubmitted(input);
    setPlaybackIndex(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handlePlay = () => {
    if (words.length === 0) return;
    if (timerRef.current) clearInterval(timerRef.current);
    let i = 0;
    setPlaybackIndex(0);
    timerRef.current = setInterval(() => {
      i += 1;
      if (i >= words.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setPlaybackIndex(null);
        return;
      }
      setPlaybackIndex(i);
    }, PLAYBACK_STEP_MS);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>Speak with Sign</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Type what you want to say. Each word becomes a sign card.
        </Text>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="e.g. thank you friend"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
          returnKeyType="done"
          onSubmitEditing={handleShow}
        />

        <Text style={[styles.voiceNote, { color: colors.textMuted }]}>
          Voice input is a fast-follow — text works great for now.
        </Text>

        <View style={styles.row}>
          <PrimaryButton label="Show signs" onPress={handleShow} disabled={!input.trim()} />
          <PrimaryButton
            label="▶ Play in sequence"
            onPress={handlePlay}
            variant="outline"
            disabled={words.length === 0}
          />
        </View>

        {words.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {knownCount}/{words.length} signs available
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardRow}>
              {words.map((word, index) => (
                <SignCard
                  key={`${word}-${index}`}
                  word={word}
                  entry={lookupSign(word)}
                  active={playbackIndex === index}
                />
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  voiceNote: { fontSize: 12, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: spacing.sm },
  cardRow: { flexGrow: 0 },
});
