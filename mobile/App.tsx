import React from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootStackParamList } from './navigation/types';
import { HomeScreen } from './screens/HomeScreen';
import { UnderstandSignScreen } from './screens/UnderstandSignScreen';
import { SpeakWithSignScreen } from './screens/SpeakWithSignScreen';
import { palette } from './theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? palette.dark : palette.light;

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
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
