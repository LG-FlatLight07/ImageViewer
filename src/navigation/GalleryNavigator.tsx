import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { GalleryStackParamList } from './types';
import { FolderListScreen } from '../screens/Gallery/FolderListScreen';
import { FolderDetailScreen } from '../screens/Gallery/FolderDetailScreen';
import { ImageViewerScreen } from '../screens/Gallery/ImageViewerScreen';

const Stack = createNativeStackNavigator<GalleryStackParamList>();

export function GalleryNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FolderList"
        component={FolderListScreen}
        options={{ title: 'ギャラリー' }}
      />
      <Stack.Screen
        name="FolderDetail"
        component={FolderDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}
