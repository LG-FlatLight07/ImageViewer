import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionRow}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            >
              <Text style={[styles.actionLabel, action.destructive && styles.destructiveLabel]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.actionRow, styles.cancelRow]} onPress={onClose}>
            <Text style={styles.cancelLabel}>キャンセル</Text>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  actionLabel: {
    fontSize: 16,
    color: '#222',
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
    color: '#888',
    textAlign: 'center',
  },
});
