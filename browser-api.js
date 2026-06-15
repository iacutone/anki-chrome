// Cross-browser WebExtension API handle.
//
// Firefox exposes a promise-based `browser` namespace; Chrome exposes `chrome`
// (which also returns promises under Manifest V3). Preferring `browser` when it
// exists gives us promise-based APIs on both engines, so the same `await`-style
// code works everywhere.
export const ext = globalThis.browser ?? globalThis.chrome;
