// PvP Tracker's own sounds: a sound file the player chose for a kill, an
// assist, a spree or a death, played instead of the built-in notes. Which one
// an event plays, and how a file is kept in the plugin's storage (each value
// there is at most 1 MB, so a file is kept in pieces). No page code here, so
// it can be tried on its own.
globalThis.KdaSounds = (() => {
  const SLOTS = ["kill", "assist", "spree", "death"];
  const MAX_BYTES = 4 * 1024 * 1024;
  // Base64 characters per stored piece: well under the 1 MB a value may be.
  const PIECE = 750_000;
  const SPREE_MIN = 2;
  const SPREE_MAX = 10;
  const SPREE_DEFAULT = 6;

  // The sound an event plays: one of SLOTS, or null for the built-in notes.
  // A kill with the streak at or past `spreeAt` plays the spree sound when
  // there is one (else the kill sound); an assist and a death their own.
  function slotFor(kind, streak, spreeAt, has) {
    if (kind === "kill") {
      if (has.spree && streak >= spreeAt) return "spree";
      return has.kill ? "kill" : null;
    }
    if (kind === "assist" || kind === "death") return has[kind] ? kind : null;
    return null;
  }

  const spreeAt = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(SPREE_MAX, Math.max(SPREE_MIN, n)) : SPREE_DEFAULT;
  };

  function toBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromBase64(text) {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const pieces = (text) => {
    const out = [];
    for (let i = 0; i < text.length; i += PIECE) out.push(text.slice(i, i + PIECE));
    return out.length ? out : [""];
  };

  // Storage keys: the file's details, and its pieces.
  const metaKey = (slot) => `clip-${slot}`;
  const pieceKey = (slot, i) => `clip-${slot}-${i}`;
  // Pieces a file of MAX_BYTES needs, so clearing a slot clears them all.
  const MAX_PIECES = Math.ceil(Math.ceil(MAX_BYTES / 3) * 4 / PIECE);

  // A file's name as shown: no folder, at most 40 characters.
  const shortName = (name) => {
    const base = String(name || "").split(/[\\/]/).pop() || "?";
    return base.length > 40 ? `${base.slice(0, 37)}…` : base;
  };

  return { SLOTS, MAX_BYTES, MAX_PIECES, SPREE_MIN, SPREE_MAX, SPREE_DEFAULT, slotFor, spreeAt, toBase64, fromBase64, pieces, metaKey, pieceKey, shortName };
})();
