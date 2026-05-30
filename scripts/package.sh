#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
OUT_DIR="$(CDPATH= cd -- "$ROOT_DIR/.." && pwd)"
ZIP_PATH="$OUT_DIR/request-mock-lite.zip"

rm -f "$ZIP_PATH"
cd "$OUT_DIR"
zip -qr "$ZIP_PATH" \
  request-mock-lite/manifest.json \
  request-mock-lite/icons \
  request-mock-lite/src

echo "$ZIP_PATH"
