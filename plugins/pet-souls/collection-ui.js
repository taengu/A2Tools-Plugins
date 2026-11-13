// Shugo's Ledger's Kinah and Skins tabs, beside the Pets tab (plugin.js).
//
// Kinah: the game counts the Kinah each character gains in a day, up to
// 1,000,000, and the meter passes the count on with the character
// (kinahToday). Each change is kept per character and day: when the day's
// first Kinah came, when the limit was reached, and the Unique drops picked
// up in between (decoder "item-gained", collection.js says which items are
// Unique). Days start at the game's daily reset, as the meter's count does.
//
// Skins: every skin in the game (collection.js, from its tables), what the
// Closet has (decoders "skins-owned" at login and "skin-added", which
// plugin.js keeps per character), and where each comes from.
//
// In a function of its own: plugin.js's names (text, el, ui, ...) are global.
(() => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  // The daily reset, as the meter's (data_storage DAILY_RESET_MS): 07:00 UTC.
  const RESET_MS = 7 * 60 * 60 * 1000;
  const KINAH_LIMIT = 1_000_000;
  // No Kinah for this long, and a run counts as stopped.
  const STOPPED_MS = 15 * 60 * 1000;
  // Days kept per character.
  const KEEP_DAYS = 30;
  // Rows drawn at most; a search or a filter narrows the rest.
  const SKIN_ROWS = 150;
  const KINAH_KEY = "kinahDays";
  const CPREFS_KEY = "collectionPrefs";
  const dayOf = (ms) => Math.floor((ms - RESET_MS) / DAY_MS) * DAY_MS + RESET_MS;

  // ---- Words, in each of the meter's languages ------------------------------
  const UI = {
    en: {
      pets: "Pets", kinah: "Kinah", skins: "Skins",
      today: "today", started: "Started", soFar: "So far", atThisPace: "At this pace", perHour: "Per hour",
      uniques: "Unique drops", resetsIn: "Resets in", reachedIn: "Reached in", notYet: "No Kinah yet today",
      before: "before", noCharacter: "Log in to a character to track its Kinah.",
      yourCharacters: "Your characters today", thisServer: "This server", all: "All",
      character: "Character", took: "Took", running: "running", stopped: "stopped", unique: "Unique",
      lastDays: "Last 7 days", day: "Day", reached1m: "Reached 1M in", notReached: "not reached",
      kinahNote: "\"Took\" runs from the day's first Kinah to the limit; time away from the game counts. Unique drops are the Unique and Heroic items picked up in that time. The bars are each day's time to the limit (shorter is faster).",
      kinahStartNote: "The meter was started after this character's first Kinah today: the start shown is when it was first seen.",
      uniqueLog: "Unique drops today", none: "None yet",
      skinsOf: "skins", missing: "Missing", owned: "Owned", search: "Search skins",
      anySlot: "Any slot", armour: "Armour", weapons: "Weapons", accessories: "Accessories",
      box: "Boxes", market: "Black Market", coin: "Coin shops", cube: "Hidden Cubes", ranking: "Rankings", dungeon: "Dungeons", other: "Other",
      onSale: "Black Market now", ownedTag: "Owned", whereTo: "Where to get it", gatherFor: "Gather for the bundle",
      gatherNote: "Any node of these kinds can drop it; the game lists no chance.",
      noCloset: "Your Closet loads when you log in: until then every skin shows as missing.",
      shown: (n, total) => `Showing ${n} of ${total}: search or filter to narrow.`,
      noSkins: "No skins match.", noSource: "Not in the game's lists (shop or event)",
      shops: { coin_shop_festa: "Festival Shop", coin_shop_nightmare: "Nightmare Shop", coin_shop_abyss: "Abyss", coin_shop_arena: "Arena", coin_shop_battlefield: "Battlefield" },
      nodes: { Herb: "Herbs (Aria, Targena)", Od: "Odyle", Jewelry: "Gemstones", Shellfish: "Shellfish", RareMetal: "Rare ore", Tree: "Trees", Berry: "Berries", Vegetable: "Vegetables", Flower: "Flowers", Metal: "Ore" },
      h: "h", m: "m",
    },
    ko: {
      pets: "펫", kinah: "키나", skins: "외형",
      today: "오늘", started: "시작", soFar: "경과", atThisPace: "현재 속도로", perHour: "시간당",
      uniques: "유일 획득", resetsIn: "초기화까지", reachedIn: "달성 시간", notYet: "오늘 획득한 키나 없음",
      before: "이전", noCharacter: "캐릭터로 접속하면 키나를 기록합니다.",
      yourCharacters: "오늘 내 캐릭터", thisServer: "이 서버", all: "전체",
      character: "캐릭터", took: "소요", running: "진행 중", stopped: "멈춤", unique: "유일",
      lastDays: "최근 7일", day: "날짜", reached1m: "100만 달성", notReached: "미달성",
      kinahNote: "\"소요\"는 그날 첫 키나부터 한도까지의 시간이며, 게임을 쉰 시간도 포함됩니다. 유일 획득은 그동안 얻은 유일·영웅 등급 아이템입니다. 막대는 날마다 한도까지 걸린 시간입니다(짧을수록 빠름).",
      kinahStartNote: "오늘 이 캐릭터의 첫 키나 이후에 미터가 시작되어, 처음 확인된 시각을 시작으로 표시합니다.",
      uniqueLog: "오늘의 유일 획득", none: "아직 없음",
      skinsOf: "외형", missing: "미보유", owned: "보유", search: "외형 검색",
      anySlot: "모든 부위", armour: "방어구", weapons: "무기", accessories: "장신구",
      box: "상자", market: "검은 구름 상단", coin: "주화 상점", cube: "숨겨진 큐브", ranking: "랭킹", dungeon: "던전", other: "기타",
      onSale: "지금 검은 구름 상단", ownedTag: "보유", whereTo: "획득처", gatherFor: "꾸러미를 위한 채집",
      gatherNote: "이 종류의 채집물 어디서나 나올 수 있으며, 게임에 확률 표기가 없습니다.",
      noCloset: "옷장은 접속할 때 불러옵니다. 그 전에는 모든 외형이 미보유로 표시됩니다.",
      shown: (n, total) => `${total}개 중 ${n}개 표시: 검색이나 필터로 좁혀 보세요.`,
      noSkins: "맞는 외형이 없습니다.", noSource: "게임 목록에 없음 (상점 또는 이벤트)",
      shops: { coin_shop_festa: "축제 상점", coin_shop_nightmare: "악몽 상점", coin_shop_abyss: "어비스", coin_shop_arena: "투기장", coin_shop_battlefield: "전장" },
      nodes: { Herb: "약초 (아리아, 타르게나)", Od: "오드", Jewelry: "보석", Shellfish: "조개", RareMetal: "희귀 광석", Tree: "나무", Berry: "열매", Vegetable: "채소", Flower: "꽃", Metal: "광석" },
      h: "시간", m: "분",
    },
    ja: {
      pets: "ペット", kinah: "キナ", skins: "外見",
      today: "今日", started: "開始", soFar: "経過", atThisPace: "このペースで", perHour: "毎時",
      uniques: "唯一入手", resetsIn: "リセットまで", reachedIn: "達成まで", notYet: "今日はまだキナなし",
      before: "より前", noCharacter: "キャラクターでログインするとキナを記録します。",
      yourCharacters: "今日のキャラクター", thisServer: "このサーバー", all: "すべて",
      character: "キャラクター", took: "所要", running: "進行中", stopped: "停止", unique: "唯一",
      lastDays: "過去7日", day: "日", reached1m: "100万達成まで", notReached: "未達成",
      kinahNote: "「所要」はその日最初のキナから上限までの時間で、ゲームを離れた時間も含みます。唯一入手はその間に拾った唯一・英雄等級のアイテムです。棒は各日の上限までの時間です(短いほど速い)。",
      kinahStartNote: "今日このキャラクターが最初のキナを得た後にメーターが起動したため、最初に確認した時刻を開始としています。",
      uniqueLog: "今日の唯一入手", none: "まだありません",
      skinsOf: "外見", missing: "未所持", owned: "所持", search: "外見を検索",
      anySlot: "すべての部位", armour: "防具", weapons: "武器", accessories: "アクセサリー",
      box: "箱", market: "黒雲商会", coin: "コインショップ", cube: "隠されたキューブ", ranking: "ランキング", dungeon: "ダンジョン", other: "その他",
      onSale: "黒雲商会で販売中", ownedTag: "所持", whereTo: "入手方法", gatherFor: "袋のための採集",
      gatherNote: "この種類の採集物ならどれからも出ます。ゲームに確率の表記はありません。",
      noCloset: "クローゼットはログイン時に読み込まれます。それまではすべて未所持と表示されます。",
      shown: (n, total) => `${total}件中${n}件を表示:検索やフィルターで絞り込めます。`,
      noSkins: "該当する外見はありません。", noSource: "ゲームの一覧になし(ショップまたはイベント)",
      shops: { coin_shop_festa: "祭りショップ", coin_shop_nightmare: "悪夢ショップ", coin_shop_abyss: "アビス", coin_shop_arena: "闘技場", coin_shop_battlefield: "戦場" },
      nodes: { Herb: "薬草(アリア、タルゲナ)", Od: "オード", Jewelry: "宝石", Shellfish: "貝", RareMetal: "希少鉱石", Tree: "木", Berry: "木の実", Vegetable: "野菜", Flower: "花", Metal: "鉱石" },
      h: "時間", m: "分",
    },
    de: {
      pets: "Begleiter", kinah: "Kinah", skins: "Aussehen",
      today: "heute", started: "Begonnen", soFar: "Bisher", atThisPace: "In diesem Tempo", perHour: "Pro Stunde",
      uniques: "Einzigartige Beute", resetsIn: "Zurückgesetzt in", reachedIn: "Erreicht in", notYet: "Heute noch kein Kinah",
      before: "vor", noCharacter: "Melde dich mit einem Charakter an, um sein Kinah zu verfolgen.",
      yourCharacters: "Deine Charaktere heute", thisServer: "Dieser Server", all: "Alle",
      character: "Charakter", took: "Dauer", running: "läuft", stopped: "gestoppt", unique: "Einzigartig",
      lastDays: "Letzte 7 Tage", day: "Tag", reached1m: "1 Mio. erreicht in", notReached: "nicht erreicht",
      kinahNote: "„Dauer“ läuft vom ersten Kinah des Tages bis zur Grenze; Zeit außerhalb des Spiels zählt mit. Einzigartige Beute sind die einzigartigen und legendären Gegenstände aus dieser Zeit. Die Balken zeigen die Zeit bis zur Grenze je Tag (kürzer ist schneller).",
      kinahStartNote: "Der Meter wurde nach dem ersten Kinah dieses Charakters heute gestartet: Als Beginn gilt, wann er zuerst gesehen wurde.",
      uniqueLog: "Einzigartige Beute heute", none: "Noch keine",
      skinsOf: "Aussehen", missing: "Fehlend", owned: "Vorhanden", search: "Aussehen suchen",
      anySlot: "Alle Plätze", armour: "Rüstung", weapons: "Waffen", accessories: "Schmuck",
      box: "Kisten", market: "Schwarzmarkt", coin: "Münzläden", cube: "Verborgene Würfel", ranking: "Ranglisten", dungeon: "Dungeons", other: "Sonstige",
      onSale: "Jetzt auf dem Schwarzmarkt", ownedTag: "Vorhanden", whereTo: "Woher", gatherFor: "Für das Bündel sammeln",
      gatherNote: "Jedes Vorkommen dieser Arten kann es geben; das Spiel nennt keine Chance.",
      noCloset: "Der Kleiderschrank lädt beim Anmelden: bis dahin gilt jedes Aussehen als fehlend.",
      shown: (n, total) => `${n} von ${total}: suche oder filtere, um einzugrenzen.`,
      noSkins: "Kein Aussehen passt.", noSource: "Nicht in den Listen des Spiels (Shop oder Event)",
      shops: { coin_shop_festa: "Festladen", coin_shop_nightmare: "Albtraumladen", coin_shop_abyss: "Abyss", coin_shop_arena: "Arena", coin_shop_battlefield: "Schlachtfeld" },
      nodes: { Herb: "Kräuter (Aria, Targena)", Od: "Odyle", Jewelry: "Edelsteine", Shellfish: "Muscheln", RareMetal: "Seltenes Erz", Tree: "Bäume", Berry: "Beeren", Vegetable: "Gemüse", Flower: "Blumen", Metal: "Erz" },
      h: "Std.", m: "Min.",
    },
    fr: {
      pets: "Familiers", kinah: "Kinah", skins: "Apparences",
      today: "aujourd'hui", started: "Début", soFar: "Écoulé", atThisPace: "À ce rythme", perHour: "Par heure",
      uniques: "Butin unique", resetsIn: "Réinitialisation dans", reachedIn: "Atteint en", notYet: "Pas encore de kinah aujourd'hui",
      before: "avant", noCharacter: "Connectez-vous avec un personnage pour suivre ses kinahs.",
      yourCharacters: "Vos personnages aujourd'hui", thisServer: "Ce serveur", all: "Tous",
      character: "Personnage", took: "Durée", running: "en cours", stopped: "arrêté", unique: "Unique",
      lastDays: "7 derniers jours", day: "Jour", reached1m: "1 M atteint en", notReached: "non atteint",
      kinahNote: "La « durée » va du premier kinah du jour à la limite ; le temps hors du jeu compte. Le butin unique regroupe les objets uniques et héroïques ramassés pendant ce temps. Les barres montrent le temps jusqu'à la limite chaque jour (plus court = plus rapide).",
      kinahStartNote: "Le compteur a démarré après le premier kinah de ce personnage aujourd'hui : le début indiqué est le moment où il a été vu.",
      uniqueLog: "Butin unique du jour", none: "Aucun pour l'instant",
      skinsOf: "apparences", missing: "Manquantes", owned: "Possédées", search: "Rechercher une apparence",
      anySlot: "Tous les emplacements", armour: "Armure", weapons: "Armes", accessories: "Accessoires",
      box: "Coffres", market: "Marché noir", coin: "Boutiques de pièces", cube: "Cubes cachés", ranking: "Classements", dungeon: "Donjons", other: "Autres",
      onSale: "Au marché noir", ownedTag: "Possédée", whereTo: "Où l'obtenir", gatherFor: "Récolter pour le paquet",
      gatherNote: "Tout point de ces types peut le donner ; le jeu n'indique aucune chance.",
      noCloset: "La garde-robe se charge à la connexion : jusque-là, toutes les apparences sont manquantes.",
      shown: (n, total) => `${n} sur ${total} : cherchez ou filtrez pour affiner.`,
      noSkins: "Aucune apparence ne correspond.", noSource: "Absente des listes du jeu (boutique ou événement)",
      shops: { coin_shop_festa: "Boutique du festival", coin_shop_nightmare: "Boutique du Cauchemar", coin_shop_abyss: "Abysses", coin_shop_arena: "Arène", coin_shop_battlefield: "Champ de bataille" },
      nodes: { Herb: "Herbes (Aria, Targena)", Od: "Odyle", Jewelry: "Gemmes", Shellfish: "Coquillages", RareMetal: "Minerai rare", Tree: "Arbres", Berry: "Baies", Vegetable: "Légumes", Flower: "Fleurs", Metal: "Minerai" },
      h: "h", m: "min",
    },
    es: {
      pets: "Mascotas", kinah: "Kinah", skins: "Aspectos",
      today: "hoy", started: "Inicio", soFar: "Hasta ahora", atThisPace: "A este ritmo", perHour: "Por hora",
      uniques: "Botín único", resetsIn: "Se reinicia en", reachedIn: "Alcanzado en", notYet: "Aún sin kinah hoy",
      before: "antes de", noCharacter: "Entra con un personaje para seguir su kinah.",
      yourCharacters: "Tus personajes hoy", thisServer: "Este servidor", all: "Todos",
      character: "Personaje", took: "Tiempo", running: "en curso", stopped: "detenido", unique: "Único",
      lastDays: "Últimos 7 días", day: "Día", reached1m: "1 M alcanzado en", notReached: "no alcanzado",
      kinahNote: "El «tiempo» va desde el primer kinah del día hasta el límite; cuenta el tiempo fuera del juego. El botín único son los objetos únicos y épicos recogidos en ese tiempo. Las barras muestran el tiempo hasta el límite de cada día (más corto es más rápido).",
      kinahStartNote: "El medidor empezó después del primer kinah de hoy de este personaje: el inicio mostrado es cuando se vio por primera vez.",
      uniqueLog: "Botín único de hoy", none: "Ninguno aún",
      skinsOf: "aspectos", missing: "Faltan", owned: "Tienes", search: "Buscar aspectos",
      anySlot: "Cualquier ranura", armour: "Armadura", weapons: "Armas", accessories: "Accesorios",
      box: "Cofres", market: "Mercado negro", coin: "Tiendas de monedas", cube: "Cubos ocultos", ranking: "Clasificaciones", dungeon: "Mazmorras", other: "Otros",
      onSale: "En el mercado negro ahora", ownedTag: "Lo tienes", whereTo: "Dónde conseguirlo", gatherFor: "Recolectar para el paquete",
      gatherNote: "Cualquier nodo de estos tipos puede darlo; el juego no indica probabilidad.",
      noCloset: "El armario se carga al entrar: hasta entonces todos los aspectos aparecen como faltantes.",
      shown: (n, total) => `Mostrando ${n} de ${total}: busca o filtra para acotar.`,
      noSkins: "Ningún aspecto coincide.", noSource: "No figura en las listas del juego (tienda o evento)",
      shops: { coin_shop_festa: "Tienda del festival", coin_shop_nightmare: "Tienda de Pesadilla", coin_shop_abyss: "Abismo", coin_shop_arena: "Arena", coin_shop_battlefield: "Campo de batalla" },
      nodes: { Herb: "Hierbas (Aria, Targena)", Od: "Odyle", Jewelry: "Gemas", Shellfish: "Mariscos", RareMetal: "Mineral raro", Tree: "Árboles", Berry: "Bayas", Vegetable: "Verduras", Flower: "Flores", Metal: "Mineral" },
      h: "h", m: "min",
    },
    pt: {
      pets: "Mascotes", kinah: "Kinah", skins: "Visuais",
      today: "hoje", started: "Início", soFar: "Até agora", atThisPace: "Neste ritmo", perHour: "Por hora",
      uniques: "Saque único", resetsIn: "Reinicia em", reachedIn: "Alcançado em", notYet: "Ainda sem kinah hoje",
      before: "antes de", noCharacter: "Entre com um personagem para acompanhar o kinah.",
      yourCharacters: "Seus personagens hoje", thisServer: "Este servidor", all: "Todos",
      character: "Personagem", took: "Tempo", running: "em andamento", stopped: "parado", unique: "Único",
      lastDays: "Últimos 7 dias", day: "Dia", reached1m: "1 M alcançado em", notReached: "não alcançado",
      kinahNote: "O \"tempo\" vai do primeiro kinah do dia até o limite; o tempo fora do jogo conta. Saque único são os itens únicos e heroicos coletados nesse tempo. As barras mostram o tempo até o limite de cada dia (mais curto é mais rápido).",
      kinahStartNote: "O medidor começou depois do primeiro kinah de hoje deste personagem: o início mostrado é quando foi visto pela primeira vez.",
      uniqueLog: "Saque único de hoje", none: "Nenhum ainda",
      skinsOf: "visuais", missing: "Faltando", owned: "Possuídos", search: "Buscar visuais",
      anySlot: "Qualquer espaço", armour: "Armadura", weapons: "Armas", accessories: "Acessórios",
      box: "Baús", market: "Mercado Negro", coin: "Lojas de moedas", cube: "Cubos Ocultos", ranking: "Rankings", dungeon: "Masmorras", other: "Outros",
      onSale: "No Mercado Negro agora", ownedTag: "Possuído", whereTo: "Onde conseguir", gatherFor: "Coletar para o pacote",
      gatherNote: "Qualquer ponto desses tipos pode dar; o jogo não informa a chance.",
      noCloset: "O guarda-roupa carrega ao entrar: até lá todos os visuais aparecem como faltando.",
      shown: (n, total) => `Mostrando ${n} de ${total}: busque ou filtre para refinar.`,
      noSkins: "Nenhum visual corresponde.", noSource: "Fora das listas do jogo (loja ou evento)",
      shops: { coin_shop_festa: "Loja do festival", coin_shop_nightmare: "Loja do Pesadelo", coin_shop_abyss: "Abismo", coin_shop_arena: "Arena", coin_shop_battlefield: "Campo de batalha" },
      nodes: { Herb: "Ervas (Aria, Targena)", Od: "Odyle", Jewelry: "Gemas", Shellfish: "Mariscos", RareMetal: "Minério raro", Tree: "Árvores", Berry: "Frutinhas", Vegetable: "Vegetais", Flower: "Flores", Metal: "Minério" },
      h: "h", m: "min",
    },
    ru: {
      pets: "Питомцы", kinah: "Кина", skins: "Облики",
      today: "сегодня", started: "Начало", soFar: "Прошло", atThisPace: "В этом темпе", perHour: "В час",
      uniques: "Уникальная добыча", resetsIn: "Сброс через", reachedIn: "Достигнуто за", notYet: "Сегодня кины ещё нет",
      before: "до", noCharacter: "Войдите персонажем, чтобы отслеживать его кину.",
      yourCharacters: "Ваши персонажи сегодня", thisServer: "Этот сервер", all: "Все",
      character: "Персонаж", took: "Время", running: "идёт", stopped: "остановлено", unique: "Уник.",
      lastDays: "Последние 7 дней", day: "День", reached1m: "1 млн за", notReached: "не достигнуто",
      kinahNote: "«Время» — от первой кины за день до лимита; время вне игры тоже считается. Уникальная добыча — уникальные и героические предметы, подобранные за это время. Столбцы — время до лимита по дням (короче — быстрее).",
      kinahStartNote: "Счётчик запущен после первой кины этого персонажа сегодня: началом считается момент, когда он был замечен.",
      uniqueLog: "Уникальная добыча сегодня", none: "Пока нет",
      skinsOf: "обликов", missing: "Нет", owned: "Есть", search: "Поиск обликов",
      anySlot: "Любой слот", armour: "Броня", weapons: "Оружие", accessories: "Украшения",
      box: "Сундуки", market: "Чёрный рынок", coin: "Лавки монет", cube: "Скрытые кубы", ranking: "Рейтинги", dungeon: "Подземелья", other: "Прочее",
      onSale: "Сейчас на чёрном рынке", ownedTag: "Есть", whereTo: "Где получить", gatherFor: "Собирать ради свёртка",
      gatherNote: "Выпадает с любого ресурса этих видов; шанс в игре не указан.",
      noCloset: "Гардероб загружается при входе: до этого все облики считаются недостающими.",
      shown: (n, total) => `Показано ${n} из ${total}: уточните поиском или фильтром.`,
      noSkins: "Подходящих обликов нет.", noSource: "Нет в списках игры (магазин или событие)",
      shops: { coin_shop_festa: "Лавка фестиваля", coin_shop_nightmare: "Лавка Кошмара", coin_shop_abyss: "Бездна", coin_shop_arena: "Арена", coin_shop_battlefield: "Поле боя" },
      nodes: { Herb: "Травы (Ария, Таргена)", Od: "Одила", Jewelry: "Самоцветы", Shellfish: "Моллюски", RareMetal: "Редкая руда", Tree: "Деревья", Berry: "Ягоды", Vegetable: "Овощи", Flower: "Цветы", Metal: "Руда" },
      h: "ч", m: "мин",
    },
    "zh-Hant": {
      pets: "寵物", kinah: "基納", skins: "外觀",
      today: "今日", started: "開始", soFar: "已過", atThisPace: "照此速度", perHour: "每小時",
      uniques: "獨特掉落", resetsIn: "重置倒數", reachedIn: "達成用時", notYet: "今日尚無基納",
      before: "之前", noCharacter: "以角色登入後會記錄其基納。",
      yourCharacters: "今日的角色", thisServer: "此伺服器", all: "全部",
      character: "角色", took: "用時", running: "進行中", stopped: "已停止", unique: "獨特",
      lastDays: "最近 7 天", day: "日期", reached1m: "達成 100 萬用時", notReached: "未達成",
      kinahNote: "「用時」從當日第一筆基納算到上限,離開遊戲的時間也算在內。獨特掉落是這段時間撿到的獨特與英雄物品。長條為每天達到上限的時間(越短越快)。",
      kinahStartNote: "計量器在此角色今日第一筆基納之後才啟動:顯示的開始時間為首次看到的時刻。",
      uniqueLog: "今日獨特掉落", none: "尚無",
      skinsOf: "外觀", missing: "未擁有", owned: "已擁有", search: "搜尋外觀",
      anySlot: "所有部位", armour: "防具", weapons: "武器", accessories: "飾品",
      box: "箱子", market: "黑雲商會", coin: "代幣商店", cube: "隱藏方塊", ranking: "排行", dungeon: "副本", other: "其他",
      onSale: "黑雲商會販售中", ownedTag: "已擁有", whereTo: "取得方式", gatherFor: "為包裹採集",
      gatherNote: "這些種類的採集點都可能掉落;遊戲未標示機率。",
      noCloset: "衣櫃於登入時載入:在此之前所有外觀都顯示為未擁有。",
      shown: (n, total) => `顯示 ${total} 個中的 ${n} 個:請搜尋或篩選。`,
      noSkins: "沒有符合的外觀。", noSource: "不在遊戲清單中(商店或活動)",
      shops: { coin_shop_festa: "慶典商店", coin_shop_nightmare: "惡夢商店", coin_shop_abyss: "深淵", coin_shop_arena: "競技場", coin_shop_battlefield: "戰場" },
      nodes: { Herb: "藥草(阿莉亞、塔爾吉納)", Od: "歐德", Jewelry: "寶石", Shellfish: "貝類", RareMetal: "稀有礦石", Tree: "樹木", Berry: "漿果", Vegetable: "蔬菜", Flower: "花卉", Metal: "礦石" },
      h: "小時", m: "分",
    },
    "zh-Hans": {
      pets: "宠物", kinah: "基纳", skins: "外观",
      today: "今日", started: "开始", soFar: "已过", atThisPace: "照此速度", perHour: "每小时",
      uniques: "独特掉落", resetsIn: "重置倒计时", reachedIn: "达成用时", notYet: "今日尚无基纳",
      before: "之前", noCharacter: "以角色登录后会记录其基纳。",
      yourCharacters: "今日的角色", thisServer: "此服务器", all: "全部",
      character: "角色", took: "用时", running: "进行中", stopped: "已停止", unique: "独特",
      lastDays: "最近 7 天", day: "日期", reached1m: "达成 100 万用时", notReached: "未达成",
      kinahNote: "“用时”从当日第一笔基纳算到上限,离开游戏的时间也算在内。独特掉落是这段时间捡到的独特与英雄物品。长条为每天达到上限的时间(越短越快)。",
      kinahStartNote: "计量器在此角色今日第一笔基纳之后才启动:显示的开始时间为首次看到的时刻。",
      uniqueLog: "今日独特掉落", none: "尚无",
      skinsOf: "外观", missing: "未拥有", owned: "已拥有", search: "搜索外观",
      anySlot: "所有部位", armour: "防具", weapons: "武器", accessories: "饰品",
      box: "箱子", market: "黑云商会", coin: "代币商店", cube: "隐藏方块", ranking: "排行", dungeon: "副本", other: "其他",
      onSale: "黑云商会出售中", ownedTag: "已拥有", whereTo: "获取方式", gatherFor: "为包裹采集",
      gatherNote: "这些种类的采集点都可能掉落;游戏未标示概率。",
      noCloset: "衣柜在登录时载入:在此之前所有外观都显示为未拥有。",
      shown: (n, total) => `显示 ${total} 个中的 ${n} 个:请搜索或筛选。`,
      noSkins: "没有符合的外观。", noSource: "不在游戏清单中(商店或活动)",
      shops: { coin_shop_festa: "庆典商店", coin_shop_nightmare: "噩梦商店", coin_shop_abyss: "深渊", coin_shop_arena: "竞技场", coin_shop_battlefield: "战场" },
      nodes: { Herb: "药草(阿莉亚、塔尔吉纳)", Od: "欧德", Jewelry: "宝石", Shellfish: "贝类", RareMetal: "稀有矿石", Tree: "树木", Berry: "浆果", Vegetable: "蔬菜", Flower: "花卉", Metal: "矿石" },
      h: "小时", m: "分",
    },
  };
  const t = (k) => UI[language]?.[k] ?? UI.en[k];
  const words = (i) => (i == null ? "" : COLLECTION_TEXT[i]?.[language] ?? COLLECTION_TEXT[i]?.en ?? "");
  const num = (n) => Math.round(n).toLocaleString(language);
  const clock = (ms) => new Date(ms).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  const span = (ms) => {
    const minutes = Math.max(0, Math.round(ms / 60_000));
    const h = Math.floor(minutes / 60);
    return h ? `${h} ${t("h")} ${String(minutes % 60).padStart(2, "0")} ${t("m")}` : `${minutes} ${t("m")}`;
  };
  const node = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // ---- State ------------------------------------------------------------------
  // character key -> { name, server, days: { [day start ms]: day } }, a day being
  // { seen, seenKinah, first, firstSeen, reached, last, lastAt, gainAt, uniques: [[at, item]] }:
  // first is the day's first Kinah (firstSeen: only when it was first seen, the
  // meter started later), reached when it came to the limit.
  let kinah = {};
  let cprefs = { tab: "pets", kinahScope: "server", kinahChar: null, skinStatus: "missing", skinSlot: "", skinSources: [], skinSearch: "" };
  let openSkin = null;
  // The character played, as the last character event named it (plugin.js's
  // marketChar follows only once its own handler has run).
  let current = null;
  const me = () => current || marketChar;
  const els = {
    tabs: document.querySelector(".tabs"),
    kinahView: document.querySelector(".kinahView"),
    skinsView: document.querySelector(".skinsView"),
    dropsView: document.querySelector(".dropsView"),
  };
  const ready = (async () => {
    kinah = (await a2.storage.get(KINAH_KEY).catch(() => null)) || {};
    dropStats = { chars: {}, lastRun: {}, ...((await a2.storage.get(DROPS_KEY).catch(() => null)) || {}) };
    cprefs = { ...cprefs, ...((await a2.storage.get(CPREFS_KEY).catch(() => null)) || {}) };
  })();
  const saveKinah = () => a2.storage.set(KINAH_KEY, kinah).catch(() => {});
  const savePrefs = () => a2.storage.set(CPREFS_KEY, cprefs).catch(() => {});

  // ---- Tabs -------------------------------------------------------------------
  const TABS = ["pets", "kinah", "drops", "skins"];
  function showTab(tab) {
    cprefs.tab = TABS.includes(tab) ? tab : "pets";
    for (const name of TABS) document.body.classList.toggle(`tab-${name}`, cprefs.tab === name);
    for (const b of els.tabs.querySelectorAll("button[data-tab]")) {
      b.setAttribute("aria-selected", String(b.dataset.tab === cprefs.tab));
    }
    renderTab();
  }
  function renderTabs() {
    for (const b of els.tabs.querySelectorAll("button[data-tab]")) b.textContent = t(b.dataset.tab);
  }
  function renderTab() {
    if (cprefs.tab === "kinah") renderKinah();
    else if (cprefs.tab === "drops") renderDrops();
    else if (cprefs.tab === "skins") renderSkins();
  }
  els.tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    showTab(b.dataset.tab);
    savePrefs();
  });

  // ---- Kinah --------------------------------------------------------------------
  function noteKinah(character) {
    const count = character?.kinahToday;
    const ck = characterKey(character);
    if (ck) current = ck;
    if (typeof count !== "number" || !ck) return;
    const now = Date.now();
    const day = dayOf(now);
    const who = (kinah[ck] ||= { name: character.name, server: Number(character.serverId) || 0, days: {} });
    who.name = character.name;
    let rec = who.days[day];
    if (!rec) {
      // First seen today: at 0 the day's first Kinah is still to come; above
      // it, it came before the meter started, and the day counts from now.
      rec = who.days[day] = { seen: now, seenKinah: count, first: count > 0 ? now : null, firstSeen: count > 0,
        reached: null, last: count, lastAt: now, gainAt: count > 0 ? now : null, uniques: [] };
      if (count >= KINAH_LIMIT) rec.reachedUnseen = true;
    } else if (count !== rec.last) {
      if (count > rec.last) {
        if (rec.first == null) rec.first = now;
        rec.gainAt = now;
      }
      if (count >= KINAH_LIMIT && !rec.reached && !rec.reachedUnseen) rec.reached = now;
      rec.last = count;
      rec.lastAt = now;
    } else {
      return;
    }
    for (const d of Object.keys(who.days)) if (Number(d) < day - KEEP_DAYS * DAY_MS) delete who.days[d];
    saveKinah();
    if (cprefs.tab === "kinah") renderKinah();
  }
  a2.on("character", (c) => ready.then(() => noteKinah(c)));

  // A Unique or Epic item picked up: counted for the day of whoever picked it up.
  a2.on("decoded:item-gained", (d, meta) => ready.then(() => {
    const item = Number(d?.item);
    if (!UNIQUE_ITEMS[item]) return;
    const ck = characterKey(meta?.character) || me();
    const at = Number(meta?.at) > 0 ? Math.min(Number(meta.at), Date.now()) : Date.now();
    const rec = kinah[ck]?.days[dayOf(at)];
    if (!rec) return;
    // The meter sends recent records again as the window opens: one item at
    // one moment counts once.
    if (rec.uniques.some(([when, id]) => id === item && Math.abs(when - at) < 1000)) return;
    rec.uniques.push([at, item]);
    saveKinah();
    if (cprefs.tab === "kinah") renderKinah();
  }));

  const inRun = (rec, at) => rec.first != null && at >= rec.first && (rec.reached == null || at <= rec.reached);
  const runUniques = (rec) => rec.uniques.filter(([at]) => inRun(rec, at)).length;
  function tookOf(rec, now) {
    if (rec.first == null) return null;
    return (rec.reached ?? (now - rec.gainAt < STOPPED_MS ? now : rec.gainAt)) - rec.first;
  }

  function renderKinah() {
    const view = els.kinahView;
    const now = Date.now();
    const day = dayOf(now);
    const who = me() && kinah[me()];
    const rec = who?.days[day];
    const parts = [];

    // Today, for the character played.
    const card = node("div", "kToday");
    if (!me() || me() === "char-unknown") {
      card.append(node("p", "kEmpty", t("noCharacter")));
    } else {
      const count = rec?.last ?? 0;
      const head = node("div", "summary");
      head.append(node("b", null, num(count)), ` / ${num(KINAH_LIMIT)} ${t("today")}`, node("span", "right", `${Math.floor((count * 100) / KINAH_LIMIT)}%`));
      const bar = node("div", "overall gold");
      const fill = node("span");
      fill.style.width = `${Math.min(100, (count * 100) / KINAH_LIMIT)}%`;
      bar.append(fill);
      card.append(head, bar);
      const facts = node("div", "kFacts");
      const fact = (label, value, cls) => {
        const f = node("div", "kFact", label);
        f.append(node("b", cls || null, value));
        facts.append(f);
      };
      if (rec?.first != null) {
        const elapsed = tookOf(rec, now);
        fact(t("started"), `${rec.firstSeen ? `${t("before")} ` : ""}${clock(rec.first)}`);
        fact(rec.reached ? t("reachedIn") : t("soFar"), `${rec.firstSeen ? "≥ " : ""}${span(elapsed)}`);
        const rate = elapsed > 5 * 60_000 ? ((count - (rec.firstSeen ? rec.seenKinah : 0)) * 3_600_000) / elapsed : 0;
        if (!rec.reached && rate > 0 && count < KINAH_LIMIT) {
          fact(t("atThisPace"), `≈ ${clock(now + ((KINAH_LIMIT - count) / rate) * 3_600_000)}`);
        } else {
          fact(t("atThisPace"), "—");
        }
        fact(t("perHour"), rate > 0 ? num(rate) : "—");
        fact(t("uniques"), String(runUniques(rec)), "gUnique");
      } else {
        card.append(node("p", "kEmpty", t("notYet")));
      }
      fact(t("resetsIn"), span(day + DAY_MS - now));
      card.append(facts);
      if (rec?.firstSeen) card.append(node("p", "kNote", t("kinahStartNote")));
    }
    parts.push(card);

    // Every character with Kinah today.
    const sect = node("div", "kSect", t("yourCharacters"));
    const scope = node("span", "kRight");
    for (const value of ["server", "all"]) {
      const label = node("label", "kRadio");
      const input = Object.assign(document.createElement("input"), { type: "radio", name: "kScope", value, checked: cprefs.kinahScope === value });
      label.append(input, ` ${t(value === "server" ? "thisServer" : "all")}`);
      scope.append(label);
    }
    sect.append(scope);
    parts.push(sect);
    const server = Number((me() || "").match(/^char-(\d+)/)?.[1]) || 0;
    const rows = Object.entries(kinah)
      .filter(([, who]) => who.days[day] && (cprefs.kinahScope === "all" || !server || who.server === server))
      .sort((a, b) => (b[1].days[day].last || 0) - (a[1].days[day].last || 0));
    const table = node("table", "kTable");
    const th = node("tr");
    th.append(node("th", null, t("character")), node("th", "r", t("kinah")), node("th", "r", t("took")), node("th", "r", t("unique")));
    table.append(th);
    for (const [, who] of rows) {
      const r = who.days[day];
      const tr = node("tr");
      const took = tookOf(r, now);
      let status;
      if (r.reached) status = node("td", "r", span(took));
      else if (r.reachedUnseen) status = node("td", "r muted", "✓");
      else if (r.gainAt && now - r.gainAt < STOPPED_MS) status = node("td", "r", null), status.append(node("span", "kPill", t("running")));
      else status = node("td", "r muted", took != null ? `${t("stopped")} ${span(took)}` : "—");
      tr.append(node("td", null, who.name), node("td", "r", num(r.last)), status, node("td", "r gUnique", String(runUniques(r))));
      table.append(tr);
    }
    if (rows.length) parts.push(table);

    // The last 7 days of one character.
    const names = Object.entries(kinah).filter(([, who]) => Object.keys(who.days).length);
    const pick = cprefs.kinahChar && kinah[cprefs.kinahChar] ? cprefs.kinahChar : me() && kinah[me()] ? me() : names[0]?.[0];
    if (pick) {
      const hist = node("div", "kSect", `${t("lastDays")}`);
      const select = node("select", "kChar");
      for (const [ck, who] of names) select.append(Object.assign(document.createElement("option"), { value: ck, textContent: who.name, selected: ck === pick }));
      const right = node("span", "kRight");
      right.append(select);
      hist.append(right);
      parts.push(hist);
      const days = Array.from({ length: 7 }, (_, i) => day - (6 - i) * DAY_MS);
      const took = days.map((d) => {
        const r = kinah[pick].days[d];
        return r?.reached && r.first != null ? r.reached - r.first : null;
      });
      const longest = Math.max(1, ...took.filter((x) => x != null));
      const bars = node("div", "kBars");
      const labels = node("div", "kBarDays");
      days.forEach((d, i) => {
        const b = node("span", d === day ? "today" : took[i] == null ? "none" : null);
        b.style.height = `${took[i] == null ? 6 : Math.max(8, (took[i] * 100) / longest)}%`;
        if (took[i] != null) b.title = span(took[i]);
        bars.append(b);
        labels.append(node("span", null, d === day ? t("today") : new Date(d).toLocaleDateString(language, { weekday: "short" })));
      });
      parts.push(bars, labels);
      const ht = node("table", "kTable");
      const hh = node("tr");
      hh.append(node("th", null, t("day")), node("th", "r", t("reached1m")), node("th", "r", t("unique")));
      ht.append(hh);
      for (const d of days.slice().reverse()) {
        const r = kinah[pick].days[d];
        if (!r) continue;
        const tr = node("tr");
        const label = new Date(d).toLocaleDateString(language, { weekday: "short", day: "numeric" });
        const value = r.reached && r.first != null
          ? `${r.firstSeen ? "≥ " : ""}${span(r.reached - r.first)}`
          : r.reachedUnseen ? "✓" : `${t("notReached")} (${num(r.last)})`;
        tr.append(node("td", null, label), node("td", r.reached ? "r" : "r muted", value), node("td", "r gUnique", String(runUniques(r))));
        ht.append(tr);
      }
      parts.push(ht);
    }

    // Today's Unique drops, the last first.
    if (rec) {
      parts.push(node("div", "kSect", t("uniqueLog")));
      const log = node("ul", "kLog");
      const drops = rec.uniques.slice().sort((a, b) => b[0] - a[0]);
      for (const [at, item] of drops.slice(0, 20)) {
        const li = node("li");
        const [grade, name] = UNIQUE_ITEMS[item] || [3, null];
        li.append(node("span", "kAt", clock(at)), node("span", grade >= 4 ? "gEpic" : "gUnique", words(name) || `#${item}`));
        if (inRun(rec, at)) li.append(node("span", "kWhere", t("kinah")));
        log.append(li);
      }
      if (!drops.length) log.append(node("li", "muted", t("none")));
      parts.push(log);
    }
    parts.push(node("p", "kNote", t("kinahNote")));
    view.replaceChildren(...parts);
  }
  els.kinahView.addEventListener("change", (e) => {
    if (e.target.name === "kScope") cprefs.kinahScope = e.target.value;
    else if (e.target.classList.contains("kChar")) cprefs.kinahChar = e.target.value;
    else return;
    savePrefs();
    renderKinah();
  });
  // The clocks and "running" age without an event.
  setInterval(() => { if (cprefs.tab === "kinah" && !document.hidden) renderKinah(); }, 30_000);

  // ---- Drops ----------------------------------------------------------------------
  //
  // What you get against what the game lists (meter 2.0.98 on, event "loot"):
  // a monster's drops counted against the kills you hit (in a party each
  // member gets drops of their own, so only yours count), gathering's extras
  // and double yields against your gathers, and the Shugo Festival's and the
  // Dimensional Invasion's rewards against their runs (an item burst while
  // the game says the content is cleared, `00 61` state 3). Kept per
  // character and day, for 90 days.
  const DROPS_UI = {
    en: { drops: "Drops", searchDrops: "Search items or monsters", allSources: "All", monsters: "Monsters", gathering: "Gathering", festival: "Shugo Festival", invasion: "Dimensional Invasion", event: "Event rewards", sortBy: "Sort", mostSeen: "Most seen", luckiest: "Luckiest", byName: "Name", periodToday: "Today", period7: "Last 7 days", period30: "Last 30 days", periodAll: "All kept", uniqueOnly: "Unique and above only", thisChar: "This character only", seen: "seen", listed: "listed", fromKills: (n, k) => `${n} from ${k} kills`, fromGathers: (n, k) => `${n} from ${k} gathers`, inRuns: (n, k) => `in ${n} of ${k} runs`, doubled: "double yield", noDrops: "No drops yet. They come in as you kill, gather and claim rewards, with meter 2.0.98 or later.", dropsNote: "The bar is your rate; the white mark is the game's listed chance. Your rate counts your own drops and the kills you hit: in a party each member gets drops of their own. Gathering extras and event rewards have no listed chance (—).", shownDrops: (n, total) => `Showing ${n} of ${total}: search or filter to narrow.` },
    ko: { drops: "드롭", searchDrops: "아이템 또는 몬스터 검색", allSources: "전체", monsters: "몬스터", gathering: "채집", festival: "슈고 축제", invasion: "차원 침공", event: "이벤트 보상", sortBy: "정렬", mostSeen: "많이 얻은 순", luckiest: "운 좋은 순", byName: "이름", periodToday: "오늘", period7: "최근 7일", period30: "최근 30일", periodAll: "전체 기록", uniqueOnly: "유일 이상만", thisChar: "이 캐릭터만", seen: "실제", listed: "표기", fromKills: (n, k) => `${k}회 처치 중 ${n}개`, fromGathers: (n, k) => `${k}회 채집 중 ${n}개`, inRuns: (n, k) => `${k}회 중 ${n}회`, doubled: "두 배 채집", noDrops: "아직 드롭 기록이 없습니다. 처치, 채집, 보상 수령 시 기록됩니다(미터 2.0.98 이상).", dropsNote: "막대는 내 확률, 흰 표시는 게임 표기 확률입니다. 내 확률은 내가 얻은 드롭과 내가 공격한 처치만 셉니다. 파티에서는 각자 따로 드롭을 얻습니다. 채집 추가 보상과 이벤트 보상은 표기 확률이 없습니다(—).", shownDrops: (n, total) => `${total}개 중 ${n}개 표시: 검색이나 필터로 좁혀 보세요.` },
    ja: { drops: "ドロップ", searchDrops: "アイテムやモンスターを検索", allSources: "すべて", monsters: "モンスター", gathering: "採集", festival: "シュゴ祭り", invasion: "次元侵攻", event: "イベント報酬", sortBy: "並べ替え", mostSeen: "入手数順", luckiest: "幸運順", byName: "名前", periodToday: "今日", period7: "過去7日", period30: "過去30日", periodAll: "記録すべて", uniqueOnly: "唯一以上のみ", thisChar: "このキャラクターのみ", seen: "実績", listed: "表記", fromKills: (n, k) => `${k}回討伐で${n}個`, fromGathers: (n, k) => `${k}回採集で${n}個`, inRuns: (n, k) => `${k}回中${n}回`, doubled: "倍採集", noDrops: "まだドロップの記録がありません。討伐・採集・報酬受け取りで記録されます(メーター2.0.98以降)。", dropsNote: "棒は自分の確率、白い印はゲームの表記確率です。自分の確率は自分のドロップと自分が攻撃した討伐だけで数えます。パーティーでは各自に別々のドロップがあります。採集の追加報酬とイベント報酬には表記確率がありません(—)。", shownDrops: (n, total) => `${total}件中${n}件を表示:検索やフィルターで絞り込めます。` },
    de: { drops: "Beute", searchDrops: "Gegenstände oder Monster suchen", allSources: "Alle", monsters: "Monster", gathering: "Sammeln", festival: "Shugo-Fest", invasion: "Dimensionsinvasion", event: "Event-Belohnungen", sortBy: "Sortieren", mostSeen: "Am häufigsten", luckiest: "Glücklichste", byName: "Name", periodToday: "Heute", period7: "Letzte 7 Tage", period30: "Letzte 30 Tage", periodAll: "Alles gespeichert", uniqueOnly: "Nur ab Einzigartig", thisChar: "Nur dieser Charakter", seen: "erlebt", listed: "angegeben", fromKills: (n, k) => `${n} aus ${k} Kills`, fromGathers: (n, k) => `${n} aus ${k}-mal Sammeln`, inRuns: (n, k) => `in ${n} von ${k} Läufen`, doubled: "doppelte Ausbeute", noDrops: "Noch keine Beute. Sie kommt beim Töten, Sammeln und Abholen von Belohnungen, ab Meter 2.0.98.", dropsNote: "Der Balken ist deine Rate, die weiße Markierung die Chance laut Spiel. Deine Rate zählt deine eigene Beute und die Kills, an denen du getroffen hast: In einer Gruppe bekommt jedes Mitglied eigene Beute. Sammel-Extras und Event-Belohnungen haben keine angegebene Chance (—).", shownDrops: (n, total) => `${n} von ${total}: suche oder filtere, um einzugrenzen.` },
    fr: { drops: "Butin", searchDrops: "Rechercher objets ou monstres", allSources: "Tout", monsters: "Monstres", gathering: "Récolte", festival: "Festival Shugo", invasion: "Invasion dimensionnelle", event: "Récompenses d'événement", sortBy: "Trier", mostSeen: "Les plus obtenus", luckiest: "Les plus chanceux", byName: "Nom", periodToday: "Aujourd'hui", period7: "7 derniers jours", period30: "30 derniers jours", periodAll: "Tout l'historique", uniqueOnly: "Unique et plus seulement", thisChar: "Ce personnage seulement", seen: "obtenu", listed: "indiqué", fromKills: (n, k) => `${n} sur ${k} victimes`, fromGathers: (n, k) => `${n} sur ${k} récoltes`, inRuns: (n, k) => `dans ${n} parties sur ${k}`, doubled: "récolte double", noDrops: "Pas encore de butin. Il arrive quand vous tuez, récoltez et réclamez des récompenses, avec le compteur 2.0.98 ou plus.", dropsNote: "La barre est votre taux ; la marque blanche, la chance indiquée par le jeu. Votre taux compte votre propre butin et les monstres que vous avez frappés : en groupe, chaque membre a son propre butin. Les bonus de récolte et les récompenses d'événement n'ont pas de chance indiquée (—).", shownDrops: (n, total) => `${n} sur ${total} : cherchez ou filtrez pour affiner.` },
    es: { drops: "Botín", searchDrops: "Buscar objetos o monstruos", allSources: "Todo", monsters: "Monstruos", gathering: "Recolección", festival: "Festival Shugo", invasion: "Invasión dimensional", event: "Recompensas de evento", sortBy: "Ordenar", mostSeen: "Más obtenidos", luckiest: "Más suerte", byName: "Nombre", periodToday: "Hoy", period7: "Últimos 7 días", period30: "Últimos 30 días", periodAll: "Todo lo guardado", uniqueOnly: "Solo único o superior", thisChar: "Solo este personaje", seen: "visto", listed: "indicado", fromKills: (n, k) => `${n} de ${k} muertes`, fromGathers: (n, k) => `${n} de ${k} recolecciones`, inRuns: (n, k) => `en ${n} de ${k} partidas`, doubled: "recolección doble", noDrops: "Aún no hay botín. Llega al matar, recolectar y reclamar recompensas, con el medidor 2.0.98 o posterior.", dropsNote: "La barra es tu tasa; la marca blanca, la probabilidad que indica el juego. Tu tasa cuenta tu propio botín y las muertes en las que golpeaste: en grupo, cada miembro recibe su propio botín. Los extras de recolección y las recompensas de evento no tienen probabilidad indicada (—).", shownDrops: (n, total) => `Mostrando ${n} de ${total}: busca o filtra para acotar.` },
    pt: { drops: "Saque", searchDrops: "Buscar itens ou monstros", allSources: "Tudo", monsters: "Monstros", gathering: "Coleta", festival: "Festival Shugo", invasion: "Invasão Dimensional", event: "Recompensas de evento", sortBy: "Ordenar", mostSeen: "Mais obtidos", luckiest: "Mais sorte", byName: "Nome", periodToday: "Hoje", period7: "Últimos 7 dias", period30: "Últimos 30 dias", periodAll: "Tudo guardado", uniqueOnly: "Só único ou acima", thisChar: "Só este personagem", seen: "visto", listed: "indicado", fromKills: (n, k) => `${n} de ${k} abates`, fromGathers: (n, k) => `${n} de ${k} coletas`, inRuns: (n, k) => `em ${n} de ${k} partidas`, doubled: "coleta dupla", noDrops: "Ainda sem saque. Ele chega ao abater, coletar e resgatar recompensas, com o medidor 2.0.98 ou mais recente.", dropsNote: "A barra é sua taxa; a marca branca, a chance indicada pelo jogo. Sua taxa conta seu próprio saque e os abates em que você bateu: em grupo, cada membro recebe saque próprio. Extras de coleta e recompensas de evento não têm chance indicada (—).", shownDrops: (n, total) => `Mostrando ${n} de ${total}: busque ou filtre para refinar.` },
    ru: { drops: "Добыча", searchDrops: "Поиск предметов или монстров", allSources: "Всё", monsters: "Монстры", gathering: "Сбор", festival: "Фестиваль шугов", invasion: "Пространственное вторжение", event: "Награды событий", sortBy: "Сортировка", mostSeen: "Чаще всего", luckiest: "Удачнее всего", byName: "Название", periodToday: "Сегодня", period7: "Последние 7 дней", period30: "Последние 30 дней", periodAll: "Всё сохранённое", uniqueOnly: "Только уникальные и выше", thisChar: "Только этот персонаж", seen: "у вас", listed: "в игре", fromKills: (n, k) => `${n} из ${k} убийств`, fromGathers: (n, k) => `${n} из ${k} сборов`, inRuns: (n, k) => `в ${n} из ${k} заходов`, doubled: "двойной сбор", noDrops: "Добычи пока нет. Она появится при убийствах, сборе и получении наград, со счётчиком 2.0.98 или новее.", dropsNote: "Полоса — ваш шанс, белая отметка — шанс, указанный в игре. Ваш шанс считает только вашу добычу и убийства, где вы били: в группе у каждого своя добыча. У бонусов сбора и наград событий нет указанного шанса (—).", shownDrops: (n, total) => `Показано ${n} из ${total}: уточните поиском или фильтром.` },
    "zh-Hant": { drops: "掉落", searchDrops: "搜尋物品或怪物", allSources: "全部", monsters: "怪物", gathering: "採集", festival: "修果慶典", invasion: "次元侵略", event: "活動獎勵", sortBy: "排序", mostSeen: "最多", luckiest: "最幸運", byName: "名稱", periodToday: "今日", period7: "最近 7 天", period30: "最近 30 天", periodAll: "全部紀錄", uniqueOnly: "只看獨特以上", thisChar: "只看此角色", seen: "實際", listed: "標示", fromKills: (n, k) => `擊殺 ${k} 次得 ${n} 個`, fromGathers: (n, k) => `採集 ${k} 次得 ${n} 個`, inRuns: (n, k) => `${k} 次中 ${n} 次`, doubled: "雙倍採集", noDrops: "尚無掉落紀錄。擊殺、採集與領取獎勵時會記錄(計量器 2.0.98 以上)。", dropsNote: "長條為你的機率,白色標記為遊戲標示機率。你的機率只計你自己的掉落與你有攻擊的擊殺:組隊時每位成員各有自己的掉落。採集額外獎勵與活動獎勵沒有標示機率(—)。", shownDrops: (n, total) => `顯示 ${total} 個中的 ${n} 個:請搜尋或篩選。` },
    "zh-Hans": { drops: "掉落", searchDrops: "搜索物品或怪物", allSources: "全部", monsters: "怪物", gathering: "采集", festival: "修果庆典", invasion: "次元侵略", event: "活动奖励", sortBy: "排序", mostSeen: "最多", luckiest: "最幸运", byName: "名称", periodToday: "今日", period7: "最近 7 天", period30: "最近 30 天", periodAll: "全部记录", uniqueOnly: "只看独特以上", thisChar: "只看此角色", seen: "实际", listed: "标示", fromKills: (n, k) => `击杀 ${k} 次得 ${n} 个`, fromGathers: (n, k) => `采集 ${k} 次得 ${n} 个`, inRuns: (n, k) => `${k} 次中 ${n} 次`, doubled: "双倍采集", noDrops: "尚无掉落记录。击杀、采集与领取奖励时会记录(计量器 2.0.98 以上)。", dropsNote: "长条为你的概率,白色标记为游戏标示概率。你的概率只计你自己的掉落与你有攻击的击杀:组队时每位成员各有自己的掉落。采集额外奖励与活动奖励没有标示概率(—)。", shownDrops: (n, total) => `显示 ${total} 个中的 ${n} 个:请搜索或筛选。` },
  };
  for (const [code, w] of Object.entries(DROPS_UI)) Object.assign(UI[code], w);

  const DROPS_KEY = "dropStats";
  const KEEP_DROP_DAYS = 90;
  // The timed contents whose rewards are counted, by the game's content id.
  const CONTENTS = { 500043: "festival", 500032: "invasion" };
  // A reward burst this long after the last of its content is a new run.
  const RUN_GAP_MS = 120_000;
  const ROWS_SHOWN = 120;
  // chars: character key -> { days: { [day]: stat } }; lastRun: content -> ms.
  let dropStats = { chars: {}, lastRun: {} };
  const runItems = {};
  const emptyStat = () => ({ kills: {}, mob: {}, gathers: {}, bonus: {}, extras: {}, runs: {}, reward: {}, rewardRuns: {} });
  const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  const gradeOf = (item) => (DROP_ITEMS[item] || UNIQUE_ITEMS[item] || [0])[0];
  const itemName = (item) => words((DROP_ITEMS[item] || UNIQUE_ITEMS[item] || [])[1]) || `#${item}`;
  const mobName = (mob) => words(MOB_NAMES[mob]) || `#${mob}`;
  let dropsDirty = false;
  setInterval(() => {
    if (!dropsDirty) return;
    dropsDirty = false;
    a2.storage.set(DROPS_KEY, dropStats).catch(() => {});
  }, 5_000);

  function noteLoot(e, meta) {
    const ck = characterKey(meta?.character) || me();
    if (!ck || !e) return;
    const at = Number(e.at) > 0 ? Number(e.at) : Date.now();
    const who = (dropStats.chars[ck] ||= { days: {} });
    const s = (who.days[dayOf(at)] ||= emptyStat());
    if (e.kind === "kill") {
      if (!e.byYou || !e.mob) return;
      bump(s.kills, e.mob);
    } else if (e.kind === "drops") {
      const mine = (e.drops || []).filter((d) => d.owner === "you" && d.mob);
      if (!mine.length) return;
      for (const d of mine) bump(s.mob, `${d.mob}:${d.item}`, d.count || 1);
    } else if (e.kind === "gather") {
      const g = e.gather;
      if (g?.type !== "done" || !g.item) return;
      bump(s.gathers, g.item);
      if (g.bonus > 0) bump(s.bonus, g.item);
      if (g.extraItem) bump(s.extras, `${g.item}:${g.extraItem}`, g.extraCount || 1);
    } else if (e.kind === "items") {
      const place = e.atPlace || {};
      if (place.contentState !== 3 || !CONTENTS[place.content]) return;
      const key = String(place.content);
      const gained = (e.items || []).filter((i) => i.gained > 0);
      if (!gained.length) return;
      if (at - (dropStats.lastRun[key] || 0) > RUN_GAP_MS) {
        bump(s.runs, key);
        runItems[key] = new Set();
      }
      dropStats.lastRun[key] = at;
      for (const i of gained) {
        bump(s.reward, `${key}:${i.item}`, i.gained);
        if (!runItems[key]?.has(i.item)) {
          (runItems[key] ||= new Set()).add(i.item);
          bump(s.rewardRuns, `${key}:${i.item}`);
        }
      }
    } else {
      return;
    }
    for (const d of Object.keys(who.days)) if (Number(d) < dayOf(at) - KEEP_DROP_DAYS * DAY_MS) delete who.days[d];
    dropsDirty = true;
    if (cprefs.tab === "drops") renderDrops();
  }
  a2.on("loot", (e, meta) => ready.then(() => noteLoot(e, meta)));

  // The counts of the period and characters chosen, added up.
  function dropTotals() {
    const now = Date.now();
    const from = { today: dayOf(now), "7": dayOf(now) - 6 * DAY_MS, "30": dayOf(now) - 29 * DAY_MS }[cprefs.dropPeriod] ?? 0;
    const total = emptyStat();
    const chars = cprefs.dropThisChar ? [dropStats.chars[me()]].filter(Boolean) : Object.values(dropStats.chars);
    for (const who of chars) {
      for (const [day, s] of Object.entries(who.days)) {
        if (Number(day) < from) continue;
        for (const part of Object.keys(total)) for (const [k, n] of Object.entries(s[part] || {})) bump(total[part], k, n);
      }
    }
    return total;
  }

  // The game's chance that one kill of `mob` drops `item`, 0 to 1, or null.
  function listedChance(mob, item) {
    let best = null;
    for (const i of MOB_LISTS[mob] || []) {
      const hit = DROP_LISTS[i]?.find(([id]) => id === item);
      if (hit) best = Math.max(best ?? 0, hit[1] / 100_000_000);
    }
    return best;
  }

  function dropRows() {
    const s = dropTotals();
    const rows = [];
    for (const [key, n] of Object.entries(s.mob)) {
      const [mob, item] = key.split(":").map(Number);
      const kills = s.kills[mob] || 0;
      rows.push({ kind: "monsters", item, n, rate: kills ? n / kills : null, listed: listedChance(mob, item),
        source: mobName(mob), detail: t("fromKills")(num(n), num(kills)) });
    }
    for (const [key, n] of Object.entries(s.extras)) {
      const [main, item] = key.split(":").map(Number);
      const of = s.gathers[main] || 0;
      rows.push({ kind: "gathering", item, n, rate: of ? n / of : null, listed: null,
        source: itemName(main), detail: t("fromGathers")(num(n), num(of)) });
    }
    for (const [main, n] of Object.entries(s.bonus)) {
      const of = s.gathers[main] || 0;
      rows.push({ kind: "gathering", item: Number(main), n, rate: of ? n / of : null, listed: null,
        source: t("doubled"), detail: t("fromGathers")(num(n), num(of)) });
    }
    for (const [key, n] of Object.entries(s.reward)) {
      const [content, item] = key.split(":");
      const runs = s.runs[content] || 0;
      const withIt = s.rewardRuns[key] || 0;
      rows.push({ kind: CONTENTS[content] || "event", item: Number(item), n, rate: runs ? withIt / runs : null, listed: null,
        source: `×${num(n)}`, detail: t("inRuns")(num(withIt), num(runs)) });
    }
    return rows;
  }

  const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`);

  function renderDrops() {
    const view = els.dropsView;
    const parts = [];
    const search = Object.assign(document.createElement("input"), { type: "search", className: "search dSearch", placeholder: t("searchDrops"), value: cprefs.dropSearch || "", spellcheck: false });
    search.setAttribute("aria-label", t("searchDrops"));
    parts.push(search);

    const chips = node("div", "chips dSources");
    for (const kind of ["all", "monsters", "gathering", "festival", "invasion"]) {
      const b = node("button", "chip", t(kind === "all" ? "allSources" : kind));
      b.type = "button";
      b.dataset.dkind = kind;
      b.setAttribute("aria-pressed", String((cprefs.dropKind || "all") === kind));
      chips.append(b);
    }
    parts.push(chips);

    const sortRow = node("div", "sRow");
    sortRow.append(node("span", "muted dLabel", t("sortBy")));
    for (const value of ["seen", "lucky", "name"]) {
      const label = node("label", "kRadio");
      label.append(Object.assign(document.createElement("input"), { type: "radio", name: "dSort", value, checked: (cprefs.dropSort || "seen") === value }),
        ` ${t(value === "seen" ? "mostSeen" : value === "lucky" ? "luckiest" : "byName")}`);
      sortRow.append(label);
    }
    const period = node("select", "kChar dPeriod");
    for (const [value, label] of [["today", "periodToday"], ["7", "period7"], ["30", "period30"], ["all", "periodAll"]]) {
      period.append(Object.assign(document.createElement("option"), { value, textContent: t(label) }));
    }
    period.value = cprefs.dropPeriod || "7";
    const right = node("span", "kRight");
    right.append(period);
    sortRow.append(right);
    parts.push(sortRow);

    const ticks = node("div", "sRow");
    for (const [cls, key, on] of [["dUnique", "uniqueOnly", cprefs.dropUnique], ["dThisChar", "thisChar", cprefs.dropThisChar]]) {
      const label = node("label", "kRadio");
      label.append(Object.assign(document.createElement("input"), { type: "checkbox", className: cls, checked: !!on }), ` ${t(key)}`);
      ticks.append(label);
    }
    parts.push(ticks);

    const q = (cprefs.dropSearch || "").trim().toLowerCase();
    const kind = cprefs.dropKind || "all";
    const all = dropRows();
    const rows = all
      .filter((r) => kind === "all" || r.kind === kind || (kind === "festival" && r.kind === "event"))
      .filter((r) => !cprefs.dropUnique || gradeOf(r.item) >= 3)
      .filter((r) => !q || itemName(r.item).toLowerCase().includes(q) || r.source.toLowerCase().includes(q))
      .sort((a, b) => {
        const sort = cprefs.dropSort || "seen";
        if (sort === "name") return itemName(a.item).localeCompare(itemName(b.item), language);
        if (sort === "lucky") {
          const la = a.listed && a.rate != null ? a.rate / a.listed : -1;
          const lb = b.listed && b.rate != null ? b.rate / b.listed : -1;
          return lb - la || b.n - a.n;
        }
        return b.n - a.n;
      });

    const list = node("div", "dList");
    for (const r of rows.slice(0, ROWS_SHOWN)) {
      const row = node("div", "drop");
      const top = node("div", "dTop");
      top.append(node("span", `dName gName g${gradeOf(r.item)}`, itemName(r.item)));
      const rates = node("span", "dRates");
      const rate = (value, label, cls) => {
        const x = node("span", `dRate${cls ? ` ${cls}` : ""}`);
        x.append(node("b", null, value), node("small", null, label));
        return x;
      };
      rates.append(rate(pct(r.rate), t("seen")), rate(pct(r.listed), t("listed"), "listed"));
      top.append(rates);
      const sub = node("div", "dSub");
      sub.append(node("span", "dSrc", t(r.kind)), node("span", null, `${r.source} · ${r.detail}`));
      const bar = node("div", "dBar");
      const scale = Math.max(r.rate ?? 0, r.listed ?? 0) * 2 || 1;
      const seen = node("span", "dSeen");
      seen.style.width = `${Math.min(100, ((r.rate ?? 0) / scale) * 100)}%`;
      bar.append(seen);
      if (r.listed != null) {
        const mark = node("span", "dMark");
        mark.style.left = `${Math.min(100, (r.listed / scale) * 100)}%`;
        bar.append(mark);
      }
      row.append(top, sub, bar);
      list.append(row);
    }
    parts.push(list);
    if (!all.length) parts.push(node("p", "kNote", t("noDrops")));
    else if (rows.length > ROWS_SHOWN) parts.push(node("p", "kNote", t("shownDrops")(ROWS_SHOWN, rows.length)));
    parts.push(node("p", "kNote", t("dropsNote")));

    const typing = document.activeElement?.classList?.contains("dSearch");
    const caret = typing ? document.activeElement.selectionStart : null;
    view.replaceChildren(...parts);
    if (typing) {
      search.focus();
      if (caret != null) search.setSelectionRange(caret, caret);
    }
  }
  els.dropsView.addEventListener("input", (e) => {
    if (!e.target.classList.contains("dSearch")) return;
    cprefs.dropSearch = e.target.value;
    savePrefs();
    renderDrops();
  });
  els.dropsView.addEventListener("change", (e) => {
    if (e.target.name === "dSort") cprefs.dropSort = e.target.value;
    else if (e.target.classList.contains("dPeriod")) cprefs.dropPeriod = e.target.value;
    else if (e.target.classList.contains("dUnique")) cprefs.dropUnique = e.target.checked;
    else if (e.target.classList.contains("dThisChar")) cprefs.dropThisChar = e.target.checked;
    else return;
    savePrefs();
    renderDrops();
  });
  els.dropsView.addEventListener("click", (e) => {
    const chip = e.target.closest("button[data-dkind]");
    if (!chip) return;
    cprefs.dropKind = chip.dataset.dkind;
    savePrefs();
    renderDrops();
  });

  // ---- Skins ----------------------------------------------------------------------
  const SLOTS = {
    armour: ["Helmet", "Torso", "Pants", "Gloves", "Boots", "Shoulder", "Cape"],
    weapons: ["Greatsword", "Sword", "Dagger", "Bow", "Magicbook", "Orb", "Mace", "Staff", "Gauntlet"],
    accessories: ["Earring", "Necklace", "ShoulderWear", "EyeWear", "MouthWear"],
  };
  const SOURCE_KINDS = ["box", "market", "coin", "cube", "ranking", "dungeon", "other"];
  const ALL_SKINS = Object.entries(SKINS).map(([id, s]) => ({ id: Number(id), ...s }));
  const ownedSkins = () => {
    const list = owned[me()]?.skins;
    return Array.isArray(list) ? new Set(list.map(Number)) : null;
  };
  const skinName = (s) => words(sideOf(me()) === "asmodian" && s.d != null ? s.d : s.n);
  // The skins on the Black Market for this character now.
  function onSaleSkins(now = Date.now()) {
    const ids = new Set();
    for (const tab of Object.values(market[me()] || {})) {
      if (!(tab.refreshAt > now)) continue;
      for (const g of tab.goods || []) {
        const item = SHOP_ITEMS[g.itemId];
        if (item && item[0] === "skin" && item[3]) ids.add(item[3]);
      }
    }
    return ids;
  }
  const kindsOf = (s) => (s.src?.length ? [...new Set(s.src.map((x) => x[0]))] : ["other"]);
  function sourceText(src) {
    const [kind, a, b] = src;
    if (kind === "box") return `${words(SKIN_BOXES[a]?.n) || `#${a}`} ${b}%`;
    if (kind === "coin") {
      const own = t("shops")[a];
      const game = words(COIN_SHOPS[a]);
      return game && own ? `${game} (${own})` : game || own || t("coin");
    }
    return t(kind);
  }

  function renderSkins() {
    const view = els.skinsView;
    const have = ownedSkins();
    const sale = onSaleSkins();
    const total = ALL_SKINS.length;
    const count = have ? ALL_SKINS.filter((s) => have.has(s.id)).length : 0;
    const parts = [];

    const head = node("div", "summary");
    head.append(node("b", null, num(count)), ` / ${num(total)} ${t("skinsOf")}`, node("span", "right", `${num(total - count)} ${t("missing").toLowerCase()}`));
    const bar = node("div", "overall");
    const fill = node("span");
    fill.style.width = `${(count * 100) / Math.max(1, total)}%`;
    bar.append(fill);
    parts.push(head, bar);
    if (!have) parts.push(node("p", "kNote", t("noCloset")));

    const search = Object.assign(document.createElement("input"), { type: "search", className: "search sSearch", placeholder: t("search"), value: cprefs.skinSearch || "", spellcheck: false });
    search.setAttribute("aria-label", t("search"));
    parts.push(search);

    const row = node("div", "sRow");
    for (const value of ["missing", "owned", "all"]) {
      const label = node("label", "kRadio");
      label.append(Object.assign(document.createElement("input"), { type: "radio", name: "sStatus", value, checked: cprefs.skinStatus === value }), ` ${t(value)}`);
      row.append(label);
    }
    const slot = node("select", "sSlot");
    slot.append(Object.assign(document.createElement("option"), { value: "", textContent: t("anySlot") }));
    for (const group of Object.keys(SLOTS)) slot.append(Object.assign(document.createElement("option"), { value: group, textContent: t(group) }));
    slot.value = cprefs.skinSlot || "";
    const right = node("span", "kRight");
    right.append(slot);
    row.append(right);
    parts.push(row);

    const chips = node("div", "chips sSources");
    const picked = new Set(cprefs.skinSources || []);
    for (const kind of SOURCE_KINDS) {
      const b = node("button", "chip", t(kind));
      b.type = "button";
      b.dataset.kind = kind;
      b.setAttribute("aria-pressed", String(picked.has(kind)));
      chips.append(b);
    }
    parts.push(chips);

    const q = (cprefs.skinSearch || "").trim().toLowerCase();
    const slots = cprefs.skinSlot ? new Set(SLOTS[cprefs.skinSlot]) : null;
    const list = ALL_SKINS.filter((s) => {
      const mine = have?.has(s.id) || false;
      if (cprefs.skinStatus === "missing" && mine) return false;
      if (cprefs.skinStatus === "owned" && !mine) return false;
      if (slots && !slots.has(s.s)) return false;
      if (picked.size && !kindsOf(s).some((k) => picked.has(k))) return false;
      if (q && !skinName(s).toLowerCase().includes(q) && !(COLLECTION_TEXT[s.n]?.en || "").toLowerCase().includes(q)) return false;
      return true;
    // On sale now first, then the ones the game says where to get, the best first.
    }).sort((a, b) => (sale.has(b.id) - sale.has(a.id)) || (!!b.src - !!a.src) || b.g - a.g || a.o - b.o);

    const ul = node("ol", "sList");
    for (const s of list.slice(0, SKIN_ROWS)) {
      const li = node("li", "sSkin");
      li.dataset.skin = String(s.id);
      const mine = have?.has(s.id);
      const icon = node("span", `sIcon g${s.g}${mine ? " owned" : ""}`);
      const body = node("div", "sBody");
      const name = node("div", "sName");
      name.append(node("span", `gName g${s.g}`, skinName(s)));
      if (sale.has(s.id) && !mine) name.append(node("span", "sTag", t("onSale")));
      const how = node("div", "sHow", mine ? t("ownedTag") : s.src?.length ? s.src.map(sourceText).join(" · ") : t("noSource"));
      body.append(name, how);
      const boxes = (s.src || []).filter((x) => x[0] === "box" && SKIN_BOXES[x[1]]?.nodes);
      if (boxes.length && !mine) {
        const more = node("button", "sMore", `${t("whereTo")} ${openSkin === s.id ? "▾" : "▸"}`);
        more.type = "button";
        more.setAttribute("aria-expanded", String(openSkin === s.id));
        body.append(more);
        if (openSkin === s.id) {
          const where = node("div", "sWhere");
          const seen = new Set();
          for (const [, boxId, pct] of boxes) {
            if (seen.has(boxId)) continue;
            seen.add(boxId);
            const box = SKIN_BOXES[boxId];
            const title = node("div", "sWhereHead");
            title.append(node("b", null, `${words(box.n)} · ${pct}%`), node("span", "muted", t("gatherFor")));
            where.append(title);
            for (const kind of box.nodes) where.append(node("div", "sNode", t("nodes")[kind] || kind));
          }
          where.append(node("div", "muted sNote", t("gatherNote")));
          body.append(where);
        }
      }
      li.append(icon, body);
      ul.append(li);
    }
    parts.push(ul);
    if (!list.length) parts.push(node("p", "kNote", t("noSkins")));
    else if (list.length > SKIN_ROWS) parts.push(node("p", "kNote", t("shown")(SKIN_ROWS, list.length)));

    // Keep the search box focused through the redraw.
    const typing = document.activeElement?.classList?.contains("sSearch");
    const caret = typing ? document.activeElement.selectionStart : null;
    view.replaceChildren(...parts);
    if (typing) {
      search.focus();
      if (caret != null) search.setSelectionRange(caret, caret);
    }
  }
  els.skinsView.addEventListener("input", (e) => {
    if (!e.target.classList.contains("sSearch")) return;
    cprefs.skinSearch = e.target.value;
    savePrefs();
    renderSkins();
  });
  els.skinsView.addEventListener("change", (e) => {
    if (e.target.name === "sStatus") cprefs.skinStatus = e.target.value;
    else if (e.target.classList.contains("sSlot")) cprefs.skinSlot = e.target.value;
    else return;
    savePrefs();
    renderSkins();
  });
  els.skinsView.addEventListener("click", (e) => {
    const chip = e.target.closest("button[data-kind]");
    if (chip) {
      const kinds = new Set(cprefs.skinSources || []);
      if (kinds.has(chip.dataset.kind)) kinds.delete(chip.dataset.kind);
      else kinds.add(chip.dataset.kind);
      cprefs.skinSources = [...kinds];
      savePrefs();
      renderSkins();
      return;
    }
    const more = e.target.closest(".sMore");
    if (more) {
      const id = Number(more.closest("[data-skin]")?.dataset.skin);
      openSkin = openSkin === id ? null : id;
      renderSkins();
    }
  });
  // The Closet and the Black Market change through plugin.js's handlers.
  for (const event of ["decoded:skins-owned", "decoded:skin-added", "blackMarket", "character"]) {
    a2.on(event, () => queued(async () => { if (cprefs.tab === "skins") renderSkins(); }));
  }
  a2.on("language", () => {
    renderTabs();
    renderTab();
  });
  // The pop-ups (farming, Black Market) are the Pets tab's: one coming up
  // shows it.
  const observer = new MutationObserver(() => {
    const popped = document.body.classList.contains("farmOnly") || document.body.classList.contains("marketOnly");
    document.body.classList.toggle("popped", popped);
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  ready.then(() => {
    renderTabs();
    showTab(cprefs.tab);
  });
})();
