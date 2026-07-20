import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';

/**
 * React Navigation bubbles `navigate()` calls up to parent navigators when the
 * route isn't found in the nearest one, so this cast lets screens nested deep
 * inside MainTabs/GalleryStack reach root-level modal screens (e.g. FolderPicker)
 * without threading a fully composed navigation prop type through every screen.
 */
export function useRootNavigation() {
  return useNavigation() as unknown as NativeStackNavigationProp<RootStackParamList>;
}
