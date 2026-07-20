import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { BrowserStackParamList } from './types';
import { BrowserScreen } from '../screens/Browser/BrowserScreen';
import { HistoryScreen } from '../screens/Browser/HistoryScreen';
import { BookmarksScreen } from '../screens/Browser/BookmarksScreen';

const Stack = createNativeStackNavigator<BrowserStackParamList>();

export function BrowserNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrowserHome" component={BrowserScreen} />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ headerShown: true, title: '履歴' }}
      />
      <Stack.Screen
        name="Bookmarks"
        component={BookmarksScreen}
        options={{ headerShown: true, title: 'ブックマーク' }}
      />
    </Stack.Navigator>
  );
}
