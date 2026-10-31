// Death Recap: who killed you, once you are dead. The meter hands it over
// only then (a2.on("deathRecap"), permission "events:death-recap", meter
// 2.0.81 on): the killer's name, server, legion, class, level, gear score
// and combat power, and the damage they did to you. Nothing about other
// players reaches this plugin while you live.
//
// Each death is kept (history and tallies), shown in this window, and
// briefly as a popup widget; clicking the popup opens this window.
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const L = globalThis.RecapLogic;

const DEFAULTS = { style: "toast", hideAfter: 10, size: "1" };
let prefs = { ...DEFAULTS };
let history = [];
let tab = "last";
let tallyBy = "player";
// The death the Last death tab shows (an index into history).
let shown = 0;
// Assists listed before the "Show all" bar; and whether it is open.
const ASSISTS_SHOWN = 5;
let assistsOpen = false;
let lang = "en";
let words = RECAP_UI.en;
let popupTimer = null;

const nf = () => new Intl.NumberFormat(lang);
const num = (n) => (typeof n === "number" ? nf().format(n) : "–");
const serverName = (id) => (id == null ? "" : RECAP_SERVERS[lang]?.[id] || RECAP_SERVERS.en?.[id] || words.serverN(id));
const className = (key) => {
  const i = RECAP_CLASS_KEYS.indexOf(key);
  return i < 0 ? "" : (RECAP_CLASSES[lang] || RECAP_CLASSES.en)[i];
};
const classIcon = (key) => (RECAP_CLASS_KEYS.includes(key) ? RECAP_ICONS[key] : null);
// The popup is its own page and loads the file.
const classFile = (key) => (RECAP_CLASS_KEYS.includes(key) ? `icons/${key}.png` : null);
const when = (at) => {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat(lang, today ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" }).format(d);
};
const fightText = (ms) => (typeof ms === "number" ? words.seconds((ms / 1000).toLocaleString(lang, { maximumFractionDigits: 1 })) : "–");
// "DISSONATA · Lumiel · Gladiator · Lv 45", leaving out what isn't known.
const subline = (h) =>
  [h.legion || words.noLegion, serverName(h.serverId), className(h.class), h.level ? words.lv(h.level) : ""].filter(Boolean).join(" · ");

function translate() {
  for (const e of document.querySelectorAll("[data-t]")) {
    const text = words[e.dataset.t];
    if (typeof text === "string") e.textContent = text;
  }
  for (const e of document.querySelectorAll("[data-t-label]")) {
    const text = words[e.dataset.tLabel];
    if (typeof text === "string") {
      e.setAttribute("aria-label", text);
      e.title = text;
    }
  }
  for (const o of $(".hideAfter").options) if (o.value !== "0") o.textContent = words.seconds(o.value);
}

// ----- The window -----


function stat(label, value, cls) {
  const box = el("div", "stat");
  box.append(el("div", "label", label), el("div", `value ${cls || ""}`, value));
  return box;
}

// Combat power or gear score with the game's icon, the words for screen
// readers and on hover.
function score(kind, value) {
  const label = kind === "cp" ? words.cp : words.gs;
  const box = el("span", `score ${kind}`);
  box.title = label;
  const icon = el("img", "scoreIcon");
  icon.src = RECAP_ICONS[kind];
  icon.alt = "";
  box.append(icon, el("span", "visuallyHidden", `${label} `), el("span", "value", value));
  return box;
}

function renderLast() {
  const view = $('[data-view="last"]');
  view.replaceChildren();
  const h = history[shown];
  if (!h) {
    view.append(el("p", "empty", words.empty), el("p", "note", words.old));
    return;
  }
  const head = el("div", "head");
  const icon = classIcon(h.class);
  if (icon) {
    const img = el("img", "classIcon");
    img.src = icon;
    img.alt = className(h.class);
    head.append(img);
  }
  const who = el("div", "who");
  who.append(
    el("div", "killedBy", words.killedBy),
    el("div", "name", h.name),
    el("div", "sub", subline(h)),
    el("div", "when", `${when(h.at)} · ${words.times(L.timesBy(history, h))}`),
  );
  head.append(who);

  const scores = el("div", "scores");
  scores.append(score("cp", L.cpText(h.cp, lang)), score("gs", num(h.gs)));
  who.insertBefore(scores, who.lastChild);

  const fight = el("div", "fight");
  fight.append(stat(words.damage, num(h.damage)), stat(words.hits, num(h.hits)), stat(words.fight, fightText(h.durationMs)), stat(words.dps, num(h.dps)));

  const skills = el("div", "skills");
  skills.append(el("div", "label", words.skills));
  if (!h.skills.length) skills.append(el("p", "note", words.noHits));
  const top = Math.max(1, ...h.skills.map((s) => s.damage));
  for (const s of h.skills) {
    const row = el("div", "skill");
    const line = el("div", "skillLine");
    line.append(el("span", null, s.name || `#${s.id}`), el("span", "skillNum", `${num(s.damage)} · ${words.hitCount(s.hits)}`));
    const bar = el("div", "bar");
    const fill = el("div", "fill");
    fill.style.width = `${Math.round((s.damage / top) * 100)}%`;
    bar.append(fill);
    row.append(line, bar);
    skills.append(row);
  }
  view.append(head, fight);
  // The others who damaged you in that fight.
  const assists = h.assists || [];
  if (assists.length) {
    const box = el("div", "assists");
    box.append(el("div", "label", words.assistedBy));
    for (const a of assistsOpen ? assists : assists.slice(0, ASSISTS_SHOWN)) {
      const row = el("div", "assist");
      const img = el("img", "rowIcon");
      if (classIcon(a.class)) img.src = classIcon(a.class);
      img.alt = className(a.class);
      const text = el("div", "rowText");
      text.append(
        el("div", "rowName", a.name || "?"),
        el("div", "rowSub", [a.legion, serverName(a.serverId), className(a.class), a.level ? words.lv(a.level) : ""].filter(Boolean).join(" · ")),
      );
      const right = el("div", "rowRight");
      right.append(el("div", "rowNum", num(a.damage)), el("div", null, words.hitCount(a.hits)));
      // Their combat power beside their name, as the killer's: icon and number.
      if (typeof a.cp === "number") text.firstChild.append(score("cp", L.cpText(a.cp, lang)));
      row.append(img, text, right);
      box.append(row);
    }
    // The rest behind a bar.
    if (assists.length > ASSISTS_SHOWN) {
      const more = el("button", "moreBar", assistsOpen ? words.showFewer : words.showAll(assists.length));
      more.type = "button";
      more.setAttribute("aria-expanded", String(assistsOpen));
      more.addEventListener("click", () => {
        assistsOpen = !assistsOpen;
        renderLast();
        $(".moreBar")?.focus();
      });
      box.append(more);
    }
    view.append(box);
  }
  view.append(skills);
}

function renderHistory() {
  const view = $('[data-view="history"]');
  view.replaceChildren();
  if (!history.length) {
    view.append(el("p", "empty", words.empty));
    return;
  }
  const list = el("ol", "history");
  history.forEach((h, i) => {
    const item = el("li");
    const b = el("button", "deathRow");
    b.type = "button";
    const icon = classIcon(h.class);
    const img = el("img", "rowIcon");
    if (icon) img.src = icon;
    img.alt = className(h.class);
    const text = el("div", "rowText");
    text.append(el("div", "rowName", h.name), el("div", "rowSub", subline(h)));
    const right = el("div", "rowRight");
    right.append(el("div", "rowNum cpText", L.cpText(h.cp, lang)), el("div", null, when(h.at)));
    b.append(img, text, right);
    b.addEventListener("click", () => {
      shown = i;
      assistsOpen = false;
      setTab("last");
    });
    item.append(b);
    list.append(item);
  });
  view.append(list);
}

function renderTally() {
  for (const b of document.querySelectorAll(".tallyBy button")) b.setAttribute("aria-pressed", String(b.dataset.by === tallyBy));
  const list = $(".tallyList");
  list.replaceChildren();
  if (!history.length) {
    list.append(el("li", "empty", words.empty));
    return;
  }
  for (const g of L.tally(history, tallyBy)) {
    const h = g.sample;
    const item = el("li", "tallyRow");
    const title =
      tallyBy === "player" ? h.name : tallyBy === "legion" ? h.legion || words.noLegion : serverName(h.serverId) || "–";
    const sub =
      tallyBy === "player" ? subline(h) : tallyBy === "legion" ? serverName(h.serverId) : "";
    const text = el("div", "rowText");
    text.append(el("div", "rowName", title));
    if (sub) text.append(el("div", "rowSub", sub));
    const right = el("div", "rowRight");
    right.append(el("div", "count", words.deaths(g.count)), el("div", null, words.last(when(g.last))));
    if (tallyBy === "player" && classIcon(h.class)) {
      const img = el("img", "rowIcon");
      img.src = classIcon(h.class);
      img.alt = className(h.class);
      item.append(img);
    }
    item.append(text, right);
    list.append(item);
  }
}

function render() {
  // The camera: on the last death, when there is one to show.
  $(".shot").hidden = tab !== "last" || !history.length;
  renderLast();
  renderHistory();
  renderTally();
}

function setTab(name) {
  tab = name;
  for (const b of document.querySelectorAll(".tabs [role=tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  for (const v of document.querySelectorAll(".view")) v.hidden = v.dataset.view !== tab;
  render();
}

// ----- The popup -----

// Each style's size at scale 1 (CSS px), with room for its shadow.
const POPUP_SIZE = { toast: [476, 144], banner: [716, 244], strip: [760, 68] };

function popupData(h) {
  return {
    style: prefs.style,
    scale: Number(prefs.size),
    killedBy: words.killedBy,
    name: h.name,
    icon: classFile(h.class),
    className: className(h.class),
    level: h.level ? words.lv(h.level) : "",
    legion: h.legion || "",
    server: serverName(h.serverId),
    cp: L.cpText(h.cp, lang),
    cpLabel: words.cp,
    gs: num(h.gs),
    gsLabel: words.gs,
    damage: num(h.damage),
    damageLabel: words.damage,
    dmg: words.dmg,
    dps: num(h.dps),
    fight: fightText(h.durationMs),
    fightLabel: words.fight,
    times: words.times(L.timesBy(history, h)),
    topSkill: h.skills[0] ? `${h.skills[0].name || `#${h.skills[0].id}`} ${num(h.skills[0].damage)}` : "",
    assists: (h.assists || []).length ? words.assists(h.assists.length) : "",
    hideLabel: words.hide,
    // The popup names four at most, then how many more.
    assistNames: (h.assists || []).length
      ? `${words.assistedBy}: ${h.assists.slice(0, 4).map((a) => a.name || "?").join(", ")}${h.assists.length > 4 ? ` +${h.assists.length - 4}` : ""}`
      : "",
  };
}

// What the popup shows now: sent again when its page says it is ready, as
// the meter drops what is sent to a widget whose page is still loading (the
// first popup after the meter starts never showed, 2026-10-28).
let popupNow = null;

async function closePopup() {
  clearTimeout(popupTimer);
  popupTimer = null;
  popupNow = null;
  await a2.widgets.close("popup").catch(() => {});
}

async function showPopup(h) {
  if (prefs.style === "off" || !h) return;
  const [w, hgt] = POPUP_SIZE[prefs.style] || POPUP_SIZE.toast;
  const scale = Number(prefs.size) || 1;
  await a2.widgets.open("popup", { width: Math.round(w * scale), height: Math.round(hgt * scale) }).catch(() => {});
  popupNow = popupData(h);
  await a2.widgets.send("popup", popupNow).catch(() => {});
  clearTimeout(popupTimer);
  const secs = Number(prefs.hideAfter);
  if (secs > 0) popupTimer = setTimeout(closePopup, secs * 1000);
}

// A made-up death to place the popup by, when none is kept yet.
const SAMPLE = {
  at: Date.now(), name: "NotYourSnack", serverId: 2304, legion: "DISSONATA", class: "gladiator", level: 45, gs: 2783, cp: 170738,
  damage: 22042, hits: 13, durationMs: 1898, dps: 11613, skills: [{ id: 11440000, name: "Upward Strike", damage: 6436, hits: 1 }],
  assists: [{ name: "Tewy", class: "ranger", level: 45, gs: 2690, cp: 152300, damage: 8120, hits: 6 }],
};

// ----- Events -----

a2.on("deathRecap", async (recap) => {
  const before = history.length;
  history = L.add(history, recap);
  if (history.length === before) return;
  shown = 0;
  assistsOpen = false;
  await a2.storage.set("history", history).catch(() => {});
  render();
  showPopup(history[0]);
});
a2.on("widget-message", async ({ data }) => {
  if (data?.dismiss) {
    await closePopup();
    return;
  }
  if (data?.hello) {
    if (popupNow) a2.widgets.send("popup", popupNow).catch(() => {});
    return;
  }
  if (!data || !data.open) return;
  await closePopup();
  shown = 0;
  setTab("last");
  a2.window?.show?.();
});
a2.on("language", (code) => {
  lang = RECAP_UI[code] ? code : RECAP_UI[String(code).split("-")[0]] ? String(code).split("-")[0] : "en";
  words = RECAP_UI[lang];
  translate();
  render();
});

for (const b of document.querySelectorAll(".tabs [role=tab]")) b.addEventListener("click", () => setTab(b.dataset.tab));

// The recap as a picture: the card (not the tabs) to the clipboard and the
// meter's screenshot folder. Meter 2.0.81 on.
let shotTimer = null;
const shotSay = (text) => {
  $(".shotStatus").textContent = text;
  clearTimeout(shotTimer);
  shotTimer = setTimeout(() => ($(".shotStatus").textContent = ""), 4000);
};
$(".shot").addEventListener("click", async () => {
  if (typeof a2.screenshot !== "function") return shotSay(words.old);
  const r = $('[data-view="last"]').getBoundingClientRect();
  const bottom = Math.min(r.bottom, window.innerHeight);
  try {
    const got = await a2.screenshot({ x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 6), width: r.width + 16, height: bottom - r.top + 12 });
    shotSay(got?.file ? words.shotSaved : got?.clipboard ? words.shotCopied : words.shotFailed);
  } catch {
    shotSay(words.shotFailed);
  }
});
for (const b of document.querySelectorAll(".tallyBy button")) {
  b.addEventListener("click", () => {
    tallyBy = b.dataset.by;
    renderTally();
  });
}
for (const key of ["style", "hideAfter", "size"]) {
  $(`.${key}`).addEventListener("change", async () => {
    prefs[key] = key === "hideAfter" ? Number($(`.${key}`).value) : $(`.${key}`).value;
    await a2.storage.set("prefs", prefs).catch(() => {});
    if (prefs.style === "off") closePopup();
  });
}
$(".test").addEventListener("click", () => {
  const was = prefs.style;
  if (was === "off") prefs.style = "toast";
  showPopup(history[0] || SAMPLE);
  prefs.style = was;
});
// Two clicks: the first asks.
let clearArmed = false;
$(".clear").addEventListener("click", async () => {
  if (!history.length) return;
  if (!clearArmed) {
    clearArmed = true;
    $(".clear").textContent = words.clearConfirm(history.length);
    setTimeout(() => {
      clearArmed = false;
      $(".clear").textContent = words.clear;
    }, 4000);
    return;
  }
  clearArmed = false;
  history = [];
  shown = 0;
  $(".clear").textContent = words.clear;
  await a2.storage.set("history", history).catch(() => {});
  render();
});

(async () => {
  const stored = await a2.storage.get("prefs").catch(() => null);
  if (stored && typeof stored === "object") prefs = { ...DEFAULTS, ...stored };
  const kept = await a2.storage.get("history").catch(() => null);
  if (Array.isArray(kept)) history = kept;
  $(".style").value = prefs.style;
  $(".hideAfter").value = String(prefs.hideAfter);
  $(".size").value = String(prefs.size);
  translate();
  setTab("last");
  a2.ready();
})();
