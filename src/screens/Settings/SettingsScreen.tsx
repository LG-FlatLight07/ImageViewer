import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

import { useRootNavigation } from '../../navigation/useRootNavigation';
import { submitFeedbackMessage } from '../../db/feedbackRepository';
import { PromptModal } from '../../components/PromptModal';
import { useLayoutStore } from '../../store/layoutStore';
import {
  SEARCH_ENGINES,
  useSettingsStore,
  type ImageViewerDirection,
  type ThemePreference,
} from '../../store/settingsStore';
import {
  FREE_DAILY_DOWNLOADS,
  FREE_TAG_LIMIT,
  getRemainingFreeDownloads,
  hasUnlimitedDownloadsToday,
  useMonetizationStore,
} from '../../store/monetizationStore';
import { requestPremiumPurchase, restorePremiumPurchases } from '../../services/purchaseService';
import { useAppTheme } from '../../theme/theme';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'システムに従う' },
  { key: 'light', label: 'ライト' },
  { key: 'dark', label: 'ダーク' },
];

const VIEWER_DIRECTION_OPTIONS: { key: ImageViewerDirection; label: string }[] = [
  { key: 'horizontal', label: '横スライド' },
  { key: 'vertical', label: '縦スライド' },
];

const FEEDBACK_TOAST_MS = 3000;

