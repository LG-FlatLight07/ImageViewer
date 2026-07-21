import React, { createContext, useContext, useMemo, useRef } from 'react';

type Coordinator = {
  /** Closes whichever other row is currently open, then remembers this row's closer as "the open one". */
  notifyOpen: (close: () => void) => void;
};

const SwipeRowCoordinatorContext = createContext<Coordinator | null>(null);

/** Wrap a list of swipeable rows so opening one auto-closes any other open row in the same list. */
export function SwipeRowCoordinatorProvider({ children }: { children: React.ReactNode }) {
  const openCloseRef = useRef<(() => void) | null>(null);

  const coordinator = useMemo<Coordinator>(
    () => ({
      notifyOpen: (close) => {
        if (openCloseRef.current && openCloseRef.current !== close) {
          openCloseRef.current();
        }
        openCloseRef.current = close;
      },
    }),
    [],
  );

  return (
    <SwipeRowCoordinatorContext.Provider value={coordinator}>
      {children}
    </SwipeRowCoordinatorContext.Provider>
  );
}

/** Returns null outside a provider — callers should treat coordination as optional. */
export function useSwipeRowCoordinator(): Coordinator | null {
  return useContext(SwipeRowCoordinatorContext);
}
