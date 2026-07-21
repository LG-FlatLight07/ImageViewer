import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { BrowserTab } from '../store/browserStore';
import { useAppTheme } from '../theme/theme';

type BrowserTabBarProps = {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
};

function tabLabel(tab: BrowserTab): string {
  if (tab.title) {
    return tab.title;
  }
  try {
    return new URL(tab.url).hostname || tab.url;
  } catch {
    return tab.url || '新しいタブ';
  }
}

export function BrowserTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}: BrowserTabBarProps) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const tabCount = tabs.length;

  useEffect(() => {
    // New tabs are always appended at the end, so scrolling to the end
    // brings a freshly-opened tab into view when the bar overflows.
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [tabCount]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                styles.tabShadow,
                { backgroundColor: colors.card },
                active && { backgroundColor: colors.primary },
              ]}
              onPress={() => onSelectTab(tab.id)}
              accessibilityLabel={`select-tab-${tab.id}`}
            >
              <Text
                style={[styles.tabLabel, { color: active ? '#fff' : colors.text }]}
                numberOfLines={1}
              >
                {tabLabel(tab)}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => onCloseTab(tab.id)}
                hitSlop={8}
                accessibilityLabel={`close-tab-${tab.id}`}
              >
                <Ionicons name="close" size={14} color={active ? '#fff' : colors.secondaryText} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        style={[styles.newTabButton, styles.tabShadow, { backgroundColor: colors.card }]}
        onPress={onNewTab}
        accessibilityLabel="new-tab"
      >
        <Ionicons name="add" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginTop: 6,
  },
  tabShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  scrollContent: {
    alignItems: 'center',
    gap: 6,
    paddingRight: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 140,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: 14,
  },
  tabLabel: {
    fontSize: 12,
    maxWidth: 90,
  },
  closeButton: {
    marginLeft: 4,
    padding: 4,
  },
  newTabButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
