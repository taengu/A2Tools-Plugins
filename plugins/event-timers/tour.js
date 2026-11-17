// A short tour of how alerts can show (0.8.0): Overlay or this window, anchor
// mode, and the list or icons. Many players never found these settings, or
// what they do. It opens once, the first time this window is on view after
// the update (existing players too), and again from Settings' "Take the
// tour". Loaded after anchor.js: it opens Settings at the Placement card.

const TOUR_VERSION = 1;
const TOUR_UI = {
  en: { title: "Quick tour", back: "Back", next: "Next", skip: "Skip", done: "Done", setup: "Set it up", again: "Take the tour", step: (n, t) => `${n} of ${t}`,
    steps: [
      ["Alerts over the game", "With Show alerts as: Overlay, each alert pops up over the game as a small icon counting down. Drag it anywhere, then lock it so clicks go through. This window shows alerts as a banner here instead."],
      ["Anchor mode", "Turn on Anchor mode and every icon lines up in one grid beside an anchor you place, so they all move together. World Boss Train adds every world boss that is up or about to spawn."],
      ["List or icons", "In anchor mode, Layout: List shows one slim row per boss with its time, teleport and HP. Rather have text only? Turn off Show the icon for pins, or Icons in the list."],
    ] },
  ko: { title: "간단 안내", back: "이전", next: "다음", skip: "건너뛰기", done: "완료", setup: "설정하기", again: "안내 다시 보기", step: (n, t) => `${n}/${t}`,
    steps: [
      ["게임 위에 알림 표시", "알림 표시 방식을 오버레이로 하면 알림마다 게임 위에 작은 아이콘이 떠서 남은 시간을 셉니다. 원하는 곳으로 끌어 놓고 잠그면 클릭이 게임으로 통과됩니다. 이 창을 고르면 이 창에 배너로 표시됩니다."],
      ["앵커 모드", "앵커 모드를 켜면 모든 아이콘이 직접 놓은 앵커 옆에 격자로 정렬되어 함께 움직입니다. 월드 보스 트레인은 출현 중이거나 곧 출현할 월드 보스를 모두 추가합니다."],
      ["목록 또는 아이콘", "앵커 모드에서 배치를 목록으로 하면 보스마다 시간, 텔레포트, HP를 담은 한 줄로 표시됩니다. 글자만 원하면 핀의 아이콘 표시나 목록에 아이콘 표시를 끄세요."],
    ] },
  ja: { title: "かんたんツアー", back: "戻る", next: "次へ", skip: "スキップ", done: "完了", setup: "設定する", again: "ツアーを見る", step: (n, t) => `${n}/${t}`,
    steps: [
      ["ゲームの上に通知", "通知の表示をオーバーレイにすると、通知ごとにゲームの上に小さなアイコンが出てカウントダウンします。好きな場所へドラッグし、ロックすればクリックはゲームに通ります。このウィンドウを選ぶと、ここにバナーで表示します。"],
      ["アンカーモード", "アンカーモードをオンにすると、すべてのアイコンが置いたアンカーの横に格子状に並び、まとめて動きます。ワールドボストレインは出現中か出現間近のワールドボスをすべて加えます。"],
      ["リストかアイコンか", "アンカーモードでレイアウトをリストにすると、ボスごとに時間、テレポート、HPの細い1行で表示します。文字だけがよければ、ピンの「アイコンを表示」か「リストにアイコンを表示」をオフに。"],
    ] },
  de: { title: "Kurze Tour", back: "Zurück", next: "Weiter", skip: "Überspringen", done: "Fertig", setup: "Einrichten", again: "Tour ansehen", step: (n, t) => `${n} von ${t}`,
    steps: [
      ["Alarme über dem Spiel", "Mit „Alarme zeigen als: Overlay“ erscheint jeder Alarm als kleines Symbol mit Countdown über dem Spiel. Zieh es an eine beliebige Stelle und sperre es, dann gehen Klicks zum Spiel durch. „Dieses Fenster“ zeigt Alarme stattdessen hier als Banner."],
      ["Ankermodus", "Mit dem Ankermodus reihen sich alle Symbole in einem Raster neben einem Anker auf, den du platzierst, und bewegen sich gemeinsam. Der Weltboss-Train fügt jeden Weltboss hinzu, der da ist oder gleich erscheint."],
      ["Liste oder Symbole", "Im Ankermodus zeigt „Darstellung: Liste“ eine schmale Zeile pro Boss mit Zeit, Teleport und HP. Lieber nur Text? Schalte „Symbol anzeigen“ für Pins oder „Symbole in der Liste“ aus."],
    ] },
  fr: { title: "Visite rapide", back: "Retour", next: "Suivant", skip: "Passer", done: "Terminé", setup: "Configurer", again: "Revoir la visite", step: (n, t) => `${n} sur ${t}`,
    steps: [
      ["Des alertes par-dessus le jeu", "Avec « Afficher les alertes en : Superposition », chaque alerte apparaît par-dessus le jeu en petite icône avec un compte à rebours. Fais-la glisser où tu veux, puis verrouille-la pour que les clics passent au jeu. « Cette fenêtre » affiche plutôt les alertes ici en bannière."],
      ["Mode ancre", "Active le mode ancre et toutes les icônes s'alignent en grille à côté d'une ancre que tu places, et bougent ensemble. Le train des boss mondiaux ajoute chaque boss mondial présent ou sur le point d'apparaître."],
      ["Liste ou icônes", "En mode ancre, « Disposition : Liste » montre une ligne fine par boss avec son heure, son téléport et ses PV. Tu préfères le texte seul ? Désactive « Afficher l'icône » pour les épingles, ou « Icônes dans la liste »."],
    ] },
  es: { title: "Visita rápida", back: "Atrás", next: "Siguiente", skip: "Omitir", done: "Listo", setup: "Configurar", again: "Ver la visita", step: (n, t) => `${n} de ${t}`,
    steps: [
      ["Alertas sobre el juego", "Con «Mostrar las alertas como: Superposición», cada alerta aparece sobre el juego como un icono pequeño con cuenta atrás. Arrástralo adonde quieras y bloquéalo para que los clics pasen al juego. «Esta ventana» muestra las alertas aquí como un aviso."],
      ["Modo ancla", "Activa el modo ancla y todos los iconos se alinean en una cuadrícula junto a un ancla que colocas, y se mueven juntos. El tren de jefes mundiales añade cada jefe mundial activo o a punto de aparecer."],
      ["Lista o iconos", "En modo ancla, «Diseño: Lista» muestra una fila fina por jefe con su hora, teletransporte y vida. ¿Prefieres solo texto? Desactiva «Mostrar el icono» en los pines o «Iconos en la lista»."],
    ] },
  pt: { title: "Tour rápido", back: "Voltar", next: "Próximo", skip: "Pular", done: "Concluir", setup: "Configurar", again: "Ver o tour", step: (n, t) => `${n} de ${t}`,
    steps: [
      ["Alertas sobre o jogo", "Com \"Mostrar os alertas como: Sobreposição\", cada alerta aparece sobre o jogo como um ícone pequeno com contagem regressiva. Arraste para onde quiser e trave para os cliques passarem ao jogo. \"Esta janela\" mostra os alertas aqui como um aviso."],
      ["Modo âncora", "Ative o modo âncora e todos os ícones se alinham numa grade ao lado de uma âncora que você posiciona, e se movem juntos. O trem de chefes mundiais adiciona cada chefe mundial ativo ou prestes a surgir."],
      ["Lista ou ícones", "No modo âncora, \"Layout: Lista\" mostra uma linha fina por chefe com horário, teleporte e HP. Prefere só texto? Desligue \"Mostrar o ícone\" nos pins ou \"Ícones na lista\"."],
    ] },
  ru: { title: "Короткий тур", back: "Назад", next: "Далее", skip: "Пропустить", done: "Готово", setup: "Настроить", again: "Пройти тур", step: (n, t) => `${n} из ${t}`,
    steps: [
      ["Оповещения поверх игры", "При «Показывать оповещения: Поверх игры» каждое оповещение появляется над игрой маленьким значком с отсчётом. Перетащите его куда угодно и зафиксируйте, чтобы клики проходили в игру. «В этом окне» показывает оповещения здесь баннером."],
      ["Режим якоря", "Включите режим якоря, и все значки выстроятся сеткой у якоря, который вы ставите, и будут двигаться вместе. Трейн мировых боссов добавляет каждого мирового босса, который на месте или вот-вот появится."],
      ["Список или значки", "В режиме якоря «Вид: Список» показывает узкую строку на босса со временем, телепортом и HP. Нужен только текст? Выключите «Показывать значок» для пинов или «Значки в списке»."],
    ] },
  "zh-Hant": { title: "快速導覽", back: "上一步", next: "下一步", skip: "略過", done: "完成", setup: "前往設定", again: "觀看導覽", step: (n, t) => `${n}/${t}`,
    steps: [
      ["在遊戲上方提醒", "將「提醒顯示為」設為覆蓋層，每個提醒都會以倒數的小圖示出現在遊戲上方。可拖到任何位置，鎖定後點擊會穿透到遊戲。選「此視窗」則改為在這裡以橫幅顯示。"],
      ["錨點模式", "開啟錨點模式後，所有圖示會以網格排在你放置的錨點旁，一起移動。世界首領車隊會加入所有已出現或即將出現的世界首領。"],
      ["清單或圖示", "在錨點模式中把版面設為清單，每個首領以一列細行顯示時間、傳送點與 HP。只想看文字？關閉圖釘的「顯示圖示」或「清單中顯示圖示」。"],
    ] },
  "zh-Hans": { title: "快速导览", back: "上一步", next: "下一步", skip: "跳过", done: "完成", setup: "前往设置", again: "观看导览", step: (n, t) => `${n}/${t}`,
    steps: [
      ["在游戏上方提醒", "将「提醒显示为」设为覆盖层，每个提醒都会以倒数的小图标出现在游戏上方。可拖到任意位置，锁定后点击会穿透到游戏。选「此窗口」则改为在这里以横幅显示。"],
      ["锚点模式", "开启锚点模式后，所有图标会以网格排在你放置的锚点旁，一起移动。世界首领车队会加入所有已出现或即将出现的世界首领。"],
      ["列表或图标", "在锚点模式中把布局设为列表，每个首领以一行细条显示时间、传送点与 HP。只想看文字？关闭图钉的「显示图标」或「列表中显示图标」。"],
    ] },
};
const tourUi = () => TOUR_UI[language] || TOUR_UI.en;

