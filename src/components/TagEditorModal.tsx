import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

import { listAllTagNames } from '../db/foldersRepository';
import { useAppTheme } from '../theme/theme';

type TagEditorModalProps = {
  visible: boolean;
  folderName: string;
  initialTags: string[];
  onCancel: () => void;
  onSubmit: (tags: string[]) => void;
};

export function TagEditorModal({
  visible,
  folderName,
  initialTags,
  onCancel,
  onSubmit,
}: TagEditorModalProps) {
  const { colors } = useAppTheme();
  const db = useSQLiteContext();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [inputValue, setInputValue] = useState('');
  const [existingTags, setExistingTags] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      // Re-seed local editor state each time the modal opens; the component
      // stays mounted across opens/closes so this can't be derived during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTags(initialTags);
      setInputValue('');
      listAllTagNames(db).then((names) => {
        setExistingTags(names);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const commitInput = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setInputValue('');
  };

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const suggestions = existingTags.filter((name) => {
    if (tags.includes(name)) {
      return false;
    }
    const query = inputValue.trim().toLowerCase();
    return query === '' || name.toLowerCase().includes(query);
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text }]}>タグを編集</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]} numberOfLines={1}>
            {folderName}
          </Text>

          <View style={styles.chipRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(tag)}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={commitInput}
            placeholder="タグ名を入力してEnter"
            placeholderTextColor={colors.secondaryText}
            returnKeyType="done"
          />

          {suggestions.length > 0 && (
            <View style={styles.suggestionsBlock}>
              <Text style={[styles.suggestionsLabel, { color: colors.secondaryText }]}>
                既存のタグから選択
              </Text>
              <ScrollView style={styles.suggestionsScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.suggestionsRow}>
                  {suggestions.map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.suggestionChip, { backgroundColor: colors.surface }]}
                      onPress={() => addTag(name)}
                    >
                      <Ionicons name="add" size={14} color={colors.secondaryText} />
                      <Text style={[styles.suggestionChipText, { color: colors.text }]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={onCancel}>
              <Text style={[styles.buttonText, { color: colors.secondaryText }]}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                commitInput();
                onSubmit(
                  inputValue.trim() && !tags.includes(inputValue.trim())
                    ? [...tags, inputValue.trim()]
                    : tags,
                );
              }}
            >
              <Text style={[styles.buttonText, styles.submitButtonText]}>保存</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '88%',
    borderRadius: 14,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef3ff',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipText: {
    fontSize: 13,
    color: '#3a5fc4',
    marginRight: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
  },
  suggestionsBlock: {
    marginTop: 10,
  },
  suggestionsLabel: {
    fontSize: 11,
    marginBottom: 6,
  },
  suggestionsScroll: {
    maxHeight: 96,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 2,
  },
  suggestionChipText: {
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  buttonText: {
    fontSize: 15,
  },
  submitButton: {
    borderRadius: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
