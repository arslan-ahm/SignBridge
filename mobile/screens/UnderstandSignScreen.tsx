import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { buildSentence, recognizeFrame } from '../services/api';
import { PrimaryButton } from '../components/PrimaryButton';
import { radius, spacing, useThemeColors } from '../theme/theme';

const CAPTURE_INTERVAL_MS = 2500;

export function UnderstandSignScreen() {
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [currentSign, setCurrentSign] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [sentenceWords, setSentenceWords] = useState<string[]>([]);
  const [sentence, setSentence] = useState<string>('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const captureAndRecognize = useCallback(async () => {
    if (!cameraRef.current || isBusy) return;
    setIsBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,
        skipProcessing: true,
      });
      if (photo?.base64) {
        const result = await recognizeFrame(photo.base64);
        setCurrentSign(result.label);
        setConfidence(result.confidence);
      }
    } catch (err) {
      // Camera not ready yet or a transient capture error — safe to ignore
      // and retry on the next tick.
      console.warn('recognizeFrame tick failed', err);
    } finally {
      setIsBusy(false);
    }
  }, [isBusy]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(captureAndRecognize, CAPTURE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isLive, captureAndRecognize]);

  const addCurrentSignToSentence = () => {
    if (!currentSign) return;
    setSentenceWords((prev) => [...prev, currentSign]);
  };

  const clearSentence = () => {
    setSentenceWords([]);
    setSentence('');
  };

  const handleBuildSentence = async () => {
    if (sentenceWords.length === 0) return;
    setIsBuilding(true);
    try {
      const result = await buildSentence(sentenceWords);
      setSentence(result.sentence);
    } catch (err) {
      console.warn('buildSentence failed', err);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleSpeak = () => {
    if (!sentence) return;
    Speech.speak(sentence, { rate: 0.95 });
  };

  if (!permission) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Checking camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          Camera access needed
        </Text>
        <Text style={[styles.permissionBody, { color: colors.textMuted }]}>
          SignBridge needs your camera to recognize signs. We never store or share
          your video.
        </Text>
        <PrimaryButton label="Grant camera access" onPress={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
        <View style={styles.overlay}>
          <View style={[styles.liveBadge, { backgroundColor: isLive ? colors.accent : colors.textMuted }]}>
            <Text style={styles.liveBadgeText}>{isLive ? 'LIVE' : 'PAUSED'}</Text>
          </View>
          <View style={[styles.signBanner, { backgroundColor: colors.surface + 'E6' }]}>
            <Text style={[styles.signLabel, { color: colors.text }]} numberOfLines={1}>
              {currentSign ? currentSign.toUpperCase() : 'Show a sign to begin'}
            </Text>
            {confidence !== null && (
              <Text style={[styles.signConfidence, { color: colors.textMuted }]}>
                {Math.round(confidence * 100)}% confident
              </Text>
            )}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.panel}>
        <View style={styles.row}>
          <PrimaryButton
            label={isLive ? 'Pause' : 'Start recognizing'}
            onPress={() => setIsLive((v) => !v)}
            variant={isLive ? 'outline' : 'solid'}
          />
          <PrimaryButton
            label="+ Add sign"
            onPress={addCurrentSignToSentence}
            disabled={!currentSign}
            variant="outline"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sentence buffer</Text>
        <View style={[styles.bufferBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: sentenceWords.length ? colors.text : colors.textMuted }}>
            {sentenceWords.length ? sentenceWords.join(' · ') : 'Recognized signs will collect here'}
          </Text>
        </View>

        <View style={styles.row}>
          <PrimaryButton
            label="Build sentence"
            onPress={handleBuildSentence}
            disabled={sentenceWords.length === 0}
            loading={isBuilding}
          />
          <PrimaryButton label="Clear" onPress={clearSentence} variant="outline" />
        </View>

        {sentence.length > 0 && (
          <View style={[styles.sentenceBox, { backgroundColor: colors.accent + '1A', borderColor: colors.accent }]}>
            <Text style={[styles.sentenceText, { color: colors.text }]}>{sentence}</Text>
            <PrimaryButton label="🔊 Speak" onPress={handleSpeak} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  permissionTitle: { fontSize: 20, fontWeight: '700' },
  permissionBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: spacing.sm },
  cameraWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  liveBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  signBanner: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  signLabel: { fontSize: 22, fontWeight: '800' },
  signConfidence: { fontSize: 12, marginTop: 2 },
  panel: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: spacing.sm },
  bufferBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 48,
  },
  sentenceBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sentenceText: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
});
