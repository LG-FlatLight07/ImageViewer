import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import { URLBar } from '../../components/URLBar';
import { BrowserTabBar } from '../../components/BrowserTabBar';
import { ActionMenuModal } from '../../components/ActionMenuModal';
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { ControlGroup } from '../../components/layout/ControlGroup';
import { useBrowserStore, useActiveBrowserTab } from '../../store/browserStore';
import { useSettingsStore } from '../../store/settingsStore';
import { resolveInputToUrl } from '../../services/urlUtils';
import { IMAGE_SCAN_SCRIPT, parseImageScanMessage } from '../../services/imageExtraction';
import { detectImageGroups } from '../../services/imageGrouping';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import type { BrowserStackParamList } from '../../navigation/types';
import { addHistoryEntry } from '../../db/historyRepository';
import { addBookmark, isBookmarked, removeBookmarkByUrl } from '../../db/bookmarksRepository';
import { useAppTheme } from '../../theme/theme';

const SCREEN_ID = 'browser';

export function BrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const rootNavigation = useRootNavigation();
  const navigation = useNavigation<NativeStackNavigationProp<BrowserStackParamList>>();
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const searchEngine = useSettingsStore((state) => state.searchEngine);
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const activeTab = useActiveBrowserTab();
  const {
    setUrl,
    setInputValue,
    setNavigationState,
    setLoading,
    setPrivateMode,
    openTab,
    closeTab,
    setActiveTabId,
  } = useBrowserStore();
  const { url, inputValue, title, canGoBack, canGoForward, loading, privateMode } = activeTab;

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
    const resolved = resolveInputToUrl(inputValue, searchEngine);
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
    if (!privateMode && !navState.loading && navState.url) {
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={styles.urlBarWrapper}>
        <URLBar
          value={inputValue}
          loading={loading}
          onChangeValue={setInputValue}
          onSubmit={handleSubmit}
          onReload={() =>
            loading ? webViewRef.current?.stopLoading() : webViewRef.current?.reload()
          }
        />
        <BrowserTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          onNewTab={() => openTab()}
        />
      </View>

      <DraggableLayoutArea>
        <WebView
          key={activeTabId}
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          startInLoadingState
          incognito={privateMode}
        />
        {privateMode && <View pointerEvents="none" style={styles.privateModeBorder} />}

        <ControlGroup screenId={SCREEN_ID}>
          <TouchableOpacity
            style={styles.toolbarButton}
            disabled={!canGoBack}
            onPress={() => webViewRef.current?.goBack()}
            accessibilityLabel="go-back"
          >
            <Ionicons name="arrow-back" size={22} color={canGoBack ? '#333' : '#ccc'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolbarButton}
            disabled={!canGoForward}
            onPress={() => webViewRef.current?.goForward()}
            accessibilityLabel="go-forward"
          >
            <Ionicons name="arrow-forward" size={22} color={canGoForward ? '#333' : '#ccc'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={handleSaveImages}
            accessibilityLabel="save-images"
          >
            <Ionicons name="download-outline" size={22} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={handleToggleBookmark}
            accessibilityLabel="toggle-bookmark"
          >
            <Ionicons name={bookmarked ? 'star' : 'star-outline'} size={22} color="#f6c453" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolbarButton, privateMode && styles.toolbarButtonActive]}
            onPress={() => setPrivateMode(!privateMode)}
            accessibilityLabel="toggle-private-mode"
          >
            <Ionicons
              name={privateMode ? 'eye-off' : 'eye-off-outline'}
              size={22}
              color={privateMode ? '#fff' : '#333'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => setMenuVisible(true)}
            accessibilityLabel="open-menu"
          >
            <Ionicons name="menu" size={22} color="#333" />
          </TouchableOpacity>
        </ControlGroup>
      </DraggableLayoutArea>

      <ActionMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        actions={[
          { label: '新しいプライベートタブ', onPress: () => openTab(undefined, true) },
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
  },
  urlBarWrapper: {
    zIndex: 1,
  },
  webview: {
    flex: 1,
  },
  privateModeBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#6d3fc0',
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
  toolbarButtonActive: {
    backgroundColor: '#6d3fc0',
  },
});
