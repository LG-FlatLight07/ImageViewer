import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import { URLBar } from '../../components/URLBar';
import { ActionMenuModal } from '../../components/ActionMenuModal';
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { DraggableControl } from '../../components/layout/DraggableControl';
import { useBrowserStore } from '../../store/browserStore';
import { resolveInputToUrl } from '../../services/urlUtils';
import { IMAGE_SCAN_SCRIPT, parseImageScanMessage } from '../../services/imageExtraction';
import { detectImageGroups } from '../../services/imageGrouping';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import type { BrowserStackParamList } from '../../navigation/types';
import { addHistoryEntry } from '../../db/historyRepository';
import { addBookmark, isBookmarked, removeBookmarkByUrl } from '../../db/bookmarksRepository';

const SCREEN_ID = 'browser';

export function BrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const rootNavigation = useRootNavigation();
  const navigation = useNavigation<NativeStackNavigationProp<BrowserStackParamList>>();
  const db = useSQLiteContext();
  const {
    url,
    inputValue,
    title,
    canGoBack,
    canGoForward,
    loading,
    setUrl,
    setInputValue,
    setNavigationState,
    setLoading,
  } = useBrowserStore();

  const [bookmarked, setBookmarked] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isBookmarked(db, url).then((result) => {
      if (!cancelled) {
        setBookmarked(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, url]);

  const handleSubmit = () => {
    const resolved = resolveInputToUrl(inputValue);
    if (resolved) {
      setUrl(resolved);
    }
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setNavigationState({
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
      title: navState.title,
    });
    setInputValue(navState.url);
    setLoading(navState.loading);
    if (!navState.loading && navState.url) {
      addHistoryEntry(db, { url: navState.url, title: navState.title || navState.url });
    }
  };

  const handleSaveImages = () => {
    webViewRef.current?.injectJavaScript(IMAGE_SCAN_SCRIPT);
  };

  const handleToggleBookmark = async () => {
    if (bookmarked) {
      await removeBookmarkByUrl(db, url);
      setBookmarked(false);
    } else {
      await addBookmark(db, { url, title: title || url });
      setBookmarked(true);
    }
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

        <DraggableControl
          screenId={SCREEN_ID}
          controlId="bookmarkButton"
          defaultPosition={{ x: 152, y: 56 }}
        >
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={handleToggleBookmark}
            accessibilityLabel="toggle-bookmark"
          >
            <Ionicons name={bookmarked ? 'star' : 'star-outline'} size={22} color="#f6c453" />
          </TouchableOpacity>
        </DraggableControl>

        <DraggableControl
          screenId={SCREEN_ID}
          controlId="menuButton"
          defaultPosition={{ x: 200, y: 56 }}
        >
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => setMenuVisible(true)}
            accessibilityLabel="open-menu"
          >
            <Ionicons name="menu" size={22} color="#333" />
          </TouchableOpacity>
        </DraggableControl>
      </DraggableLayoutArea>

      <ActionMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        actions={[
          { label: '履歴', onPress: () => navigation.navigate('History') },
          { label: 'ブックマーク', onPress: () => navigation.navigate('Bookmarks') },
        ]}
      />
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
