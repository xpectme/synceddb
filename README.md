<div align="center" id="top"> 
  <img src="./.github/app.gif" alt="Synceddb" />

  &#xa0;

  <!-- <a href="https://synceddb.netlify.app">Demo</a> -->
</div>

<h1 align="center">Synceddb</h1>

<p align="center">
  <img alt="Github top language" src="https://img.shields.io/github/languages/top/xpectme/synceddb?color=56BEB8">

  <img alt="Github language count" src="https://img.shields.io/github/languages/count/xpectme/synceddb?color=56BEB8">

  <img alt="Repository size" src="https://img.shields.io/github/repo-size/xpectme/synceddb?color=56BEB8">

  <img alt="License" src="https://img.shields.io/github/license/xpectme/synceddb?color=56BEB8">
</p>

<hr>

<p align="center">
  <a href="#dart-about">About</a> &#xa0; | &#xa0; 
  <a href="#rocket-technologies">Technologies</a> &#xa0; | &#xa0;
  <a href="#white_check_mark-requirements">Requirements</a> &#xa0; | &#xa0;
  <a href="#checkered_flag-starting">Getting started</a> &#xa0; | &#xa0;
  <a href="#memo-license">License</a> &#xa0; | &#xa0;
  <a href="https://github.com/xpectme" target="_blank">Author</a>
</p>

<br>

## About ##

Client-side CRUD operations between indexedDB and a server.

## Technologies ##

The following tools were used in this project:

- [idbx](https://github.com/xpectme/idbx) - an indexedDB wrapper

## Getting started ##

```ts
import * as idbx from "https://deno.land/x/idbx/main.ts";
import { SyncedDB } from "https://deno.land/x/synceddb/main.ts";

// create a database
const dbreq = idbx.open('my-database', 1);

// create a store
dbreq.upgrade((event) => {
  const target = event.target as IDBOpenDBRequest;
  const db = target.result;
  SyncedDB.createStore(db, "mystore");
});

// wait for DB to initialize
const db = await dbreq.ready;

// create a synceddb instance
const syncdb = new SyncedDB(db, "mystore", {
keyName: "id",
  // Default Settings:
  
  // url: location.origin,
  // autoSync: false,
  // createPath: "/api/create",
  // readPath: "/api/read",
  // updatePath: "/api/update",
  // deletePath: "/api/delete",
  // readAllPath: "/api/read_all",
  // syncPath: "/api/sync",
});

const result = await syncdb.create({
  title: "Awesome!",
  description: "Probably a reinvention of the wheel ;-P"
});
// case 1 (online): writes entry into the indexedDB store and send the entry to the server
//                  sync_action: "none", sync_status: "synced"
// case 2 (offline): writes entry into the indexedDB store and creates a temporary ID
//                  sync_action: "create", sync_status: "unsynced"
```

## License ##

This project is under license from MIT. For more details, see the [LICENSE](LICENSE) file.


Made by <a href="https://github.com/mstoecklein" target="_blank">Mario Stöcklein</a>

&#xa0;

<a href="#top">Back to top</a>
