import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useContentsFilterStore } from '../store/contentsFilterStore';
import { useAppTheme } from '../theme/theme';

export function ContentsFilterPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  const { filters, defaultFilter, save, remove, setDefault } = useContentsFilterStore();
  const [input, setInput] = useState(value);
  const apply = () => {
    const next = input.trim();
    save(next);
    onChange(next);
  };
  return (
    <View style={styles.panel}>
      <Text style={{ color: colors.text }}>収集元の絞り込み</Text>
      <Text style={{ color: colors.secondaryText }}>
        /contents/ より前に含まれる文字列を指定します。例:
        HOGEHOGE、396_desktop_medium_2x。空欄はすべて。
      </Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          accessibilityLabel="収集元の条件"
          value={input}
          onChangeText={setInput}
          placeholder="ホスト名・パス・URL"
          placeholderTextColor={colors.secondaryText}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={apply}
        />
        <TouchableOpacity style={styles.button} onPress={apply}>
          <Text style={{ color: colors.primary }}>保存・適用</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.row}>
        {['', ...filters].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.chip,
              { backgroundColor: value === filter ? colors.primary : colors.surface },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: value === filter }}
            onPress={() => {
              setInput(filter);
              onChange(filter);
            }}
            onLongPress={
              filter
                ? () =>
                    Alert.alert('保存条件を削除', filter, [
                      { text: 'キャンセル', style: 'cancel' },
                      {
                        text: '削除',
                        style: 'destructive',
                        onPress: () => {
                          remove(filter);
                          if (value === filter) {
                            setInput('');
                            onChange('');
                          }
                        },
                      },
                    ])
                : undefined
            }
          >
            <Text style={{ color: value === filter ? '#fff' : colors.text }}>
              {defaultFilter === filter ? '★ ' : ''}
              {filter || 'すべて'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.button} onPress={() => setDefault(value)}>
        <Text style={{ color: colors.primary }}>
          {defaultFilter === value
            ? '★ 次回もこの条件で開きます'
            : '選択中の条件をデフォルトにする'}
        </Text>
      </TouchableOpacity>
      <Text style={{ color: colors.secondaryText }}>保存条件は長押しで削除できます。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, padding: 8 },
  button: { paddingVertical: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16 },
});
