import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { buildSentence, recognizeFrame } from '../services/api';
import { PrimaryButton } from '../components/PrimaryButton';
import { Surface } from '../components/Surface';
import { Badge } from '../components/Badge';
import { IconCircle } from '../components/IconCircle';
import { fontFamily, radius, spacing, useThemeColors } from '../theme/theme';

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
    Speech.speak(sentence, { rate: 0.95, pitch: 1.05 });
  };

  if (!permission) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.body, { color: colors.textMuted }]}>Checking camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <IconCircle name="camera-outline" size={72} tone="accent" />
        <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera access needed</Text>
        <Text style={[styles.permissionBody, { color: colors.textMuted }]}>
          SignBridge needs your camera to recognize signs. We never store or share
          your video.
        </Text>
        <PrimaryButton
          label="Grant camera access"
          icon="lock-open-outline"
          onPress={requestPermission}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <View style={styles.cameraOuter}>
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
          <View style={styles.overlay}>
            <Badge
              label={isLive ? 'LIVE' : 'PAUSED'}
              tone={isLive ? 'accent' : 'muted'}
              dot
              mono
            />
            <Surface style={styles.signBanner} elevated={false} bordered={false} padding={spacing.md}>
              <Text style={[styles.signLabel, { color: colors.text }]} numberOfLines={1}>
                {currentSign ? currentSign.toUpperCase() : 'Show a sign to begin'}
              </Text>
              {confidence !== null && (
                <Text style={[styles.signConfidence, { color: colors.textMuted }]}>
                  {Math.round(confidence * 100)}% confident
                </Text>
              )}
            </Surface>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <PrimaryButton
              label={isLive ? 'Pause' : 'Start recognizing'}
              icon={isLive ? 'pause' : 'play'}
              onPress={() => setIsLive((v) => !v)}
              variant={isLive ? 'outline' : 'primary'}
              fullWidth
            />
          </View>
          <View style={styles.rowItem}>
            <PrimaryButton
              label="Add sign"
              icon="add"
              onPress={addCurrentSignToSentence}
              disabled={!currentSign}
              variant="secondary"
              fullWidth
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sentence buffer</Text>
        <Surface padding={spacing.md} elevated={false}>
          <Text
            style={[
              styles.body,
              { color: sentenceWords.length ? colors.text : colors.textFaint },
            ]}
          >
            {sentenceWords.length ? sentenceWords.join(' · ') : 'Recognized signs will collect here'}
          </Text>
        </Surface>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <PrimaryButton
              label="Build sentence"
              icon="sparkles-outline"
              onPress={handleBuildSentence}
              disabled={sentenceWords.length === 0}
              loading={isBuilding}
              fullWidth
            />
          </View>
          <View style={styles.rowItem}>
            <PrimaryButton
              label="Clear"
              icon="trash-outline"
              onPress={clearSentence}
              variant="ghost"
              fullWidth
            />
          </View>
        </View>

        {sentence.length > 0 && (
          <Surface
            padding={spacing.md}
            style={{ borderColor: colors.accent, backgroundColor: colors.accentSoft }}
          >
            <Text style={[styles.sentenceText, { color: colors.text }]}>{sentence}</Text>
            <PrimaryButton label="Speak" icon="volume-high" onPress={handleSpeak} fullWidth />
          </Surface>
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
  permissionTitle: { fontSize: 20, fontFamily: fontFamily.bold },
  permissionBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  cameraOuter: { padding: spacing.md, paddingBottom: spacing.sm },
  cameraWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#000',
    borderRadius: radius.lg,
    overflow: 'hidden',
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
  signBanner: { borderRadius: radius.md, backgroundColor: 'rgba(10, 14, 20, 0.72)' },
  signLabel: { fontSize: 22, fontFamily: fontFamily.extrabold },
  signConfidence: { fontSize: 12, fontFamily: fontFamily.mono, marginTop: 2 },
  panel: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowItem: { flex: 1 },
  sectionTitle: { fontSize: 13, fontFamily: fontFamily.bold, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  body: { fontSize: 15, fontFamily: fontFamily.regular },
  sentenceText: { fontSize: 17, fontFamily: fontFamily.semibold, lineHeight: 24, marginBottom: spacing.md },
});
