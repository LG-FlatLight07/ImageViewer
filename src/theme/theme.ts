import { useColorScheme } from 'react-native';
import { DefaultTheme, DarkTheme, type Theme as NavigationTheme } from '@react-navigation/native';

import { useSettingsStore } from '../store/settingsStore';

export type AppColors = {
  background: string;
  surface: string;
  card: string;
  text: string;
  secondaryText: string;
  border: string;
  primary: string;
  danger: string;
};

const lightColors: AppColors = {
  background: '#ffffff',
  surface: '#f1f1f1',
  card: '#ffffff',
  text: '#222222',
  secondaryText: '#666666',
  border: '#dddddd',
  primary: '#4c8bf5',
  danger: '#c0392b',
};

const darkColors: AppColors = {
  background: '#121212',
  surface: '#1e1e1e',
  card: '#1c1c1e',
  text: '#f0f0f0',
  secondaryText: '#a0a0a0',
  border: '#333333',
  primary: '#6d9fff',
  danger: '#e0554f',
};

export function useAppTheme(): {
  scheme: 'light' | 'dark';
  colors: AppColors;
  navigationTheme: NavigationTheme;
} {
  const systemScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);

  const scheme =
    themePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePreference;
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const baseNavigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme: NavigationTheme = {
    ...baseNavigationTheme,
    colors: {
      ...baseNavigationTheme.colors,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return { scheme, colors, navigationTheme };
}
