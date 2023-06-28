import { build } from "esbuild";

// build for browser
build({
  entryPoints: ["main.ts"],
  outfile: "dest/synceddb.browser.js",
  bundle: true,
  sourcemap: true,
  minify: true,
  format: "esm",
  external: ["idbx"],
}).catch(() => process.exit(1));

// build for node
build({
  entryPoints: ["main.ts"],
  outfile: "dest/synceddb.esm.js",
  bundle: true,
  sourcemap: true,
  minify: true,
  format: "esm",
  platform: "node",
  external: ["idbx"],
}).catch(() => process.exit(1));
