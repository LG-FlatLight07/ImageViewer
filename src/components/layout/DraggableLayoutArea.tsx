import React, { createContext, useContext, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

type Bounds = { width: number; height: number };

const BoundsContext = createContext<Bounds>({ width: 0, height: 0 });

export function useDraggableBounds(): Bounds {
  return useContext(BoundsContext);
}

export function DraggableLayoutArea({ children }: { children: React.ReactNode }) {
  const [bounds, setBounds] = useState<Bounds>({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBounds({ width, height });
  };

  return (
    <BoundsContext.Provider value={bounds}>
      <View style={styles.fill} onLayout={handleLayout}>
        {children}
      </View>
    </BoundsContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
