import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL("../plugins/cooldowns/skills.js", import.meta.url), "utf8"), context);
vm.runInContext(readFileSync(new URL("../plugins/cooldowns/icons.js", import.meta.url), "utf8"), context);
const { COOLDOWN_DATA: data, COOLDOWN_ICONS: icons } = context.window;

test("Gladiator skills use their current client artwork without swapping cooldowns", () => {
  for (const [group, name, cooldown, icon] of [
    [11250000, "Zikel's Blessing", 120000, "ICON_GL_SKILL_040"],
    [11400000, "Lunge Stance", 60000, "ICON_GL_SKILL_024"],
  ]) {
    const skill = data.classes["11"].skills.find((s) => s.g === group);
    assert.equal(skill.n.en, name);
    assert.equal(skill.cd, cooldown);
    assert.equal(skill.icon, icon);
    assert.match(icons[skill.icon], /^data:image\/webp;base64,/);
  }
});

test("all existing ranks of both buffs use the same corrected artwork as their skill", () => {
  for (const [prefix, name, icon] of [
    ["112500", "Zikel's Blessing", "ICON_GL_SKILL_040"],
    ["114000", "Lunge Stance", "ICON_GL_SKILL_024"],
  ]) {
    const buffs = Object.entries(data.buffs).filter(([id]) => id.startsWith(prefix) && id.length === 9);
    assert.equal(buffs.length, 6);
    for (const [, buff] of buffs) {
      assert.equal(data.buffNames[buff.t].en, name);
      assert.equal(buff.icon, icon);
    }
  }
});
