import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { useTagGroupStore, type TagGroup } from '../store/tagGroupStore';
import { useAppTheme } from '../theme/theme';

type Props = { tags: string[]; allTags: string[]; onSelect: (tag: string) => void };
const TAB_WIDTH = 112;

/** Group membership is independent of the folder's selected tags. */
export function TagGroupPicker({ tags, allTags, onSelect }: Props) {
  const { colors } = useAppTheme();
  const { groups, save, remove } = useTagGroupStore();
  const [active, setActive] = useState('all');
  const [width, setWidth] = useState(0);
  const [tabWidth, setTabWidth] = useState(0);
  const tabsRef = useRef<ScrollView>(null);
  const pagesRef = useRef<ScrollView>(null);
  const [editor, setEditor] = useState<{ id: string | null; name: string; tags: string[] } | null>(
    null,
  );
  const pages: TagGroup[] = [
    { id: 'all', name: 'すべて', tags },
    {
      id: 'ungrouped',
      name: '未分類',
      tags: tags.filter((t) => !groups.some((g) => g.tags.includes(t))),
    },
    ...groups.map((g) => ({ ...g, tags: tags.filter((t) => g.tags.includes(t)) })),
  ];
  const index = Math.max(
    0,
    pages.findIndex((p) => p.id === active),
  );
  useEffect(() => {
    tabsRef.current?.scrollTo({ x: index * TAB_WIDTH, animated: true });
    pagesRef.current?.scrollTo({ x: index * width, animated: true });
  }, [index, width, tabWidth]);
  const openEditor = (g?: TagGroup) =>
    setEditor(g ? { ...g, tags: [...g.tags] } : { id: null, name: '', tags: [] });
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.row}>
        <ScrollView
          ref={tabsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => setTabWidth(e.nativeEvent.layout.width)}
          contentContainerStyle={{ paddingHorizontal: Math.max(0, (tabWidth - TAB_WIDTH) / 2) }}
        >
          {pages.map((g, i) => (
            <TouchableOpacity
              key={g.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={`タググループ ${g.name}`}
              onPress={() => setActive(g.id)}
              onLongPress={() => {
                const saved = groups.find((item) => item.id === g.id);
                if (saved) openEditor(saved);
              }}
              style={[
                styles.tab,
                { borderBottomColor: i === index ? colors.primary : 'transparent' },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{ color: i === index ? colors.primary : colors.secondaryText }}
              >
                {g.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          accessibilityLabel="タググループを作成"
          onPress={() => openEditor()}
          style={styles.add}
        >
          <Text style={{ color: colors.primary, fontSize: 24 }}>＋</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={pagesRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          if (width)
            setActive(pages[Math.round(e.nativeEvent.contentOffset.x / width)]?.id ?? 'all');
        }}
      >
        {pages.map((g) => (
          <View key={g.id} style={{ width, height: 112 }}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chips}
            >
              {g.tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => onSelect(tag)}
                  style={[styles.chip, { backgroundColor: colors.background }]}
                >
                  <Text style={{ color: colors.text }}>{tag}</Text>
                </TouchableOpacity>
              ))}
              {!g.tags.length && (
                <Text style={{ color: colors.secondaryText }}>タグがありません</Text>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
      {groups.some((g) => g.id === active) && (
        <TouchableOpacity onPress={() => openEditor(groups.find((g) => g.id === active))}>
          <Text style={{ color: colors.primary, padding: 4 }}>グループ名・所属タグを編集</Text>
        </TouchableOpacity>
      )}
      <Modal
        visible={editor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontSize: 18 }}>タググループ</Text>
            <TextInput
              accessibilityLabel="タググループ名"
              placeholder="作者・二次創作・年代など"
              placeholderTextColor={colors.secondaryText}
              value={editor?.name ?? ''}
              onChangeText={(name) => setEditor((e) => e && { ...e, name })}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <Text style={{ color: colors.secondaryText }}>
              所属させるタグを選択（他のグループから移動します）
            </Text>
            <ScrollView
              style={{ maxHeight: 240 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chips}
            >
              {allTags.map((tag) => {
                const selected = editor?.tags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!selected }}
                    onPress={() =>
                      setEditor(
                        (e) =>
                          e && {
                            ...e,
                            tags: selected ? e.tags.filter((t) => t !== tag) : [...e.tags, tag],
                          },
                      )
                    }
                    style={[
                      styles.chip,
                      { backgroundColor: selected ? colors.primary : colors.surface },
                    ]}
                  >
                    <Text style={{ color: selected ? '#fff' : colors.text }}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
              {!allTags.length && (
                <Text style={{ color: colors.secondaryText }}>
                  フォルダにタグを追加すると、ここで所属を設定できます。
                </Text>
              )}
            </ScrollView>
            <View style={[styles.row, { justifyContent: 'flex-end', flexWrap: 'wrap' }]}>
              {editor?.id && (
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => {
                    remove(editor.id!);
                    setActive('ungrouped');
                    setEditor(null);
                  }}
                >
                  <Text style={{ color: colors.secondaryText }}>グループ解除</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.action} onPress={() => setEditor(null)}>
                <Text style={{ color: colors.text }}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.action}
                onPress={() => {
                  if (!editor) return;
                  const id = save(editor.id, editor.name, editor.tags);
                  if (!id) {
                    Alert.alert(
                      'グループ名を確認してください',
                      '空欄・同名・「すべて」「未分類」は使用できません。',
                    );
                    return;
                  }
                  setActive(id);
                  setEditor(null);
                }}
              >
                <Text style={{ color: colors.primary }}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tab: { width: TAB_WIDTH, padding: 10, alignItems: 'center', borderBottomWidth: 2 },
  add: { paddingHorizontal: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 6 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: { width: '92%', maxHeight: '85%', borderRadius: 14, padding: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  action: { padding: 10 },
});
