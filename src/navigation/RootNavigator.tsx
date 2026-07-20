import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import type { MainTabParamList, RootStackParamList } from './types';
import { BrowserScreen } from '../screens/Browser/BrowserScreen';
import { ImageSelectionScreen } from '../screens/Browser/ImageSelectionScreen';
import { GalleryNavigator } from './GalleryNavigator';
import { FolderPickerScreen } from '../screens/Gallery/FolderPickerScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Browser"
        component={BrowserScreen}
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
  return (
    <NavigationContainer>
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
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
