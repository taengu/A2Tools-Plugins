// Every line a plugin's built-in voice can say, in English, one per line on
// stdout, for make_voice.py. Read from the plugin's own files, so the clips
// follow its data:
//
//   node tools/voices/phrases.js event-timers
//   node tools/voices/phrases.js cooldowns
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const plugin = process.argv[2];
const dir = path.join(__dirname, "..", "..", "plugins", plugin);
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const ctx = { window: {} };
vm.createContext(ctx);
const out = new Set();

if (plugin === "event-timers") {
  // schedule.js' names, and plugin.js' SPOKEN words and LEADS.
  vm.runInContext(read("schedule.js").replace(/^const /gm, "var "), ctx);
  const src = read("plugin.js");
  const spoken = /^const SPOKEN = \{[\s\S]*?^\};/m.exec(src)[0].replace(/^const /, "var ");
  const leads = /^const LEADS = (\[[^\]]*\]);/m.exec(src)[1];
  vm.runInContext(`${spoken}\nvar LEADS = ${leads};`, ctx);
  const { SPOKEN, LEADS, EVENT_TEXT } = ctx;
  for (const k of Object.keys(EVENT_TEXT)) out.add(SPOKEN.name(k));
  // The sample line's name when no event is scheduled.
  out.add("Shugo Festival");
  for (const n of LEADS.filter((n) => n > 0)) {
    out.add(SPOKEN.soon(n));
    out.add(SPOKEN.bossSoon(n));
    // The Dimensional Invasion's "may open" alert (0.9.1, optional).
    if (SPOKEN.maySoon) out.add(SPOKEN.maySoon(n));
  }
  // The invasion as it may open, and as the game says it has (0.9.1).
  for (const k of ["now", "bossNow", "fought", "mayNow", "opened"]) if (SPOKEN[k]) out.add(SPOKEN[k]);
} else if (plugin === "cooldowns") {
  // Every skill's and buff's name, and the sample line with no skill shown.
  vm.runInContext(read("skills.js"), ctx);
  const D = ctx.window.COOLDOWN_DATA;
  for (const c of Object.values(D.classes)) for (const s of c.skills) out.add(s.n?.en);
  for (const b of Object.values(D.buffs)) out.add(D.buffNames?.[b.t]?.en);
  out.add("Skills");
  // Not the game's names but its developers' notes ("For Testing_…", "100%
  // chance, 50% Reflected"): no clip, the computer's voice says them.
  for (const t of [...out]) if (/[_=%]|testing|condition|\(temp|capped at|chance/i.test(t || "")) out.delete(t);
} else {
  throw new Error(`no phrases for ${plugin}`);
}

for (const t of [...out].filter(Boolean).sort()) console.log(t);
