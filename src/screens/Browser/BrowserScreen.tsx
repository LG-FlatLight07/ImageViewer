import React, { useRef } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { URLBar } from '../../components/URLBar';
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { DraggableControl } from '../../components/layout/DraggableControl';
import { useBrowserStore } from '../../store/browserStore';
import { resolveInputToUrl } from '../../services/urlUtils';
import { IMAGE_SCAN_SCRIPT, parseImageScanMessage } from '../../services/imageExtraction';
import { detectImageGroups } from '../../services/imageGrouping';
import { useRootNavigation } from '../../navigation/useRootNavigation';

const SCREEN_ID = 'browser';

export function BrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const rootNavigation = useRootNavigation();
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

  const handleSaveImages = () => {
    webViewRef.current?.injectJavaScript(IMAGE_SCAN_SCRIPT);
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    const result = parseImageScanMessage(event.nativeEvent.data);
    if (!result) {
      return;
    }
    const { primaryGroup, otherImages } = detectImageGroups(result.images);
    rootNavigation.navigate('ImageSelection', {
      pageTitle: result.pageTitle || inputValue,
      sourceUrl: url,
      primaryGroup,
      otherImages,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DraggableLayoutArea>
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          startInLoadingState
        />

        <DraggableControl screenId={SCREEN_ID} controlId="urlBar" defaultPosition={{ x: 8, y: 8 }}>
          <URLBar
            value={inputValue}
            loading={loading}
            onChangeValue={setInputValue}
            onSubmit={handleSubmit}
            onReload={() =>
              loading ? webViewRef.current?.stopLoading() : webViewRef.current?.reload()
            }
          />
        </DraggableControl>

        <DraggableControl
          screenId={SCREEN_ID}
          controlId="backButton"
          defaultPosition={{ x: 8, y: 56 }}
        >
          <TouchableOpacity
            style={styles.toolbarButton}
            disabled={!canGoBack}
            onPress={() => webViewRef.current?.goBack()}
            accessibilityLabel="go-back"
          >
            <Ionicons name="arrow-back" size={22} color={canGoBack ? '#333' : '#ccc'} />
          </TouchableOpacity>
        </DraggableControl>

        <DraggableControl
          screenId={SCREEN_ID}
          controlId="forwardButton"
          defaultPosition={{ x: 56, y: 56 }}
        >
          <TouchableOpacity
            style={styles.toolbarButton}
            disabled={!canGoForward}
            onPress={() => webViewRef.current?.goForward()}
            accessibilityLabel="go-forward"
          >
            <Ionicons name="arrow-forward" size={22} color={canGoForward ? '#333' : '#ccc'} />
          </TouchableOpacity>
        </DraggableControl>

        <DraggableControl
          screenId={SCREEN_ID}
          controlId="saveImagesButton"
          defaultPosition={{ x: 104, y: 56 }}
        >
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={handleSaveImages}
            accessibilityLabel="save-images"
          >
            <Ionicons name="download-outline" size={22} color="#333" />
          </TouchableOpacity>
        </DraggableControl>
      </DraggableLayoutArea>
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
  toolbarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
