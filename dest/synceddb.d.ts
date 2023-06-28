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
    dryRun: boolean;
}
export type SyncedDBState = "unsynced" | "synced";
export interface SyncedDBInfo {
    sync_action?: SyncedDBAction;
    sync_state?: SyncedDBState;
}
export interface SyncedDBRequestCreate<T> {
    create: T[];
}
export interface SyncedDBRequestUpdate<T> {
    update: T[];
}
export interface SyncedDBRequestDelete<T = string> {
    delete: T[];
}
export type SyncedDBRequest<T> = SyncedDBRequestCreate<T> | SyncedDBRequestUpdate<T> | SyncedDBRequestDelete<T>;
export interface SyncedDBResponse<T> {
    changed: T[];
    deleted: string[];
    timestamp: number;
}
export interface SyncedDBEventMap<T> {
    "created": MessageEvent<T>;
    "read": MessageEvent<T>;
    "readAll": MessageEvent<T[]>;
    "updated": MessageEvent<T>;
    "deleted": MessageEvent<string>;
    "synced": MessageEvent<SyncedDBResponse<T>>;
}
export interface SyncedDBEventTarget<T> extends EventTarget {
    addEventListener<K extends keyof SyncedDBEventMap<T>>(type: K, listener: (ev: SyncedDBEventMap<T>[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
    removeEventListener<K extends keyof SyncedDBEventMap<T>>(type: K, listener: ((ev: SyncedDBEventMap<T>[K]) => void) | null, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}
export interface SyncedDB<T extends SyncedDBInfo> extends SyncedDBEventTarget<T> {
    addEventListener<K extends keyof SyncedDBEventMap<T>>(type: K, listener: ((ev: SyncedDBEventMap<T>[K]) => void) | null, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
    removeEventListener<K extends keyof SyncedDBEventMap<T>>(type: K, listener: ((ev: SyncedDBEventMap<T>[K]) => void) | null, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}
declare const SyncedDB_base: {
    new (): SyncedDBEventTarget<any>;
    prototype: SyncedDBEventTarget<any>;
};
export declare class SyncedDB<T extends SyncedDBInfo> extends SyncedDB_base {
    #private;
    db: IDBDatabase;
    storeName: string;
    static createStore(db: IDBDatabase, storeName: string, options?: IDBObjectStoreParameters): IDBObjectStore;
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
export {};
