import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const [tags, setTags] = useState<string[]>(initialTags);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (visible) {
      // Re-seed local editor state each time the modal opens; the component
      // stays mounted across opens/closes so this can't be derived during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTags(initialTags);
      setInputValue('');
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

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

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
