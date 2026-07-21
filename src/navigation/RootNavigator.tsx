import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import type { MainTabParamList, RootStackParamList } from './types';
import { BrowserNavigator } from './BrowserNavigator';
import { ImageSelectionScreen } from '../screens/Browser/ImageSelectionScreen';
import { GalleryNavigator } from './GalleryNavigator';
import { FolderPickerScreen } from '../screens/Gallery/FolderPickerScreen';
import { RankingScreen } from '../screens/Ranking/RankingScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { AppGuideScreen } from '../screens/Settings/AppGuideScreen';
import { useAppTheme } from '../theme/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="Browser" screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Ranking"
        component={RankingScreen}
        options={{
          title: 'ランキング',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Browser"
        component={BrowserNavigator}
        options={{
          title: 'ブラウザー',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="globe-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Gallery"
        component={GalleryNavigator}
        options={{
          title: 'ギャラリー',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { navigationTheme } = useAppTheme();

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator>
        <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <RootStack.Screen
          name="ImageSelection"
          component={ImageSelectionScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <RootStack.Screen
          name="FolderPicker"
          component={FolderPickerScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <RootStack.Screen
          name="AppGuide"
          component={AppGuideScreen}
          options={{ title: 'アプリの使い方・仕様' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
