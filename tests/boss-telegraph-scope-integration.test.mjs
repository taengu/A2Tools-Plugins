import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(root, "plugins", "boss-telegraph");
const source = (name) => fs.readFileSync(path.join(plugin, name), "utf8");
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const locales = ["en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"];
const texts = (en) => Object.fromEntries(locales.map((locale) => [locale, en])); // Synthetic fixture values only.

function fixture(data) {
  const entry = (key, region, category, qualifier, en) => {
    const call = data.calls.find((row) => row.k === key);
    const field = call.line == null ? "act" : "line";
    return { k: call.k, bossKey: call.b, t: call.t, id: call.id, enabled: true, referenceOnly: false,
      verification: "guide-exact", source: { field, en: data.texts[call[field]].en }, text: texts(en),
      scope: { regions: [region], categories: [category], ...qualifier } };
  };
  const literal = entry("use:1604330:decaying-durvati", "Global", "conquest", {}, "Fixture literal destroy eggs");
  literal.verification = "game-explicit"; literal.scope = { universal: true };
  return {
    managedKeys: { fixture: [...new Set(data.calls.map((call) => call.k))] },
    dungeons: { "200001": { name: "Fixture Normal", difficulty: "normal" }, "200002": { name: "Fixture Hard", difficulty: "hard" } },
    entries: [
      literal,
      entry("thamon-violet", "Global", "conquest", { difficulties: ["normal"] }, "Fixture Global magic instruction"),
      entry("thamon-violet", "KR", "conquest", { difficulties: ["hard"] }, "Fixture KR magic instruction"),
      entry("thamon-red", "Global", "conquest", { difficulties: ["hard"] }, "Fixture Global physical instruction"),
      entry("talisra-dark-spear", "Global", "transcendence", { stages: [3] }, "Fixture Global shield reminder"),
      entry("talisra-dark-spear", "KR", "transcendence", { stages: [7] }, "Fixture KR shield reminder"),
      entry("cast:1800050:ultimate-berk", "Global", "conquest", { difficulties: ["normal"] }, "Fixture Global cover instruction"),
    ],
  };
}

class Element {
  constructor(type = "") {
    this.type = type; this.value = ""; this.children = []; this.dataset = {}; this.style = {}; this.events = {};
    this.classList = { toggle() {}, remove() {} };
  }
  addEventListener(name, fn) { this.events[name] = fn; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute() {}
  focus() {}
}

async function page({ stored = null, registry = fixture } = {}) {
  let time = 100_000, timerId = 0;
  class ClockDate extends Date { static now() { return time; } }
  const elements = new Map(), handlers = new Map(), timers = new Map(), spoken = [], saved = [];
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element([".enabled", ".widget", ".lock", ".tellMeWhatToDo"].includes(selector) ? "checkbox" : ""));
    return elements.get(selector);
  };
  const sandbox = vm.createContext({
    Date: ClockDate,
    window: { speechSynthesis: { getVoices: () => [{ name: "Local", voiceURI: "local", lang: "en-US" }], addEventListener() {}, cancel() {}, speak: (utterance) => spoken.push(utterance.text) } },
    document: { documentElement: {}, body: { style: {} }, querySelector: get, querySelectorAll: () => [], createElement: () => new Element(), createTextNode: (text) => text },
    a2: { storage: { get: async () => structuredClone(stored), set: async (key, value) => saved.push({ key, value: structuredClone(value) }) }, on: (event, fn) => handlers.set(event, fn),
      widgets: { locked: async () => false, open: async () => {}, close: async () => {}, send: async () => {} }, ready() {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout: (id) => timers.delete(id), setInterval() {},
    atob: (encoded) => Buffer.from(encoded, "base64").toString("binary"),
  });
  for (const name of ["bosses.js", "actions.js", "i18n.js", "context.js", "activation.js", "logic.js", "voice.js"]) vm.runInContext(source(name), sandbox);
  if (registry === "real") vm.runInContext(source("mechanics.js"), sandbox);
  else sandbox.window.BOSS_MECHANICS = registry(sandbox.window.BOSS_CALLOUTS);
  for (const name of ["BossLogic", "BossContext", "BossActivation"]) sandbox[name] = sandbox.window[name];
  vm.runInContext(source("plugin.js") + "\nglobalThis.scopeTest = { engine, context: guideContext, prefs: () => prefs, data: DATA, registry: MECHANICS, activation };", sandbox);
  await flush(); handlers.get("game")({ running: true }); time += 1;
  const advance = async (ms = 1) => {
    time += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); }
    sandbox.scopeTest.engine.tick(); await flush();
  };
  const choose = async (selector, value) => {
    const element = get(selector); element.value = String(value); element.events.change(); await advance();
  };
  const emit = async (key, { at = time, entity = 101, instance = 1, length = 10000 } = {}) => {
    const call = sandbox.scopeTest.data.calls.find((row) => row.k === key);
    assert.ok(call, key);
    const event = call.t === "cast" ? "boss-cast" : call.t === "use" ? "boss-skill" : "boss-buff-added";
    const fields = call.t === "abnormal" ? { entity, abnormal: call.id, instance, length } : { caster: entity, skill: call.id };
    handlers.get(`decoded:${event}`)(fields, { at }); await flush();
  };
  return { ...sandbox.scopeTest, elements, handlers, spoken, saved, choose, advance, emit, now: () => time };
}

