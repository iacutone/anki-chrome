# New Tab Anki Review

A cross-browser extension (Manifest V3, **Chrome + Firefox**) that turns every
new tab into an Anki review session. It connects to your local **Anki Desktop**
through the **AnkiConnect** add-on, shows your due cards, and schedules them
using Anki's real scheduler — so all reviews stay in sync with your collection.

Inspired by [New Tab Review (Anki)](https://chromewebstore.google.com/detail/new-tab-review-anki/kjpflfnnkcllmebifigcenjpnccoojof).

## Features

- **Real Anki sync** — reviews go through AnkiConnect, so your scheduling stays correct.
- **Review on every new tab** — see a due card each time you open a tab.
- **Hotkeys** like Anki:
  - `Space` / `Enter` → show answer, then rate **Good**
  - `1` Again · `2` Hard · `3` Good · `4` Easy
- **Media support** — images and `[sound:…]` audio are inlined and playable in the browser.
- **Pick one or more decks & session size** in the options page (or review all decks).
- **Skip when nothing is due** — optionally redirect to any URL (e.g. Google).
- **Dark / light** UI that follows your system theme.

## Requirements

1. [Anki Desktop](https://apps.ankiweb.net/) installed and **running**.
2. The **AnkiConnect** add-on (add-on code `2055492159`):
   - In Anki: `Tools → Add-ons → Get Add-ons…`, paste `2055492159`, restart Anki.

## Build

The same source builds packages for both browsers:

```bash
./tools/build.sh
# -> dist/chrome.zip   (uses manifest.json)
# -> dist/firefox.zip  (uses manifest.firefox.json)
```

The only browser-specific file is the manifest. `manifest.json` targets Chrome;
`manifest.firefox.json` adds Firefox's required `browser_specific_settings.gecko`
ID (needed for `storage.sync`), a `strict_min_version` of `127.0` (so host
permissions are granted at install), and uses `options_ui` instead of
`options_page`. A small shim (`browser-api.js`) maps `browser`/`chrome` so the
shared JS gets promise-based APIs on both engines.

## Install (unpacked)

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Open a new tab — you'll be guided through setup if Anki isn't reachable yet.

### Firefox

Temporary load (cleared when Firefox closes):

1. Run `./tools/build.sh`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `dist/firefox.zip` (or
   `manifest.firefox.json` directly).
4. Open a new tab.

Requires **Firefox 127+** so the localhost host permission is granted at install.

## Allow the extension in AnkiConnect (one-time)

AnkiConnect only answers requests from origins on its allow-list. Add this
extension's origin:

1. Find the extension's origin — it's shown on the new-tab error screen and at
   the bottom of the options page. It looks like
   `chrome-extension://YOUR_ID` (Chrome) or `moz-extension://YOUR_UUID` (Firefox).
2. In Anki: `Tools → Add-ons → AnkiConnect → Config`.
3. Add the extension origin to `webCorsOriginList`, for example:

   ```json
   {
     "webCorsOriginList": [
       "http://localhost",
       "chrome-extension://YOUR_ID",
       "moz-extension://YOUR_UUID"
     ]
   }
   ```

4. Restart Anki.

## Options

Open the options page (right-click the extension icon → **Options**, or the gear
icon on the new-tab page):

- **Decks** — check one or more decks to pull cards from. Select none to review **all decks**. Use the **All** / **None** buttons to toggle quickly.
- **Cards per new tab** — how many due cards to queue per tab (`0` = unlimited).
- **Include new cards** — include not-yet-learned cards.
- **Auto-play audio** — play the first audio clip automatically.
- **Redirect URL** — where to send the tab when nothing is due.
- **AnkiConnect API key** — only if you've set one in AnkiConnect's config.

## Project structure

```
manifest.json        Chrome manifest (MV3, new-tab override)
manifest.firefox.json Firefox manifest (MV3 + gecko settings)
newtab.html/css/js   The new-tab review UI
options.html/css/js  Settings page
anki.js              AnkiConnect client + media inlining
settings.js          Shared storage settings helpers
browser-api.js       Cross-browser (chrome/browser) API shim
icons/               Generated PNG icons
tools/build.sh       Builds dist/chrome.zip and dist/firefox.zip
tools/gen_icons.py   Regenerates the icons (stdlib only)
```

## Publishing

- **Chrome Web Store:** upload `dist/chrome.zip` in the
  [Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time
  $5 registration). New-tab overrides get extra review scrutiny, so clearly
  explain the override and the AnkiConnect/localhost requirement in the listing.
- **Firefox Add-ons (AMO):** upload `dist/firefox.zip` at
  [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) (free).
  Keep the `gecko.id` stable across releases. AMO signs the package; you can also
  self-distribute the signed `.xpi`.

## Notes & limitations

- Cards are pulled with a query like `(deck:"A" OR deck:"B") (is:due OR is:new)`
  and reviewed via AnkiConnect's `answerCards`, which applies Anki's normal
  scheduling. Ordering is by card id rather than Anki's exact in-app queue order.
- The extension talks to `http://127.0.0.1:8765` only; nothing leaves your machine.
- Anki Desktop must be open for cards to load.
