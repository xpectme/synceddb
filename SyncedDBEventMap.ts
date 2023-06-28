import { SyncedDBResponse } from "./SyncedDBResponse.ts";

export interface SyncedDBEventMap<T> {
  "created": MessageEvent<T>;
  "read": MessageEvent<T>;
  "readAll": MessageEvent<T[]>;
  "updated": MessageEvent<T>;
  "deleted": MessageEvent<string>;
  "synced": MessageEvent<SyncedDBResponse<T>>;
}