async function scope(h, region, category, qualifier, value) {
  if (region) await h.choose(".guideRegion", region);
  await h.choose(".guideCategory", category);
  if (qualifier) await h.choose(qualifier, value);
}

test("Global Talisra dark/light retains its original reminders and order without a selected stage", async () => {
  const h = await page({registry: "real", stored: {guideRegion: "Global"}});
  await h.emit("talisra-dark-spear"); assert.equal(h.spoken.at(-1), "Remember dark shield");
  await h.advance(1500); await h.emit("talisra-light-spear");
  assert.equal(h.spoken.at(-1), "Remember light shield");
  const item=h.engine.items().find(item=>item.key.startsWith("m:"));
  assert.equal(item.text,"Dark → Light"); assert.match(item.sub,/pulses|order|shield/i);
  assert.equal(h.context().stage,null); assert.equal(h.context().category,"auto");
});

test("the full captured-cadence order stays visible when other boss calls arrive", async () => {
  const h = await page({registry: "real", stored: {guideRegion: "Global"}});
  await h.emit("talisra-dark-spear"); await h.advance(1952); await h.emit("talisra-dark-spear");
  await h.advance(1945); await h.emit("talisra-light-spear");
  const calls=h.data.calls.filter(c=>c.b==='talisra-of-the-void'&&!c.mark&&['cast','use'].includes(c.t)).slice(0,3);
  assert.equal(calls.length,3);
  for(const call of calls){await h.advance(10);await h.emit(call.k);}
  const displayed=h.engine.items().slice(0,2);
  assert.equal(displayed[0].text,'Dark → Dark → Light');
  assert.equal(displayed[0].sub,h.engine.items().find(item=>item.key.startsWith('m:')).sub);
  await h.advance(13000); assert.ok(!h.engine.items().some(item=>item.key.startsWith('m:')));
});

test("sequence priority neither merges separate casters nor survives an encounter reset", async () => {
  const h=await page({registry:'real',stored:{guideRegion:'Global'}});
  await h.emit('talisra-dark-spear',{entity:101});await h.advance(1952);await h.emit('talisra-light-spear',{entity:202});
  const sequences=h.engine.items().filter(item=>item.key.startsWith('m:'));
  assert.equal(sequences.length,2);assert.deepEqual(Array.from(sequences,item=>item.text),['Light','Dark']);
  h.handlers.get('decoded:boss-map')({count:1,map:1010},{at:h.now()});await h.advance();
  assert.equal(h.engine.items().length,0);
});

