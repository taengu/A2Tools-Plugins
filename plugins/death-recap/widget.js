// The popup: one death as the plugin's page sends it (all the text ready),
// in the style the player picked: a corner toast, a centre banner or a slim
// strip. A click opens the plugin's window; a press that moves drags it.
const $ = (s) => document.querySelector(s);
const card = $(".card");

a2.on("widget", (d) => {
  if (!d) return;
  card.dataset.style = d.style || "toast";
  document.documentElement.style.setProperty("--scale", String(d.scale || 1));
  for (const icon of document.querySelectorAll(".classIcon")) {
    const shown = !!d.icon && d.icon === `icons/${icon.dataset.class}.png`;
    icon.hidden = !shown;
    icon.alt = shown ? d.className || "" : "";
  }
  $(".dismiss").setAttribute("aria-label", d.hideLabel || "Hide");
  $(".dismiss").title = d.hideLabel || "Hide";
  $(".killedBy").textContent = d.killedBy;
  $(".name").textContent = d.name;
  // The strip has the least room: level and legion only.
  const parts = d.style === "strip" ? [d.level, d.legion] : [d.className && d.level ? `${d.className} ${d.level}` : d.className || d.level, d.legion, d.server];
  $(".sub").textContent = parts.filter(Boolean).join(" · ");
  $(".cp").textContent = d.cp;
  $(".cpBox").title = d.cpLabel;
  $(".gs").textContent = d.gs;
  $(".gsBox").title = d.gsLabel;
  $(".damage").textContent = `${d.damage} ${d.dmg}`;
  $(".dps").textContent = `${d.dps} DPS`;
  $(".fight").textContent = d.fight;
  $(".extra").textContent = d.style === "banner" ? [d.assistNames, d.times].filter(Boolean).join(" · ") : d.style === "toast" ? d.assists || "" : "";
  $(".assistCount").textContent = d.style === "strip" ? d.assists || "" : "";
  card.hidden = false;
  reportArea();
});

// Only the card takes the mouse.
function reportArea() {
  if (typeof a2.widget.area !== "function") return;
  const r = card.getBoundingClientRect();
  a2.widget.area({ x: Math.max(0, Math.floor(r.left)), y: Math.max(0, Math.floor(r.top)), width: Math.ceil(r.width), height: Math.ceil(r.height) }).catch(() => {});
}
addEventListener("resize", reportArea);

const DRAG_PX = 4;
let press = null;
// The X: hide it now, without opening the window.
$(".dismiss").addEventListener("click", (e) => {
  e.stopPropagation();
  a2.widget.post({ dismiss: true }).catch(() => {});
});
card.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || e.target.closest(".dismiss")) return;
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
    a2.widget.drag().catch(() => {});
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || !press) return;
  press = null;
  a2.widget.post({ open: true }).catch(() => {});
});
document.addEventListener("contextmenu", (e) => e.preventDefault());

a2.ready();
// Ready: ask for what to show, in case it was sent before this page loaded.
a2.widget.post({ hello: true }).catch(() => {});
