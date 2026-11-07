// The energy alert over the game (plugin.js sends it what to show): each
// character near or at the Odyle cap. Dragged with the mouse, a click (no
// drag) dismisses it.
const box = document.querySelector(".alert");

a2.on("widget", (d) => {
  if (!d) return;
  document.querySelector(".title").textContent = d.title || "";
  document.querySelector(".hint").textContent = d.hint || "";
  document.querySelector(".lines").replaceChildren(
    ...(d.lines || []).map((line) => {
      const li = document.createElement("li");
      if (line.full) li.className = "full";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = line.name;
      const energy = document.createElement("span");
      energy.className = "energy";
      energy.textContent = line.energy;
      const note = document.createElement("span");
      note.className = "note";
      note.textContent = line.note;
      li.append(name, energy, note);
      return li;
    }),
  );
  document.title = d.title || "Odyle energy";
});

// A press becomes a drag once the pointer moves; a click without one
// dismisses (as Event Timers' icons: a drag started at once took the mouse,
// and the release never reached the page).
const DRAG_PX = 4;
let press = null;
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
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
  box.classList.add("leaving");
  a2.widget.post({ dismiss: true }).catch(() => {});
});

a2.ready();
