import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, radius, spacing, useThemeColors } from '../theme/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}

/**
 * The app's single button primitive. Every screen routes through this
 * (variant + size covers every case we need) instead of one-off Pressables,
 * so press feedback, haptics, and disabled/loading states are consistent
 * everywhere rather than subtly different per screen.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
}: PrimaryButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const palette: Record<ButtonVariant, { bg: string; border: string; fg: string }> = {
    primary: { bg: colors.accent, border: colors.accent, fg: colors.accentText },
    secondary: { bg: colors.accentSoft, border: 'transparent', fg: colors.accent },
    outline: { bg: 'transparent', border: colors.borderStrong, fg: colors.text },
    ghost: { bg: 'transparent', border: 'transparent', fg: colors.textMuted },
    danger: { bg: colors.dangerSoft, border: 'transparent', fg: colors.danger },
  };
  const p = palette[variant];

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };
  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled }}
        style={[
          styles.button,
          size === 'sm' ? styles.buttonSm : styles.buttonMd,
          {
            backgroundColor: p.bg,
            borderColor: p.border,
            borderWidth: variant === 'outline' ? 1.5 : 0,
            opacity: isDisabled ? 0.45 : 1,
          },
          fullWidth && styles.fullWidth,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.fg} size="small" />
        ) : (
          <View style={styles.content}>
            {icon && <Ionicons name={icon} size={size === 'sm' ? 15 : 17} color={p.fg} />}
            <Text
              style={[
                size === 'sm' ? styles.labelSm : styles.label,
                { color: p.fg },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  button: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMd: { paddingVertical: 14, paddingHorizontal: spacing.lg },
  buttonSm: { paddingVertical: 10, paddingHorizontal: spacing.md },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontFamily: fontFamily.semibold },
  labelSm: { fontSize: 13, fontFamily: fontFamily.semibold },
});