// Each step's drawing, made of the pins' own parts (widget.css's look, at a
// smaller size): pins over a game scene; a grid of them beside its anchor;
// a list's rows.
const tourIcon = (name) => document.querySelector(`.tourIcons img[data-icon="${name}"]`)?.getAttribute("src") || "";
const tourPin = (kind, icon, time, name, extra = "") => {
  const src = tourIcon(icon);
  const art = src ? `<img src="${src}" alt="" />` : "";
  return `<div class="tPin ${kind} ${extra}"><div class="tBadge">${art}</div><div class="tTime">${time}</div>${name ? `<div class="tName">${name}</div>` : ""}</div>`;
};
const tourRow = (edge, icon, name, time, extra = "") => {
  const src = tourIcon(icon);
  return `<div class="tRow ${extra}" style="--edge:${edge}"><span class="tRowIcon">${src ? `<img src="${src}" alt="" />` : ""}</span><span class="tRowName">${name}</span><span class="tRowTime">${time}</span></div>`;
};
const TOUR_ART = [
  () => `<div class="tourScene">${tourPin("field running hp", "boss", "Fighting", "Kashapa")}${tourPin("event due", "invasion", "2:41", "Invasion")}${tourPin("event", "shugo", "26:30", "Shugo Festa")}</div>`,
  () => `<div class="tourScene"><div class="tGrid"><span class="tAnchor">⚓</span>${tourPin("field running", "boss", "Up", "")}${tourPin("event due", "invasion", "2:41", "")}${tourPin("boss", "boss", "4:12", "")}${tourPin("field", "boss", "11:05", "")}${tourPin("event", "shugo", "26:30", "")}${tourPin("field", "boss", "38:20", "")}</div></div>`,
  () => `<div class="tourScene"><div class="tList">${tourRow("#5fbf86", "boss", "Soul Ruler Kashapa", "64%", "hp")}${tourRow("#5a95d6", "invasion", "Dimensional Invasion", "2:41", "due")}${tourRow("#d9705f", "boss", "Drana Var", "11:05")}</div></div>`,
];

