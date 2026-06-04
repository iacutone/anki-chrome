// Shared settings storage helpers.

export const DEFAULTS = {
  deckNames: [],       // decks to review; empty => all decks
  sessionSize: 20,     // max cards per new tab batch (0 = unlimited)
  includeNew: true,    // include new (not-yet-learned) cards
  skipUrl: "",         // redirect here when nothing is due (empty = stay)
  autoPlayAudio: true, // auto-play first audio on a card side
  apiKey: "",          // AnkiConnect API key, if configured
};

export async function loadSettings() {
  const stored = await chrome.storage.sync.get(null);
  const settings = { ...DEFAULTS, ...stored };

  // Migrate legacy single-deck setting (deckName -> deckNames).
  if (!Array.isArray(settings.deckNames)) settings.deckNames = [];
  if (
    settings.deckNames.length === 0 &&
    typeof stored.deckName === "string" &&
    stored.deckName
  ) {
    settings.deckNames = [stored.deckName];
  }
  delete settings.deckName;

  return settings;
}

export async function saveSettings(partial) {
  await chrome.storage.sync.set(partial);
  // Drop the legacy key so it doesn't shadow the new one.
  if ("deckNames" in partial) {
    await chrome.storage.sync.remove("deckName");
  }
}
