import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import type { BrowserStackParamList } from '../../navigation/types';
import type { Bookmark } from '../../db/types';
import { listBookmarks, removeBookmark } from '../../db/bookmarksRepository';
import { useBrowserStore } from '../../store/browserStore';
import { useAppTheme } from '../../theme/theme';

export function BookmarksScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<BrowserStackParamList>>();
  const setUrl = useBrowserStore((state) => state.setUrl);
  const { colors } = useAppTheme();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const reload = useCallback(async () => {
    setBookmarks(await listBookmarks(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleOpen = (bookmark: Bookmark) => {
    setUrl(bookmark.url);
    navigation.navigate('BrowserHome');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => handleOpen(item)}
          >
            <Ionicons name="star" size={18} color="#f6c453" />
            <View style={styles.rowTextGroup}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title || item.url}
              </Text>
              <Text style={[styles.rowUrl, { color: colors.secondaryText }]} numberOfLines={1}>
                {item.url}
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                await removeBookmark(db, item.id);
                reload();
              }}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.secondaryText} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            ブックマークはありません
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTextGroup: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 15,
  },
  rowUrl: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
  },
});
