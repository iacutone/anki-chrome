import {
  deckNames,
  findDueCards,
  cardsInfo,
  answerCard,
  inlineMedia,
  AnkiError,
} from "./anki.js";
import { loadSettings } from "./settings.js";

const els = {
  views: {
    loading: document.getElementById("view-loading"),
    review: document.getElementById("view-review"),
    done: document.getElementById("view-done"),
    error: document.getElementById("view-error"),
  },
  deckLabel: document.getElementById("deck-label"),
  progress: document.getElementById("progress"),
  cardHost: document.getElementById("card-host"),
  controlsFront: document.getElementById("controls-front"),
  controlsBack: document.getElementById("controls-back"),
  showAnswer: document.getElementById("show-answer"),
  settingsBtn: document.getElementById("settings-btn"),
  reloadBtn: document.getElementById("reload-btn"),
  openOptionsBtn: document.getElementById("open-options-btn"),
  retryBtn: document.getElementById("retry-btn"),
  errorOptionsBtn: document.getElementById("error-options-btn"),
  errorTitle: document.getElementById("error-title"),
  errorMessage: document.getElementById("error-message"),
  errorHelp: document.getElementById("error-help"),
};

const state = {
  settings: null,
  queue: [],
  index: 0,
  current: null, // { info, cardShadow }
  showingAnswer: false,
  grading: false,
  total: 0,
};

let shadowRoot = null;

function showView(name) {
  for (const [key, el] of Object.entries(els.views)) {
    el.classList.toggle("hidden", key !== name);
  }
}

function openOptions() {
  if (chrome?.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.location.href = chrome.runtime.getURL("options.html");
  }
}

function ensureShadow() {
  if (!shadowRoot) shadowRoot = els.cardHost.attachShadow({ mode: "open" });
  return shadowRoot;
}

function renderCardSide(html, css) {
  const root = ensureShadow();
  root.innerHTML = `<style>${css || ""}</style>` +
    `<div class="card">${html}</div>`;
}

function updateProgress() {
  const done = state.index;
  els.progress.textContent = state.total ? `${done} / ${state.total}` : "";
}

async function showFront() {
  state.showingAnswer = false;
  const info = state.current.info;
  const { html } = await inlineMedia(info.question, state.settings.apiKey);
  renderCardSide(html, info.css);
  els.controlsFront.classList.remove("hidden");
  els.controlsBack.classList.add("hidden");
  maybeAutoplay();
}

async function showBack() {
  state.showingAnswer = true;
  const info = state.current.info;
  const { html } = await inlineMedia(info.answer, state.settings.apiKey);
  renderCardSide(html, info.css);
  els.controlsFront.classList.add("hidden");
  els.controlsBack.classList.remove("hidden");
  maybeAutoplay();
}

function maybeAutoplay() {
  if (!state.settings.autoPlayAudio || !shadowRoot) return;
  const audio = shadowRoot.querySelector("audio.anki-audio");
  if (audio) audio.play().catch(() => {});
}

async function loadCurrentCard() {
  if (state.index >= state.queue.length) {
    showView("done");
    updateProgress();
    return;
  }
  showView("review");
  updateProgress();
  const cardId = state.queue[state.index];
  const infos = await cardsInfo([cardId], state.settings.apiKey);
  if (!infos || !infos.length) {
    // Card vanished (e.g. suspended); skip it.
    state.index += 1;
    return loadCurrentCard();
  }
  state.current = { info: infos[0] };
  await showFront();
}

async function grade(ease) {
  if (!state.showingAnswer || !state.current || state.grading) return;
  const cardId = state.current.info.cardId;
  state.grading = true;
  try {
    // `answered` is false only when Anki no longer has the card; either way we
    // move on so the user isn't stuck on a card that can't be graded.
    await answerCard(cardId, ease, state.settings.apiKey);
  } catch (err) {
    state.grading = false;
    return handleError(err);
  }
  state.grading = false;
  state.index += 1;
  state.current = null;
  await loadCurrentCard();
}

