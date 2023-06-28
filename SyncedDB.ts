import * as idbx from "npm:idbx";
import { SyncedDBOptions } from "./SyncedDBOptions.ts";
import { SyncedDBAction } from "./SyncedDBAction.ts";
import { SyncedDBState } from "./SyncedDBState.ts";

export class SyncedDB<T> {
  static createStore(db: IDBDatabase, storeName: string, keyPath = "id") {
    const store = db.createObjectStore(storeName, {
      keyPath,
      autoIncrement: false,
    });
    store.createIndex("syncState", "sync_state", { unique: false });
    store.createIndex("syncAction", "sync_action", { unique: false });
    return store;
  }

  options: SyncedDBOptions;

  syncState = Promise.resolve("unsynced");
  lastSync = 0;

  constructor(
    public db: IDBDatabase,
    public storeName: string,
    options?: Partial<SyncedDBOptions>,
  ) {
    this.options = {
      keyName: "id",
      url: (globalThis as any).location?.origin ?? "",
      autoSync: false,
      createPath: "/api/create",
      readPath: "/api/read",
      updatePath: "/api/update",
      deletePath: "/api/delete",
      readAllPath: "/api/read_all",
      syncPath: "/api/sync",
      ...options,
    };
    globalThis.addEventListener("online", () => {
      this.syncState = new Promise((resolve) => {
        this.sync()
          .then(() => resolve("synced"))
          .catch(console.error);
      });
    });
    globalThis.addEventListener("offline", () => {
      this.syncState = Promise.resolve("unsynced");
    });
  }

  // create a method that writes into the indexeddb store and send a fetch
  // request to the server to update the database on the server
  async create(data: T) {
    const store = this.#getStore("readwrite");
    const item = this.#addSyncState(data, "create", "unsynced");
    const key = "TMP-" + crypto.randomUUID();
    item[this.options.keyName] = key;
    await idbx.add(store, item);

    if (navigator.onLine) {
      return this.#fetchOne("POST", this.options.createPath, data, key);
    }

    return item as T;
  }

  // create a method that reads from the indexeddb store and send a fetch
  // request to the server to update the database on the server
  async read(key: string, forceSync = false) {
    const store = this.#getStore("readonly");
    const result = await idbx.get<T>(store, key);

    if (!result) {
      // sync if result is not found
      forceSync = true;
    }

    if (navigator.onLine && !key.startsWith("TMP-") && forceSync) {
      return this.#fetchOne("GET", this.options.readPath, undefined, key);
    }

    return result as T;
  }

  // create a method that updates the indexeddb store and send a fetch
  // request to the server to update the database on the server
  async update(data: T) {
    if (!data[this.options.keyName]) {
      throw new Error("Missing key");
    }
    const key = data[this.options.keyName] as string;

    const store = this.#getStore("readwrite");
    const item = this.#addSyncState(data, "update", "unsynced");
    await idbx.put(store, item);

    if (navigator.onLine) {
      return this.#fetchOne("PUT", this.options.updatePath, data, key);
    }

    return item as T;
  }

  // create a method that deletes from the indexeddb store and send a fetch
  // request to the server to update the database on the server
  async delete(key: string) {
    // check if the record is already registered on the server.
    // If it isn't, then we can delete it from the store right now.
    if (key.startsWith("TMP-")) {
      // delete the record
      const store = this.#getStore("readwrite");
      await idbx.del(store, key);
      return;
    }

    const read = this.#getStore("readonly");
    const record = await idbx.get<T>(read, key);

    const store = this.#getStore("readwrite");
    const item = this.#addSyncState(record as T, "delete", "unsynced");
    await idbx.put(store, item);

    // delete the record
    if (navigator.onLine) {
      await this.#fetchOne("DELETE", this.options.deletePath, undefined, key);
    }
  }

