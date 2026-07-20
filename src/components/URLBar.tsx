import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type URLBarProps = {
  value: string;
  loading: boolean;
  onChangeValue: (value: string) => void;
  onSubmit: () => void;
  onReload: () => void;
};

export function URLBar({ value, loading, onChangeValue, onSubmit, onReload }: URLBarProps) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeValue}
        onSubmitEditing={onSubmit}
        placeholder="URLまたは検索ワードを入力"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        selectTextOnFocus
      />
      <TouchableOpacity style={styles.reloadButton} onPress={onReload} accessibilityLabel="reload">
        <Ionicons name={loading ? 'close' : 'refresh'} size={20} color="#333" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f1f1f1',
  },
  input: {
    flex: 1,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  reloadButton: {
    marginLeft: 8,
    padding: 6,
  },
});
