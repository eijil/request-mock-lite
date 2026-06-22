#!/usr/bin/env node
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const indexPath = join(distDir, "index.html");
const serverEntryPath = ["entry-server.js", "entry-server.mjs"]
  .map((fileName) => join(distDir, "server", fileName))
  .find((filePath) => existsSync(filePath));

if (!existsSync(indexPath)) {
  throw new Error("dist/index.html was not found. Run the client build before prerendering.");
}

if (!serverEntryPath) {
  throw new Error("dist/server/entry-server.js or entry-server.mjs was not found. Run the SSR build before prerendering.");
}

const template = readFileSync(indexPath, "utf8");
const { render } = await import(pathToFileURL(serverEntryPath).href);
const appHtml = render();
const rootMarker = '<div id="root"></div>';

if (!template.includes(rootMarker)) {
  throw new Error("Could not find the empty #root marker in dist/index.html.");
}

writeFileSync(indexPath, template.replace(rootMarker, `<div id="root">${appHtml}</div>`));
rmSync(join(distDir, "server"), { recursive: true, force: true });

console.log("Prerendered landing HTML into dist/index.html");
