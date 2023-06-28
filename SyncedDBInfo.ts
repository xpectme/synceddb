import { SyncedDBAction } from "./SyncedDBAction.ts";
import { SyncedDBState } from "./SyncedDBState.ts";

export interface SyncedDBInfo {
  sync_action?: SyncedDBAction;
  sync_state?: SyncedDBState;
}
