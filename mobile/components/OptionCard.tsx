import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { IconCircle } from './IconCircle';
import { fontFamily, radius, shadow, spacing, useThemeColors } from '../theme/theme';

interface OptionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'accent' | 'violet';
  title: string;
  subtitle: string;
  onPress: () => void;
}

/** Large, tappable home-screen option card. */
export function OptionCard({ icon, tone, title, subtitle, onPress }: OptionCardProps) {
  const colors = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[
          styles.card,
          shadow.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <IconCircle name={icon} tone={tone} />
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
        <View style={[styles.chevron, { backgroundColor: colors.surfaceSunken }]}>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontFamily: fontFamily.bold },
  subtitle: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
