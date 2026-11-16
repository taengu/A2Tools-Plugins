// A pinned timer's icon (pins.js sends it what to show every second). It
// follows the pointer when dragged, unless the pins are locked; a
// double-click opens the plugin's window.
//
// In anchor mode the anchor's widget is the whole grid (anchor.js sends it
// { kind: "grid", cells, ... }): the anchor's grip in the corner the grid
// grows from, and each icon drawn in its place, the same way as a single one.
const single = document.querySelector(".pin");
let locked = false;
let gridBox = null;
let listBox = null;

// Two letters for the badge: the first of each of the first two words, or the
// first two of one word ("Shugo" is "SH", "Kaira the Watcher" is "KT").
const initials = (name) => {
  const words = String(name || "").split(/[\s·:,-]+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length > 1 ? [...words[0]][0] + [...words[words.length - 1]][0] : [...words[0]].slice(0, 2).join("");
  return letters.toUpperCase();
};

// An icon's parts, made like widget.html's own.
function makePin() {
  const pin = document.createElement("div");
  pin.className = "pin";
  pin.innerHTML = '<div class="badge"><img class="art" alt="" hidden /><span class="glyph"></span><span class="tp" hidden></span></div>'
    + '<div class="time"></div><div class="sub"></div><div class="name"></div>';
  return pin;
}

// Draw timer `d` in icon element `pin`.
function renderPin(pin, d) {
  const glyph = pin.querySelector(".glyph");
  const art = pin.querySelector(".art");
  const badge = pin.querySelector(".badge");
  const sub = pin.querySelector(".sub");
  // The game's icon when there is one, else the initials. Taken from the
  // page's own copy (widget.html), which on Linux is the image itself.
  const src = (d.icon && document.querySelector(`.icons img[data-icon="${d.icon}"]`)?.getAttribute("src")) || "";
  if (art.getAttribute("src") !== src) {
    if (src) art.setAttribute("src", src);
    else art.removeAttribute("src");
  }
  art.hidden = !src;
  glyph.hidden = !!src;
  glyph.textContent = d.glyph || initials(d.name);
  // The nearest teleport's number, on the ring (Settings: Teleport number on icon).
  const tp = pin.querySelector(".tp");
  tp.textContent = d.tp || "";
  tp.hidden = !d.tp;
  pin.querySelector(".time").textContent = d.countdown || "";
  pin.dataset.copy = d.copy || "";
  sub.textContent = d.sub || "";
  // A world boss's HP: the ring drains from the top as it falls.
  const hasHp = typeof d.hp === "number";
  badge.classList.toggle("hasHp", hasHp);
  const hpColor = hasHp ? (d.hp > 50 ? "#5fe08a" : d.hp > 20 ? "#ffd54a" : "#ff5a4f") : "";
  if (hasHp) {
    badge.style.setProperty("--hp", `${d.hp}%`);
    badge.style.setProperty("--hp-color", hpColor);
  }
  // The HP in the ring's colour; "Enter" keeps its own.
  sub.style.color = hpColor;
  pin.querySelector(".name").textContent = d.showName ? d.name : "";
  // Settings, Show the icon: off, the name and time alone.
  badge.hidden = d.badge === false;
  // An Abyss boss is purple, as a world boss is red, up or not (the class
  // set apart, before this, was wiped here).
  pin.className = `pin ${d.kind || "event"}${d.running ? " running" : ""}${d.due ? " due" : ""}${d.abyss ? " abyss" : ""}${d.enemy ? " enemy" : ""}${d.badge === false ? " bare" : ""} ${d.effect || "shake"}`;
  pin.title = d.tip || (pin.closest(".grid") && d.name) || "";
  // Settings: Icon opacity.
  pin.style.opacity = typeof d.opacity === "number" ? String(d.opacity) : "";
}

// The grid: the frame's size, the grip in its corner, and each icon in its
// place, filling from the grip's side.
// The other layout's box, hidden: not placing either. It kept its "setup"
// mark, and its hidden grip was the one found for the mouse, so the list
// shown after the icons (Layout changed in Settings) could not be moved by
// its anchor.
function hideBox(box) {
  if (!box) return;
  box.hidden = true;
  box.classList.remove("setup");
}

function renderGrid(g) {
  single.hidden = true;
  hideBox(listBox);
  if (gridBox) gridBox.hidden = false;
  if (!gridBox) {
    gridBox = document.createElement("div");
    gridBox.className = "grid";
    const grip = document.createElement("div");
    grip.className = "grip";
    grip.textContent = "⚓";
    gridBox.append(grip);
    document.body.append(gridBox);
  }
  gridBox.style.width = `${g.width}px`;
  gridBox.style.height = `${g.height}px`;
  const gripSize = Number(g.gripSize) || 40;
  const grip = gridBox.querySelector(".grip");
  grip.style.left = `${g.grip.x}px`;
  grip.style.top = `${g.grip.y}px`;
  grip.style.width = grip.style.height = `${gripSize - 4}px`;
  grip.title = g.label || "";
  // Placing it (the plugin's Settings open): the anchor, and every place
  // the grid can fill, outlined.
  gridBox.classList.toggle("setup", !!g.setup);
  const left = String(g.dir).startsWith("left");
  const up = String(g.dir).endsWith("up");
  const top = Number(g.top) || 0;
  const gapX = Number(g.gapX) || 0;
  const gapY = Number.isFinite(Number(g.gapY)) ? Number(g.gapY) : 4;
  // A place's left edge; the icon sits in it with half the column gap on
  // each side.
  const colX = (i) => {
    const col = i % g.cols;
    return left ? g.width - gripSize - (col + 1) * g.cellW : gripSize + col * g.cellW;
  };
  const cells = Array.isArray(g.cells) ? g.cells : [];
  const pins = [...gridBox.querySelectorAll(".pin")];
  while (pins.length < cells.length) {
    const pin = makePin();
    gridBox.append(pin);
    pins.push(pin);
  }
  for (const [i, pin] of pins.entries()) {
    const d = cells[i];
    pin.hidden = !d;
    if (d) renderPin(pin, d);
  }
  // Each row as tall as its tallest icon (a row with none, while placing,
  // as tall as a typical one), packed from the anchor's side, so a short
  // row leaves no gap. The outlines follow the same rows.
  const rows = g.setup ? g.rows : Math.ceil(cells.length / g.cols);
  const heights = Array.from({ length: rows }, () => 0);
  for (const [i, pin] of pins.entries()) {
    if (pin.hidden) continue;
    const row = Math.floor(i / g.cols);
    heights[row] = Math.max(heights[row], pin.offsetHeight + gapY);
  }
  const rowTop = [];
  let y = up ? g.height : top;
  for (let row = 0; row < rows; row++) {
    const h = heights[row] || g.cellH;
    heights[row] = h;
    if (up) y -= h;
    rowTop[row] = y;
    if (!up) y += h;
  }
  // Every icon at its row's top, so a row's badges are in one line however
  // many lines its names and countdowns take (growing up, they were set at
  // the row's bottom, and a two-line name lifted its badge above the rest).
  for (const [i, pin] of pins.entries()) {
    if (pin.hidden) continue;
    const row = Math.floor(i / g.cols);
    pin.style.left = `${colX(i) + gapX / 2}px`;
    pin.style.top = `${rowTop[row] + (up ? gapY : 0)}px`;
  }
  // While placing: every place outlined.
  const places = g.setup ? g.cols * g.rows : 0;
  const ghosts = [...gridBox.querySelectorAll(".ghost")];
  while (ghosts.length < places) {
    const ghost = document.createElement("div");
    ghost.className = "ghost";
    gridBox.prepend(ghost);
    ghosts.push(ghost);
  }
  for (const [i, ghost] of ghosts.entries()) {
    ghost.hidden = i >= places;
    if (ghost.hidden) continue;
    const row = Math.floor(i / g.cols);
    // Each outline is the icon's own place, the gaps left between them.
    ghost.style.left = `${colX(i) + gapX / 2}px`;
    ghost.style.top = `${rowTop[row] + (up ? gapY : 0)}px`;
    ghost.style.width = `${g.cellW - gapX}px`;
    ghost.style.height = `${Math.max(heights[row] - gapY, 8)}px`;
  }
  document.title = g.label || "Event Timers";
}

// The list (Placement, Layout: List): one slim row per timer, its name,
// teleport, HP or "Enter", and time, with a coloured edge for its kind and a
// faint bar for its HP (or for being up). Same frame, grip and order as the
// grid; rows fill from the grip's side.
const KIND_EDGE = { field: "#d9705f", boss: "#a985e0", event: "#5a95d6", more: "#7d8794" };
function renderList(g) {
  single.hidden = true;
  hideBox(gridBox);
  if (!listBox) {
    listBox = document.createElement("div");
    listBox.className = "grid list";
    const grip = document.createElement("div");
    grip.className = "grip";
    grip.textContent = "⚓";
    listBox.append(grip);
    document.body.append(listBox);
  }
  listBox.hidden = false;
  listBox.style.width = `${g.width}px`;
  listBox.style.height = `${g.height}px`;
  listBox.classList.toggle("setup", !!g.setup);
  const gripSize = Number(g.gripSize) || 40;
  const grip = listBox.querySelector(".grip");
  grip.style.left = `${g.grip.x}px`;
  grip.style.top = `${g.grip.y}px`;
  grip.style.width = grip.style.height = `${gripSize - 4}px`;
  grip.title = g.label || "";
  const left = String(g.dir).startsWith("left");
  const up = String(g.dir).endsWith("up");
  const x = left ? 0 : gripSize;
  const rowH = Number(g.cellH) || 24;
  const top = (i) => (up ? g.height - (i + 1) * rowH : i * rowH);
  const cells = Array.isArray(g.cells) ? g.cells : [];
  const rows = [...listBox.querySelectorAll(".lrow")];
  while (rows.length < cells.length) {
    const row = document.createElement("div");
    row.className = "lrow";
    row.innerHTML = '<span class="fill"></span><span class="licon"><img class="art" alt="" hidden /><span class="glyph"></span></span>'
      + '<span class="lname"></span><span class="ltp"></span><span class="lsub"></span><span class="ltime"></span>';
    listBox.append(row);
    rows.push(row);
  }
  for (const [i, row] of rows.entries()) {
    const d = cells[i];
    row.hidden = !d;
    if (!d) continue;
    row.style.left = `${x}px`;
    row.style.top = `${top(i)}px`;
    row.style.width = `${g.cellW}px`;
    row.style.height = `${rowH - (Number(g.gapY) || 0)}px`;
    const edge = d.enemy ? "#c8262b" : d.abyss ? "#a985e0" : d.running ? "#5fbf86" : KIND_EDGE[d.kind] || KIND_EDGE.event;
    row.style.setProperty("--edge", edge);
    row.className = `lrow${d.running ? " running" : ""}${d.due ? " due" : ""}${d.enemy ? " enemy" : ""}`;
    // A small icon (Placement: Icons in the list): the game's, or the
    // initials, as on the icons.
    const icon = row.querySelector(".licon");
    icon.hidden = g.icons === false;
    if (!icon.hidden) {
      const src = (d.icon && document.querySelector(`.icons img[data-icon="${d.icon}"]`)?.getAttribute("src")) || "";
      const art = icon.querySelector(".art");
      if (art.getAttribute("src") !== src) {
        if (src) art.setAttribute("src", src);
        else art.removeAttribute("src");
      }
      art.hidden = !src;
      const glyph = icon.querySelector(".glyph");
      glyph.hidden = !!src;
      glyph.textContent = d.kind === "more" ? "+" : d.glyph || initials(d.name);
    }
    row.querySelector(".lname").textContent = d.name || "";
    const tp = row.querySelector(".ltp");
    tp.textContent = d.tp ? `#${d.tp}` : "";
    tp.hidden = !d.tp;
    const sub = row.querySelector(".lsub");
    sub.textContent = d.sub || "";
    sub.hidden = !d.sub;
    row.querySelector(".ltime").textContent = d.kind === "more" ? "" : d.countdown || "";
    // HP: the bar's share of the row; up without HP, a faint full bar.
    const fill = row.querySelector(".fill");
    const hasHp = typeof d.hp === "number";
    const hpColor = hasHp ? (d.hp > 50 ? "95, 191, 134" : d.hp > 20 ? "224, 186, 74" : "214, 86, 76") : "95, 191, 134";
    fill.style.width = hasHp ? `${Math.max(0, Math.min(100, d.hp))}%` : d.running ? "100%" : "0";
    fill.style.background = `rgba(${hpColor}, calc(${hasHp ? 0.32 : 0.14} * var(--bg, 1)))`;
    sub.style.color = hasHp ? `rgb(${hpColor})` : "";
    row.dataset.copy = d.copy || "";
    row.title = d.tip || d.name || "";
    // Settings' opacity, in the list: the row's background and bar only, the
    // text stays solid.
    row.style.setProperty("--bg", typeof d.opacity === "number" ? String(d.opacity) : "1");
  }
  // While placing: every row's place outlined.
  const places = g.setup ? g.rows : 0;
  const ghosts = [...listBox.querySelectorAll(".ghost")];
  while (ghosts.length < places) {
    const ghost = document.createElement("div");
    ghost.className = "ghost";
    listBox.prepend(ghost);
    ghosts.push(ghost);
  }
  for (const [i, ghost] of ghosts.entries()) {
    ghost.hidden = i >= places;
    if (ghost.hidden) continue;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${top(i)}px`;
    ghost.style.width = `${g.cellW}px`;
    ghost.style.height = `${rowH - (Number(g.gapY) || 0)}px`;
  }
  document.title = g.label || "Event Timers";
}

a2.on("widget", (d) => {
  if (!d) return;
  if (d.kind === "list") renderList(d);
  else if (d.kind === "grid") renderGrid(d);
  else {
    renderPin(single, d);
    document.title = d.name || "Event Timers";
  }
  reportArea();
});

// The drawn parts: only they take the mouse, so icons set close together
// don't catch each other's drags, and the grid's empty cells let clicks
// through to the game (meter 2.0.70 on, Linux; 2.0.77 on, Windows too). In
// the grid, the grip and each icon shown: one rectangle each where the meter
// takes several (a2.widget.areas, 2.0.77), else the box around them all.
const PARTS = ".badge, .time, .sub, .name";
// What can be grabbed: the grip in setup, and the parts of each icon shown.
const SHOWN = ".grid:not([hidden]).setup > .grip, .pin:not([hidden]) .badge, .pin:not([hidden]) .time, .pin:not([hidden]) .sub, .pin:not([hidden]) .name, .lrow:not([hidden])";
let lastArea = "";
function partsOf(el, rect) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return rect;
  // The badge's ring and glow reach a little past it.
  const pad = el.classList.contains("badge") ? 4 : 0;
  const box = rect || { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  return {
    left: Math.min(box.left, r.left - pad),
    top: Math.min(box.top, r.top - pad),
    right: Math.max(box.right, r.right + pad),
    bottom: Math.max(box.bottom, r.bottom + pad),
  };
}
const toArea = (b) => ({
  x: Math.max(0, Math.floor(b.left)),
  y: Math.max(0, Math.floor(b.top)),
  width: Math.ceil(b.right - Math.max(0, Math.floor(b.left))),
  height: Math.ceil(b.bottom - Math.max(0, Math.floor(b.top))),
});
function reportArea() {
  const several = typeof a2.widget.areas === "function";
  if (!several && typeof a2.widget.area !== "function") return;
  const boxes = [];
  const grip = document.querySelector(".grid:not([hidden]).setup > .grip");
  if (grip) {
    const b = partsOf(grip, null);
    if (b) boxes.push(b);
  }
  for (const pin of document.querySelectorAll(".grid:not([hidden]) .pin:not([hidden]), body > .pin:not([hidden])")) {
    let b = null;
    for (const el of pin.querySelectorAll(PARTS)) b = partsOf(el, b);
    if (b && b.right > b.left && b.bottom > b.top) boxes.push(b);
  }
  // A list's rows, whole.
  for (const row of document.querySelectorAll(".list:not([hidden]) .lrow:not([hidden])")) {
    const b = partsOf(row, null);
    if (b) boxes.push(b);
  }
  let payload;
  if (several) {
    payload = boxes.map(toArea);
  } else {
    // Nothing drawn (an empty grid, its anchor hidden): a point, so the
    // frame's empty space doesn't keep clicks from the game.
    const all = boxes.reduce((acc, b) => (acc ? {
      left: Math.min(acc.left, b.left), top: Math.min(acc.top, b.top),
      right: Math.max(acc.right, b.right), bottom: Math.max(acc.bottom, b.bottom),
    } : b), null);
    payload = all ? toArea(all) : { x: 0, y: 0, width: 1, height: 1 };
  }
  const key = JSON.stringify(payload);
  if (key === lastArea) return;
  lastArea = key;
  (several ? a2.widget.areas(payload) : a2.widget.area(payload)).catch(() => {});
}
addEventListener("resize", () => {
  lastArea = "";
  reportArea();
});
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
});

// A press becomes a drag only once the pointer moves: a window drag starts
// at once took the mouse (Windows), so the release never reached the page
// and a double-click never happened. Two clicks within DOUBLE_MS open the
// plugin's window.
const DRAG_PX = 4;
const DOUBLE_MS = 400;
let press = null;
let lastClick = 0;
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || !(e.target instanceof Element) || !e.target.closest(SHOWN)) return;
  e.preventDefault();
  press = { x: e.screenX, y: e.screenY };
});
document.addEventListener("mousemove", (e) => {
  if (!press) return;
  if (!(e.buttons & 1)) {
    press = null;
    return;
  }
  if (Math.abs(e.screenX - press.x) + Math.abs(e.screenY - press.y) >= DRAG_PX) {
    press = null;
    lastClick = 0;
    a2.widget.drag().catch(() => {});
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || !press) return;
  press = null;
  const now = Date.now();
  if (now - lastClick <= DOUBLE_MS) {
    lastClick = 0;
    a2.widget.post({ open: true }).catch(() => {});
  } else {
    lastClick = now;
  }
});
// A right-click stops its alert's sound; a second on the same icon within
// DOUBLE_MS copies a line about it for chat (unlocked: a locked icon lets
// clicks through to the game). The click lets the page write there.
let lastRight = null;
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const pin = e.target instanceof Element ? e.target.closest(".pin, .lrow") : null;
  const line = pin?.dataset.copy || "";
  const now = Date.now();
  if (line && lastRight && lastRight.line === line && now - lastRight.at <= DOUBLE_MS) {
    lastRight = null;
    copy(line, pin);
    return;
  }
  lastRight = { line, at: now };
  a2.widget.post({ mute: true }).catch(() => {});
});

async function copy(line, pin) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(line);
    ok = true;
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: line });
    area.style.cssText = "position:fixed;opacity:0;";
    document.body.append(area);
    area.select();
    try { ok = document.execCommand("copy"); } catch {}
    area.remove();
  }
  if (!ok) return;
  pin.classList.remove("copied");
  void pin.offsetWidth;
  pin.classList.add("copied");
  setTimeout(() => pin.classList.remove("copied"), 900);
}

a2.ready();
