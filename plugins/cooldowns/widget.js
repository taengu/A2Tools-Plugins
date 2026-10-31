// A bar of icons: what the plugin's page sends it ({ look, slots }), timed
// here against the clock, dragged unless locked; a double-click opens the
// settings.
const grid = document.querySelector(".grid");
let locked = false;
let look = { size: 42, direction: "right", opacity: 1, numbers: true, readyGlow: true, ring: false };
let slots = [];
const nodes = new Map(); // key -> { el, slot, wasCooling }

const fmt = (ms) => {
  const s = ms / 1000;
  if (s >= 60) return `${Math.ceil(s / 60)}m`;
  if (s >= 10) return String(Math.ceil(s));
  return s.toFixed(1);
};

function build() {
  document.documentElement.style.setProperty("--s", `${look.size}px`);
  document.documentElement.style.setProperty("--gap", `${Math.round(look.size * 0.08) + 2}px`);
  grid.className = `grid ${look.direction}`;
  document.body.classList.toggle("noNumbers", !look.numbers);
  document.body.classList.toggle("ringMode", !!look.ring);
  // Out of combat the icons fade, unless they are unlocked to be placed.
  grid.style.opacity = look.away && locked ? "0" : String(look.opacity ?? 1);
  const keep = new Set(slots.map((s) => s.key));
  for (const [key, n] of nodes) {
    if (!keep.has(key)) {
      n.el.remove();
      nodes.delete(key);
    }
  }
  for (const s of slots) {
    let n = nodes.get(s.key);
    if (!n) {
      const el = document.createElement("div");
      el.className = "slot";
      for (const c of ["art", "sweep", "ring", "bar", "num cdNum", "num buffNum", "num chNum"]) {
        const part = document.createElement(c.startsWith("num") ? "span" : "div");
        part.className = c;
        el.append(part);
      }
      n = { el, art: el.querySelector(".art"), wasCooling: false, filter: "" };
      nodes.set(s.key, n);
    }
    n.slot = s;
    // From icons.js: on Linux a file path set from a script shows nothing.
    const url = s.icon && window.COOLDOWN_ICONS?.[s.icon];
    n.art.style.backgroundImage = url ? `url("${url}")` : "";
    grid.append(n.el);
  }
  tick();
}

function tick() {
  const now = Date.now();
  for (const n of nodes.values()) {
    const s = n.slot;
    const el = n.el;
    const cooling = s.cdEnd > now;
    const buffing = s.buffEnd > now;
    // Charges (a skill's variant with them): how many there are now, one
    // back every chPer ms until chFull; the count shows while there are any.
    const charges = s.chMax ? s.chMax - Math.min(s.chMax, Math.ceil(Math.max(0, s.chFull - now) / s.chPer)) : 0;
    const recharging = !!s.chMax && charges < s.chMax;
    // A skill can be usable while a spent charge is still coming back.
    // Show that next charge's timer without changing its ready-flash state.
    const timing = cooling || recharging;
    const end = cooling ? s.cdEnd : s.chFull - (s.chMax - charges - 1) * s.chPer;
    const start = cooling ? s.cdStart : end - s.chPer;
    el.classList.toggle("cooling", timing);
    el.classList.toggle("buffing", buffing);
    el.classList.toggle("both", timing && buffing);
    const chNum = el.querySelector(".chNum");
    const chText = s.chMax && charges ? String(charges) : "";
    if (chNum.textContent !== chText) chNum.textContent = chText;
    const active = cooling || buffing || recharging || s.always;
    el.hidden = !active && locked;
    el.classList.toggle("idle", !active);
    const cdNum = el.querySelector(".cdNum");
    if (timing) {
      const total = Math.max(1, end - start);
      el.style.setProperty("--p", `${Math.min(360, ((end - now) / total) * 360)}deg`);
      cdNum.textContent = fmt(end - now);
    } else {
      cdNum.textContent = "";
    }
    // How much of the buff is left, 0-1: the bar, or the ring around the
    // icon, drains with it.
    let left = 1;
    if (buffing) {
      const total = Math.max(1, s.buffEnd - s.buffStart);
      left = Math.max(0, Math.min(1, (s.buffEnd - now) / total));
      el.style.setProperty("--w", `${left * 100}%`);
      el.style.setProperty("--r", `${left * 360}deg`);
      el.querySelector(".buffNum").textContent = fmt(s.buffEnd - now);
    }
    // A buff kept on screen while it isn't on you: near black. With the
    // ring, a buff's own icon dims and greys as it runs out.
    const off = s.buff && !buffing;
    el.classList.toggle("off", off);
    const fade = 1 - left;
    const filter = off
      ? "grayscale(1) brightness(0.3)"
      : look.ring && s.buff && buffing
        ? `grayscale(${(fade * 0.85).toFixed(2)}) brightness(${(1 - fade * 0.55).toFixed(2)})`
        : "";
    if (filter !== n.filter) {
      n.filter = filter;
      n.art.style.filter = filter;
    }
    // Ready again: a flash.
    if (n.wasCooling && !cooling && look.readyGlow && !el.hidden) {
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
    n.wasCooling = cooling;
  }
  reportArea();
}
setInterval(tick, 100);

a2.on("widget", (d) => {
  if (!d) return;
  look = { ...look, ...(d.look || {}) };
  slots = d.slots || [];
  build();
});
a2.on("locked", (on) => {
  locked = !!on;
  document.body.classList.toggle("locked", locked);
  build();
  tick();
});

// Only the icons take the mouse; clicks beside them go through to the game
// (meter 2.0.70 on, Linux).
let lastArea = "";
function reportArea() {
  if (typeof a2.widget.area !== "function") return;
  const rs = [...nodes.values()].filter((n) => !n.el.hidden).map((n) => n.el.getBoundingClientRect());
  let area = { x: 0, y: 0, width: 1, height: 1 };
  if (rs.length) {
    const x = Math.max(0, Math.floor(Math.min(...rs.map((r) => r.left))));
    const y = Math.max(0, Math.floor(Math.min(...rs.map((r) => r.top))));
    area = { x, y, width: Math.ceil(Math.max(...rs.map((r) => r.right)) - x), height: Math.ceil(Math.max(...rs.map((r) => r.bottom)) - y) };
  }
  const key = JSON.stringify(area);
  if (key === lastArea) return;
  lastArea = key;
  a2.widget.area(area).catch(() => {});
}

// A press becomes a drag once the pointer moves, so a double-click still
// reaches the page (as Event Timers' icons do).
const DRAG_PX = 4;
const DOUBLE_MS = 400;
let press = null;
let lastClick = 0;
grid.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || locked || !e.target.closest(".slot")) return;
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

a2.ready();
// Ready for its icons: a widget just opened (a layout change) missed what
// was sent while its page loaded, and stayed empty until the next cooldown
// or buff changed (#130).
a2.widget.post({ ready: true }).catch(() => {});
