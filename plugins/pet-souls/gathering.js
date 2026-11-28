// Shugo's Ledger's Gathering tab (0.8.0): how each node's gathers turn out,
// from the game's own two gather records (decoders "gather-start" and
// "gather-done"; the meter's loot event passes base-quality results only).
//
// The start record (31 8D) already holds the outcome: the grade (1 base,
// 2 upgraded) and a set of effect flags. 0x02: it comes out upgraded;
// 0x04: upgraded as the gather started (Aria and Targena come out Fresh,
// Mela ×3). Upgraded but not at the start: Herb Appraiser did it (labeled
// by the player, 2026-11-17, and the start's skill records name Appraiser
// exactly then, 265 of 265). 0x08 << step marks the step it happened on,
// but only up to step 4, so it isn't used. The result
// record (33 8D) says the item, the count, Plentiful Harvest's extra
// (bonus: the count again, so the gather is doubled; not in the start) and a
// status: 0 base, 1 upgraded, 2 failed. A gather is its start and its
// result on the same node.
//
// Appraiser can only upgrade a gather that started at base quality, so its
// rate counts those. Its chance (30% at level 3, GatherSkillEffect) is a
// second roll for a higher grade at the start's own upgrade chance, so it
// upgrades about 30% of that (about 5% for herbs). Each rate has the range
// the true rate likely lies in (95%, Wilson).
(() => {
  const LOG_KEY = "gatherLog";
  const INDEX_KEY = "gatherLogPages";
  const KEEP = 20_000;
  const PAGE_ROWS = 4_000;
  // The gathers list: a page at a time, newest first.
  const PAGE = 20;
  let page = 0;
  let search = "";
  const F_STARTED_FRESH = 0x04;
  const F_UPGRADED = 0x02;
  // Fresh item -> its base item, as the game pairs them; more are learned
  // from the node a gather came from (the same node gives both). Mela keeps
  // its item and comes out ×3 instead.
  const SEED_PAIRS = { 610670045: 610670041, 610670046: 610670042, 610610014: 610610013 };

  const UI = {
    en: { gathers: "gathers", fresh: "Upgraded", appraiser: "Appraiser", startedFresh: "Upgraded at start", extra: "Plentiful Harvest", failed: "Failed", allHerbs: "All", recent: "Recent gathers", likely: (lo, hi) => `likely ${lo}–${hi}`, of: (n, k) => `${n} of ${k}`, none: "No gathers yet: they are counted as you gather.", periodHour: "Last hour", periodSession: "Latest session", gained: "Gathered", gathersIn: (n, d) => `${n} gathers in ${d}`, perHour: (n) => `≈ ${n}/h`, dur: (h, m) => (h ? `${h}h ${m}m` : `${m}m`), searchGathers: "Search gathers", newer: "Newer", older: "Older", showing: (a, b, n) => `${a}–${b} of ${n}`, noMatch: "No gathers match.", lastMin: (n) => `Last ${n} min`, lastHours: (n) => `Last ${n} hours`, periodYesterday: "Yesterday", note: "Appraiser can only upgrade a gather that started at base quality, so its rate counts those gathers only. Its chance (30% at level 3) is a second roll for a higher grade, which succeeds as often as a gather is upgraded at start: expect about 30% of your upgraded-at-start rate. \"likely\" is the range the true rate is in, 95% of the time; it narrows as you gather more." },
    ko: { gathers: "회 채집", fresh: "등급 상승", appraiser: "감정사", startedFresh: "시작부터 상승", extra: "풍요로운 수확", failed: "실패", allHerbs: "전체", recent: "최근 채집", likely: (lo, hi) => `예상 ${lo}–${hi}`, of: (n, k) => `${k}회 중 ${n}회`, none: "아직 채집 기록이 없습니다. 채집할 때마다 기록됩니다.", periodHour: "최근 1시간", periodSession: "최근 세션", gained: "채집한 아이템", gathersIn: (n, d) => `${d} 동안 ${n}회 채집`, perHour: (n) => `시간당 ≈ ${n}`, dur: (h, m) => (h ? `${h}시간 ${m}분` : `${m}분`), searchGathers: "채집 검색", newer: "최신", older: "이전", showing: (a, b, n) => `${n}개 중 ${a}–${b}`, noMatch: "일치하는 채집이 없습니다.", lastMin: (n) => `최근 ${n}분`, lastHours: (n) => `최근 ${n}시간`, periodYesterday: "어제", note: "감정사는 기본 등급으로 시작한 채집만 올릴 수 있으므로 그 채집만 셉니다. 감정사의 확률(3레벨 30%)은 상위 등급을 한 번 더 굴리는 기회이고, 그 굴림은 시작 시 등급 상승만큼만 성공하므로 시작 시 상승 확률의 약 30%가 됩니다. '예상'은 실제 확률이 95%의 경우 들어가는 범위이며, 많이 채집할수록 좁아집니다." },
    ja: { gathers: "回採集", fresh: "品質上昇", appraiser: "鑑定士", startedFresh: "開始時に上昇", extra: "豊かな収穫", failed: "失敗", allHerbs: "すべて", recent: "最近の採集", likely: (lo, hi) => `推定 ${lo}–${hi}`, of: (n, k) => `${k}回中${n}回`, none: "まだ採集の記録がありません。採集するたびに記録されます。", periodHour: "直近1時間", periodSession: "直近のセッション", gained: "採集したアイテム", gathersIn: (n, d) => `${d}で${n}回採集`, perHour: (n) => `1時間あたり ≈ ${n}`, dur: (h, m) => (h ? `${h}時間${m}分` : `${m}分`), searchGathers: "採集を検索", newer: "新しい", older: "古い", showing: (a, b, n) => `${n}件中 ${a}–${b}`, noMatch: "一致する採集はありません。", lastMin: (n) => `直近${n}分`, lastHours: (n) => `直近${n}時間`, periodYesterday: "昨日", note: "鑑定士は基本品質で始まった採集しか上げられないため、その採集だけで数えます。鑑定士の確率（レベル3で30%）は上位品質をもう一度判定する機会で、その判定は開始時の品質上昇と同じ確率でしか成功しないため、開始時の上昇率の約30%になります。「推定」は本当の確率が95%の確率で入る範囲で、採集が増えるほど狭くなります。" },
    de: { gathers: "× gesammelt", fresh: "Aufgewertet", appraiser: "Gutachter", startedFresh: "Beim Start aufgewertet", extra: "Reichhaltige Ernte", failed: "Fehlgeschlagen", allHerbs: "Alle", recent: "Letzte Sammelvorgänge", likely: (lo, hi) => `wahrscheinlich ${lo}–${hi}`, of: (n, k) => `${n} von ${k}`, none: "Noch nichts gesammelt: Es wird beim Sammeln gezählt.", periodHour: "Letzte Stunde", periodSession: "Letzte Sitzung", gained: "Gesammelt", gathersIn: (n, d) => `${n}-mal gesammelt in ${d}`, perHour: (n) => `≈ ${n}/h`, dur: (h, m) => (h ? `${h} h ${m} min` : `${m} min`), searchGathers: "Sammelvorgänge suchen", newer: "Neuere", older: "Ältere", showing: (a, b, n) => `${a}–${b} von ${n}`, noMatch: "Keine passenden Sammelvorgänge.", lastMin: (n) => `Letzte ${n} Min.`, lastHours: (n) => `Letzte ${n} Stunden`, periodYesterday: "Gestern", note: "Der Gutachter kann nur Sammelvorgänge aufwerten, die in Grundqualität begannen, daher zählt seine Rate nur diese. Seine Chance (30 % auf Stufe 3) ist ein zweiter Wurf auf eine höhere Qualität, der so oft gelingt wie eine Aufwertung beim Start: Erwarte etwa 30 % deiner Start-Aufwertungsrate. „wahrscheinlich“ ist der Bereich, in dem die wahre Rate zu 95 % liegt." },
    fr: { gathers: "récoltes", fresh: "Amélioré", appraiser: "Expert", startedFresh: "Amélioré dès le départ", extra: "Récolte Abondante", failed: "Échec", allHerbs: "Tout", recent: "Récoltes récentes", likely: (lo, hi) => `probablement ${lo}–${hi}`, of: (n, k) => `${n} sur ${k}`, none: "Aucune récolte encore : elles sont comptées à mesure que tu récoltes.", periodHour: "Dernière heure", periodSession: "Dernière session", gained: "Récolté", gathersIn: (n, d) => `${n} récoltes en ${d}`, perHour: (n) => `≈ ${n}/h`, dur: (h, m) => (h ? `${h} h ${m} min` : `${m} min`), searchGathers: "Rechercher des récoltes", newer: "Plus récentes", older: "Plus anciennes", showing: (a, b, n) => `${a}–${b} sur ${n}`, noMatch: "Aucune récolte ne correspond.", lastMin: (n) => `${n} dernières min`, lastHours: (n) => `${n} dernières heures`, periodYesterday: "Hier", note: "L'Expert ne peut améliorer qu'une récolte commencée en qualité de base, donc son taux ne compte que celles-là. Sa chance (30 % au niveau 3) est un second tirage vers une meilleure qualité, qui réussit aussi souvent qu'une amélioration dès le départ : attendez-vous à environ 30 % de ce taux. « probablement » est la plage où se trouve le vrai taux 95 % du temps." },
    es: { gathers: "recolecciones", fresh: "Mejorada", appraiser: "Tasador", startedFresh: "Mejorada al inicio", extra: "Cosecha abundante", failed: "Fallida", allHerbs: "Todo", recent: "Recolecciones recientes", likely: (lo, hi) => `probablemente ${lo}–${hi}`, of: (n, k) => `${n} de ${k}`, none: "Aún no hay recolecciones: se cuentan mientras recolectas.", periodHour: "Última hora", periodSession: "Última sesión", gained: "Recolectado", gathersIn: (n, d) => `${n} recolecciones en ${d}`, perHour: (n) => `≈ ${n}/h`, dur: (h, m) => (h ? `${h} h ${m} min` : `${m} min`), searchGathers: "Buscar recolecciones", newer: "Más recientes", older: "Más antiguas", showing: (a, b, n) => `${a}–${b} de ${n}`, noMatch: "Ninguna recolección coincide.", lastMin: (n) => `Últimos ${n} min`, lastHours: (n) => `Últimas ${n} horas`, periodYesterday: "Ayer", note: "El Tasador solo puede mejorar una recolección que empezó en calidad base, así que su tasa cuenta solo esas. Su probabilidad (30 % en nivel 3) es una segunda tirada a una calidad mayor, que acierta tan a menudo como una mejora al inicio: espera cerca del 30 % de esa tasa. «probablemente» es el rango donde está la tasa real el 95 % de las veces." },
    pt: { gathers: "coletas", fresh: "Melhorada", appraiser: "Classificador", startedFresh: "Melhorada no início", extra: "Colheita Abundante", failed: "Falhou", allHerbs: "Tudo", recent: "Coletas recentes", likely: (lo, hi) => `provavelmente ${lo}–${hi}`, of: (n, k) => `${n} de ${k}`, none: "Ainda sem coletas: elas são contadas enquanto você coleta.", periodHour: "Última hora", periodSession: "Última sessão", gained: "Coletado", gathersIn: (n, d) => `${n} coletas em ${d}`, perHour: (n) => `≈ ${n}/h`, dur: (h, m) => (h ? `${h} h ${m} min` : `${m} min`), searchGathers: "Buscar coletas", newer: "Mais recentes", older: "Mais antigas", showing: (a, b, n) => `${a}–${b} de ${n}`, noMatch: "Nenhuma coleta corresponde.", lastMin: (n) => `Últimos ${n} min`, lastHours: (n) => `Últimas ${n} horas`, periodYesterday: "Ontem", note: "O Classificador só melhora uma coleta que começou na qualidade base, então a taxa dele conta só essas. A chance dele (30% no nível 3) é uma segunda rolagem para uma qualidade maior, que acerta tão frequentemente quanto uma melhoria no início: espere cerca de 30% dessa taxa. \"provavelmente\" é a faixa onde está a taxa real 95% das vezes." },
    ru: { gathers: "сборов", fresh: "Улучшено", appraiser: "Оценщик", startedFresh: "Улучшено с начала", extra: "Богатый урожай", failed: "Неудача", allHerbs: "Всё", recent: "Последние сборы", likely: (lo, hi) => `вероятно ${lo}–${hi}`, of: (n, k) => `${n} из ${k}`, none: "Сборов пока нет: они считаются по мере сбора.", periodHour: "Последний час", periodSession: "Последняя сессия", gained: "Собрано", gathersIn: (n, d) => `${n} сборов за ${d}`, perHour: (n) => `≈ ${n}/ч`, dur: (h, m) => (h ? `${h} ч ${m} мин` : `${m} мин`), searchGathers: "Поиск сборов", newer: "Новее", older: "Старше", showing: (a, b, n) => `${a}–${b} из ${n}`, noMatch: "Нет подходящих сборов.", lastMin: (n) => `Последние ${n} мин`, lastHours: (n) => `Последние ${n} ч`, periodYesterday: "Вчера", note: "Оценщик улучшает только сбор, начатый с базовым качеством, поэтому его шанс считается только по таким сборам. Его шанс (30% на 3-м уровне) — второй бросок на более высокое качество, который удаётся так же часто, как улучшение с начала, так что ждите около 30% от этого шанса. «вероятно» — диапазон, где настоящий шанс находится в 95% случаев." },
    "zh-Hant": { gathers: "次採集", fresh: "品質提升", appraiser: "鑑定師", startedFresh: "開始時提升", extra: "豐饒的收穫", failed: "失敗", allHerbs: "全部", recent: "最近採集", likely: (lo, hi) => `可能 ${lo}–${hi}`, of: (n, k) => `${k} 次中 ${n} 次`, none: "尚無採集紀錄：採集時會記錄。", periodHour: "最近 1 小時", periodSession: "最近一段", gained: "採集所得", gathersIn: (n, d) => `${d} 內採集 ${n} 次`, perHour: (n) => `每小時 ≈ ${n}`, dur: (h, m) => (h ? `${h} 小時 ${m} 分` : `${m} 分`), searchGathers: "搜尋採集", newer: "較新", older: "較舊", showing: (a, b, n) => `${n} 筆中的 ${a}–${b}`, noMatch: "沒有符合的採集。", lastMin: (n) => `最近 ${n} 分鐘`, lastHours: (n) => `最近 ${n} 小時`, periodYesterday: "昨天", note: "鑑定師只能提升以基本品質開始的採集，因此其機率只計這些採集。鑑定師的機率（3 級為 30%）是再擲一次更高品質的機會，而這次擲骰的成功率與開始時品質提升相同，所以約為開始時提升率的 30%。「可能」是真實機率 95% 會落在的範圍。" },
    "zh-Hans": { gathers: "次采集", fresh: "品质提升", appraiser: "鉴定师", startedFresh: "开始时提升", extra: "丰饶的收获", failed: "失败", allHerbs: "全部", recent: "最近采集", likely: (lo, hi) => `可能 ${lo}–${hi}`, of: (n, k) => `${k} 次中 ${n} 次`, none: "尚无采集记录：采集时会记录。", periodHour: "最近 1 小时", periodSession: "最近一段", gained: "采集所得", gathersIn: (n, d) => `${d} 内采集 ${n} 次`, perHour: (n) => `每小时 ≈ ${n}`, dur: (h, m) => (h ? `${h} 小时 ${m} 分` : `${m} 分`), searchGathers: "搜索采集", newer: "较新", older: "较旧", showing: (a, b, n) => `${n} 条中的 ${a}–${b}`, noMatch: "没有符合的采集。", lastMin: (n) => `最近 ${n} 分钟`, lastHours: (n) => `最近 ${n} 小时`, periodYesterday: "昨天", note: "鉴定师只能提升以基本品质开始的采集，因此其概率只计这些采集。鉴定师的概率（3 级为 30%）是再掷一次更高品质的机会，而这次掷骰的成功率与开始时品质提升相同，所以约为开始时提升率的 30%。「可能」是真实概率 95% 会落在的范围。" },
  };
  const g = (k) => (UI[language] || UI.en)[k] ?? UI.en[k];

  // [at, character, item (as gathered), grade, effects (null: start not
  // seen), bonus, status, count, extra item (0: none), extra count]; rows
  // from before 0.8.8 have no extras.
  let log = [];
  let pairs = { ...SEED_PAIRS };
  const starts = new Map(); // node -> { at, grade, effects }
  const nodeBase = new Map(); // node -> base item seen on it
  const pageKey = (bank, i) => `gatherLog_${bank}_${i}`;
  const writtenPages = new Map();
  let bank = 0, loaded = false, loading = null, saving = false;
  let dirty = false;

  function load() {
    if (loaded) return Promise.resolve();
    if (!loading) loading = readHistory().catch(() => {}).finally(() => { loading = null; });
    return loading;
  }

  async function readHistory() {
    const index = await a2.storage.get(INDEX_KEY);
    let kept;
    if (index == null) {
      kept = await a2.storage.get(LOG_KEY);
    } else {
      if (![0, 1].includes(index.bank) || !Number.isInteger(index.pages)
        || index.pages < 1 || index.pages > Math.ceil(KEEP / PAGE_ROWS)) return;
      const pages = await Promise.all(Array.from({ length: index.pages },
        (_, i) => a2.storage.get(pageKey(index.bank, i))));
      if (pages.some((rows) => !Array.isArray(rows) || rows.length > PAGE_ROWS)) return;
      kept = { log: pages.flat(), pairs: index.pairs };
      bank = index.bank;
    }
    if (Array.isArray(kept?.log)) log = [...kept.log, ...log].slice(-KEEP);
    if (kept?.pairs) pairs = { ...pairs, ...kept.pairs };
    loaded = true;
  }

  async function saveHistory() {
    if (!dirty || saving) return;
    saving = true;
    await load();
    if (!loaded) { saving = false; return; }
    dirty = false;
    const snapshot = log.slice();
    const next = { bank: 1 - bank, pages: Math.ceil(snapshot.length / PAGE_ROWS), pairs: { ...pairs } };
    try {
      // The index points to the last complete write while the other bank is saved.
      for (let i = 0; i < next.pages; i++) {
        const key = pageKey(next.bank, i);
        const page = snapshot.slice(i * PAGE_ROWS, (i + 1) * PAGE_ROWS);
        const content = JSON.stringify(page);
        if (writtenPages.get(key) === content) continue;
        await a2.storage.set(key, page);
        writtenPages.set(key, content);
      }
      await a2.storage.set(INDEX_KEY, next);
      bank = next.bank;
    } catch {
      dirty = true;
    } finally {
      saving = false;
    }
  }
  load();
  setInterval(saveHistory, 5_000);

  const charOf = (meta) => (meta?.character ? marketKeyOf(meta.character) : marketChar) || "char-unknown";

  a2.on("decoded:gather-start", (d) => {
    if (Number(d?.flag) !== 0 || Number(d?.mark) !== 0) return;
    starts.set(Number(d.node), { at: Date.now(), grade: Number(d.grade), effects: Number(d.effects) });
  });
  a2.on("decoded:gather-done", (d, meta) => load().then(() => {
    const status = Number(d?.status);
    const node = Number(d?.node);
    const item = Number(d?.item);
    if (![0, 1, 2].includes(status) || !(item > 100_000_000)) return;
    const start = starts.get(node);
    starts.delete(node);
    const fresh = start && Date.now() - start.at < 60_000 ? start : null;
    if (status === 0) nodeBase.set(node, item);
    if (status === 1 && !pairs[item] && nodeBase.has(node)) pairs[item] = nodeBase.get(node);
    log.push([Number(meta?.at) || Date.now(), charOf(meta), item, status === 1 ? 2 : 1, fresh ? fresh.effects : null, Number(d.bonus) || 0, status, Number(d.count) || 0,
      Number(d.extraItem) > 100_000_000 ? Number(d.extraItem) : 0, Number(d.extraCount) || 0]);
    if (log.length > KEEP) log.splice(0, log.length - KEEP);
    dirty = true;
    if (document.body.classList.contains("tab-gathering")) render();
  }));

  // The range the true rate likely lies in, 95% (Wilson).
  function range(n, k) {
    if (!k) return null;
    const z = 1.96;
    const p = n / k;
    const d = 1 + (z * z) / k;
    const c = p + (z * z) / (2 * k);
    const m = z * Math.sqrt((p * (1 - p)) / k + (z * z) / (4 * k * k));
    return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
  }
  const pc = (x) => `${Math.round(x * 100)}%`;
  const baseOf = (item) => pairs[item] || item;

  function tally(rows) {
    const s = { gathers: 0, fresh: 0, startedFresh: 0, appraiser: 0, appraiserOf: 0, extra: 0, failed: 0 };
    for (const [, , , grade, eff, bonus, status] of rows) {
      if (status === 2) { s.failed++; continue; }
      s.gathers++;
      if (grade === 2) s.fresh++;
      if (bonus > 0) s.extra++;
      if (eff == null) continue;
      if (eff & F_STARTED_FRESH) s.startedFresh++;
      else {
        s.appraiserOf++;
        if (eff & F_UPGRADED) s.appraiser++;
      }
    }
    return s;
  }

  // What a stretch of gathering brought in: each item and how many (the
  // count, Plentiful Harvest's copies and the random extra), the gathers,
  // and the time from the first to the last.
  function gains(rows) {
    const items = new Map();
    const add = (item, n) => { if (item && n > 0) items.set(item, (items.get(item) || 0) + n); };
    for (const [, , item, , , bonus, status, count, extra, extraCount] of rows) {
      if (status !== 2) add(item, (count || 0) + (bonus || 0));
      if (extra) add(extra, extraCount || 1);
    }
    return {
      items: [...items].sort((a, b) => b[1] - a[1] || a[0] - b[0]),
      gathers: rows.length,
      span: rows.length ? rows[rows.length - 1][0] - rows[0][0] : 0,
    };
  }
  // A session: the gathers back from the newest until a gap of 15 minutes.
  const SESSION_GAP_MS = 15 * 60_000;
  function sessionStart(rows) {
    if (!rows.length) return Infinity;
    let from = rows[rows.length - 1][0];
    for (let i = rows.length - 2; i >= 0 && from - rows[i][0] <= SESSION_GAP_MS; i--) from = rows[i][0];
    return from;
  }
  globalThis.GatherGains = { gains, sessionStart };

  function gainsList(rows, ledger) {
    const { node } = ledger;
    const got = gains(rows);
    const out = [];
    const mins = Math.round(got.span / 60_000);
    const head = node("div", "sRow gHead");
    head.append(node("span", "muted dLabel", g("gained")), node("span", "kRight muted dLabel", g("gathersIn")(ledger.num(got.gathers), g("dur")(Math.floor(mins / 60), mins % 60))));
    out.push(head);
    // Per hour only once the stretch is long enough to say.
    const hours = got.span >= 10 * 60_000 ? got.span / 3_600_000 : 0;
    const list = node("div", "dList gGains");
    for (const [item, n] of got.items) {
      const line = node("div", "dSub gGain");
      const right = node("span", "kRight");
      right.append(node("b", null, `×${ledger.num(n)}`));
      if (hours) right.append(node("small", "muted", ` ${g("perHour")(ledger.num(Math.round(n / hours)))}`));
      line.append(node("span", `gName g${ledger.gradeOf ? ledger.gradeOf(item) : 0}`, ledger.itemName(item)), right);
      list.append(line);
    }
    out.push(list);
    return out;
  }

  function card(name, s, ledger) {
    const { node } = ledger;
    const row = node("div", "drop");
    const top = node("div", "dTop");
    top.append(node("span", "dName", name));
    const rates = node("span", "dRates");
    const rate = (value, label, cls) => {
      const x = node("span", `dRate${cls ? ` ${cls}` : ""}`);
      x.append(node("b", null, value), node("small", null, label));
      return x;
    };
    // Upgraded at start: of the gathers whose start was seen.
    const seenStarts = s.startedFresh + s.appraiserOf;
    rates.append(rate(s.gathers ? pc(s.fresh / s.gathers) : "—", g("fresh")),
      rate(seenStarts ? pc(s.startedFresh / seenStarts) : "—", g("startedFresh"), "listed"),
      rate(s.appraiserOf ? pc(s.appraiser / s.appraiserOf) : "—", g("appraiser"), "listed"));
    top.append(rates);
    const bits = [`${ledger.num(s.gathers)} ${g("gathers")}`];
    const r = range(s.appraiser, s.appraiserOf);
    if (s.appraiserOf) bits.push(`${g("appraiser")} ${g("of")(ledger.num(s.appraiser), ledger.num(s.appraiserOf))}${r ? ` (${g("likely")(pc(r[0]), pc(r[1]))})` : ""}`);
    const rs = range(s.startedFresh, seenStarts);
    if (seenStarts) bits.push(`${g("startedFresh")} ${g("of")(ledger.num(s.startedFresh), ledger.num(seenStarts))}${rs ? ` (${g("likely")(pc(rs[0]), pc(rs[1]))})` : ""}`);
    if (s.gathers) bits.push(`${g("extra")} ${pc(s.extra / s.gathers)}`);
    // Failed: of every gather tried, the failed ones too.
    const tried = s.gathers + s.failed;
    if (tried) bits.push(`${g("failed")} ${pc(s.failed / tried)} (${g("of")(ledger.num(s.failed), ledger.num(tried))})`);
    const sub = node("div", "dSub");
    sub.append(node("span", null, bits.join(" · ")));
    const bar = node("div", "dBar");
    const seen = node("span", "dSeen");
    seen.style.width = `${s.appraiserOf ? Math.min(100, (s.appraiser / s.appraiserOf) * 100) : 0}%`;
    bar.append(seen);
    row.append(top, sub, bar);
    return row;
  }

  function render() {
    const ledger = globalThis.ledger;
    const view = document.querySelector(".gatheringView");
    if (!ledger || !view) return;
    const { node, prefs } = ledger;
    const parts = [];
    const sortRow = node("div", "sRow");
    const period = node("select", "kChar gPeriod");
    // The ranges: minutes and hours back from now, the latest session, days.
    const ranges = [["m15", g("lastMin")(15)], ["m30", g("lastMin")(30)], ["hour", g("periodHour")], ["h2", g("lastHours")(2)], ["h4", g("lastHours")(4)],
      ["h8", g("lastHours")(8)], ["session", g("periodSession")], ["today", ledger.t("periodToday")], ["yesterday", g("periodYesterday")],
      ["7", ledger.t("period7")], ["30", ledger.t("period30")], ["all", ledger.t("periodAll")]];
    for (const [value, textContent] of ranges) period.append(Object.assign(document.createElement("option"), { value, textContent }));
    if (!ranges.some(([v]) => v === prefs().gatherPeriod)) prefs().gatherPeriod = "session";
    period.value = prefs().gatherPeriod || "session";
    const thisChar = node("label", "kRadio");
    thisChar.append(Object.assign(document.createElement("input"), { type: "checkbox", className: "gThisChar", checked: !!prefs().gatherThisChar }), ` ${ledger.t("thisChar")}`);
    sortRow.append(thisChar);
    const right = node("span", "kRight");
    right.append(period);
    sortRow.append(right);
    parts.push(sortRow);

    const now = Date.now();
    const me = ledger.me();
    const mine = prefs().gatherThisChar ? log.filter((r) => r[1] === me) : log;
    const today = ledger.dayOf(now);
    const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
    const from = { m15: now - 15 * MIN, m30: now - 30 * MIN, hour: now - HOUR, h2: now - 2 * HOUR, h4: now - 4 * HOUR, h8: now - 8 * HOUR,
      session: sessionStart(mine), today, yesterday: today - DAY, "7": today - 6 * DAY, "30": today - 29 * DAY }[period.value] ?? 0;
    const to = period.value === "yesterday" ? today : Infinity;
    const rows = mine.filter((r) => r[0] >= from && r[0] < to);
    const herbs = new Map();
    for (const r of rows) {
      const base = baseOf(r[2]);
      if (!herbs.has(base)) herbs.set(base, []);
      herbs.get(base).push(r);
    }
    if (rows.length) parts.push(...gainsList(rows, ledger));
    const list = node("div", "dList");
    if (herbs.size > 1) list.append(card(g("allHerbs"), tally(rows), ledger));
    for (const [base, herbRows] of [...herbs].sort((a, b) => b[1].length - a[1].length)) {
      list.append(card(ledger.itemName(base), tally(herbRows), ledger));
    }
    parts.push(list);
    if (!rows.length) parts.push(node("p", "kNote", g("none")));

    // The gathers, newest first: what each came out as. A page at a time,
    // narrowed by the search (the item gathered or its extra).
    let box = null;
    if (rows.length) {
      parts.push(node("div", "muted dLabel", g("recent")));
      box = Object.assign(document.createElement("input"), { type: "search", className: "search dSearch gSearch", placeholder: g("searchGathers"), value: search, spellcheck: false });
      box.setAttribute("aria-label", g("searchGathers"));
      parts.push(box);
      const q = search.trim().toLowerCase();
      const hits = (q ? rows.filter((r) => ledger.itemName(r[2]).toLowerCase().includes(q) || (r[8] && ledger.itemName(r[8]).toLowerCase().includes(q))) : rows).slice().reverse();
      const pages = Math.max(1, Math.ceil(hits.length / PAGE));
      page = Math.min(page, pages - 1);
      const recent = node("div", "dList");
      for (const [at, , item, grade, eff, bonus, status, count, extra, extraCount] of hits.slice(page * PAGE, (page + 1) * PAGE)) {
        const tags = [];
        if (status === 2) tags.push(g("failed"));
        else if (eff != null && eff & F_STARTED_FRESH) tags.push(g("startedFresh"));
        else if (eff != null && eff & F_UPGRADED) tags.push(g("appraiser"));
        if (bonus > 0) tags.push(g("extra"));
        if (extra) tags.push(`+ ${ledger.itemName(extra)}${extraCount > 1 ? ` ×${extraCount}` : ""}`);
        const line = node("div", "dSub");
        const when = new Date(at);
        const time = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        // An older day says its date too.
        const stamp = ledger.dayOf(at) === ledger.dayOf(Date.now()) ? time : `${when.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
        line.append(node("span", "dSrc", stamp), node("span", grade === 2 ? "gName g2" : null, `${ledger.itemName(item)}${count > 1 ? ` ×${count}` : ""}`), node("span", null, tags.length ? ` · ${tags.join(" · ")}` : ""));
        recent.append(line);
      }
      parts.push(recent);
      if (!hits.length) parts.push(node("p", "kNote", g("noMatch")));
      if (hits.length > PAGE) {
        const pager = node("div", "sRow gPager");
        const button = (label, to, off) => {
          const b = node("button", "chip gPage", label);
          b.type = "button";
          b.dataset.page = String(to);
          b.disabled = off;
          return b;
        };
        pager.append(button(`‹ ${g("newer")}`, page - 1, page === 0),
          node("span", "muted dLabel", g("showing")(ledger.num(page * PAGE + 1), ledger.num(Math.min(hits.length, (page + 1) * PAGE)), ledger.num(hits.length))),
          button(`${g("older")} ›`, page + 1, page >= pages - 1));
        parts.push(pager);
      }
    }
    parts.push(node("p", "kNote", g("note")));
    const typing = document.activeElement?.classList?.contains("gSearch");
    const caret = typing ? document.activeElement.selectionStart : null;
    view.replaceChildren(...parts);
    if (typing && box) {
      box.focus();
      if (caret != null) box.setSelectionRange(caret, caret);
    }
  }

  document.addEventListener("change", (e) => {
    const ledger = globalThis.ledger;
    if (!ledger || !e.target.closest?.(".gatheringView")) return;
    if (e.target.classList.contains("gSearch")) return;
    if (e.target.classList.contains("gPeriod")) ledger.setPref("gatherPeriod", e.target.value);
    if (e.target.classList.contains("gThisChar")) ledger.setPref("gatherThisChar", e.target.checked);
    page = 0;
    render();
  });
  document.addEventListener("input", (e) => {
    if (!e.target.classList?.contains("gSearch")) return;
    search = e.target.value;
    page = 0;
    render();
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".gatheringView .gPage");
    if (!b || b.disabled) return;
    page = Math.max(0, Number(b.dataset.page) || 0);
    render();
  });
  a2.on("language", () => { if (document.body.classList.contains("tab-gathering")) render(); });
  globalThis.renderGathering = () => load().then(render);
})();
