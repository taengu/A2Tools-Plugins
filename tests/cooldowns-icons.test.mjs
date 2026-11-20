// Tests for the icons the plugin ships (skills.js names them, icons.js has the pictures)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {} });
for (const file of ["skills.js", "icons.js"]) {
  vm.runInContext(readFileSync(new URL(`../plugins/cooldowns/${file}`, import.meta.url), "utf8"), context);
}
const { COOLDOWN_DATA: data, COOLDOWN_ICONS: icons } = context.window;

test("every icon skills.js names is in icons.js", () => {
  const named = new Set();
  for (const c of Object.values(data.classes)) for (const s of c.skills) if (s.icon) named.add(s.icon);
  for (const b of Object.values(data.buffs)) if (b.icon) named.add(b.icon);
  const missing = [...named].filter((name) => !icons[name]);
  assert.deepEqual(missing, [], "these icons are named but have no picture");
});

test("Earth's Blessing (Earth Punishment's buff) gets 030: the 040_Buff its tables name isn't on the CDN", () => {
  for (const id of ["174000271", "174000281", "174000371", "174000381", "174000571", "174000591"]) {
    assert.equal(data.buffs[id]?.icon, "ICON_CL_SKILL_030", `variant ${id} doesn't have icon 030 (is the redirect in build_skills.py's SWAPPED gone?)`);
  }
});

test("Salvation, Power Burst, Absolution and Voice of Doom get their own icon, not the one a number higher", () => {
  const want = { 17270000: "ICON_CL_SKILL_026", 17280000: "ICON_CL_SKILL_027", 17290000: "ICON_CL_SKILL_028", 17300000: "ICON_CL_SKILL_029" };
  const cleric = data.classes["17"].skills;
  for (const [group, icon] of Object.entries(want)) {
    const skill = cleric.find((s) => s.g === Number(group));
    assert.equal(skill?.icon, icon, `${skill?.n.en ?? group} doesn't have ${icon} (is it gone from build_skills.py's PINNED?)`);
  }
});

test("Salvation's and Absolution's buffs get the same icon as the skill itself", () => {
  for (const id of ["172700001", "172700101", "172700201", "172700401"]) {
    assert.equal(data.buffs[id]?.icon, "ICON_CL_SKILL_026", `Salvation buff ${id} doesn't have icon 026`);
  }
  for (const id of ["172900401", "172900501"]) {
    assert.equal(data.buffs[id]?.icon, "ICON_CL_SKILL_028", `Absolution buff ${id} doesn't have icon 028`);
  }
});

test("Prayer of Concentration's buff gets Passive_006, the icon the game shows", () => {
  assert.equal(data.buffs["177700011"]?.icon, "ICON_CL_SKILL_Passive_006");
});

test("The Cleric's Survival Willpower shows the Gladiator's picture, like the game", () => {
  for (const id of ["177900011", "177900021"]) {
    assert.equal(data.buffs[id]?.icon, "ICON_GL_SKILL_Passive_009", `Survival Willpower buff ${id} doesn't have the Gladiator's picture`);
  }
});
