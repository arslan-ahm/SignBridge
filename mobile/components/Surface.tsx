import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { radius, shadow, useThemeColors } from '../theme/theme';

interface SurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  padding?: number;
  bordered?: boolean;
}

/**
 * The app's one card/panel container. Every "box" on screen (option cards,
 * the sentence buffer, the built-sentence panel, etc.) should render inside
 * one of these instead of a bespoke View with its own border/radius/shadow
 * math -- that repetition is exactly what made the old screens feel like
 * a pile of similar-but-not-quite-consistent boxes.
 */
export function Surface({ children, style, elevated = true, padding, bordered = true }: SurfaceProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.border,
          padding: padding ?? 0,
        },
        elevated && shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}
