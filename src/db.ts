import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'verdegrana_db';
const STORE_NAME = 'app_state';

interface AppData {
  transactions: any[];
  categories: any[];
  profiles_list?: string[];
  workspaceHandle?: FileSystemDirectoryHandle;
}

export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export async function saveState(db: IDBPDatabase, data: AppData) {
  // We can store the workspaceHandle in IDB directly as it is serializable by structured clone in modern browsers
  await db.put(STORE_NAME, data, 'current_state');
}

export async function getState(db: IDBPDatabase): Promise<Partial<AppData> | null> {
  return db.get(STORE_NAME, 'current_state');
}

export async function clearState(db: IDBPDatabase) {
  await db.clear(STORE_NAME);
}
