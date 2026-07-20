import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { BrowserScreen } from '../screens/Browser/BrowserScreen';
import { GalleryScreen } from '../screens/Gallery/GalleryScreen';

export type RootTabParamList = {
  Browser: undefined;
  Gallery: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
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
          component={GalleryScreen}
          options={{
            title: 'ギャラリー',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="images-outline" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
