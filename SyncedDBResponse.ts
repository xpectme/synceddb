export interface SyncedDBResponse<T> {
  changed: T[];
  deleted: string[];
  timestamp: number;
}
