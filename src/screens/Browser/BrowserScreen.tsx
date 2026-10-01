import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { AD_BLOCK_SCRIPT, isUserGestureMessage } from '../../services/adBlock';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import type { BrowserStackParamList } from '../../navigation/types';
import { addHistoryEntry } from '../../db/historyRepository';
import { addBookmark, isBookmarked, removeBookmarkByUrl } from '../../db/bookmarksRepository';
import { useAppTheme } from '../../theme/theme';
import { fetchNativePageSource } from '../../services/nativePageSource';
import { networkScope } from '../../services/networkScope';
import { readerFailureMessage } from '../../services/readerSnapshot';
import { NetworkImageTransport } from '../../services/networkImageTransport';
import {
  MAX_NETWORK_IMAGES,
  SOURCE_TITLE_TIMEOUT_MS,
  NETWORK_IMAGE_SCRIPT,
  NetworkImageCollection,
  networkImageSnapshotScript,
  networkImageSourceRetryScript,
  parseNetworkImageMessage,
  snapshotFailureDetails,
} from '../../services/networkImages';

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
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const isTopPage = url === TOP_PAGE_URL;
  const topPageHtml = useMemo(() => buildTopPageHtml(searchEngine), [searchEngine]);
  const networkImages = useRef(new NetworkImageCollection());
  const imageTransport = useRef(new NetworkImageTransport());
  const pendingNetworkScan = useRef<{
    id: string;
    tabId: string;
    sourceRetried?: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    networkImages.current.retain(tabs.map((tab) => tab.id));
  }, [tabs]);
  useEffect(
    () => () => {
      if (pendingNetworkScan.current) clearTimeout(pendingNetworkScan.current.timer);
      pendingNetworkScan.current = null;
      imageTransport.current.clear();
    },
    [activeTabId],
  );

  const handleSaveNetworkImages = () => {
    if (isTopPage || !webViewRef.current || pendingNetworkScan.current) return;
    const id = `${activeTabId}-${Date.now()}`;
    imageTransport.current.clear();
    const timer = setTimeout(
      () => {
        pendingNetworkScan.current = null;
        imageTransport.current.clear();
        Alert.alert(
          '通信画像の確認',
          'ページから応答がありません。読み込み完了後にもう一度お試しください。',
        );
      },
      SOURCE_TITLE_TIMEOUT_MS * 2 + 5000,
    );
    pendingNetworkScan.current = { id, tabId: activeTabId, timer };
    webViewRef.current.injectJavaScript(networkImageSnapshotScript(id));
  };

  const handleClearNetworkImages = () => {
    Alert.alert(
      '収集履歴をクリア',
      'このタブで収集したURLをクリアします。次に読み込まれる画像から再び収集します。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'クリア',
          onPress: () => {
            networkImages.current.clear(activeTabId);
            webViewRef.current?.injectJavaScript('window.__myGalleryNetworkImages?.clear(); true;');
          },
        },
      ],
    );
  };

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
    networkImages.current.navigate(activeTabId, navState.url);
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

  // Redirect-style ads send the current tab straight to an ad landing page
  // (no new window at all, so window.open blocking never sees them) — from
  // a delayed timer, or an invisible full-page overlay that hijacks the
  // next tap. onShouldStartLoadWithRequest below blocks a same-window
  // navigation that isn't tied to a genuine, recent touch, using this
  // timestamp (updated via a message from AD_BLOCK_SCRIPT — page JS can't
  // reliably intercept navigation itself, since location.href's setter is
  // unforgeable in Chromium's WebView).
  const lastGestureAtRef = useRef(0);
  const GESTURE_WINDOW_MS = 1200;
  // True for exactly the next navigation after `url` changes — i.e. one
  // explicitly requested by the app itself (address bar submit, bookmark/
  // history tap, opening a tab), which must always be allowed through
  // regardless of origin or gesture timing, since no in-page touch is
  // possible before that page has even started loading.
  const pendingExplicitNavigationRef = useRef(true);
  useEffect(() => {
    pendingExplicitNavigationRef.current = true;
  }, [url]);

  const handleShouldStartLoad = (request: WebViewNavigation): boolean => {
    if (!adBlockEnabled) {
      return true;
    }
    if (pendingExplicitNavigationRef.current) {
      pendingExplicitNavigationRef.current = false;
      return true;
    }
    try {
      if (new URL(request.url).origin === new URL(currentUrl).origin) {
        return true;
      }
    } catch {
      return true;
    }
    return Date.now() - lastGestureAtRef.current < GESTURE_WINDOW_MS;
  };

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
    const request = pendingNetworkScan.current;
    const failScan = (code: string) => {
      if (!request || pendingNetworkScan.current !== request) return;
      clearTimeout(request.timer);
      pendingNetworkScan.current = null;
      imageTransport.current.clear();
      Alert.alert(
        '通信画像の確認',
        `本編画像の取得・受信処理に失敗しました。\n理由: ${code}\nサムネイルでの代用は行いません。`,
      );
    };
    let data: string | null = event.nativeEvent.data;
    try {
      // Bind transfer fragments and errors to the same tab/document as the request.
      if (/^\{"type":"NETWORK_IMAGES_(?:CHUNK|ERROR)"/.test(data)) {
        const browser = useBrowserStore.getState();
        const liveTab = browser.tabs.find((tab) => tab.id === activeTabId);
        if (
          !liveTab ||
          browser.activeTabId !== activeTabId ||
          new URL(liveTab.currentUrl).origin !== new URL(event.nativeEvent.url).origin
        )
          return;
      }
      if (data.length < 2000) {
        const status = JSON.parse(data);
        if (status?.type === 'NETWORK_IMAGES_ERROR') {
          if (request?.id === status.requestId) failScan(snapshotFailureDetails(status));
          return;
        }
      }
      data = imageTransport.current.receive(data, request?.id);
    } catch (error) {
      // Ordinary non-JSON WebView messages still go through their existing handlers.
      if (error instanceof SyntaxError) data = event.nativeEvent.data;
      else {
        failScan('IMAGE_TRANSFER_FAILED');
        return;
      }
    }
    if (data === null) return;
    const networkMessage = parseNetworkImageMessage(data);
    if (!networkMessage && data !== event.nativeEvent.data) {
      failScan('INVALID_IMAGE_RESPONSE');
      return;
    }
    if (networkMessage) {
      // Reject stale documents after navigating to another site.
      try {
        const browser = useBrowserStore.getState();
        if (browser.activeTabId !== activeTabId) return;
        const liveTab = browser.tabs.find((tab) => tab.id === activeTabId);
        if (!liveTab || networkScope(liveTab.currentUrl) !== networkScope(networkMessage.pageUrl))
          return;
        if (new URL(networkMessage.pageUrl).origin !== new URL(event.nativeEvent.url).origin)
          return;
      } catch {
        return;
      }
      const images = networkMessage.reader
        ? networkMessage.reader.images
        : networkImages.current.merge(activeTabId, networkMessage);
      const pending = pendingNetworkScan.current;
      if (pending && pending.tabId === activeTabId && pending.id === networkMessage.requestId) {
        if (
          Platform.OS !== 'web' &&
          networkMessage.titleSourceError === 'NOT_FOUND' &&
          !pending.sourceRetried
        ) {
          pending.sourceRetried = true;
          void fetchNativePageSource(networkMessage.pageUrl).then(({ html, error }) => {
            if (
              pendingNetworkScan.current !== pending ||
              useBrowserStore.getState().activeTabId !== pending.tabId
            )
              return;
            webViewRef.current?.injectJavaScript(
              networkImageSourceRetryScript(pending.id, networkMessage.pageUrl, html, error),
            );
          });
          return;
        }
        clearTimeout(pending.timer);
        pendingNetworkScan.current = null;
        if (!images.length) {
          Alert.alert(
            '本編画像が見つかりません',
            networkMessage.reader
              ? networkMessage.reader.blocked > 0
                ? readerFailureMessage(networkMessage.reader)
                : '本編の読み込み完了後に再度お試しください。本編表示領域の画像だけを対象にし、おすすめ・サムネイルは除外します。サイトの表示構造によっては取得できません。'
              : 'ページを表示・操作してから再度お試しください。/contents/ の画像を収集します。取得できない通信もあります。',
          );
          return;
        }
        if (images.length >= MAX_NETWORK_IMAGES) {
          Alert.alert(
            '収集上限',
            `最大${MAX_NETWORK_IMAGES}件までの画像を表示します。保存後、ボタンを長押しすると履歴をクリアできます。`,
          );
        }
        rootNavigation.navigate('ImageSelection', {
          pageTitle: networkMessage.pageTitle || title,
          sourceUrl: networkMessage.pageUrl,
          primaryGroup: { groupKey: 'network-contents', images },
          otherImages: [],
          collectionKind: networkMessage.reader ? 'reader' : 'network',
          readerSkipped: networkMessage.reader
            ? networkMessage.reader.blocked + networkMessage.reader.skipped
            : undefined,
          titleFromSource: networkMessage.titleFromSource,
          titleSourceError: networkMessage.titleSourceError,
        });
      }
      return;
    }
    if (isUserGestureMessage(event.nativeEvent.data)) {
      lastGestureAtRef.current = Date.now();
      return;
    }
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
      onGoBack={() => {
        if (!canGoBack || !webViewRef.current) return;
        pendingExplicitNavigationRef.current = true;
        webViewRef.current.goBack();
      }}
      onGoForward={() => {
        if (!canGoForward || !webViewRef.current) return;
        pendingExplicitNavigationRef.current = true;
        webViewRef.current.goForward();
      }}
      onSaveImages={handleSaveImages}
      onSaveNetworkImages={handleSaveNetworkImages}
      onClearNetworkImages={handleClearNetworkImages}
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
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
            onLoadEnd={() => {
              setLoading(false);
              webViewRef.current?.injectJavaScript(NETWORK_IMAGE_SCRIPT);
            }}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            startInLoadingState
            incognito={disableHistory}
            injectedJavaScriptBeforeContentLoaded={`${NETWORK_IMAGE_SCRIPT}\n${adBlockEnabled ? AD_BLOCK_SCRIPT : ''}`}
            injectedJavaScript={NETWORK_IMAGE_SCRIPT}
            setSupportMultipleWindows={!adBlockEnabled}
            onOpenWindow={adBlockEnabled ? () => {} : undefined}
          />
          {disableHistory && <View pointerEvents="none" style={styles.privateModeBorder} />}

          <ControlGroup
            screenId={CHROME_SCREEN_ID}
            variant="bar"
            defaultAnchor="top"
            edgesOnly
            flushBottom={chromeAtBottom && keyboardVisible}
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
      </KeyboardAvoidingView>
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
