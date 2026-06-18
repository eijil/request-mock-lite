#!/usr/bin/env node
// Keep manifest.json's version in sync with package.json (single source of truth).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const manifestPath = join(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.version === pkg.version) {
  console.log(`manifest.json already at ${pkg.version}`);
} else {
  manifest.version = pkg.version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Synced manifest.json version -> ${pkg.version}`);
}
