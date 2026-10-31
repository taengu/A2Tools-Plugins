// The big text: what the plugin's page sends ({ look, items, preview }), the
// seconds counted here against the clock. Unlocked and empty, a sample box
// shows so it can be placed; a double-click opens the settings.
const stack = document.querySelector(".stack");
let locked = false;
let look = { size: 60, fg: "#ffff00", safe: "#66ff66", bg: "#000000", bgOpacity: 0.85 };
let items = [];
let preview = { text: "Boss Callouts", sub: "" };

const hex = (c, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c || "");
  if (!m) return `rgba(0, 0, 0, ${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const secs = (ms) => {
  const s = ms / 1000;
  return s >= 10 ? `${Math.ceil(s)} s` : `${s.toFixed(1)} s`;
};

function style() {
  const r = document.documentElement.style;
  r.setProperty("--s", `${look.size}px`);
  r.setProperty("--fg", look.fg);
  r.setProperty("--safe", look.safe);
  r.setProperty("--bg", hex(look.bg, look.bgOpacity ?? 0.85));
}

let lastKey = "";
function render() {
  const now = Date.now();
  const live = items.filter((x) => x.until > now);
  const list = live.length ? live : locked ? [] : [{ kind: "preview", text: preview.text, sub: preview.sub, end: 0 }];
  // Rebuilt only when the words change; the seconds are updated in place.
  const key = JSON.stringify(list.map((x) => [x.kind, x.text, x.sub, !!x.end]));
  if (key !== lastKey) {
    lastKey = key;
    stack.replaceChildren(
      ...list.map((x, i) => {
        const box = document.createElement("div");
        box.className = `box ${x.kind}${i ? " second" : ""}`;
        const big = document.createElement("div");
        big.className = "big";
        const text = document.createElement("span");
        text.textContent = x.text;
        big.append(text);
        if (x.end) {
          big.append(document.createTextNode(" — "));
          const s = document.createElement("span");
          s.className = "secs";
          big.append(s);
        }
        box.append(big);
        if (x.sub) {
          const sub = document.createElement("div");
          sub.className = "sub";
          sub.textContent = x.sub;
          box.append(sub);
        }
        return box;
      }),
    );
  }
  [...stack.children].forEach((box, i) => {
    const s = box.querySelector(".secs");
    if (s && list[i]) {
      const t = secs(Math.max(0, list[i].end - now));
      if (s.textContent !== t) s.textContent = t;
    }
  });
  reportArea();
}
setInterval(render, 100);

// Only the boxes take the mouse; around them clicks go through to the game.
let lastArea = "";
function reportArea() {
  const rs = [...stack.children].map((b) => b.getBoundingClientRect());
  const areas = rs.map((r) => ({ x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) }));
  const key = JSON.stringify(areas);
  if (key === lastArea) return;
  lastArea = key;
  if (typeof a2.widget.areas === "function") a2.widget.areas(areas).catch(() => {});
  else if (typeof a2.widget.area === "function") {
    const r = areas[0] || { x: 0, y: 0, width: 1, height: 1 };
    a2.widget.area(r).catch(() => {});
  }
}

a2.on("widget", (d) => {
  if (!d) return;
  look = { ...look, ...(d.look || {}) };
  items = Array.isArray(d.items) ? d.items : [];
  if (d.preview) preview = d.preview;
  style();
  render();
});
a2.on("locked", (on) => {
  locked = !!on;
  render();
});

// A press becomes a drag once the pointer moves, so a double-click still
// reaches the page.
const DRAG_PX = 4;
const DOUBLE_MS = 400;
let press = null;
let lastClick = 0;
stack.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || !e.target.closest(".box")) return;
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
document.addEventListener("contextmenu", (e) => e.preventDefault());

style();
a2.ready();
