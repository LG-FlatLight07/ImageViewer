import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { DatabaseProvider } from './src/db/DatabaseProvider';
import { LayoutEditBanner } from './src/components/layout/LayoutEditBanner';
import { DownloadProgressBar } from './src/components/DownloadProgressBar';
import { DownloadCompleteToast } from './src/components/DownloadCompleteToast';
import { useAppTheme } from './src/theme/theme';

export default function App() {
  const { scheme } = useAppTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DatabaseProvider>
          <RootNavigator />
          <LayoutEditBanner />
          <DownloadProgressBar />
          <DownloadCompleteToast />
        </DatabaseProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