  // create a method that reads all from the indexeddb store and send a fetch
  // request to the server to update the database on the server
  async readAll(forceSync = false) {
    const tx = this.db.transaction(this.storeName, "readonly");
    const store = tx.objectStore(this.storeName);
    const result = await idbx.getAll(store);

    if (navigator.onLine && (result.length === 0 || forceSync)) {
      const url = new URL(this.options.url + this.options.readAllPath);
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "include",
      });
      if (response.ok) {
        const json = await response.json() ?? [];
        const store = this.#getStore("readwrite");
        const items = (json ?? []).map((item: any) =>
          this.#addSyncState(item, "none", "synced")
        );

        await idbx.putBulk(store, items);

        // add the TMP- items to the items array
        const tmpItems = result.filter((item: any) =>
          item[this.options.keyName].startsWith("TMP-")
        );
        return [...items, ...tmpItems] as T[];
      } else {
        // handle error
        console.log("fetch entries failed", response);
      }
    }

    return result as T[];
  }

  async sync(timestamp: number | null = null) {
    const offline = !navigator.onLine;
    if (offline) {
      return;
    }

    if (timestamp === null) {
      timestamp = this.lastSync;
    }

    const tx = this.db.transaction(this.storeName, "readonly");
    const store = tx.objectStore(this.storeName);
    const index = store.index("syncState");
    const syncStore = index.objectStore;

    const result = await idbx.getAll(syncStore);
    const unsynced = result.filter((item: any) =>
      item.sync_state === "unsynced"
    );

    if (unsynced.length === 0) {
      return;
    }

    // filter all items where keyName starts with TMP-
    const key = this.options.keyName;
    const createTmpIds = unsynced
      .filter((item: any) => item.sync_action === "create")
      .map((item: any) => item[key]);

    // create groups from sync_action
    const groups = unsynced.reduce((acc: any, item: any) => {
      const { sync_action } = item;
      if (!acc[sync_action]) {
        acc[sync_action] = [];
      }
      acc[sync_action].push(item);
      return acc;
    }, {});

    const url = new URL(this.options.url + this.options.syncPath);
    url.searchParams.set("t", timestamp.toString());

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groups),
      mode: "cors",
      credentials: "include",
    });

    if (response.ok) {
      const json = await response.json();
      const store = this.#getStore("readwrite");
      const items = json.changed.map((item: any) =>
        this.#addSyncState(item, "none", "synced")
      );

      await Promise.all([
        // delete all items that are flagged as created on the client
        idbx.delBulk(store, createTmpIds),
        // delete all items that are flagged as deleted from the server
        idbx.delBulk(store, json.deleted),
        // update all items where sync_state is unsynced
        idbx.putBulk(store, items),
      ]);

      this.lastSync = new Date(json.timestamp).getTime();
    } else {
      // handle error
      console.log("sync failed", response);
    }
  }

  #addSyncState(
    data: T | undefined,
    sync_action: SyncedDBAction,
    sync_state: SyncedDBState,
  ) {
    return { ...data, sync_action, sync_state } as T;
  }

  #getStore(mode: IDBTransactionMode) {
    const tx = this.db.transaction(this.storeName, mode);
    return tx.objectStore(this.storeName);
  }

  #buildUrl(path: string, key: string) {
    const url = new URL(this.options.url + path);
    if (!key.startsWith("TMP-")) {
      url.searchParams.set(this.options.keyName as string, key);
    }
    return url;
  }

  #fetchOne = async (
    method: string,
    path: string,
    data: T | undefined,
    key: string,
  ) => {
    const canHaveBody = method !== "GET" && method !== "DELETE";
    const body = !canHaveBody ? undefined : JSON.stringify(data);
    const url = this.#buildUrl(path, key);
    const response = await fetch(url, {
      method,
      body,
      mode: "cors",
      credentials: "include",
    });

    console.log(response.ok, response.status);

    if (response.ok) {
      const store = this.#getStore("readwrite");
      if (method === "DELETE") {
        await idbx.del(store, key);
        return;
      } else {
        const json = await response.json();
        const item = this.#addSyncState(json, "none", "synced");
        await idbx.put(store, item);
        return item as T;
      }
    } else if (response.status === 404) {
      const store = this.#getStore("readwrite");
      await idbx.del(store, key);
    } else {
      // handle error
      console.log("read/write/delete entry failed", response);
    }
  };
}
