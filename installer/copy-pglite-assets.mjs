/**
 * Nitro's node-server bundle loads PGLite with new URL("./pglite.wasm", import.meta.url).
 * Those files live in the package dist and are not copied into .output, so a
 * standalone server cannot open its database without them. Pinokio's dev server
 * resolves them from node_modules and does not need this step.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app");
const srcDir = path.join(appDir, "node_modules/@electric-sql/pglite/dist");
const destDir = path.join(appDir, ".output/server/_libs");
const files = ["pglite.wasm", "initdb.wasm", "pglite.data"];

if (!fs.existsSync(destDir)) {
  console.error("Missing production build. Run with DRIVEBAY_STANDALONE=1 npm run build in app/.");
  process.exit(1);
}

for (const name of files) {
  const src = path.join(srcDir, name);
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(destDir, name));
  console.log(`copied ${name}`);
}
