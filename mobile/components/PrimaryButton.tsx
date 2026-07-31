import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius, spacing, useThemeColors } from '../theme/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'solid' | 'outline';
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'solid',
}: PrimaryButtonProps) {
  const colors = useThemeColors();
  const isOutline = variant === 'outline';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isOutline ? 'transparent' : colors.accent,
          borderColor: colors.accent,
          borderWidth: isOutline ? 1.5 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.accent : colors.accentText} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: isOutline ? colors.accent : colors.accentText },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
