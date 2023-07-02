// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/indexeddb@1.3.5/polyfill_memory.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.192.0/testing/mock.ts";
import * as mf from "https://deno.land/x/mock_fetch@0.3.0/mod.ts";

import * as idbx from "https://esm.sh/idbx@v2.0.0";

mf.install();

import { SyncedDB, SyncedDBInfo } from "./main.ts";

interface TestStore extends SyncedDBInfo {
  id?: string;
  name: string;
}

interface TestAutoIncrementStore extends SyncedDBInfo {
  id?: number;
  name: string;
}

let uuidCounter = 1;
stub(crypto, "randomUUID", () => `${uuidCounter++}` as any);

const resetRandomUUID = () => uuidCounter = 1;

const getCount = async (db: IDBDatabase) => {
  const store = db.transaction("test").objectStore("test");
  const count = await idbx.count(store);
  return count;
};

const createDB = (options?: IDBObjectStoreParameters) => {
  return idbx.openDB("testdb", {
    version: 1,
    upgrade(db) {
      SyncedDB.createStore(db, "test", options);
    },
  });
};

const clearDB = (db: IDBDatabase) => {
  // close database
  db.close();
  // delete database
  indexedDB.deleteDatabase("testdb");
};

const fillDB = async (db: IDBDatabase) => {
  const store = idbx.getStore(db, "test", "readwrite");
  await idbx.add<TestStore>(store, [
    { id: "1", name: "test", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test", sync_action: "none", sync_state: "synced" },
    { id: "3", name: "test", sync_action: "none", sync_state: "synced" },
    {
      id: "TMP-1",
      name: "test",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);
};

const createPOSTRoute = (item: TestStore | TestAutoIncrementStore) => {
  mf.mock("POST@/api/create", async (req) => {
    const actualBody = await req.json();
    const expectedBody = item;

    assertEquals(actualBody, expectedBody);
    return new Response(JSON.stringify(item), { status: 201 });
  });
};

const createPUTRoute = (item: TestStore | TestAutoIncrementStore) => {
  mf.mock("PUT@/api/update", async (req) => {
    const actualBody = await req.json();
    const expectedBody = item;

    assertEquals(actualBody, expectedBody);
    return new Response(JSON.stringify(item), { status: 200 });
  });
};

const createDELETERoute = (id: string | number) => {
  mf.mock("DELETE@/api/delete", (req) => {
    const actual = new URL(req.url).searchParams.get("id");
    const expected = id;

    assertEquals(actual, expected);
    return new Response(undefined, { status: 204 });
  });
};

const createGETRoute = (item: TestStore | TestAutoIncrementStore) => {
  mf.mock("GET@/api/read", (req) => {
    const url = new URL(req.url);
    const actual = url.searchParams.get("id");
    const expected = item.id;

    assertEquals(actual, expected);
    return new Response(JSON.stringify(item), { status: 200 });
  });
};

const createGETALLRoute = (items: TestStore[] | TestAutoIncrementStore[]) => {
  mf.mock("GET@/api/read_all", () => {
    return new Response(JSON.stringify(items), { status: 200 });
  });
};

const createRoutes = () => {
  mf.mock("POST@/api/create", async (req) => {
    const actualBody = await req.json();
    const expectedBody = { name: "test" };

    assertEquals(actualBody, expectedBody);
    return new Response(
      JSON.stringify({
        id: "TMP-1",
        name: "test",
        sync_action: "none",
        sync_state: "synced",
      }),
      { status: 201 },
    );
  });

  mf.mock("PUT@/api/update", async (req) => {
    const actualBody = await req.json();
    const expectedBody = { id: "1", name: "test" };

    assertEquals(actualBody, expectedBody);
    return new Response(
      JSON.stringify({
        id: "TMP-1",
        name: "test",
        sync_action: "none",
        sync_state: "synced",
      }),
      { status: 200 },
    );
  });

  mf.mock("DELETE@/api/delete", (req) => {
    const actual = new URL(req.url).searchParams.get("id");
    const expected = "TMP-1";

    assertEquals(actual, expected);
    return new Response(undefined, { status: 204 });
  });

  mf.mock("GET@/api/read", (req) => {
    const url = new URL(req.url);
    const actual = url.searchParams.get("id");
    const expected = "TMP-1";

    assertEquals(actual, expected);
    return new Response(
      JSON.stringify({
        id: "TMP-1",
        name: "test",
        sync_action: "none",
        sync_state: "synced",
      }),
      { status: 200 },
    );
  });

  mf.mock("GET@/api/read_all", () => {
    return new Response(
      JSON.stringify([
        {
          id: "TMP-1",
          name: "test",
          sync_action: "none",
          sync_state: "synced",
        },
        {
          id: "TMP-2",
          name: "test2",
          sync_action: "none",
          sync_state: "synced",
        },
      ]),
      { status: 200 },
    );
  });
};

const removeRoutes = () => {
  mf.remove("POST@/api/create");
  mf.remove("PUT@/api/update");
  mf.remove("DELETE@/api/delete");
  mf.remove("GET@/api/read");
  mf.remove("GET@/api/read_all");
};

const syncOptions = {
  url: "http://localhost",
};

Deno.test("SyncedDB.create online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();

  createPOSTRoute({ id: "TMP-1", name: "test" });

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const data: TestStore = { name: "test" };
  const result = await syncdb.create(data);
  assertEquals(result, {
    id: "TMP-1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  assertEquals(await getCount(db), 1, "should have 1 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.create offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const data: TestStore = { name: "test" };
  const result = await syncdb.create(data);

  assertEquals(result.id, "TMP-1", "id should be a temporary id");
  assertEquals(result, {
    id: "TMP-1",
    name: "test",
    sync_action: "create",
    sync_state: "unsynced",
  });

  assertEquals(await getCount(db), 1, "should have 1 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.create (test mode)", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();

  const syncdb = new SyncedDB<TestStore>(db, "test", {
    ...syncOptions,
    testRun: true,
  });
  const data: TestStore = { name: "test" };
  const result = await syncdb.create(data);
  assertEquals(result, {
    id: "TMP-1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  assertEquals(await getCount(db), 1, "should have 1 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.create with autoIncrement", async () => {
  (navigator as any).onLine = true;
  const db = await createDB({ autoIncrement: true });

  createPOSTRoute({
    // CAUTION! AutoIncrement Key is a number!
    id: 1,
    name: "test",
  });

  const syncdb = new SyncedDB<TestAutoIncrementStore>(db, "test", syncOptions);
  const data: TestAutoIncrementStore = { name: "test" };
  const result = await syncdb.create(data);

  assertEquals(result, {
    id: 1,
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  assertEquals(await getCount(db), 1, "should have 1 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.update online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();

  createPUTRoute({
    id: "1",
    name: "test",
  });

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const data: TestStore = { id: "1", name: "test" };
  const result = await syncdb.update(data);
  assertEquals(result, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  assertEquals(await getCount(db), 1, "should have 1 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.update offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();

  createPUTRoute({
    id: "1",
    name: "test",
  });

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);

  const data: TestStore = { id: "1", name: "test" };
  const result = await syncdb.update(data);
  assertEquals(result, {
    id: "1",
    name: "test",
    sync_action: "update",
    sync_state: "unsynced",
  });

  assertEquals(await getCount(db), 1, "should have 1 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.update online (test mode)", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();

  const syncdb = new SyncedDB<TestStore>(db, "test", {
    ...syncOptions,
    testRun: true,
  });
  const data: TestStore = { id: "1", name: "test" };
  const result = await syncdb.update(data);
  assertEquals(result, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  assertEquals(await getCount(db), 1, "should have 1 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.delete online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();

  createPOSTRoute({
    id: "TMP-1",
    name: "test",
  });

  createDELETERoute("TMP-1");

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);

  // create a record
  const item = await syncdb.create({ name: "test" });
  assertEquals(item, {
    id: "TMP-1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  // delete the record
  const result = await syncdb.delete("TMP-1");
  assertEquals(result, undefined);

  assertEquals(await getCount(db), 0, "should have 0 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.delete offline with ID", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();

  createPOSTRoute({
    id: "TMP-1",
    name: "test",
  });

  createDELETERoute("TMP-1");

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);

  // create a record
  const item = await syncdb.create({ name: "test" });
  const id = item.id;

  (navigator as any).onLine = false;

  // delete the record
  await syncdb.delete(id);

  const result = await syncdb.read(id);
  assertEquals(result, {
    id,
    name: "test",
    sync_action: "delete",
    sync_state: "unsynced",
  });

  assertEquals(await getCount(db), 1, "should have 1 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.delete offline with temporary ID", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();

  createPOSTRoute({
    id: "TMP-1",
    name: "test",
  });

  createDELETERoute("TMP-1");

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);

  // create a record
  const item = await syncdb.create({ name: "test" });
  const id = item.id;

  assert(id.startsWith("TMP-"), "id should be a temporary id");

  // delete the record
  await syncdb.delete(id);

  const result = await syncdb.read(id);
  assertEquals(result, undefined);

  assertEquals(await getCount(db), 0, "should have 0 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.delete online (test mode)", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();

  createPOSTRoute({
    id: "TMP-1",
    name: "test",
  });

  createDELETERoute("TMP-1");

  const syncdb = new SyncedDB<TestStore>(db, "test", {
    ...syncOptions,
    testRun: true,
  });

  // create a record
  const item = await syncdb.create({ name: "test" });
  assertEquals(item, {
    id: "TMP-1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  // delete the record
  const result = await syncdb.delete("TMP-1");
  assertEquals(result, undefined);

  assertEquals(await getCount(db), 0, "should have 0 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.read online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);

  createGETRoute({
    id: "1",
    name: "test",
  });

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const item1 = await syncdb.read("1");
  assertEquals(item1, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  }, "item flagged as synced should be returned");

  assertEquals(await getCount(db), 4, "should have 4 items in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.read online/sync/update", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);

  createGETRoute({
    id: "2",
    name: "test2",
  });

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const item2 = await syncdb.read("2");
  assertEquals(item2, {
    id: "2",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  const item2Changed = await syncdb.read("2", true);
  assertEquals(item2Changed, {
    id: "2",
    name: "test2",
    sync_action: "none",
    sync_state: "synced",
  });

  assertEquals(await getCount(db), 4, "should have 4 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.read online/sync/delete", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);

  mf.mock("GET@/api/read", (req) => {
    const url = new URL(req.url);
    assertEquals(url.searchParams.get("id"), "3");
    return new Response(undefined, { status: 404 });
  });

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const item3 = await syncdb.read("3");
  assertEquals(item3, {
    id: "3",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  const item3Deleted = await syncdb.read("3", true);
  assertEquals(item3Deleted, undefined, "item must be deleted");
  assertEquals(await getCount(db), 3, "should have 3 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.read offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await fillDB(db);
  createRoutes();

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const item1 = await syncdb.read("1");
  assertEquals(item1, {
    id: "1",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });
  assertEquals(await getCount(db), 4, "should have 4 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.read offline/sync/update", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await fillDB(db);

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const item2 = await syncdb.read("2");
  assertEquals(item2, {
    id: "2",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  const itemNotChanged = await syncdb.read("2", true);
  assertEquals(itemNotChanged, {
    id: "2",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  }, "item must not be changed");
  assertEquals(await getCount(db), 4, "should have 4 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.read offline/sync/delete", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await fillDB(db);

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const item3 = await syncdb.read("3");
  assertEquals(item3, {
    id: "3",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  });

  const itemNotDeleted = await syncdb.read("3", true);
  assertEquals(itemNotDeleted, {
    id: "3",
    name: "test",
    sync_action: "none",
    sync_state: "synced",
  }, "item must not be deleted");
  assertEquals(await getCount(db), 4, "should have 4 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.readAll online", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);
  createRoutes();

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const items = await syncdb.readAll();
  assertEquals(items, [
    {
      id: "1",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "2",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "3",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "TMP-1",
      name: "test",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ], "all items flagged as synced should be returned");
  assertEquals(await getCount(db), 4, "should have 4 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.readAll online/sync", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await fillDB(db);

  createGETALLRoute([
    { id: "1", name: "test" },
    { id: "2", name: "test2" },
    { id: "TMP-1", name: "test" },
  ]);

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const items = await syncdb.readAll(true);
  assertEquals(items, [
    { id: "1", name: "test", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "none", sync_state: "synced" },
    // ID 3 is deleted
    // ID TMP-1 will be added to the server
    { id: "TMP-1", name: "test", sync_action: "none", sync_state: "synced" },
  ]);
  assertEquals(await getCount(db), 3, "should have 3 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.readAll offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await fillDB(db);
  createRoutes();

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  const items = await syncdb.readAll();
  assertEquals(items, [
    {
      id: "1",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "2",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "3",
      name: "test",
      sync_action: "none",
      sync_state: "synced",
    },
    {
      id: "TMP-1",
      name: "test",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);
  assertEquals(await getCount(db), 4, "should have 4 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

const createSyncItems = async (db: IDBDatabase) => {
  const store = idbx.getStore(db, "test", 'readwrite');
  await idbx.add(store, [
    // synced entry
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    // updated entry
    { id: "2", name: "test2", sync_action: "update", sync_state: "unsynced" },
    // deleted entry
    { id: "3", name: "test3", sync_action: "delete", sync_state: "unsynced" },
    // new entry
    {
      id: "TMP-1",
      name: "test4",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);
};

const createSyncMock = () => {
  mf.mock("POST@/api/sync", async (req) => {
    const body = await req.json();
    assertEquals(body, {
      create: [
        {
          id: "TMP-1",
          name: "test4",
          sync_action: "create",
          sync_state: "unsynced",
        },
      ],
      update: [
        {
          id: "2",
          name: "test2",
          sync_action: "update",
          sync_state: "unsynced",
        },
      ],
      delete: [
        {
          id: "3",
          name: "test3",
          sync_action: "delete",
          sync_state: "unsynced",
        },
      ],
    });
    return new Response(JSON.stringify({
      changed: [
        {
          id: "2",
          name: "test2",
          sync_action: "none",
          sync_state: "synced",
        },
        {
          id: "4",
          name: "test4",
          sync_action: "none",
          sync_state: "synced",
        },
      ],
      deleted: ["3"],
      timestamp: "2023-01-01T00:00:00.000Z",
    }));
  });
};

Deno.test("SyncedDB.sync()", async () => {
  (navigator as any).onLine = true;
  const db = await createDB();
  await createSyncItems(db);
  createSyncMock();

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  await syncdb.sync();

  const items = await syncdb.readAll();
  assertEquals(items, [
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "none", sync_state: "synced" },
    { id: "4", name: "test4", sync_action: "none", sync_state: "synced" },
  ]);
  assertEquals(await getCount(db), 3, "should have 3 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB.sync() offline", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await createSyncItems(db);
  createSyncMock();

  const syncdb = new SyncedDB<TestStore>(db, "test", syncOptions);
  await syncdb.sync();

  const items = await syncdb.readAll();
  assertEquals(items, [
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "update", sync_state: "unsynced" },
    { id: "3", name: "test3", sync_action: "delete", sync_state: "unsynced" },
    {
      id: "TMP-1",
      name: "test4",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);
  assertEquals(await getCount(db), 4, "should have 4 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});

Deno.test("SyncedDB AutoSync toggle from offline to online", async () => {
  (navigator as any).onLine = false;
  const db = await createDB();
  await createSyncItems(db);
  createSyncMock();

  const syncdb = new SyncedDB<TestStore>(db, "test", {
    ...syncOptions,
    autoSync: true,
  });

  const items = await syncdb.readAll();
  assertEquals(items, [
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "update", sync_state: "unsynced" },
    { id: "3", name: "test3", sync_action: "delete", sync_state: "unsynced" },
    {
      id: "TMP-1",
      name: "test4",
      sync_action: "create",
      sync_state: "unsynced",
    },
  ]);
  assertEquals(await getCount(db), 4, "should have 4 item in the db");

  (navigator as any).onLine = true;
  globalThis.dispatchEvent(new Event("online"));

  const state = await syncdb.syncState;
  assertEquals(state, "synced");

  const items2 = await syncdb.readAll();
  assertEquals(items2, [
    { id: "1", name: "test1", sync_action: "none", sync_state: "synced" },
    { id: "2", name: "test2", sync_action: "none", sync_state: "synced" },
    { id: "4", name: "test4", sync_action: "none", sync_state: "synced" },
  ]);
  assertEquals(await getCount(db), 3, "should have 3 item in the db");

  clearDB(db);
  removeRoutes();
  resetRandomUUID();
});
