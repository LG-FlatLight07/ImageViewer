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

import { useAppTheme } from '../theme/theme';

type PromptModalProps = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

export function PromptModal({
  visible,
  title,
  placeholder,
  initialValue = '',
  submitLabel = 'OK',
  onCancel,
  onSubmit,
}: PromptModalProps) {
  const { colors } = useAppTheme();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      // Re-seed the input each time the modal opens; the component stays
      // mounted across opens/closes so this can't be derived during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.secondaryText}
            autoFocus
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={onCancel}>
              <Text style={[styles.buttonText, { color: colors.secondaryText }]}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={() => onSubmit(value)}
            >
              <Text style={[styles.buttonText, styles.submitButtonText]}>{submitLabel}</Text>
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
    width: '85%',
    borderRadius: 14,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
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
