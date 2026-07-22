import { Alert } from 'react-native';

import { useSettingsStore } from '../store/settingsStore';

/**
 * Shows a delete confirmation, honoring the user's "don't ask again"
 * preference (shared across every kind of delete in the app — folders,
 * images, etc). When the preference is already set, deletes immediately
 * without prompting; otherwise offers a third button that both deletes and
 * persists the preference for next time.
 */
export function confirmDelete(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}): void {
  if (useSettingsStore.getState().skipDeleteConfirmation) {
    options.onConfirm();
    return;
  }

  const confirmLabel = options.confirmLabel ?? '削除';

  Alert.alert(options.title, options.message, [
    { text: 'キャンセル', style: 'cancel' },
    {
      text: confirmLabel,
      style: 'destructive',
      onPress: options.onConfirm,
    },
    {
      text: `${confirmLabel}(次回から確認しない)`,
      style: 'destructive',
      onPress: () => {
        useSettingsStore.getState().setSkipDeleteConfirmation(true);
        options.onConfirm();
      },
    },
  ]);
}

/** Folder-delete specific wording over the shared confirmDelete. */
export function confirmDeleteFolder(folderName: string, onConfirm: () => void): void {
  confirmDelete({
    title: 'フォルダを削除しますか?',
    message: `「${folderName}」を削除します。この操作は元に戻せません。`,
    onConfirm,
  });
}
