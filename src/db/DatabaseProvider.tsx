import React, { Suspense } from 'react';
import { SQLiteProvider } from 'expo-sqlite';

import { migrateDbIfNeeded } from './schema';

export const DATABASE_NAME = 'imageviewer.db';

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
        {children}
      </SQLiteProvider>
    </Suspense>
  );
}
