import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useRewardedDownloadAd } from '../services/rewardedAdService';
import { hasUnlimitedDownloadsToday, useMonetizationStore } from '../store/monetizationStore';
import { useAppTheme } from '../theme/theme';

/**
 * Entry point for the free tier's daily download cap: watching one rewarded
 * ad lifts the cap for the rest of the calendar day. Hidden entirely once
 * premium is purchased (see ImageSelectionScreen.tsx), since a purchase
 * already grants unlimited downloads forever.
 */
export function RewardedAdButton() {
  const { colors } = useAppTheme();
  const rewardedAdDate = useMonetizationStore((state) => state.rewardedAdDate);
  const purchasedPremium = useMonetizationStore((state) => state.purchasedPremium);
  const grantRewardedAdToday = useMonetizationStore((state) => state.grantRewardedAdToday);
  const { isLoaded, showAd } = useRewardedDownloadAd();
  const [showing, setShowing] = useState(false);

  const unlockedToday = hasUnlimitedDownloadsToday({
    purchasedPremium,
    rewardedAdDate,
    dailyDownloadDate: null,
    dailyDownloadUsed: 0,
  });

  if (unlockedToday) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.unlockedButton]}
        accessibilityLabel="rewarded-ad-unlocked-today"
        disabled
      >
        <Ionicons name="checkmark-circle" size={16} color="#fff" />
        <Text style={styles.buttonText}>本日は無制限</Text>
      </TouchableOpacity>
    );
  }

  const handlePress = async () => {
    if (showing) {
      return;
    }
    if (!isLoaded) {
      Alert.alert('広告を読み込み中です', 'しばらくしてからもう一度お試しください');
      return;
    }
    setShowing(true);
    try {
      const earned = await showAd();
      if (earned) {
        grantRewardedAdToday();
        Alert.alert('本日はダウンロード無制限です', 'ご視聴ありがとうございました');
      }
    } finally {
      setShowing(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.primary }]}
      onPress={handlePress}
      accessibilityLabel="watch-rewarded-ad"
    >
      {showing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="play-circle" size={16} color="#fff" />
      )}
      <Text style={styles.buttonText}>広告を見て本日は無制限に</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  unlockedButton: {
    backgroundColor: '#2e9e5b',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
