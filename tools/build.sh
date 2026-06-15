#!/usr/bin/env bash
# Build distributable zips for Chrome and Firefox from the shared source.
#
#   ./tools/build.sh
#
# Outputs:
#   dist/chrome.zip   (uses manifest.json)
#   dist/firefox.zip  (uses manifest.firefox.json, renamed to manifest.json)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

SHARED=(
  newtab.html newtab.css newtab.js
  options.html options.css options.js
  anki.js settings.js browser-api.js
  icons
)

rm -rf dist build
mkdir -p dist

# --- Chrome (Manifest V3, manifest.json as-is) ---
zip -rq dist/chrome.zip manifest.json "${SHARED[@]}" -x "*/.*"
echo "Built dist/chrome.zip"

# --- Firefox (Manifest V3 + gecko settings) ---
mkdir -p build/firefox
cp -R "${SHARED[@]}" build/firefox/
cp manifest.firefox.json build/firefox/manifest.json
( cd build/firefox && zip -rq "$ROOT/dist/firefox.zip" . -x "*/.*" )
echo "Built dist/firefox.zip"

rm -rf build
echo "Done."
