import { SyncedDBRequestCreate } from "./SyncedDBRequestCreate.ts";
import { SyncedDBRequestUpdate } from "./SyncedDBRequestUpdate.ts";
import { SyncedDBRequestDelete } from "./SyncedDBRequestDelete.ts";

export type SyncedDBRequest<T> =
  | SyncedDBRequestCreate<T>
  | SyncedDBRequestUpdate<T>
  | SyncedDBRequestDelete<T>;
