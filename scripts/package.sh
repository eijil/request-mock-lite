#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
OUT_DIR="$(CDPATH= cd -- "$ROOT_DIR/.." && pwd)"
# ZIP_PATH can be overridden (e.g. in CI) to write inside the workspace.
ZIP_PATH="${ZIP_PATH:-$OUT_DIR/request-mock-lite.zip}"

rm -f "$ZIP_PATH"
cd "$ROOT_DIR"
if [ -f package.json ]; then
  npm run build:vendor >/dev/null
fi
cd "$OUT_DIR"
zip -qr "$ZIP_PATH" \
  request-mock-lite/manifest.json \
  request-mock-lite/icons \
  request-mock-lite/src/background.js \
  request-mock-lite/src/content-bridge.js \
  request-mock-lite/src/devtools.html \
  request-mock-lite/src/devtools.js \
  request-mock-lite/src/injected.js \
  request-mock-lite/src/panel.css \
  request-mock-lite/src/panel.html \
  request-mock-lite/src/panel.js \
  request-mock-lite/src/vendor

echo "$ZIP_PATH"
