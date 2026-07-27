import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import { URLBar } from '../../components/URLBar';
import { BrowserTabBar } from '../../components/BrowserTabBar';
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { ControlGroup, BAR_MARGIN } from '../../components/layout/ControlGroup';
import { EDGE_BOTTOM_ANCHOR } from '../../components/layout/anchors';
import { useBrowserStore, useActiveBrowserTab } from '../../store/browserStore';
import { useLayoutStore } from '../../store/layoutStore';
import { useSettingsStore } from '../../store/settingsStore';
import { resolveInputToUrl } from '../../services/urlUtils';
import { TOP_PAGE_URL, buildTopPageHtml } from '../../services/topPage';
import { IMAGE_SCAN_SCRIPT, parseImageScanMessage } from '../../services/imageExtraction';
import { detectImageGroups } from '../../services/imageGrouping';
import { AD_BLOCK_SCRIPT } from '../../services/adBlock';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import type { BrowserStackParamList } from '../../navigation/types';
import { addHistoryEntry } from '../../db/historyRepository';
import { addBookmark, isBookmarked, removeBookmarkByUrl } from '../../db/bookmarksRepository';
import { useAppTheme } from '../../theme/theme';

const CHROME_SCREEN_ID = 'browser.chrome';
const CHROME_GAP = 16;