test("Talisra speaks the shield action once after the signs pause, retaining the full order", async () => {
  const h=await page({registry:'real',stored:{guideRegion:'Global'}});
  await h.emit('talisra-dark-spear'); await h.advance(1952); await h.emit('talisra-dark-spear');
  await h.advance(1945); await h.emit('talisra-light-spear');
  const instruction='When the pulses begin, use matching shields in this order.';
  assert.equal(h.spoken.filter(s=>s===instruction).length,0);
  await h.advance(2499); assert.equal(h.spoken.at(-1),'Remember light shield');
  await h.advance(1); assert.equal(h.spoken.at(-1),instruction);
  assert.equal(h.engine.items()[0].text,'Dark → Dark → Light');
  await h.advance(1000); assert.equal(h.spoken.filter(s=>s===instruction).length,1);
  await h.advance(6000); await h.emit('talisra-light-spear'); await h.advance(2500);
  assert.equal(h.spoken.filter(s=>s===instruction).length,2);
  const clips=JSON.parse(source('voice.js').slice(source('voice.js').indexOf('{'),source('voice.js').lastIndexOf('}')+1));
  assert.ok(clips[instruction], 'the built-in voice must include the action instruction');
});

test("delayed sequence speech respects reset, disabled calls, custom wording and action opt-out", async () => {
  for(const mode of ['reset','disabled','custom','opt-out','stale']) {
    const h=await page({registry:'real',stored:{guideRegion:'Global'}});
    await h.emit('talisra-dark-spear'); const count=h.spoken.length;
    if(mode==='reset') h.engine.clear(h.now());
    if(mode==='disabled') h.prefs().offCall={'talisra-dark-spear':true};
    if(mode==='custom') h.prefs().custom={'talisra-dark-spear':'My sign'};
    if(mode==='opt-out') h.prefs().tellMeWhatToDo=false;
    await h.advance(mode==='stale'?13000:2500);
    assert.equal(h.spoken.length,count,mode);
  }
});


