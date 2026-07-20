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
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { ControlGroup } from '../../components/layout/ControlGroup';
import { useBrowserStore, useActiveBrowserTab } from '../../store/browserStore';
import { SEARCH_ENGINES, useSettingsStore } from '../../store/settingsStore';
import { resolveInputToUrl } from '../../services/urlUtils';
import { IMAGE_SCAN_SCRIPT, parseImageScanMessage } from '../../services/imageExtraction';
import { detectImageGroups } from '../../services/imageGrouping';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import type { BrowserStackParamList } from '../../navigation/types';
import { addHistoryEntry } from '../../db/historyRepository';
import { addBookmark, isBookmarked, removeBookmarkByUrl } from '../../db/bookmarksRepository';
import { useAppTheme } from '../../theme/theme';

const BUTTONS_SCREEN_ID = 'browser.buttons';
const CHROME_SCREEN_ID = 'browser.chrome';

export function BrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const rootNavigation = useRootNavigation();
  const navigation = useNavigation<NativeStackNavigationProp<BrowserStackParamList>>();
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const searchEngine = useSettingsStore((state) => state.searchEngine);
  const disableHistory = useSettingsStore((state) => state.disableHistory);
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const activeTab = useActiveBrowserTab();
  const {
    setUrl,
    setInputValue,
    setNavigationState,
    setLoading,
    openTab,
    closeTab,
    setActiveTabId,
  } = useBrowserStore();
  const { url, inputValue, title, canGoBack, canGoForward, loading } = activeTab;

  const [bookmarked, setBookmarked] = useState(false);

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
    if (!disableHistory && !navState.loading && navState.url) {
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

  const handleNewTab = () => {
    const engine = SEARCH_ENGINES.find((e) => e.key === searchEngine);
    openTab(engine?.homeUrl);
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
      <DraggableLayoutArea>
        <WebView
          key={activeTabId}
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          startInLoadingState
          incognito={disableHistory}
        />
        {disableHistory && <View pointerEvents="none" style={styles.privateModeBorder} />}

        <ControlGroup screenId={BUTTONS_SCREEN_ID}>
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
        </ControlGroup>

        <ControlGroup screenId={CHROME_SCREEN_ID} variant="bar" defaultAnchor="top">
          <URLBar
            value={inputValue}
            loading={loading}
            bookmarked={bookmarked}
            onChangeValue={setInputValue}
            onSubmit={handleSubmit}
            onReload={() =>
              loading ? webViewRef.current?.stopLoading() : webViewRef.current?.reload()
            }
            onToggleBookmark={handleToggleBookmark}
            onOpenBookmarks={() => navigation.navigate('Bookmarks')}
            onOpenHistory={() => navigation.navigate('History')}
          />
          <BrowserTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={closeTab}
            onNewTab={handleNewTab}
          />
        </ControlGroup>
      </DraggableLayoutArea>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
