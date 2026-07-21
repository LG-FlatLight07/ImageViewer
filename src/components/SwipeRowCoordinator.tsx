import React, { createContext, useContext, useMemo, useRef } from 'react';

type Coordinator = {
  /**
   * Closes whichever other row is currently open, then remembers this row's
   * closer as "the open one". Rows are identified by a stable `id` (not by
   * the `close` function reference, which is recreated on every open) so
   * that a row reopening after its own auto-close isn't mistaken for a
   * different row and immediately closed again.
   */
  notifyOpen: (id: string, close: () => void) => void;
};

const SwipeRowCoordinatorContext = createContext<Coordinator | null>(null);

/** Wrap a list of swipeable rows so opening one auto-closes any other open row in the same list. */
export function SwipeRowCoordinatorProvider({ children }: { children: React.ReactNode }) {
  const openRef = useRef<{ id: string; close: () => void } | null>(null);

  const coordinator = useMemo<Coordinator>(
    () => ({
      notifyOpen: (id, close) => {
        if (openRef.current && openRef.current.id !== id) {
          openRef.current.close();
        }
        openRef.current = { id, close };
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
