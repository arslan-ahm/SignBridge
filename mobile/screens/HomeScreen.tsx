import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { OptionCard } from '../components/OptionCard';
import { IconCircle } from '../components/IconCircle';
import { fontFamily, spacing, useThemeColors } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const isDark = useColorScheme() !== 'light';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? [colors.accentSoft, 'transparent'] : [colors.accentSoft, 'transparent']}
        style={styles.glow}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <IconCircle name="hand-left" size={44} tone="accent" />
            <View>
              <Text style={[styles.logo, { color: colors.text }]}>SignBridge</Text>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>ASL TRANSLATOR</Text>
            </View>
          </View>

          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Bridging sign language and spoken language, in both directions.
          </Text>

          <View style={styles.cards}>
            <OptionCard
              icon="hand-left-outline"
              tone="accent"
              title="Understand Sign"
              subtitle="Point the camera at signing and get live text and speech."
              onPress={() => navigation.navigate('UnderstandSign')}
            />
            <OptionCard
              icon="chatbox-ellipses-outline"
              tone="violet"
              title="Speak with Sign"
              subtitle="Type what you want to say and see it as sign cards."
              onPress={() => navigation.navigate('SpeakWithSign')}
            />
          </View>
        </ScrollView>

        <Text style={[styles.footer, { color: colors.textFaint }]}>
          Built for accessible, two-way communication.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  safeArea: { flex: 1, paddingHorizontal: spacing.lg },
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  logo: { fontSize: 26, fontFamily: fontFamily.extrabold },
  eyebrow: { fontSize: 11, fontFamily: fontFamily.bold, letterSpacing: 1.2, marginTop: 2 },
  tagline: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular, marginBottom: spacing.xl },
  cards: { gap: spacing.md },
  footer: {
    marginBottom: spacing.lg,
    fontSize: 12,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
});