async function start() {
  showView("loading");
  state.index = 0;
  state.queue = [];
  state.current = null;
  state.grading = false;

  state.settings = await loadSettings();

  try {
    const decks = await deckNames(state.settings.apiKey);
    if (!decks || decks.length === 0) {
      return showSetup(
        "No decks found",
        "Your Anki collection has no decks. Create one in Anki, then try again."
      );
    }

    // Keep only configured decks that still exist; empty => all decks.
    let selected = (state.settings.deckNames || []).filter((d) =>
      decks.includes(d)
    );

    if (selected.length === 0) {
      els.deckLabel.textContent = "All decks";
    } else if (selected.length === 1) {
      els.deckLabel.textContent = selected[0];
    } else {
      els.deckLabel.textContent = `${selected.length} decks`;
      els.deckLabel.title = selected.join(", ");
    }

    state.queue = await findDueCards(
      selected,
      state.settings.sessionSize,
      state.settings.includeNew,
      state.settings.apiKey
    );
    state.total = state.queue.length;

    if (state.queue.length === 0) {
      if (state.settings.skipUrl) {
        window.location.replace(state.settings.skipUrl);
        return;
      }
      showView("done");
      updateProgress();
      return;
    }

    await loadCurrentCard();
  } catch (err) {
    handleError(err);
  }
}

function showSetup(title, message, helpHtml) {
  els.errorTitle.textContent = title;
  els.errorMessage.textContent = message;
  if (helpHtml) {
    els.errorHelp.innerHTML = helpHtml;
    els.errorHelp.classList.remove("hidden");
  } else {
    els.errorHelp.classList.add("hidden");
  }
  showView("error");
}

function handleError(err) {
  console.error(err);
  if (err instanceof AnkiError && err.kind === "cors") {
    const origin = `chrome-extension://${chrome.runtime.id}`;
    showSetup(
      "Allow this extension in AnkiConnect",
      "AnkiConnect blocked the request. Add this extension to its allowed origins:",
      `<ol>
        <li>In Anki: <code>Tools &rarr; Add-ons &rarr; AnkiConnect &rarr; Config</code></li>
        <li>Add <code>${origin}</code> to <code>webCorsOriginList</code>.</li>
        <li>Restart Anki, then click Retry.</li>
      </ol>
      <p style="margin:10px 0 0">Example config:</p>
      <code>"webCorsOriginList": ["http://localhost", "${origin}"]</code>`
    );
    return;
  }
  if (err instanceof AnkiError && err.kind === "unsupported") {
    showSetup(
      "Update AnkiConnect to grade cards",
      "Your installed AnkiConnect is too old to record answers. The action used to grade cards (answerCards) was added to AnkiConnect in 2023.",
      `<ol>
        <li>In Anki: <code>Tools &rarr; Add-ons</code>.</li>
        <li>Select <strong>AnkiConnect</strong>, then click <strong>Check for Updates</strong> (or remove it and re-add code <code>2055492159</code>).</li>
        <li>Restart Anki, reopen this tab, and try again.</li>
      </ol>`
    );
    return;
  }
  if (err instanceof AnkiError && err.kind === "connection") {
    showSetup(
      "Can't connect to Anki",
      err.message,
      `<ol>
        <li>Open <strong>Anki Desktop</strong> and keep it running.</li>
        <li>Install the <strong>AnkiConnect</strong> add-on (code <code>2055492159</code>).</li>
        <li>Restart Anki, then click Retry.</li>
      </ol>`
    );
    return;
  }
  showSetup("Something went wrong", err.message || String(err));
}

// --- Events ---
els.showAnswer.addEventListener("click", () => showBack());
els.controlsBack.addEventListener("click", (e) => {
  const btn = e.target.closest(".grade");
  if (btn) grade(Number(btn.dataset.ease));
});
els.settingsBtn.addEventListener("click", openOptions);
els.openOptionsBtn.addEventListener("click", openOptions);
els.errorOptionsBtn.addEventListener("click", openOptions);
els.reloadBtn.addEventListener("click", start);
els.retryBtn.addEventListener("click", start);

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (!els.views.review.classList.contains("hidden")) {
    if (!state.showingAnswer) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        showBack();
      }
    } else {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        grade(3); // Good
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key));
      }
    }
  }
});

start();
