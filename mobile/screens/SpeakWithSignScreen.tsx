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
import { Ionicons } from '@expo/vector-icons';
import { lookupSign } from '../data/vocabulary';
import { SignCard } from '../components/SignCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Surface } from '../components/Surface';
import { Badge } from '../components/Badge';
import { IconCircle } from '../components/IconCircle';
import { fontFamily, radius, spacing, useThemeColors } from '../theme/theme';

const PLAYBACK_STEP_MS = 900;

export function SpeakWithSignScreen() {
  const colors = useThemeColors();
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Speak with Sign</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Type what you want to say. Each word becomes a sign card.
        </Text>

        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: colors.surface,
              borderColor: focused ? colors.accent : colors.border,
              borderWidth: focused ? 1.5 : 1,
            },
          ]}
        >
          <Ionicons name="create-outline" size={18} color={colors.textFaint} />
          <TextInput
            value={input}
            onChangeText={setInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="e.g. thank you friend"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { color: colors.text }]}
            returnKeyType="done"
            onSubmitEditing={handleShow}
          />
        </View>

        <View style={styles.voiceNoteRow}>
          <Ionicons name="mic-outline" size={13} color={colors.textFaint} />
          <Text style={[styles.voiceNote, { color: colors.textFaint }]}>
            Voice input is a fast-follow — text works great for now.
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <PrimaryButton label="Show signs" onPress={handleShow} disabled={!input.trim()} fullWidth />
          </View>
          <View style={styles.rowItem}>
            <PrimaryButton
              label="Play in sequence"
              icon="play"
              onPress={handlePlay}
              variant="outline"
              disabled={words.length === 0}
              fullWidth
            />
          </View>
        </View>

        {words.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Sign cards</Text>
              <Badge
                label={`${knownCount}/${words.length} available`}
                tone={knownCount === words.length ? 'accent' : 'warning'}
              />
            </View>
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

        {words.length === 0 && (
          <Surface padding={spacing.xl} style={styles.emptyState} elevated={false}>
            <IconCircle name="albums-outline" tone="muted" />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing to show yet</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Type a phrase above and tap "Show signs" to see it broken into cards.
            </Text>
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 26, fontFamily: fontFamily.extrabold },
  subtitle: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular, marginBottom: spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
    fontFamily: fontFamily.medium,
  },
  voiceNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voiceNote: { fontSize: 12, fontFamily: fontFamily.regular, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowItem: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 13, fontFamily: fontFamily.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  cardRow: { flexGrow: 0 },
  emptyState: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  emptyTitle: { fontSize: 16, fontFamily: fontFamily.bold },
  emptyBody: { fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular, textAlign: 'center' },
});
