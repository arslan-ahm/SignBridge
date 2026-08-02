import React, { useCallback, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as useManropeFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { RootStackParamList } from './navigation/types';
import { HomeScreen } from './screens/HomeScreen';
import { UnderstandSignScreen } from './screens/UnderstandSignScreen';
import { SpeakWithSignScreen } from './screens/SpeakWithSignScreen';
import { fontFamily, palette } from './theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Keep the native splash up until fonts are ready -- without this, the app
// briefly flashes with the OS's fallback system font before Manrope loads,
// which reads as unpolished on a real device (the exact kind of thing that
// separates "hackathon demo" from "professional product").
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const colors = isDark ? palette.dark : palette.light;

  const [fontsLoaded, fontError] = useManropeFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const ready = fontsLoaded || fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const onLayoutRootView = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.accent,
      background: colors.background,
      card: colors.backgroundElevated,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.backgroundElevated },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fontFamily.bold, fontSize: 17 },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="UnderstandSign"
            component={UnderstandSignScreen}
            options={{ title: 'Understand Sign' }}
          />
          <Stack.Screen
            name="SpeakWithSign"
            component={SpeakWithSignScreen}
            options={{ title: 'Speak with Sign' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