let tourStep = 0;
let tourBox = null;

function closeTour() {
  if (tourBox) tourBox.hidden = true;
  if (prefs.tour !== TOUR_VERSION) {
    prefs.tour = TOUR_VERSION;
    savePrefs();
  }
}

function renderTour() {
  const u = tourUi();
  if (!tourBox) {
    tourBox = document.createElement("div");
    tourBox.className = "tour";
    tourBox.setAttribute("role", "dialog");
    tourBox.setAttribute("aria-modal", "true");
    tourBox.innerHTML = '<div class="tourCard"><div class="tourTop"><span class="tourTitle"></span><span class="tourCount"></span></div>'
      + '<div class="tourArt"></div><h3 class="tourHead"></h3><p class="tourText"></p>'
      + '<div class="tourButtons"><button type="button" class="tourSkip"></button><span class="tourSpacer"></span>'
      + '<button type="button" class="tourBack"></button><button type="button" class="tourSetup"></button><button type="button" class="tourNext"></button></div></div>';
    document.body.append(tourBox);
    tourBox.querySelector(".tourSkip").addEventListener("click", closeTour);
    tourBox.querySelector(".tourBack").addEventListener("click", () => { tourStep = Math.max(0, tourStep - 1); renderTour(); });
    tourBox.querySelector(".tourNext").addEventListener("click", () => {
      if (tourStep >= tourUi().steps.length - 1) return closeTour();
      tourStep += 1;
      renderTour();
    });
    // Set it up: Settings, at the Placement card.
    tourBox.querySelector(".tourSetup").addEventListener("click", () => {
      closeTour();
      if (typeof selectTab === "function") selectTab("settings");
      setTimeout(() => document.querySelector(".placement")?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && tourBox && !tourBox.hidden) closeTour();
    });
  }
  const steps = u.steps;
  const last = tourStep === steps.length - 1;
  tourBox.querySelector(".tourTitle").textContent = u.title;
  tourBox.querySelector(".tourCount").textContent = u.step(tourStep + 1, steps.length);
  tourBox.querySelector(".tourArt").innerHTML = TOUR_ART[tourStep]();
  tourBox.querySelector(".tourHead").textContent = steps[tourStep][0];
  tourBox.querySelector(".tourText").textContent = steps[tourStep][1];
  tourBox.querySelector(".tourSkip").textContent = u.skip;
  tourBox.querySelector(".tourSkip").hidden = last;
  tourBox.querySelector(".tourBack").textContent = u.back;
  tourBox.querySelector(".tourBack").hidden = tourStep === 0;
  tourBox.querySelector(".tourSetup").textContent = u.setup;
  tourBox.querySelector(".tourSetup").hidden = !last || !canPin();
  tourBox.querySelector(".tourNext").textContent = last ? u.done : u.next;
  tourBox.hidden = false;
}

function openTour() {
  tourStep = 0;
  renderTour();
}

// Settings: "Take the tour", under the On screen heading.
function tourButton() {
  const head = document.querySelector(".onScreenHead");
  if (!head) return;
  let b = document.querySelector(".tourAgain");
  if (!b) {
    b = document.createElement("button");
    b.type = "button";
    b.className = "tourAgain";
    b.addEventListener("click", openTour);
    head.after(b);
  }
  b.textContent = tourUi().again;
}

// The first time this window is on view after the update (prefs loaded, the
// page shown, not hidden in the dock): the tour, once.
const tourTimer = setInterval(() => {
  tourButton();
  if (!prefsLoaded || prefs.tour === TOUR_VERSION) return;
  const onView = (typeof windowShown === "undefined" || windowShown) && document.visibilityState === "visible";
  if (!onView || !document.querySelector(".view.settings")) return;
  clearInterval(tourTimer);
  setInterval(tourButton, 2000);
  openTour();
}, 1500);
