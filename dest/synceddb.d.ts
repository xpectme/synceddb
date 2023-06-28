export type SyncedDBAction = "create" | "update" | "delete" | "none";
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
export type SyncedDBState = "unsynced" | "synced";
export interface SyncedDBInfo {
    sync_action?: SyncedDBAction;
    sync_state?: SyncedDBState;
}
export declare class SyncedDB<T> {
    #private;
    db: IDBDatabase;
    storeName: string;
    static createStore(db: IDBDatabase, storeName: string, keyPath?: string): IDBObjectStore;
    options: SyncedDBOptions;
    syncState: Promise<string>;
    lastSync: number;
    constructor(db: IDBDatabase, storeName: string, options?: Partial<SyncedDBOptions>);
    create(data: T): Promise<T | undefined>;
    read(key: string, forceSync?: boolean): Promise<T | undefined>;
    update(data: T): Promise<T | undefined>;
    delete(key: string): Promise<void>;
    readAll(forceSync?: boolean): Promise<T[]>;
    sync(timestamp?: number | null): Promise<void>;
}
