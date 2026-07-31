import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { OptionCard } from '../components/OptionCard';
import { spacing, useThemeColors } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.accent }]}>SignBridge</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>
          Bridging sign language and spoken language, in both directions.
        </Text>
      </View>

      <View style={styles.cards}>
        <OptionCard
          icon="🤟"
          title="Understand Sign"
          subtitle="Point the camera at signing and get live text and speech."
          onPress={() => navigation.navigate('UnderstandSign')}
        />
        <OptionCard
          icon="💬"
          title="Speak with Sign"
          subtitle="Type or speak, and see the words as sign cards."
          onPress={() => navigation.navigate('SpeakWithSign')}
        />
      </View>

      <Text style={[styles.footer, { color: colors.textMuted }]}>
        Built for accessible, two-way communication.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
  },
  cards: {
    gap: spacing.md,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
    fontSize: 12,
    textAlign: 'center',
  },
});