export function SettingsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const rootNavigation = useRootNavigation();
  const editMode = useLayoutStore((state) => state.editMode);
  const setEditMode = useLayoutStore((state) => state.setEditMode);
  const resetAll = useLayoutStore((state) => state.resetAll);
  const searchEngine = useSettingsStore((state) => state.searchEngine);
  const setSearchEngine = useSettingsStore((state) => state.setSearchEngine);
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);
  const disableHistory = useSettingsStore((state) => state.disableHistory);
  const setDisableHistory = useSettingsStore((state) => state.setDisableHistory);
  const adBlockEnabled = useSettingsStore((state) => state.adBlockEnabled);
  const setAdBlockEnabled = useSettingsStore((state) => state.setAdBlockEnabled);
  const autoSelectSequentialImages = useSettingsStore((state) => state.autoSelectSequentialImages);
  const setAutoSelectSequentialImages = useSettingsStore(
    (state) => state.setAutoSelectSequentialImages,
  );
  const skipDeleteConfirmation = useSettingsStore((state) => state.skipDeleteConfirmation);
  const setSkipDeleteConfirmation = useSettingsStore((state) => state.setSkipDeleteConfirmation);
  const imageViewerDirection = useSettingsStore((state) => state.imageViewerDirection);
  const setImageViewerDirection = useSettingsStore((state) => state.setImageViewerDirection);
  const folderNameExclusions = useSettingsStore((state) => state.folderNameExclusions);
  const addFolderNameExclusion = useSettingsStore((state) => state.addFolderNameExclusion);
  const removeFolderNameExclusion = useSettingsStore((state) => state.removeFolderNameExclusion);
  const [exclusionInput, setExclusionInput] = useState('');
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(false);
  const purchasedPremium = useMonetizationStore((state) => state.purchasedPremium);
  const rewardedAdDate = useMonetizationStore((state) => state.rewardedAdDate);
  const dailyDownloadDate = useMonetizationStore((state) => state.dailyDownloadDate);
  const dailyDownloadUsed = useMonetizationStore((state) => state.dailyDownloadUsed);
  const setPurchasedPremium = useMonetizationStore((state) => state.setPurchasedPremium);
  const grantRewardedAdToday = useMonetizationStore((state) => state.grantRewardedAdToday);
  const [purchaseBusy, setPurchaseBusy] = useState(false);

  useEffect(() => {
    if (!feedbackToast) {
      return;
    }
    const timer = setTimeout(() => setFeedbackToast(false), FEEDBACK_TOAST_MS);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  const commitExclusion = () => {
    if (exclusionInput.trim()) {
      addFolderNameExclusion(exclusionInput);
      setExclusionInput('');
    }
  };

  const confirmResetLayout = () => {
    Alert.alert('レイアウトをリセットしますか?', undefined, [
      { text: 'いいえ', style: 'cancel' },
      { text: 'はい', style: 'destructive', onPress: resetAll },
    ]);
  };

  const monetizationEntitlement = {
    purchasedPremium,
    rewardedAdDate,
    dailyDownloadDate,
    dailyDownloadUsed,
  };
  const unlimitedDownloadsToday = hasUnlimitedDownloadsToday(monetizationEntitlement);
  const remainingFreeDownloads = getRemainingFreeDownloads(monetizationEntitlement);

  const handlePurchase = async () => {
    setPurchaseBusy(true);
    try {
      await requestPremiumPurchase();
    } catch (err) {
      Alert.alert(
        '購入できませんでした',
        '実機の開発版ビルド(Dev Client)またはストア経由のビルドで、Google Playにログインした状態でお試しください',
      );
      console.warn('[SettingsScreen] premium purchase failed', err);
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleRestore = async () => {
    setPurchaseBusy(true);
    try {
      await restorePremiumPurchases();
    } catch (err) {
      Alert.alert('復元できませんでした', 'しばらくしてからもう一度お試しください');
      console.warn('[SettingsScreen] restore purchases failed', err);
    } finally {
      setPurchaseBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>検索エンジン</Text>
        <View style={styles.optionRow}>
          {SEARCH_ENGINES.map((engine) => (
            <TouchableOpacity
              key={engine.key}
              style={[
                styles.optionButton,
                { backgroundColor: colors.surface },
                searchEngine === engine.key && { backgroundColor: colors.primary },
              ]}
              onPress={() => setSearchEngine(engine.key)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  { color: colors.secondaryText },
                  searchEngine === engine.key && styles.optionButtonTextActive,
                ]}
              >
                {engine.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          テーマ
        </Text>
        <View style={styles.optionRow}>
          {THEME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.optionButton,
                { backgroundColor: colors.surface },
                themePreference === option.key && { backgroundColor: colors.primary },
              ]}
              onPress={() => setThemePreference(option.key)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  { color: colors.secondaryText },
                  themePreference === option.key && styles.optionButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          ブラウジング
        </Text>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>履歴を残さない</Text>
            <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
              オンにすると閲覧履歴を保存せず、Cookie等もセッション限りになります
            </Text>
          </View>
          <Switch
            value={disableHistory}
            onValueChange={setDisableHistory}
            accessibilityLabel="toggle-disable-history"
          />
        </View>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              広告・ポップアップをブロック
            </Text>
            <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
              広告らしき要素を非表示にし、ポップアップウィンドウを開かないようにします。{'\n'}
              サイトが正しく開けないときはオフにしてみてください
            </Text>
          </View>
          <Switch
            value={adBlockEnabled}
            onValueChange={setAdBlockEnabled}
            accessibilityLabel="toggle-ad-block"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          画像のダウンロード
        </Text>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>連番画像を自動選択</Text>
            <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
              保存ボタンを押したときに、検出された連番画像を自動的に選択した状態にします
            </Text>
          </View>
          <Switch
            value={autoSelectSequentialImages}
            onValueChange={setAutoSelectSequentialImages}
            accessibilityLabel="toggle-auto-select-sequential-images"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          ギャラリー
        </Text>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>削除前に確認する</Text>
            <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
              オフにすると、フォルダ削除時に確認ポップアップを表示せず即座に削除します
            </Text>
          </View>
          <Switch
            value={!skipDeleteConfirmation}
            onValueChange={(value) => setSkipDeleteConfirmation(!value)}
            accessibilityLabel="toggle-delete-confirmation"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          フォルダ名の除外文字列
        </Text>
        <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
          画像を保存するフォルダ名をページタイトルから自動生成する際に、ここに登録した文字列を取り除きます。
        </Text>
        {folderNameExclusions.length > 0 && (
          <View style={styles.exclusionChipRow}>
            {folderNameExclusions.map((entry) => (
              <View key={entry} style={[styles.exclusionChip, { backgroundColor: colors.surface }]}>
                <Text style={[styles.exclusionChipText, { color: colors.text }]}>{entry}</Text>
                <TouchableOpacity
                  onPress={() => removeFolderNameExclusion(entry)}
                  accessibilityLabel={`remove-exclusion-${entry}`}
                >
                  <Ionicons name="close-circle" size={16} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={styles.exclusionInputRow}>
          <TextInput
            style={[styles.exclusionInput, { borderColor: colors.border, color: colors.text }]}
            value={exclusionInput}
            onChangeText={setExclusionInput}
            onSubmitEditing={commitExclusion}
            placeholder="除外する文字列を入力"
            placeholderTextColor={colors.secondaryText}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.exclusionAddButton, { backgroundColor: colors.primary }]}
            onPress={commitExclusion}
            accessibilityLabel="add-exclusion"
          >
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          スライドビューワー
        </Text>
        <View style={styles.optionRow}>
          {VIEWER_DIRECTION_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.optionButton,
                { backgroundColor: colors.surface },
                imageViewerDirection === option.key && { backgroundColor: colors.primary },
              ]}
              onPress={() => setImageViewerDirection(option.key)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  { color: colors.secondaryText },
                  imageViewerDirection === option.key && styles.optionButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          画面レイアウト
        </Text>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>レイアウト編集モード</Text>
            <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
              ブラウザーとギャラリーの操作ボタンをドラッグで移動、切替ボタンで並び方を変更できます
            </Text>
          </View>
          <Switch
            value={editMode}
            onValueChange={setEditMode}
            accessibilityLabel="toggle-layout-edit-mode"
          />
        </View>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>レイアウトのリセット</Text>
            <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
              移動・変更したボタンの配置をすべて初期状態に戻します
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: colors.surface }]}
            onPress={confirmResetLayout}
            accessibilityLabel="reset-layout"
          >
            <Text style={styles.resetButtonText}>リセット</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          プレミアム
        </Text>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {purchasedPremium ? '購入済み' : '未購入'}
            </Text>
            <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
              {purchasedPremium
                ? 'ダウンロード無制限・タグ無制限・ランキング上位50位まで閲覧できます'
                : `ダウンロードは1日${FREE_DAILY_DOWNLOADS}回、タグは全体で${FREE_TAG_LIMIT}個まで、ランキングは上位3位まで閲覧できます。${'\n'}本日の残り無料ダウンロード回数: ${
                    unlimitedDownloadsToday ? '無制限' : `${remainingFreeDownloads}回`
                  }`}
            </Text>
          </View>
        </View>
        {!purchasedPremium && (
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: colors.primary }]}
              onPress={handlePurchase}
              disabled={purchaseBusy}
              accessibilityLabel="purchase-premium"
            >
              <Text style={[styles.optionButtonText, styles.optionButtonTextActive]}>
                買い切り版を購入する
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: colors.surface }]}
              onPress={handleRestore}
              disabled={purchaseBusy}
              accessibilityLabel="restore-premium"
            >
              <Text style={[styles.optionButtonText, { color: colors.secondaryText }]}>
                購入を復元する
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          開発者機能(実機テスト用)
        </Text>
        <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
          実際に広告を視聴・購入することなく、収益化まわりの表示や制限を確認するためのコマンドです。
        </Text>
        <View style={styles.optionRow}>
          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: colors.surface }]}
            onPress={grantRewardedAdToday}
            accessibilityLabel="dev-simulate-rewarded-ad"
          >
            <Text style={[styles.optionButtonText, { color: colors.text }]}>
              報酬型広告を視聴したことにする
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: colors.surface }]}
            onPress={() => setPurchasedPremium(true)}
            accessibilityLabel="dev-simulate-purchased"
          >
            <Text style={[styles.optionButtonText, { color: colors.text }]}>
              買い切り課金をしたことにする
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: colors.surface }]}
            onPress={() => setPurchasedPremium(false)}
            accessibilityLabel="dev-simulate-not-purchased"
          >
            <Text style={[styles.optionButtonText, { color: colors.text }]}>
              買い切り課金をしていないことにする
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          サポート
        </Text>
        <TouchableOpacity
          style={[styles.guideLink, { backgroundColor: colors.surface }]}
          onPress={() => setFeedbackVisible(true)}
          accessibilityLabel="open-feedback"
        >
          <Ionicons name="mail-outline" size={18} color={colors.text} />
          <Text style={[styles.guideLinkText, { color: colors.text }]}>
            開発者にメッセージを送る
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
        </TouchableOpacity>

        <View style={styles.guideDivider} />
        <TouchableOpacity
          style={[styles.guideLink, { backgroundColor: colors.surface }]}
          onPress={() => rootNavigation.navigate('AppGuide')}
          accessibilityLabel="open-app-guide"
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.text} />
          <Text style={[styles.guideLinkText, { color: colors.text }]}>
            アプリの使い方・仕様を見る
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
        </TouchableOpacity>
      </ScrollView>

      <PromptModal
        visible={feedbackVisible}
        title="開発者にメッセージを送る"
        placeholder="ご意見・不具合報告などをご記入ください"
        submitLabel="送信"
        multiline
        onCancel={() => setFeedbackVisible(false)}
        onSubmit={async (value) => {
          setFeedbackVisible(false);
          if (value.trim()) {
            await submitFeedbackMessage(db, value);
            setFeedbackToast(true);
          }
        }}
      />

      {feedbackToast && (
        <View style={[styles.toastOverlay, { top: insets.top + 8 }]} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>メッセージありがとうございます。今後の参考にします</Text>
          </View>
        </View>
      )}
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  optionButtonText: {
    fontSize: 13,
  },
  optionButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  exclusionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  exclusionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  exclusionChipText: {
    fontSize: 12,
  },
  exclusionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  exclusionInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  exclusionAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#c0392b',
    fontWeight: '600',
    fontSize: 13,
  },
  guideDivider: {
    height: 24,
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  guideLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  toastOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    backgroundColor: 'rgba(20, 20, 20, 0.92)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    maxWidth: '90%',
  },
  toastText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});
