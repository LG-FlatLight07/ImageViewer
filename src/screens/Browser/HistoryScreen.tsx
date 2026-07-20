import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import type { BrowserStackParamList } from '../../navigation/types';
import type { HistoryEntry } from '../../db/types';
import { clearHistory, deleteHistoryEntry, listHistory } from '../../db/historyRepository';
import { useBrowserStore } from '../../store/browserStore';
import { useAppTheme } from '../../theme/theme';

export function HistoryScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<BrowserStackParamList>>();
  const setUrl = useBrowserStore((state) => state.setUrl);
  const { colors } = useAppTheme();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const reload = useCallback(async () => {
    setEntries(await listHistory(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleClearAll = useCallback(() => {
    Alert.alert('履歴を削除', 'すべての閲覧履歴を削除しますか?', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await clearHistory(db);
          reload();
        },
      },
    ]);
  }, [db, reload]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={[styles.clearButtonText, { color: colors.danger }]}>すべて削除</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleClearAll, colors.danger]);

  const handleOpen = (entry: HistoryEntry) => {
    setUrl(entry.url);
    navigation.navigate('BrowserHome');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => handleOpen(item)}
          >
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
                await deleteHistoryEntry(db, item.id);
                reload();
              }}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.secondaryText} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>履歴はありません</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  clearButtonText: {
    fontSize: 13,
    marginRight: 4,
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
