export interface SyncedDBOptions {
  keyName: string;
  url: string;
  autoSync: boolean;
  createPath: string;
  readPath: string;
  updatePath: string;
  deletePath: string;
  readAllPath: string;
  syncPath: string;
}
