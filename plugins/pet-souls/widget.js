// Pet Soul Tracker's map, popped out: a widget drawing the scene the window
// sends it (plugin.js), the same map as in the window (minimap.js).
const $ = (s) => document.querySelector(s);
const bar = $(".bar");
const where = $(".where");
let zoomFromWindow = false;
const map = new PetMiniMap.MiniMap(
  { canvas: $(".minimap"), zoomIn: $(".zoomIn"), zoomOut: $(".zoomOut"), follow: $(".follow"), note: $(".mapNote") },
  { onZoom: (zoom) => a2.widget.post({ zoom }).catch(() => {}) },
);

a2.on("widget", (scene) => {
  if (!scene || typeof scene !== "object") return;
  // Its zoom is kept by the window: taken once, then this widget's own.
  if (!zoomFromWindow && scene.zoom != null) {
    zoomFromWindow = true;
    map.setZoom(scene.zoom);
  }
  $(".title").textContent = scene.title || "Around you";
  label(scene.labels || {});
  where.textContent = scene.where || "";
  where.title = scene.whereTitle || "";
  where.className = `where ${scene.whereClass || ""}`.trim();
  $(".count").textContent = scene.count || "";
  map.set(scene);
  reportArea();
});

// The page's words in the meter's language, as the window sends them.
function label(t) {
  const set = (sel, title, text) => {
    const node = $(sel);
    if (!node) return;
    if (title) node.title = title;
    if (text) node.textContent = text;
  };
  set(".bar", t.drag);
  set(".size", t.bigger);
  set(".dock", t.backIn);
  set(".zoomIn", t.zoomIn);
  set(".zoomOut", t.zoomOut);
  set(".follow", t.back);
  set(".minimap", t.mapTip);
  // Aion 2 Timers' badge: its tooltip, and its two lines (not its text,
  // which holds the logo).
  set(".mapCredit", t.credit);
  set(".creditLive", null, t.creditLive);
  set(".creditBy", null, t.creditBy);
  if (t.mapLabel) $(".minimap").setAttribute("aria-label", t.mapLabel);
}

// What takes the mouse (CONTRIBUTING: only what is drawn). Unlocked, the
// whole panel: its bar moves the widget, and the map pans and zooms. Locked,
// only its buttons: the map is something to look at, and clicks on it go
// through to the game like the plugin's other locked widgets.
let lastArea = "";
function reportArea() {
  const several = typeof a2.widget.areas === "function";
  if (!several && typeof a2.widget.area !== "function") return;
  const parts = locked ? [...document.querySelectorAll(".bar button, .mapButtons button:not([hidden]), .mapCredit")] : [$(".pop")];
  const boxes = parts.map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => ({
    x: Math.max(0, Math.floor(r.left)),
    y: Math.max(0, Math.floor(r.top)),
    width: Math.ceil(r.right - Math.max(0, Math.floor(r.left))),
    height: Math.ceil(r.bottom - Math.max(0, Math.floor(r.top))),
  }));
  let payload = boxes;
  if (!several) {
    // Older meters take one box: around the buttons, else the panel.
    const all = boxes.reduce((a, b) => (a ? {
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
      height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y),
    } : b), null);
    payload = all || { x: 0, y: 0, width: 1, height: 1 };
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

// The bar moves the widget (unlocked); its buttons don't.
let locked = false;
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
  reportArea();
});
// Heard on the page and placed by where the press is, not by its target: a
// pointer the map still held would send the press there, and the widget
// could no longer be moved until it was opened again.
document.addEventListener("pointerdown", (e) => {
  // Any capture left over goes first (the map takes a new one for its own drag).
  for (const el of document.querySelectorAll("canvas")) if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  if (e.button !== 0 || locked) return;
  const r = bar.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
  if (document.elementsFromPoint(e.clientX, e.clientY).some((el) => el.closest?.("button"))) return;
  e.preventDefault();
  a2.widget.drag().catch(() => {});
}, true);
$(".size").addEventListener("click", () => a2.widget.post({ size: true }).catch(() => {}));
$(".dock").addEventListener("click", () => a2.widget.post({ close: true }).catch(() => {}));

a2.ready();
reportArea();
// Ask for the scene: the window sends one as it changes, and at once on this.
a2.widget.post({ hello: true }).catch(() => {});
