import React, { useCallback, useState } from 'react';
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

export function HistoryScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<BrowserStackParamList>>();
  const setUrl = useBrowserStore((state) => state.setUrl);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const reload = useCallback(async () => {
    setEntries(await listHistory(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleOpen = (entry: HistoryEntry) => {
    setUrl(entry.url);
    navigation.navigate('BrowserHome');
  };

  const handleClearAll = () => {
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>履歴</Text>
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={styles.clearButtonText}>すべて削除</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => handleOpen(item)}>
            <View style={styles.rowTextGroup}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title || item.url}
              </Text>
              <Text style={styles.rowUrl} numberOfLines={1}>
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
              <Ionicons name="close" size={18} color="#aaa" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>履歴はありません</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  clearButtonText: {
    fontSize: 13,
    color: '#c0392b',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowTextGroup: {
    flex: 1,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 15,
    color: '#222',
  },
  rowUrl: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
  },
});
