import { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Privacy screen: covers the whole app with a blur the instant it stops
 * being the foreground app (task switcher, another app taking focus, the
 * device lock screen), so screenshots/glances of the app list or a shoulder
 * surfer can't read its content. Cleared the moment the app is foregrounded
 * again.
 *
 * Note: this only affects what's rendered *while* React Native is still
 * running — Android's own recent-apps thumbnail is a separate OS-level
 * screenshot taken independently of this component and isn't covered by it.
 */
export function AppBackgroundBlur() {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  if (active) {
    return null;
  }

  return (
    <BlurView
      intensity={100}
      tint="dark"
      blurMethod="dimezisBlurView"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
