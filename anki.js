// Lightweight AnkiConnect client + media helpers.
// AnkiConnect listens on http://127.0.0.1:8765 when Anki Desktop is running.

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;

/**
 * Invoke an AnkiConnect action.
 * @param {string} action
 * @param {object} [params]
 * @param {string|null} [key] optional AnkiConnect API key
 * @returns {Promise<any>}
 */
export async function invoke(action, params = {}, key = null) {
  const body = { action, version: ANKI_CONNECT_VERSION, params };
  if (key) body.key = key;

  let response;
  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AnkiError(
      "Could not reach AnkiConnect. Make sure Anki Desktop is open and AnkiConnect is installed.",
      "connection"
    );
  }

  if (response.status === 403) {
    throw new AnkiError(
      "AnkiConnect refused this extension (403). Add this extension's origin to AnkiConnect's webCorsOriginList.",
      "cors"
    );
  }

  if (!response.ok) {
    throw new AnkiError(`AnkiConnect returned HTTP ${response.status}.`, "http");
  }

  const data = await response.json();
  if (data.error) {
    const kind = /unsupported action/i.test(data.error) ? "unsupported" : "anki";
    throw new AnkiError(data.error, kind);
  }
  return data.result;
}

export class AnkiError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = "AnkiError";
    this.kind = kind;
  }
}

/** Returns the list of deck names. */
export function deckNames(key) {
  return invoke("deckNames", {}, key);
}

/**
 * Find due/new card ids across one or more decks, respecting an optional limit.
 * @param {string[]} deckNamesList decks to search; empty => all decks
 */
export async function findDueCards(deckNamesList, limit, includeNew, key) {
  let deckClause = "";
  if (Array.isArray(deckNamesList) && deckNamesList.length > 0) {
    const parts = deckNamesList.map((d) => `deck:"${d.replace(/"/g, '\\"')}"`);
    deckClause = parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;
  }
  const statusClause = includeNew ? "(is:due OR is:new)" : "is:due";
  const query = deckClause ? `${deckClause} ${statusClause}` : statusClause;

  let ids = await invoke("findCards", { query }, key);
  if (!Array.isArray(ids)) ids = [];
  if (typeof limit === "number" && limit > 0) ids = ids.slice(0, limit);
  return ids;
}

/** Get rendered info for the given card ids. */
export function cardsInfo(cardIds, key) {
  return invoke("cardsInfo", { cards: cardIds }, key);
}

/**
 * Answer a card with the given ease (1=Again, 2=Hard, 3=Good, 4=Easy).
 * Uses AnkiConnect's headless scheduler so the Anki GUI need not be open.
 * Requires AnkiConnect with the `answerCards` action (added June 2023).
 * @returns {Promise<boolean>} true if the card was answered, false if not found
 */
export async function answerCard(cardId, ease, key) {
  const result = await invoke("answerCards", { answers: [{ cardId, ease }] }, key);
  return Array.isArray(result) ? result[0] !== false : Boolean(result);
}

/** Retrieve a media file as base64, or null if missing. */
export async function retrieveMediaFile(filename, key) {
  try {
    const result = await invoke("retrieveMediaFile", { filename }, key);
    return result || null;
  } catch {
    return null;
  }
}

const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
};

function mimeFor(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

/**
 * Take an Anki-rendered HTML fragment and inline its media as data URIs so it
 * renders inside the browser (which has no access to Anki's media folder).
 * - <img src="local.png"> -> data URI
 * - [sound:foo.mp3] -> <audio controls> with data URI
 * Returns { html, audioSources } where audioSources can be auto-played.
 */
export async function inlineMedia(html, key) {
  const audioSources = [];
  const container = document.createElement("div");
  container.innerHTML = html;

  // Inline <img>, <audio>, <video>, <source> referencing local media.
  const mediaEls = container.querySelectorAll("img, audio, video, source");
  await Promise.all(
    Array.from(mediaEls).map(async (el) => {
      const src = el.getAttribute("src");
      if (!src || /^(https?:|data:)/i.test(src)) return;
      const filename = src.split(/[?#]/)[0].split("/").pop();
      const b64 = await retrieveMediaFile(filename, key);
      if (b64) el.setAttribute("src", `data:${mimeFor(filename)};base64,${b64}`);
    })
  );

  // Replace [sound:filename] tokens with <audio> elements.
  let working = container.innerHTML;
  const soundRe = /\[sound:([^\]]+)\]/g;
  const matches = [...working.matchAll(soundRe)];
  for (const m of matches) {
    const filename = m[1].trim();
    const b64 = await retrieveMediaFile(filename, key);
    if (b64) {
      const dataUri = `data:${mimeFor(filename)};base64,${b64}`;
      audioSources.push(dataUri);
      working = working.replace(
        m[0],
        `<audio class="anki-audio" controls preload="auto" src="${dataUri}"></audio>`
      );
    } else {
      working = working.replace(m[0], "");
    }
  }

  return { html: working, audioSources };
}
