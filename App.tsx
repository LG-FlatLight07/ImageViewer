import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { DatabaseProvider } from './src/db/DatabaseProvider';
import { LayoutEditBanner } from './src/components/layout/LayoutEditBanner';
import { useAppTheme } from './src/theme/theme';

export default function App() {
  const { scheme } = useAppTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DatabaseProvider>
          <RootNavigator />
          <LayoutEditBanner />
        </DatabaseProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