export function BrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const rootNavigation = useRootNavigation();
  const navigation = useNavigation<NativeStackNavigationProp<BrowserStackParamList>>();
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const searchEngine = useSettingsStore((state) => state.searchEngine);
  const disableHistory = useSettingsStore((state) => state.disableHistory);
  const adBlockEnabled = useSettingsStore((state) => state.adBlockEnabled);
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
  const { url, inputValue, currentUrl, title, canGoBack, canGoForward, loading } = activeTab;
  const chromeAnchor = useLayoutStore((state) => state.layouts[CHROME_SCREEN_ID]?.anchor);
  const chromeAtBottom = chromeAnchor === EDGE_BOTTOM_ANCHOR;

  const [bookmarked, setBookmarked] = useState(false);
  const [chromeHeight, setChromeHeight] = useState(0);
  const isTopPage = url === TOP_PAGE_URL;
  const topPageHtml = useMemo(() => buildTopPageHtml(searchEngine), [searchEngine]);

  useEffect(() => {
    if (isTopPage) {
      return;
    }
    let cancelled = false;
    isBookmarked(db, currentUrl).then((result) => {
      if (!cancelled) {
        setBookmarked(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, currentUrl, isTopPage]);
  const displayBookmarked = isTopPage ? false : bookmarked;

  // Continuously track the active tab's real (non-top-page) URL so the
  // "前回のタブ" startup option can restore it after a full app restart —
  // there's no reliable way to run cleanup code on abrupt process kill, so
  // this is kept current on every navigation instead.
  useEffect(() => {
    if (currentUrl && currentUrl !== TOP_PAGE_URL) {
      useBrowserStore.getState().recordLastActiveUrl(currentUrl);
    }
  }, [currentUrl]);

  useEffect(() => {
    let settingsReady = useSettingsStore.persist.hasHydrated();
    let browserReady = useBrowserStore.persist.hasHydrated();
    const unsubscribes: (() => void)[] = [];

    const tryApplyStartupPage = () => {
      if (!settingsReady || !browserReady) {
        return;
      }
      const { startupPageMode, startupPageUrl, searchEngine: engine } = useSettingsStore.getState();
      let target = TOP_PAGE_URL;
      if (startupPageMode === 'custom' && startupPageUrl.trim()) {
        target = resolveInputToUrl(startupPageUrl, engine) || TOP_PAGE_URL;
      } else if (startupPageMode === 'lastTab') {
        target = useBrowserStore.getState().lastActiveUrl ?? TOP_PAGE_URL;
      }
      useBrowserStore.getState().applyStartupPage(target);
    };

    if (!settingsReady) {
      unsubscribes.push(
        useSettingsStore.persist.onFinishHydration(() => {
          settingsReady = true;
          tryApplyStartupPage();
        }),
      );
    }
    if (!browserReady) {
      unsubscribes.push(
        useBrowserStore.persist.onFinishHydration(() => {
          browserReady = true;
          tryApplyStartupPage();
        }),
      );
    }
    tryApplyStartupPage();

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  const handleSubmit = () => {
    const resolved = resolveInputToUrl(inputValue, searchEngine);
    if (resolved) {
      setUrl(resolved);
    }
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    if (isTopPage) {
      // The built-in top page is loaded via `source={{ html }}`, so WebView
      // reports "about:blank" for it. Only a real navigation away from it
      // (e.g. the top page's own search form submitting) should promote
      // this tab to a normal, addressable one — otherwise `source` would
      // keep resetting back to the top-page HTML on every re-render.
      if (navState.url && !navState.url.startsWith('about:')) {
        setUrl(navState.url);
      }
      return;
    }
    setNavigationState({
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
      title: navState.title,
      currentUrl: navState.url,
    });
    setInputValue(navState.url);
    setLoading(navState.loading);
    if (!disableHistory && !navState.loading && navState.url) {
      addHistoryEntry(db, { url: navState.url, title: navState.title || navState.url });
    }
  };

  // navState.loading alone can get stuck at true on some sites (long-lived
  // subresource/websocket/analytics activity, or a navigation delegate quirk
  // where the final "loading: false" event just never arrives), which left
  // the reload button stuck showing a "✕" with no way to reload. onLoadEnd
  // fires once the main-frame document itself finishes (success or error)
  // regardless of that other activity, so it's a more reliable signal to
  // clear the icon; a timeout is a last-resort safety net on top of that.
  useEffect(() => {
    if (!loading) {
      return;
    }
    const timer = setTimeout(() => setLoading(false), 15000);
    return () => clearTimeout(timer);
  }, [loading, setLoading]);

  // Captures the page being scanned at the moment the scan is triggered, so
  // that if the user switches tabs or navigates before the async postMessage
  // arrives, the download is still attributed to the page that was actually
  // scanned rather than whatever tab happens to be active on arrival.
  // Uses currentUrl (the actual displayed page, synced on every navigation),
  // not the address-bar inputValue or the WebView's initial `url` — those
  // don't track in-page/SPA navigation and previously caused downloads to be
  // attributed to the wrong page within the (correct) site.
  const scanContextRef = useRef<{ pageUrl: string; pageTitle: string } | null>(null);

  const handleSaveImages = () => {
    scanContextRef.current = { pageUrl: currentUrl, pageTitle: title || inputValue };
    webViewRef.current?.injectJavaScript(IMAGE_SCAN_SCRIPT);
  };

  const handleToggleBookmark = async () => {
    if (isTopPage) {
      return;
    }
    if (bookmarked) {
      await removeBookmarkByUrl(db, currentUrl);
      setBookmarked(false);
    } else {
      await addBookmark(db, { url: currentUrl, title: title || currentUrl });
      setBookmarked(true);
    }
  };

  const handleNewTab = () => {
    openTab(TOP_PAGE_URL);
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    const result = parseImageScanMessage(event.nativeEvent.data);
    if (!result) {
      return;
    }
    const context = scanContextRef.current ?? {
      pageUrl: currentUrl,
      pageTitle: title || inputValue,
    };
    const { primaryGroup, otherImages } = detectImageGroups(result.images);
    rootNavigation.navigate('ImageSelection', {
      pageTitle: result.pageTitle || context.pageTitle,
      sourceUrl: context.pageUrl,
      primaryGroup,
      otherImages,
    });
  };

  const urlBarElement = (
    <URLBar
      key="url-bar"
      value={inputValue}
      loading={loading}
      bookmarked={displayBookmarked}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onChangeValue={setInputValue}
      onSubmit={handleSubmit}
      onReload={() => (loading ? webViewRef.current?.stopLoading() : webViewRef.current?.reload())}
      onGoBack={() => webViewRef.current?.goBack()}
      onGoForward={() => webViewRef.current?.goForward()}
      onSaveImages={handleSaveImages}
      onToggleBookmark={handleToggleBookmark}
      onOpenBookmarks={() => navigation.navigate('Bookmarks')}
      onOpenHistory={() => navigation.navigate('History')}
    />
  );

  const tabBarElement = (
    <BrowserTabBar
      key="tab-bar"
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={setActiveTabId}
      onCloseTab={closeTab}
      onNewTab={handleNewTab}
    />
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <DraggableLayoutArea>
        <WebView
          key={activeTabId}
          ref={webViewRef}
          source={isTopPage ? { html: topPageHtml } : { uri: url }}
          style={[
            styles.webview,
            chromeAtBottom
              ? { marginBottom: BAR_MARGIN + chromeHeight + CHROME_GAP }
              : { marginTop: BAR_MARGIN + chromeHeight + CHROME_GAP },
          ]}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onMessage={handleMessage}
          startInLoadingState
          incognito={disableHistory}
          injectedJavaScriptBeforeContentLoaded={adBlockEnabled ? AD_BLOCK_SCRIPT : undefined}
          setSupportMultipleWindows={!adBlockEnabled}
          onOpenWindow={adBlockEnabled ? () => {} : undefined}
        />
        {disableHistory && <View pointerEvents="none" style={styles.privateModeBorder} />}

        <ControlGroup
          screenId={CHROME_SCREEN_ID}
          variant="bar"
          defaultAnchor="top"
          edgesOnly
          onMeasured={(size) => setChromeHeight(size.height)}
        >
          {chromeAtBottom ? (
            <>
              {tabBarElement}
              <View style={styles.chromeGap} />
              {urlBarElement}
            </>
          ) : (
            <>
              {urlBarElement}
              <View style={styles.chromeGap} />
              {tabBarElement}
            </>
          )}
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
  chromeGap: {
    height: 10,
  },
});
