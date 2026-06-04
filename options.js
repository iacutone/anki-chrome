import { deckNames, AnkiError } from "./anki.js";
import { DEFAULTS, loadSettings, saveSettings } from "./settings.js";

const els = {
  deckList: document.getElementById("deck-list"),
  refreshDecks: document.getElementById("refresh-decks"),
  selectAll: document.getElementById("select-all"),
  selectNone: document.getElementById("select-none"),
  sessionSize: document.getElementById("sessionSize"),
  includeNew: document.getElementById("includeNew"),
  autoPlayAudio: document.getElementById("autoPlayAudio"),
  skipUrl: document.getElementById("skipUrl"),
  apiKey: document.getElementById("apiKey"),
  save: document.getElementById("save"),
  status: document.getElementById("status"),
  extOrigin: document.getElementById("ext-origin"),
};

let settings = { ...DEFAULTS };

function showStatus(message, kind = "ok") {
  els.status.textContent = message;
  els.status.className = `status ${kind}`;
  els.status.classList.remove("hidden");
  if (kind === "ok") {
    setTimeout(() => els.status.classList.add("hidden"), 2500);
  }
}

function renderDeckList(decks, selected) {
  els.deckList.innerHTML = "";
  if (!decks.length) {
    const empty = document.createElement("div");
    empty.className = "deck-empty";
    empty.textContent = "No decks found. Open Anki, then click Refresh.";
    els.deckList.appendChild(empty);
    return;
  }
  const selectedSet = new Set(selected);
  for (const name of decks) {
    const item = document.createElement("label");
    item.className = "deck-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = name;
    cb.checked = selectedSet.has(name);

    const span = document.createElement("span");
    span.textContent = name;

    item.append(cb, span);
    els.deckList.appendChild(item);
  }
}

function getCheckedDecks() {
  return Array.from(els.deckList.querySelectorAll("input:checked")).map(
    (cb) => cb.value
  );
}

function setAllChecked(checked) {
  els.deckList
    .querySelectorAll("input[type=checkbox]")
    .forEach((cb) => (cb.checked = checked));
}

async function refreshDecks() {
  try {
    const decks = await deckNames(settings.apiKey || els.apiKey.value.trim());
    decks.sort((a, b) => a.localeCompare(b));
    // Preserve any in-progress selection across a refresh.
    const current = getCheckedDecks();
    const selection = current.length ? current : settings.deckNames;
    renderDeckList(decks, selection);
  } catch (err) {
    renderDeckList([], []);
    if (err instanceof AnkiError && err.kind === "cors") {
      showStatus(
        "AnkiConnect blocked this extension. Add the origin below to webCorsOriginList.",
        "err"
      );
    } else {
      showStatus(
        "Couldn't reach Anki. Open Anki Desktop with AnkiConnect, then click Refresh.",
        "err"
      );
    }
  }
}

function fillForm() {
  els.sessionSize.value = settings.sessionSize;
  els.includeNew.checked = settings.includeNew;
  els.autoPlayAudio.checked = settings.autoPlayAudio;
  els.skipUrl.value = settings.skipUrl;
  els.apiKey.value = settings.apiKey;
}

async function save() {
  const partial = {
    deckNames: getCheckedDecks(),
    sessionSize: Math.max(0, parseInt(els.sessionSize.value, 10) || 0),
    includeNew: els.includeNew.checked,
    autoPlayAudio: els.autoPlayAudio.checked,
    skipUrl: els.skipUrl.value.trim(),
    apiKey: els.apiKey.value.trim(),
  };
  await saveSettings(partial);
  settings = { ...settings, ...partial };
  const count = partial.deckNames.length;
  showStatus(
    count === 0
      ? "Settings saved. Reviewing all decks."
      : `Settings saved. Reviewing ${count} deck${count > 1 ? "s" : ""}.`
  );
}

async function init() {
  els.extOrigin.textContent = `chrome-extension://${chrome.runtime.id}`;
  settings = await loadSettings();
  fillForm();
  await refreshDecks();

  els.refreshDecks.addEventListener("click", refreshDecks);
  els.selectAll.addEventListener("click", () => setAllChecked(true));
  els.selectNone.addEventListener("click", () => setAllChecked(false));
  els.save.addEventListener("click", save);
}

init();
