import { Alert } from 'react-native';

import { useSettingsStore } from '../store/settingsStore';

/**
 * Shows the folder-delete confirmation, honoring the user's
 * "don't ask again" preference. When the preference is already set, deletes
 * immediately without prompting; otherwise offers a third button that both
 * deletes and persists the preference for next time.
 */
export function confirmDeleteFolder(folderName: string, onConfirm: () => void): void {
  if (useSettingsStore.getState().skipDeleteConfirmation) {
    onConfirm();
    return;
  }

  Alert.alert(
    'フォルダを削除しますか?',
    `「${folderName}」を削除します。この操作は元に戻せません。`,
    [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: onConfirm,
      },
      {
        text: '削除(次回から確認しない)',
        style: 'destructive',
        onPress: () => {
          useSettingsStore.getState().setSkipDeleteConfirmation(true);
          onConfirm();
        },
      },
    ],
  );
}
