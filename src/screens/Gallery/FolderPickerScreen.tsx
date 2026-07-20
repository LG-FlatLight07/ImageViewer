import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';

import type { RootStackParamList } from '../../navigation/types';
import type { FolderWithTags } from '../../db/types';
import { getFolderName, listFolders, moveFolder } from '../../db/foldersRepository';
import { useAppTheme } from '../../theme/theme';

export function FolderPickerScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'FolderPicker'>>();
  const { movingFolderId } = route.params;
  const { colors } = useAppTheme();

  const [pathStack, setPathStack] = useState<(string | null)[]>([null]);
  const currentParentId = pathStack[pathStack.length - 1];
  const [folders, setFolders] = useState<FolderWithTags[]>([]);
  const [currentName, setCurrentName] = useState('すべてのフォルダ');

  const reload = useCallback(async () => {
    const list = await listFolders(db, { parentId: currentParentId, sortKey: 'name' });
    setFolders(list.filter((f) => f.id !== movingFolderId));
    setCurrentName(await getFolderName(db, currentParentId));
  }, [db, currentParentId, movingFolderId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleMoveHere = async () => {
    await moveFolder(db, movingFolderId, currentParentId);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="cancel">
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>移動先を選択</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.pathRow}>
        {pathStack.length > 1 && (
          <TouchableOpacity
            onPress={() => setPathStack((prev) => prev.slice(0, -1))}
            style={styles.upButton}
          >
            <Ionicons name="arrow-up" size={16} color={colors.primary} />
            <Text style={[styles.upButtonText, { color: colors.primary }]}>上の階層へ</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.currentPath, { color: colors.secondaryText }]} numberOfLines={1}>
          現在地: {currentName}
        </Text>
      </View>

      <FlatList
        data={folders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => setPathStack((prev) => [...prev, item.id])}
          >
            <Ionicons name="folder" size={22} color="#f6c453" />
            <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            サブフォルダはありません
          </Text>
        }
      />

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.moveButton, { backgroundColor: colors.primary }]}
          onPress={handleMoveHere}
        >
          <Text style={styles.moveButtonText}>「{currentName}」に移動</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  pathRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  upButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  upButtonText: {
    fontSize: 13,
    color: '#4c8bf5',
    marginLeft: 4,
  },
  currentPath: {
    fontSize: 12,
    color: '#888',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
  },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  moveButton: {
    backgroundColor: '#4c8bf5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  moveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
