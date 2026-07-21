import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../theme/theme';

type GuideSection = {
  title: string;
  items: string[];
};

const SECTIONS: GuideSection[] = [
  {
    title: 'ブラウザー',
    items: [
      'タブで複数ページを閲覧',
      'アドレスバー: ★でブックマーク追加、リストアイコンでブックマーク一覧、時計アイコンで履歴を開く',
      'ダウンロードボタンで表示中ページの連番画像を検出',
    ],
  },
  {
    title: '画像の保存',
    items: [
      '検出した画像から保存したいものを選んでダウンロード',
      'ダウンロードは背景で実行され、進捗は画面下部、完了通知は画面上部に表示',
      'ページタイトルから保存先フォルダ名を自動生成',
    ],
  },
  {
    title: 'ギャラリー',
    items: [
      'フォルダ名・タグ名で検索、タグをチップで絞り込み、ソート方法を切替',
      'フォルダ行を右スワイプで削除、左スワイプで保存元URLへ移動',
      'フォルダ内では画像を複数選択してまとめて削除可能',
      '画像をタップするとスライドビューワーで閲覧',
    ],
  },
  {
    title: 'スライドビューワー',
    items: [
      '縦スライド/横スライドは設定で切替可能',
      '表示中の向きと垂直にスワイプすると閉じる',
      'フォルダの最後の画像まで進むと次のフォルダへ継続',
    ],
  },
  {
    title: 'レイアウト編集',
    items: [
      '設定の「レイアウト編集モード」をONにすると、各画面の操作UIをドラッグで移動可能',
      '編集中は他の操作が無効になり、ドラッグのみ受け付ける',
      '各UI右上のボタンで並び方(横/縦)を切替、「リセット」で配置を初期化',
    ],
  },
];

export function AppGuideScreen() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            {section.items.map((item) => (
              <View key={item} style={styles.itemRow}>
                <Text style={[styles.bullet, { color: colors.secondaryText }]}>•</Text>
                <Text style={[styles.itemText, { color: colors.secondaryText }]}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    fontSize: 13,
    marginRight: 6,
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
