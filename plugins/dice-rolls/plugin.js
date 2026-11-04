// Dice Rolls: an item rolled for with Dice Roll on, from the drop to who won
// it. The game says this only in chat, which scrolls away; the meter hands
// each roll over as it comes (a2.on("lootRoll"), permission
// "events:loot-rolls", meter 2.0.88 on).
//
// While a roll is going a card on screen lists every number, highest first,
// yours marked, with the time left; then the winner, for as long as the
// player chose. Every roll is kept here, newest first.
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const L = globalThis.DiceLogic;

const DEFAULTS = { cardOn: "on", keepFor: 10, size: "1" };
// The game's grade colours, by DICE_GRADES: Common, Rare, Legend, Unique,
// Epic, Special.
const GRADE_COLORS = ["#e8edf3", "#7ee08a", "#6fb6ff", "#f5cf6b", "#ff9f5a", "#e59bff"];
const CARD_WIDTH = 300;
// The most numbers a card lists; the rest are counted.
const CARD_ROWS = 8;

let prefs = { ...DEFAULTS };
let history = [];
let me = null;
let tab = "rolls";
let lang = "en";
let words = DICE_UI.en;
// Rows opened in the window (by key); a going roll is open unless closed.
const opened = new Set();
const closed = new Set();
// Rolls the player hid from the card.
const dismissed = new Set();
let test = null;

