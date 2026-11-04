// The live card: each roll the plugin's page sends (all the text ready),
// counting its own time down. A click opens the plugin's window at that
// roll; a press that moves drags the card; the X hides that roll.
const $ = (s) => document.querySelector(s);
const stack = $(".stack");
let rolls = [];

const TIMER = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>';
const TROPHY = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const left = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function render(d) {
  document.documentElement.style.setProperty("--scale", String(d.scale || 1));
  rolls = d.rolls || [];
  stack.replaceChildren();
  for (const r of rolls) {
    const card = el("div", "card");
    card.dataset.key = r.key;
    card.style.setProperty("--g", r.color);
    const x = el("button", "dismiss");
    x.type = "button";
    x.innerHTML = CLOSE;
    x.setAttribute("aria-label", d.hide || "Hide");
    x.title = d.hide || "Hide";
    card.append(x, el("div", "item", r.item));
    if (r.going) {
      const meta = el("div", "meta");
      if (r.endsAt) {
        const t = el("span", "timer");
        t.dataset.endsAt = String(r.endsAt);
        meta.insertAdjacentHTML("beforeend", TIMER);
        meta.append(t);
      }
      meta.append(el("span", null, r.counts));
      card.append(meta);
      if (r.lines.length) {
        const lines = el("div", "lines");
        for (const l of r.lines) {
          const line = el("div", `line${l.mine ? " mine" : ""}${l.top ? " top" : ""}`);
          line.append(el("span", "num", l.num), el("span", "who", l.name));
          lines.append(line);
        }
        if (r.more) lines.append(el("div", "more", r.more));
        if (r.mineBelow) lines.append(el("div", "mineBelow", r.mineBelow));
        card.append(lines);
      }
    } else {
      const out = el("div", `outcome${r.won ? " won" : ""}`);
      if (r.won) out.insertAdjacentHTML("beforeend", TROPHY);
      out.append(el("span", null, r.outcome));
      card.append(out, el("div", "you", r.you));
    }
    stack.append(card);
  }
  tick();
  fit();
}

// The time left on each roll going.
function tick() {
  const now = Date.now();
  for (const t of document.querySelectorAll(".timer")) {
    const ms = Number(t.dataset.endsAt) - now;
    t.textContent = left(ms);
    t.classList.toggle("low", ms <= 10_000);
  }
}
setInterval(tick, 250);

// The window fits the cards (the plugin's page sizes it), and only the cards
// take the mouse.
let lastHeight = 0;
function fit() {
  const scale = Number(getComputedStyle(document.documentElement).getPropertyValue("--scale")) || 1;
  const height = Math.ceil(stack.getBoundingClientRect().height * (CSS.supports("zoom", "1") ? 1 : scale));
  if (Math.abs(height - lastHeight) > 1) {
    lastHeight = height;
    a2.widget.post({ height }).catch(() => {});
  }
  const cards = [...document.querySelectorAll(".card")].map((c) => c.getBoundingClientRect());
  if (typeof a2.widget.areas === "function") {
    a2.widget.areas(cards.map((r) => ({ x: Math.max(0, Math.floor(r.left)), y: Math.max(0, Math.floor(r.top)), width: Math.ceil(r.width), height: Math.ceil(r.height) }))).catch(() => {});
  } else if (typeof a2.widget.area === "function" && cards.length) {
    const top = Math.min(...cards.map((r) => r.top)), bottom = Math.max(...cards.map((r) => r.bottom));
    const l = Math.min(...cards.map((r) => r.left)), rt = Math.max(...cards.map((r) => r.right));
    a2.widget.area({ x: Math.floor(l), y: Math.floor(top), width: Math.ceil(rt - l), height: Math.ceil(bottom - top) }).catch(() => {});
  }
}
addEventListener("resize", fit);

a2.on("widget", (d) => {
  if (d) render(d);
});

const DRAG_PX = 4;
let press = null;
stack.addEventListener("click", (e) => {
  const x = e.target.closest(".dismiss");
  if (!x) return;
  e.stopPropagation();
  a2.widget.post({ dismiss: x.closest(".card").dataset.key }).catch(() => {});
});
stack.addEventListener("mousedown", (e) => {
  const card = e.target.closest(".card");
  if (e.button !== 0 || !card || e.target.closest(".dismiss")) return;
  e.preventDefault();
  press = { x: e.screenX, y: e.screenY, key: card.dataset.key };
});
document.addEventListener("mousemove", (e) => {
  if (!press) return;
  if (!(e.buttons & 1)) {
    press = null;
    return;
  }
  if (Math.abs(e.screenX - press.x) + Math.abs(e.screenY - press.y) >= DRAG_PX) {
    press = null;
    a2.widget.drag().catch(() => {});
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || !press) return;
  const key = press.key;
  press = null;
  a2.widget.post({ open: true, key }).catch(() => {});
});
document.addEventListener("contextmenu", (e) => e.preventDefault());

a2.ready();
// Ready: ask for what to show, in case it was sent before this page loaded.
a2.widget.post({ hello: true }).catch(() => {});
