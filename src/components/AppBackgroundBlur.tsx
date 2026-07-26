import { useEffect, useState, type RefObject } from 'react';
import { AppState, StyleSheet, type View } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Privacy screen: covers the whole app with a blur the instant it stops
 * being the foreground app (task switcher, another app taking focus, the
 * device lock screen), so screenshots/glances of the app list or a shoulder
 * surfer can't read its content. Cleared the moment the app is foregrounded
 * again.
 *
 * `blurMethod="dimezisBlurView"` on Android only produces a real blur (as
 * opposed to a plain translucent overlay) when paired with an explicit
 * `blurTarget` pointing at a `BlurTargetView` wrapping the content behind
 * it, so the caller must render the whole app inside one and pass its ref.
 *
 * Note: this only affects what's rendered *while* React Native is still
 * running — Android's own recent-apps thumbnail is a separate OS-level
 * screenshot taken independently of this component and isn't covered by it.
 */
export function AppBackgroundBlur({ target }: { target: RefObject<View | null> }) {
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
      blurTarget={target}
      intensity={100}
      tint="dark"
      blurMethod="dimezisBlurView"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