const shortCall=(h,key)=>{const c=h.data.calls.find(c=>c.k===key);return h.data.texts[c.act??c.line??c.n]?.en;};
test("an unknown activity uses the region's only instruction, and Talisra signs stay in every region",async()=>{
 for(const region of ["Global","KR"]){
  const h=await page({registry:"real"});await h.choose(".guideRegion",region);
  assert.equal(h.context().category,"auto");
  for(const key of ["thamon-violet","vakron-jump"]){
   const entry=h.registry.entries.find(e=>e.k===key&&e.scope.regions.includes(region));
   const event=entry.t==="cast"?"boss-cast":"boss-skill";
   h.handlers.get(`decoded:${event}`)({caster:101,skill:entry.id},{at:h.now()});await h.advance();
   assert.equal(h.spoken.at(-1),entry.text.en,`${region} ${key}`);
  }
  await h.choose(".guideCategory","transcendence");await h.emit("thamon-violet",{entity:202});
  assert.equal(h.spoken.at(-1),shortCall(h,"thamon-violet"),"a known, different activity keeps the short call");
  await h.choose(".guideCategory","auto");
  await h.emit("talisra-dark-spear");await h.advance(1500);await h.emit("talisra-dark-spear");await h.advance(1500);await h.emit("talisra-light-spear");
  assert.equal(h.engine.items().find(i=>i.sequence).text,"Dark → Dark → Light");
  assert.equal(h.spoken.at(-1),"Remember light shield");
 }
});
test("scoped added instructions require matching region and difficulty, otherwise original call remains",async()=>{
 for(const [region,difficulty,expected] of [["Global","normal","Fixture Global magic instruction"],["KR","hard","Fixture KR magic instruction"]]){
  const h=await page();await scope(h,region,"conquest",".guideDifficulty",difficulty);await h.emit("thamon-violet");assert.equal(h.spoken.at(-1),expected);
  await h.choose(".guideDifficulty",difficulty==="normal"?"hard":"normal");await h.emit("thamon-violet");assert.equal(h.spoken.at(-1),shortCall(h,"thamon-violet"));
 }
});
test("Global default is independent of language and explicit KR remains selected",async()=>{
 const h=await page({stored:{guideRegion:"unknown"}});assert.equal(h.context().region,"Global");h.handlers.get("language")("ko");assert.equal(h.context().region,"Global");
 await h.choose(".guideRegion","KR");h.handlers.get("language")("en");assert.equal(h.context().region,"KR");
});
test("activity and stage survive map, process boundaries and saved preference reload",async()=>{
 const h=await page();await scope(h,"Global","transcendence",".guideStage",3);
 h.handlers.get("decoded:boss-map")({count:1,map:200001},{at:h.now()});await h.advance();assert.equal(h.context().stage,3);assert.equal(h.context().category,"transcendence");assert.equal(h.context().difficulty,"normal");
 h.handlers.get("game")({running:false});h.handlers.get("game")({running:true});assert.equal(h.context().stage,3);
 const stored=h.saved.at(-1).value;const next=await page({stored});assert.equal(next.context().stage,3);assert.equal(next.context().category,"transcendence");
 await next.choose(".guideStage",7);assert.equal(next.context().stage,7);
});
test("empty registry still preserves original calls and marks without inventing added directions",async()=>{
 const h=await page({registry:()=>({entries:[],dungeons:{},managedKeys:{}})});await h.emit("thamon-violet");assert.equal(h.spoken.at(-1),shortCall(h,"thamon-violet"));
 await h.emit("talisra-dark-spear");assert.equal(h.engine.items()[0].text,"Dark");
});
test("map reset accepts a subsequent captured cast with the retained guide selection",async()=>{
 const h=await page();await scope(h,"Global","conquest",".guideDifficulty","normal");await h.advance(100);
 h.handlers.get("decoded:boss-map")({count:1,map:200001},{at:h.now()-30});await h.emit("thamon-violet",{at:h.now()-20});assert.equal(h.spoken.at(-1),"Fixture Global magic instruction");
});
test("real regional guide resolver never substitutes a different region's added instructions",async()=>{
 const h=await page({registry:"real"});
 for(const entry of h.registry.entries.filter(e=>e.enabled&&!e.referenceOnly&&!e.scope.universal)){
  const region=entry.scope.regions[0],category=entry.scope.categories?.[0]||"auto",difficulty=entry.scope.difficulties?.[0],stage=entry.scope.stages?.[0];
  const context={region,category,difficulty,stage};const call=h.data.calls.find(c=>c.k===entry.k&&c.id===entry.id&&c.t===entry.t);if(!call)continue;
  const resolved=h.activation.resolve(call,context,{});if(resolved.eligible)assert.equal(resolved.text.en,entry.text.en);
  const other=h.activation.resolve(call,{...context,region:region==="Global"?"KR":"Global"},{});
  if(other.eligible)assert.ok(h.registry.entries.some(e=>e.k===entry.k&&e.scope.regions?.includes(region==="Global"?"KR":"Global")&&e.text.en===other.text.en));
 }
});
test("Frenzy, shared by many bosses with one instruction, is said for a known boss and an unknown entity",async()=>{
 const h=await page({registry:"real",stored:{guideRegion:"Global"}});
 const frenzy=h.registry.entries.filter(e=>e.t==="abnormal"&&e.id===10000008);
 assert.ok(frenzy.length>=10);assert.equal(new Set(frenzy.map(e=>e.text.en)).size,1);
 const atiel=h.data.calls.find(c=>c.b==="atiel"&&c.t==="cast"&&!c.uncertain);
 h.handlers.get("decoded:boss-cast")({caster:303,skill:atiel.id},{at:h.now()});await h.advance(2000);
 h.handlers.get("decoded:boss-buff-added")({entity:303,abnormal:10000008,instance:4,length:10000},{at:h.now()});await h.advance();
 assert.equal(h.spoken.at(-1),frenzy[0].text.en);
 const differing=h.registry.entries.filter(e=>e.k==="cast:1604500:vakron");
 assert.ok(differing.length>0,"a shared trigger with different texts stays neutral");
 h.handlers.get("decoded:boss-cast")({caster:404,skill:1604500},{at:h.now()});await h.advance();
 assert.ok(!h.registry.entries.some(e=>e.id===1604500&&e.text.en===h.spoken.at(-1)));
});
