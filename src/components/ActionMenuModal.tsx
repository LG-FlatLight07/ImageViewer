import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '../theme/theme';

export type MenuAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

type ActionMenuModalProps = {
  visible: boolean;
  onClose: () => void;
  actions: MenuAction[];
};

export function ActionMenuModal({ visible, onClose, actions }: ActionMenuModalProps) {
  const { colors } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.actionRow, { borderBottomColor: colors.border }]}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            >
              <Text
                style={[
                  styles.actionLabel,
                  { color: colors.text },
                  action.destructive && styles.destructiveLabel,
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.actionRow, styles.cancelRow]} onPress={onClose}>
            <Text style={[styles.cancelLabel, { color: colors.secondaryText }]}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
  destructiveLabel: {
    color: '#c0392b',
  },
  cancelRow: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  cancelLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
});
