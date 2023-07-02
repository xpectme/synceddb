import { build } from "esbuild";

// build for node
build({
  entryPoints: ["main.ts"],
  outfile: "dest/synceddb.js",
  bundle: true,
  sourcemap: true,
  minify: true,
  format: "esm",
  platform: "node",
  external: ["npm:idbx", "npm:idbatch"],
}).catch(() => process.exit(1));
