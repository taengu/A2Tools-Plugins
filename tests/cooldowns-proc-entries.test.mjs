import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// A one-skill cooldown entry seconds after a use is a proc taking time off,
// not the use's whole cooldown (#183: a Cleric's Bolt, a Chanter's Spinning
// Strike, from the GDC5UH and AV4PSZ logs).
const source = (name) => readFileSync(new URL(`../plugins/cooldowns/${name}`, import.meta.url), "utf8");

function engine() {
  const context = vm.createContext({
    window: {}, UI: { en: {} }, TextEncoder,
    Date: class extends Date { static now() { return 1000; } },
    document: { querySelector: () => ({}) },
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
  });
  vm.runInContext(`${source("skills.js")}\n${source("plugin.js").split("// ---- The page")[0]}
    function renderSkills() {}
    globalThis.api = { onSkill, onCooldowns, cooldownOf, learned: () => mine.learned };`, context);
  return context.api;
}

const BOLT = 17060000;
const SPINNING = 18290000;

test("Bolt read 16 s after its release, with 7 s taken off, teaches nothing", () => {
  const p = engine();
  // GDC5UH: released at 15.0 s (1E 38, 17060340), 17.4 s left at 31.06 s,
  // 7.75 s left at 33.7 s, ready at 41.3 s.
  p.onSkill({ skill: 17060340 }, 15_000);
  p.onCooldowns({ skills: [{ group: BOLT, ms: 17_400 }] }, 31_060);
  p.onCooldowns({ skills: [{ group: BOLT, ms: 7_750 }] }, 33_700);
  p.onCooldowns({ skills: [{ group: BOLT, ms: 0 }] }, 41_300);
  assert.equal(p.learned()[BOLT], undefined);
  assert.equal(p.cooldownOf(BOLT), 45_000);
});

test("an entry that comes with the use is the whole cooldown", () => {
  const p = engine();
  p.onSkill({ skill: 18290010 }, 10_000);
  p.onCooldowns({ skills: [{ group: SPINNING, ms: 24_300 }] }, 11_700);
  assert.equal(p.learned()[SPINNING], 26_000);
});

test("a proc's entry later on doesn't shorten what was learnt", () => {
  const p = engine();
  p.onSkill({ skill: 18290010 }, 10_000);
  p.onCooldowns({ skills: [{ group: SPINNING, ms: 24_300 }] }, 11_700);
  // AV4PSZ: 6.3 s after a use, 13.7 s left: 20.0 s, where the game has 26 s.
  p.onSkill({ skill: 18290010 }, 40_000);
  p.onCooldowns({ skills: [{ group: SPINNING, ms: 13_700 }] }, 46_300);
  assert.equal(p.learned()[SPINNING], 26_000);
});

test("the held skill's release is decoded", () => {
  const manifest = JSON.parse(source("manifest.json"));
  const release = manifest.decoders.find((d) => d.name === "skill-released");
  assert.equal(release.opcode, "1E 38");
  assert.ok(manifest.permissions.includes("decoder:skill-released"));
  assert.match(source("plugin.js"), /a2\.on\("decoded:skill-released"/);
});
