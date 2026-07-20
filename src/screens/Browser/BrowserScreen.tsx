import React, { useRef } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { URLBar } from '../../components/URLBar';
import { useBrowserStore } from '../../store/browserStore';
import { resolveInputToUrl } from '../../services/urlUtils';

export function BrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const {
    url,
    inputValue,
    canGoBack,
    canGoForward,
    loading,
    setUrl,
    setInputValue,
    setNavigationState,
    setLoading,
  } = useBrowserStore();

  const handleSubmit = () => {
    const resolved = resolveInputToUrl(inputValue);
    if (resolved) {
      setUrl(resolved);
    }
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setNavigationState({ canGoBack: navState.canGoBack, canGoForward: navState.canGoForward });
    setInputValue(navState.url);
    setLoading(navState.loading);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <URLBar
        value={inputValue}
        loading={loading}
        onChangeValue={setInputValue}
        onSubmit={handleSubmit}
        onReload={() =>
          loading ? webViewRef.current?.stopLoading() : webViewRef.current?.reload()
        }
      />
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        startInLoadingState
      />
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolbarButton}
          disabled={!canGoBack}
          onPress={() => webViewRef.current?.goBack()}
          accessibilityLabel="go-back"
        >
          <Ionicons name="arrow-back" size={24} color={canGoBack ? '#333' : '#ccc'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          disabled={!canGoForward}
          onPress={() => webViewRef.current?.goForward()}
          accessibilityLabel="go-forward"
        >
          <Ionicons name="arrow-forward" size={24} color={canGoForward ? '#333' : '#ccc'} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Platform.select({ ios: 10, default: 8 }),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#f8f8f8',
  },
  toolbarButton: {
    padding: 8,
  },
});
