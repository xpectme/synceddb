import * as idbx from "npm:idbx";
import { SyncedDBOptions } from "./SyncedDBOptions.ts";
import { SyncedDBAction } from "./SyncedDBAction.ts";
import { SyncedDBState } from "./SyncedDBState.ts";
import { SyncedDBResponse } from "./SyncedDBResponse.ts";
import { SyncedDBRequest } from "./SyncedDBRequest.ts";
import { SyncedDBInfo } from "./SyncedDBInfo.ts";
import { SyncedDBEventMap } from "./SyncedDBEventMap.ts";
import { SyncedDBEventTarget } from "./SyncedDBEventTarget.ts";

let currentTime = 0;
let currentCount = 0;
function testRunId(padding = 1) {
  const now = Date.now();
  if (now === currentTime) {
    currentCount++;
  } else {
    currentTime = now;
    currentCount = 0;
  }
  return `${now}${currentCount.toString().padStart(padding, "0")}`;
}

export interface SyncedDB<T extends SyncedDBInfo>
  extends SyncedDBEventTarget<T> {
  addEventListener<K extends keyof SyncedDBEventMap<T>>(
    type: K,
    listener: ((ev: SyncedDBEventMap<T>[K]) => void) | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;

  removeEventListener<K extends keyof SyncedDBEventMap<T>>(
    type: K,
    listener: ((ev: SyncedDBEventMap<T>[K]) => void) | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;

  dispatchEvent(event: Event): boolean;
}

export class SyncedDB<T extends SyncedDBInfo>
  extends (EventTarget as unknown as {
    // deno-lint-ignore no-explicit-any
    new (): SyncedDBEventTarget<any>;
    // deno-lint-ignore no-explicit-any
    prototype: SyncedDBEventTarget<any>;
  }) {
  static createStore(
    db: IDBDatabase,
    storeName: string,
    options?: IDBObjectStoreParameters,
  ) {
    const store = db.createObjectStore(
      storeName,
      {
        keyPath: "id",
        autoIncrement: false,
        ...options,
      },
    );
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
    super();
    this.options = {
      keyName: "id",
      url: location?.origin ?? "",
      autoSync: false,
      createPath: "/api/create",
      readPath: "/api/read",
      updatePath: "/api/update",
      deletePath: "/api/delete",
      readAllPath: "/api/read_all",
      syncPath: "/api/sync",
      testRun: false,
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
    let key: IDBValidKey;
    if (store.autoIncrement) {
      key = await idbx.add(store, item);
      item[this.options.keyName] = key;
      console.log("key", key);
    } else {
      key = "TMP-" + crypto.randomUUID();
      item[this.options.keyName] = key;
      await idbx.add(store, item);
    }

    if (navigator.onLine) {
      const path = this.options.createPath;
      const result = await this.#fetchOne("POST", path, data, key);
      this.dispatchEvent(new MessageEvent("created", { data: result }));
      return result;
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

    if (
      navigator.onLine && result?.sync_action === "create" ||
      navigator.onLine && forceSync
    ) {
      const path = this.options.readPath;
      const result = await this.#fetchOne("GET", path, undefined, key);
      this.dispatchEvent(new MessageEvent("read", { data: result }));
      return result;
    }

    this.dispatchEvent(new MessageEvent("read", { data: result }));
    return result;
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
      const path = this.options.updatePath;
      const result = await this.#fetchOne("PUT", path, data, key);
      this.dispatchEvent(new MessageEvent("updated", { data: result }));
      return result;
    }
    return item as T;
  }

  // create a method that deletes from the indexeddb store and send a fetch
  // request to the server to update the database on the server
  async delete(key: string) {
    const read = this.#getStore("readonly");
    const record = await idbx.get<T>(read, key);

    // check if the record is already registered on the server.
    // If it isn't, then we can delete it from the store right now.
    if (record?.sync_action === "create") {
      // delete the record
      const store = this.#getStore("readwrite");
      await idbx.del(store, key);
      return;
    }

    const store = this.#getStore("readwrite");
    const item = this.#addSyncState(record as T, "delete", "unsynced");
    await idbx.put(store, item);

    // delete the record
    if (navigator.onLine) {
      const path = this.options.deletePath;
      await this.#fetchOne("DELETE", path, undefined, key);
      this.dispatchEvent(new MessageEvent("deleted", { data: key }));
    }
  }

  // create a method that reads all from the indexeddb store and send a fetch
  // request to the server to update the database on the server
  async readAll(forceSync = false) {
    const store = this.#getStore("readonly");
    let result = await idbx.getAll<T>(store);

    if (navigator.onLine && (result.length === 0 || forceSync)) {
      const url = new URL(this.options.url + this.options.readAllPath);

      let response: Response;
      if (this.options.testRun) {
        console.log(`TEST RUN: GET ${url}`);
        response = new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        response = await fetch(url, {
          method: "GET",
          mode: "cors",
          credentials: "include",
        });
      }

      if (response.ok) {
        const json: T[] = await response.json() ?? [];
        const store = this.#getStore("readwrite");
        const items = (json ?? []).map((item) =>
          this.#addSyncState(item, "none", "synced")
        );

        await idbx.putBulk(store, items);

        // add the TMP- items to the items array
        const tmpItems = result.filter((item) => item.sync_action === "create");
        result = [...items, ...tmpItems] as T[];
      } else {
        // handle error
        console.log("fetch entries failed", response);
      }
    }

    this.dispatchEvent(new MessageEvent("readAll", { data: result }));
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

    const store = this.#getStore("readonly");
    const index = store.index("syncState");
    const syncStore = index.objectStore;

    const result = await idbx.getAll<T>(syncStore);
    const unsynced = result.filter((item) => item.sync_state === "unsynced");

    if (unsynced.length === 0) {
      return;
    }

    // filter all items where keyName starts with TMP-
    const key = this.options.keyName;
    const createTmpIds = unsynced
      .filter((item) => item.sync_action === "create")
      .map<string>((item) => item[key]);

    // create groups from sync_action
    const groups = unsynced.reduce<SyncedDBRequest<T>>(
      (acc, item) => {
        if ("sync_action" in item) {
          const { sync_action } = item;
          if (sync_action !== undefined) {
            if (!acc[sync_action]) {
              acc[sync_action] = [];
            }
            acc[sync_action].push(item);
          }
        }
        return acc;
      },
      {} as SyncedDBRequest<T>,
    );

    const url = new URL(this.options.url + this.options.syncPath);
    url.searchParams.set("t", timestamp.toString());

    let response: Response;
    if (this.options.testRun) {
      // handle deletions
      let deleted: string[] = [];
      if ("delete" in groups) {
        deleted = groups.delete.map((item: T) => item[key]);
      }

      // handle updates
      let updated: T[] = [];
      if ("update" in groups) {
        updated = JSON.parse(JSON.stringify(groups.update));
      }

      // handle creations
      let created: T[] = [];
      if ("create" in groups) {
        created = JSON.parse(JSON.stringify(groups.create)).map((item: T) => {
          item[key] = testRunId(3);
          return item;
        });
      }

      console.log(`TEST RUN: POST ${url}`);
      response = new Response(
        JSON.stringify({
          deleted,
          changed: [...updated, ...created],
          timestamp: Date.now(),
        } as SyncedDBResponse<T>),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } else {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groups),
        mode: "cors",
        credentials: "include",
      });
    }

    if (response.ok) {
      const json = await response.json() as SyncedDBResponse<T>;
      const items = json.changed.map((item) =>
        this.#addSyncState(item, "none", "synced")
      );

      await idbx.batch<T>(this.db, [
        { method: "del", storeName: this.storeName, keys: createTmpIds },
        { method: "del", storeName: this.storeName, keys: json.deleted },
        { method: "put", storeName: this.storeName, data: items },
      ], "readwrite").completed;

      this.dispatchEvent(new MessageEvent("synced", { data: json }));
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

  #buildUrl(path: string, key?: IDBValidKey | undefined) {
    const url = new URL(this.options.url + path);
    if (key) {
      url.searchParams.set(this.options.keyName as string, key.toString());
    }
    return url;
  }

  #fetchOne = async (
    method: string,
    path: string,
    data: T | undefined,
    key?: IDBValidKey | undefined,
  ) => {
    const canHaveBody = method !== "GET" && method !== "DELETE";
    const body = !canHaveBody ? undefined : JSON.stringify(data);
    const url = this.#buildUrl(path, key);

    let response: Response;
    if (this.options.testRun) {
      let responseBody = body ? JSON.parse(body) : null;
      let status = 200;
      const headers = new Headers({ "Content-Type": "application/json" });
      if ("POST" === method) {
        const id = testRunId(3);
        if (responseBody !== null && this.options.keyName in responseBody) {
          responseBody[this.options.keyName] = id;
        }
        status = 201;
      } else if ("DELETE" === method) {
        status = 204;
        headers.delete("Content-Type");
      } else if ("PUT" === method) {
        status = 200;
      }

      if (responseBody !== null) {
        responseBody = JSON.stringify(responseBody);
      }

      console.log(`TEST RUN: ${method} ${url}`);
      response = new Response(responseBody, { status, headers });
    } else {
      response = await fetch(url, {
        method,
        body,
        mode: "cors",
        credentials: "include",
      });
    }

    if (response.ok) {
      if (method === "DELETE" && key) {
        await idbx.del(this.#getStore("readwrite"), key);
        return;
      } else {
        const json = await response.json();
        const item = this.#addSyncState(json, "none", "synced");
        const store = this.#getStore("readwrite");
        if (store.autoIncrement) {
          await idbx.put(this.#getStore("readwrite"), item);
        } else {
          await idbx.put(this.#getStore("readwrite"), item, key);
        }
        return item as T;
      }
    } else if (response.status === 404) {
      if (key) {
        await idbx.del(this.#getStore("readwrite"), key);
      }
    } else {
      // handle error
      console.log("read/write/delete entry failed", response);
    }
  };
}