const keyOf = (r) => r.rollId || `${r.itemId}@${r.openedAt}`;
const nf = () => new Intl.NumberFormat(lang);
const num = (n) => (typeof n === "number" ? nf().format(n) : "–");
const itemOf = (id) => {
  const it = id == null ? null : DICE_ITEMS[String(id)];
  return {
    name: it ? it[1][lang] || it[1].en : id == null ? words.noItem : words.unknownItem(id),
    color: GRADE_COLORS[it ? it[0] : 0],
  };
};
const serverName = (id) => (id == null ? "" : DICE_SERVERS[lang]?.[id] || DICE_SERVERS.en?.[id] || words.serverN(id));
const nameOf = (x) => (x.mine ? words.you : x.name || "?");
const left = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const when = (at) => {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat(lang, today ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" }).format(d);
};
// "T7 won with 5,070", "You won with 9,361", or that no winner was heard.
const outcome = (r) => {
  if (!r.winner) return words.noWinner;
  return r.winner.mine ? words.youWon(r.winner.roll != null ? num(r.winner.roll) : "") : words.won(r.winner.name, r.winner.roll != null ? num(r.winner.roll) : "");
};
// Your part: your number and place, a pass, or nothing.
const yourPart = (r) => {
  const p = L.place(r);
  if (p) return words.yourRoll(num(r.rolls[p.place - 1].roll), p.place, p.of);
  if (r.passes.some((x) => x.mine)) return words.youPassed;
  return words.notIn;
};
const counts = (r) => [words.rolled(r.rolls.length), r.passes.length ? words.passed(r.passes.length) : ""].filter(Boolean).join(" · ");

function translate() {
  for (const e of document.querySelectorAll("[data-t]")) {
    const text = words[e.dataset.t];
    if (typeof text === "string") e.textContent = text;
  }
  for (const o of $(".keepFor").options) if (o.value !== "0") o.textContent = words.seconds(o.value);
}

// ----- The window -----

function detail(r) {
  const box = el("div", "detail");
  const top = r.rolls[0]?.roll;
  for (const x of r.rolls) {
    const line = el("div", `line${x.mine ? " mine" : ""}${x.roll === top ? " top" : ""}`);
    line.title = [x.name, serverName(x.serverId)].filter(Boolean).join(" · ");
    line.append(el("span", "num", num(x.roll)), el("span", "who", nameOf(x)));
    box.append(line);
  }
  if (r.passes.length) box.append(el("div", "passes", `${words.passedBy}: ${r.passes.map(nameOf).join(", ")}`));
  return box;
}

function renderRolls() {
  const view = $('[data-view="rolls"]');
  view.replaceChildren();
  if (!history.length) {
    view.append(el("p", "empty", words.empty), el("p", "note", words.old));
    return;
  }
  const now = Date.now();
  const list = el("ol", "rolls");
  for (const r of history) {
    const key = keyOf(r);
    const going = L.going(r, now);
    const open = going ? !closed.has(key) : opened.has(key);
    const item = el("li", `${going ? "going" : ""}${open ? " open" : ""}`);
    const row = el("button", "rollRow");
    row.type = "button";
    row.setAttribute("aria-expanded", String(open));
    const it = itemOf(r.itemId);
    const grade = el("span", "grade");
    grade.style.setProperty("--g", it.color);
    const text = el("div", "rowText");
    const name = el("div", "rowName", r.count > 1 ? `${it.name} ×${r.count}` : it.name);
    name.style.setProperty("--g", it.color);
    const sub = el("div", "rowSub");
    if (going) sub.textContent = [words.rolling, r.endsAt ? left(r.endsAt - now) : "", counts(r)].filter(Boolean).join(" · ");
    else sub.append(el("span", r.winner ? "win" : null, outcome(r)), ` · ${yourPart(r)}`);
    text.append(name, sub);
    const right = el("div", "rowRight", when(r.openedAt));
    const chev = el("span", "chev");
    chev.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    row.append(grade, text, right, chev);
    row.addEventListener("click", () => {
      const set = going ? closed : opened;
      if (set.has(key)) set.delete(key);
      else set.add(key);
      renderRolls();
    });
    item.append(row);
    if (open) item.append(detail(r));
    list.append(item);
  }
  view.append(list);
}

function setTab(name) {
  tab = name;
  for (const b of document.querySelectorAll(".tabs [role=tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  for (const v of document.querySelectorAll(".view")) v.hidden = v.dataset.view !== tab;
  renderRolls();
}

// ----- The card -----

// What the card shows: each roll going, and each just over for as long as
// the player chose, not hidden.
function cardRolls(now) {
  if (test) return test.filter((r) => !dismissed.has(keyOf(r)));
  if (prefs.cardOn !== "on") return [];
  const keep = Number(prefs.keepFor) * 1000;
  return history.filter((r) => {
    if (dismissed.has(keyOf(r))) return false;
    if (L.going(r, now)) return true;
    return keep === 0 ? now - r.endedAt < 30 * 60_000 : now - r.endedAt < keep;
  });
}

function cardData(rolls, now) {
  return {
    scale: Number(prefs.size) || 1,
    hide: words.hide,
    rolls: rolls.map((r) => {
      const it = itemOf(r.itemId);
      const going = L.going(r, now);
      const top = r.rolls[0]?.roll;
      return {
        key: keyOf(r),
        item: r.count > 1 ? `${it.name} ×${r.count}` : it.name,
        color: it.color,
        going,
        endsAt: going ? r.endsAt : null,
        counts: counts(r),
        lines: going
          ? r.rolls.slice(0, CARD_ROWS).map((x) => ({ num: num(x.roll), name: nameOf(x), mine: !!x.mine, top: x.roll === top }))
          : [],
        more: going && r.rolls.length > CARD_ROWS ? `+${r.rolls.length - CARD_ROWS}` : "",
        // Yours, when it is below the ones listed.
        mineBelow: going && r.rolls.findIndex((x) => x.mine) >= CARD_ROWS ? words.yourRoll(num(r.rolls.find((x) => x.mine).roll), L.place(r).place, L.place(r).of) : "",
        outcome: going ? "" : outcome(r),
        won: !going && !!r.winner,
        you: going ? "" : yourPart(r),
      };
    }),
  };
}

let cardNow = null;
let cardHeight = 120;
let cardOpen = false;

async function updateCard() {
  const now = Date.now();
  const rolls = cardRolls(now);
  if (!rolls.length) {
    cardNow = null;
    if (cardOpen) {
      cardOpen = false;
      await a2.widgets.close("card").catch(() => {});
    }
    return;
  }
  const data = cardData(rolls, now);
  const same = JSON.stringify(data) === JSON.stringify(cardNow);
  cardNow = data;
  if (!cardOpen) {
    cardOpen = true;
    await a2.widgets.open("card", { width: Math.round(CARD_WIDTH * data.scale), height: cardHeight }).catch(() => {});
  }
  if (!same) a2.widgets.send("card", data).catch(() => {});
}

// A made-up roll for the test card: going for a few seconds, then won.
function startTest() {
  const now = Date.now();
  const player = (name, roll) => ({ name, serverId: 1304, roll, mine: false });
  const r = {
    rollId: "test", itemId: 514310074, count: 1, openedAt: now, endsAt: now + 8000, lastAt: now, endedAt: null, winner: null, passes: [],
    rolls: [player("T7", 5070), player("Exodus", 3985), player("Kayamo", 3278), player("HeavenDorian", 2846), { name: me?.name, serverId: me?.serverId, roll: 2003, mine: true }, player("Codix", 1944)],
  };
  dismissed.delete("test");
  test = [r];
  updateCard();
  setTimeout(() => {
    if (!test) return;
    test = [{ ...r, endedAt: Date.now(), winner: { name: "T7", serverId: 1304, roll: 5070, mine: false } }];
    updateCard();
  }, 5000);
  setTimeout(() => {
    test = null;
    updateCard();
  }, 5000 + Math.max(5, Number(prefs.keepFor) || 10) * 1000);
}

// ----- Events -----

let saveTimer = null;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => a2.storage.set("history", history).catch(() => {}), 1000);
};

a2.on("lootRoll", (e) => {
  history = L.apply(history, e, me);
  save();
  renderRolls();
  updateCard();
});
a2.on("character", (c) => {
  if (c?.name) me = { name: c.name, serverId: c.serverId ?? null };
});
a2.on("widget-message", async ({ data }) => {
  if (!data) return;
  if (data.hello) {
    if (cardNow) a2.widgets.send("card", cardNow).catch(() => {});
    return;
  }
  // The card fits its rolls: its page says how tall they came out.
  if (typeof data.height === "number" && cardNow) {
    const height = Math.max(40, Math.min(900, Math.ceil(data.height)));
    if (Math.abs(height - cardHeight) > 1) {
      cardHeight = height;
      await a2.widgets.open("card", { width: Math.round(CARD_WIDTH * cardNow.scale), height }).catch(() => {});
    }
    return;
  }
  if (data.dismiss) {
    dismissed.add(data.dismiss);
    updateCard();
    return;
  }
  if (data.open) {
    if (data.key) {
      closed.delete(data.key);
      opened.add(data.key);
    }
    setTab("rolls");
    a2.window?.show?.();
  }
});
a2.on("language", (code) => {
  lang = DICE_UI[code] ? code : DICE_UI[String(code).split("-")[0]] ? String(code).split("-")[0] : "en";
  words = DICE_UI[lang];
  translate();
  renderRolls();
  cardNow = null;
  updateCard();
});

// Each second: the time left, and rolls that ran out with no winner heard.
setInterval(() => {
  const now = Date.now();
  const settled = L.settle(history, now);
  if (settled !== history) {
    history = settled;
    save();
  }
  if (history.some((r) => L.going(r, now)) || settled !== history) renderRolls();
  updateCard();
}, 1000);

for (const b of document.querySelectorAll(".tabs [role=tab]")) b.addEventListener("click", () => setTab(b.dataset.tab));
for (const key of ["cardOn", "keepFor", "size"]) {
  $(`.${key}`).addEventListener("change", async () => {
    prefs[key] = key === "keepFor" ? Number($(`.${key}`).value) : $(`.${key}`).value;
    await a2.storage.set("prefs", prefs).catch(() => {});
    if (key === "size" && cardOpen) {
      cardOpen = false;
      await a2.widgets.close("card").catch(() => {});
    }
    cardNow = null;
    updateCard();
  });
}
$(".test").addEventListener("click", startTest);
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
  $(".clear").textContent = words.clear;
  await a2.storage.set("history", history).catch(() => {});
  renderRolls();
  updateCard();
});

(async () => {
  const stored = await a2.storage.get("prefs").catch(() => null);
  if (stored && typeof stored === "object") prefs = { ...DEFAULTS, ...stored };
  const kept = await a2.storage.get("history").catch(() => null);
  if (Array.isArray(kept)) history = kept;
  // Rolls that ended before the page opened get no card.
  for (const r of history) if (!L.going(r, Date.now())) dismissed.add(keyOf(r));
  $(".cardOn").value = prefs.cardOn;
  $(".keepFor").value = String(prefs.keepFor);
  $(".size").value = String(prefs.size);
  translate();
  setTab("rolls");
  a2.ready();
})();
