/* game.js: игровой режим страницы практической работы.

   Работает, только когда выбран профиль «Игровой» (html[data-profile="game"]).
   Под каждым блоком проверки появляется сцена в духе 16-битных платформеров.
   Персонажи, предметы и уровни оригинальные.

   Идея: страница это один уровень, каждая задача его участок.
   - Участки идут подряд: фон и земля продолжаются с того места, где кончился
     предыдущий участок, герой входит слева, куда ушел в прошлой сцене.
   - Идет проверка: герой бежит на месте.
   - Решение верное: герой перепрыгивает препятствие, берет «нуклеотид»
     и уходит вправо к следующей задаче; на итоговой задаче открывается портал.
   - Решение неверное: герой спотыкается о препятствие (враг, стена или яма)
     и возвращается к началу участка. Опыт не отнимается, серия решений
     с первой попытки начинается заново: игра подбадривает, а не наказывает.
   - Механика практики: опыт за упражнения по варианту (базовый 5, средний 8,
     продвинутый 12; VARIANT_XP), уровень героя со званием, серия, значки за пройденный
     уровень, всплывающие сообщения, HUD в верхней панели (звезды считаются
     по выбранному уровню студента).
   Состояние (сердца, пройденные участки) хранится в localStorage.
   Слушает события checker:start и checker:result из checker.js. */

(function () {
  "use strict";
  var W = 320, H = 84, GROUND = 66;
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- спрайты (оригинальные) ---------------- */
  var PAL = {
    K: "#1A1C2C", W: "#F4F4F4", w: "#C9CCD6", S: "#F2B98B", H: "#6B3E26", G: "#41D6E8", P: "#2B59C3",
    B: "#3A2A22", b: "#2B6EC4", n: "#1C468C", f: "#2E7D46", F: "#215C34", x: "#BEA069", X: "#967A4C", g: "#39B54A", d: "#1F7A2E", y: "#F2C230", o: "#E08A00", r: "#D62839", c: "#8FE3F2", v: "#7A3FC8"
  };
  function sprite(rows) { return rows.map(function (r) { return r.split(""); }); }
  /* герой: полевой биолог в кепке и полевом жилете, с пробиркой (оригинальный персонаж) */
  var HERO_TOP = [
    "...bbbbb....",
    "..bbbbbbb...",
    "..bnbbbbbbbb",
    "..HSSSSSS...",
    "..HSKSSKS...",
    "...SSSSSS...",
    "....SSSS....",
    "..fWWWWWWf..",
    ".SffWWWWffSc",
    ".SffWWWWffSc",
    "..ffWWWWff..",
    "..fFFFFFFf.."
  ];
  var LEGS = {
    stand: ["...xxx.xxx..", "...xxx.xxx..", "...XX...XX..", "..BBB...BBB."],
    run1:  ["...xxx.xx...", "..xxx...xx..", ".XX......XX.", ".BB.......BB"],
    run2:  ["....xxxx....", "....xxx.....", "....XX.XX...", "...BBB.BB..."],
    jump:  ["..xxx..xxx..", "..XX....XX..", ".BB......BB.", "............"],
    hurt:  ["...xxx.xxx..", "..XX.....XX.", ".BB.......BB", "............"]
  };
  var HERO = {};
  Object.keys(LEGS).forEach(function (k) { HERO[k] = sprite(HERO_TOP.concat(LEGS[k])); });
  var BLOB = [
    sprite(["....gggg....", "..gggggggg..", ".gggggggggg.", ".ggWKggWKgg.", "gggWKggWKggg", "gggggggggggg", "gggggddggggg", ".gggggggggg.", ".g.g.gg.g.g."]),
    sprite(["............", "...gggggg...", ".gggggggggg.", "gggWKggWKggg", "gggWKggWKggg", "gggggggggggg", "gggggddggggg", "gggggggggggg", "g.g.g..g.g.g"])
  ];
  var TUBE = sprite([
    "...KKKKKK...", "...KwwwwK...", "....KwwK....", "....KccK....", "...KccccK...", "..KccccccK..",
    ".KcccccccK..", ".KccvvccccK.", "KccvvvvcccK.", "KcvvvvvvvcK.", "KvvvvvvvvvK.", "KvvvvvvvvvK.",
    ".KvvvvvvvK..", "..KKKKKKK..."
  ]);
  var GLYPH = {
    A: ["010", "101", "111", "101", "101"], T: ["111", "010", "010", "010", "010"],
    G: ["011", "100", "101", "101", "011"], C: ["011", "100", "100", "100", "011"]
  };
  var LETTERS = "ATGC";

  function drawSprite(ctx, spr, x, y, flip, outline) {
    var h = spr.length, w = spr[0].length;
    x = Math.round(x); y = Math.round(y);
    if (outline !== false) {
      ctx.fillStyle = PAL.K;
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        if (spr[yy][xx] === ".") continue;
        var px = flip ? x + (w - 1 - xx) : x + xx;
        ctx.fillRect(px - 1, y + yy, 3, 1);
        ctx.fillRect(px, y + yy - 1, 1, 3);
      }
    }
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var c = spr[j][i];
      if (c === ".") continue;
      ctx.fillStyle = PAL[c] || c;
      ctx.fillRect(flip ? x + (w - 1 - i) : x + i, y + j, 1, 1);
    }
  }


  /* ---------------- тема «Рыцарь» (версия 72) ----------------
     Включается полем game_theme: "knight" в манифесте практики (build_manifest.py берет его
     из data-game-theme у <main> обзора). Рыцарь в стиле чиби вместо биолога, монстр на каждой
     странице (MONSTERS по номеру страницы), дракон с полосой здоровья на всю практику: деление
     за каждое упражнение своего уровня. На странице с драконом бой показан как цикл while с
     трассировкой; когда здоровье дракона 0, башня открыта и принцесса свободна. */
  var THEME = (window.PRACTICE_MANIFEST || {}).game_theme || "lab";
  var KPAL = {"a":"#E5484D","b":"#B9C0CF","c":"#E4E8F0","d":"#F4F6FA","e":"#2A2F45","f":"#FFFFFF","g":"#F2C230","h":"#3C6FD8","i":"#7A4A2A","j":"#4A4F63","k":"#59D46A","l":"#B8F5BF","m":"#1A1C2C","n":"#3BA84B","o":"#4FC0C8","p":"#BFF3F5","q":"#2E8F97","r":"#F1EEE4","s":"#C9C3B3","t":"#8A5BD6","u":"#5B3A9E","v":"#EEF1FA","w":"#F59AB8","x":"#6CC24A","y":"#8A5A2B","z":"#3A2A22","A":"#F6E7B0","B":"#A42A2A","C":"#E0453A","D":"#7A1E1E","E":"#F6C26B","F":"#B53328","G":"#F6CBA5","H":"#F07AB5","I":"#FFFFFE"};
  var KSPR = {
    knight_stand: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............",".....jj..jj.............",".....jj..jj............."],
    knight_run1: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............","...jj.....jj............","...jj......jj..........."],
    knight_run2: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............","......jjjj..............","......jjjj.............."],
    knight_jump: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............","....jj....jj............","........................"],
    knight_hurt: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","..beeeeeeeeeebd.........","..beeefeeefeebd.........","..beeeeeeeeeebd.........","...bbbbbbbbbbbd.........","...bbbbbbbbbbbd.........","....bbbbbbbbb.d.........",".....bbbbbbb.ggg........","..bbhhhhhhhhbbi.........","..bbhhhhhhhhbbi.........","..bbggggggggbb..........","....hhhhhhhh............","...jj......jj...........","........................"],
    knight_strike: [".....aaaaaa.............",".....aabbb..............",".....bbbbbbb............","....cccbbbbbb...........","...bbbbbbbbbbb..........","...bbbbbbbbbbb..........","..beeeeeeeeeebb.........","..beeefeeefeebb.........","..beeeeeeeeeebb.........","...bbbbbbbbbbb..........","...bbbbbbbbbbb..........","....bbbbbbbbb...........",".....bbbbbbb...g........","..bbhhhhhhhhbiigdddddddd","..bbhhhhhhhhbb.g........","..bbggggggggbb..........","....hhhhhhhh............",".....jj..jj.............",".....jj..jj............."],
    slime: ["..............","......kkk.....","....kkkkkkk...","...llkkkkkkk..","..kkkkkkkkkkk.","..kkffkkffkkk.",".kkkfmkkfmkkkk",".kkkfmkkfmkkkk",".kkkkkkkkkkkkk",".kkkkkkkkkkkk.",".nnnnnnnnnnnn."],
    slimeking: [".......g......","....g..g.g....","....ggaggg....","....gggggg....","......ooo.....","....ooooooo...","...ppooooooo..","..ooooooooooo.","..ooffooffooo.",".ooofmoofmoooo",".ooofmoofmoooo",".ooooooooooooo",".oooooooooooo.",".qqqqqqqqqqqq."],
    skeleton: ["..............","......rrr.....","....rrrrrrr...","...rrrrrrrrr..","...rrrrrrrrr..","..rrmmrrmmrrr.","..rrmmrrmmrrr.","..rrrrrrrrrrr.","...rrrrrrrrr..","...rrssssrrr..","....rrrrrrr...","...rrrrrrrr...",".....ssss.....",".....rrrr.....",".....r..r.....",".....r..r....."],
    bat: ["................","......t...t.....","uu....ttttt...uu","uuuuutttttttuuuu",".uuuuttftfttuuu.","..uuutttttttuu..",".....ttttttt....",".....tttdttt....","......ttttt.....","................"],
    ghost: ["......vvv.....","....vvvvvvv...","...vvvvvvvvv..","..vvvvvvvvvvv.","..vvvvvvvvvvv.",".vvveevveevvvv",".vvveevveevvvv",".vvveevveevvvv",".vvvvvvvvvvvv.",".vvwvvvvvvwvv.",".vvvvveevvvvv.",".vvvvvvvvvvvv.",".vv..vvvv.vvv.",".vv..vvv..vvv."],
    goblin: ["..............",".....xxxxx....","...xxxxxxxxx..","...xxxxxxxxx..","xxxxxxxxxxxxxx","xxxxggxxggxxxx","..xxgmxxmgxxx.","..xxxxxxxxxxx.",".iixxxxxxxxxx.",".iixxffffxxx..",".iixxxxxxxxx..",".ii.yyyyyy....",".ii.zzzzzz....",".ii.yyyyyy....",".....x..x.....",".....x..x....."],
    dragon: ["......................................","......................................",".........AA...........................",".........AA...AA..........BBBBBBB.....","........CAACC.AA..........BBBBBBB.....","......CCCCCCCCAA........BBBBBBBBB.....",".....CCCCCCCCCCC........BBBBBBBBB.....","....CCCCCCfffCCCC......BBBBBBBBBBBB...","....CCCCCfffffCCC......BBBBBBBBBBBB...","...CCCCCCffmffCCCC.....BBBBBBBBBBBB...","...CCCCCCffmffCCCC.CCCCCBBBBBBBBBBB...",".CCCCCCCCCfffCCCCCCCCCCCCCBBBBBBB.....",".CDCCCCCCCCCCCCCCCCCCCCCCCCCBBBBB.....",".CCCCCCCCCCCCCCCCCCCCCCCCCCCC.........",".CCCCCCCCCCCCCCCCCCCCCCCCCCCC.........",".CfCfCCCCCCCCCCCCCCCCCCCCCCCCC........",".....CCCCCCCCCCCCCEEECCCCCCCCC........","......CCCCCCCCCCEEEEEEECCCCCCCC.......","........CCCCCCCEEEEEEEEECCCCCCC....EE.","............CCCEEEEEEEEECCCCCCC...CCC.","............CCEEEEEEEEEEECCCCCC...CCC.","............CCEEEEEEEEEEECCCCCC...CCC.",".............CEEEEEEEEEEECCCCCCCCCC...",".............CCEEEEEEEEECCCCCCCCCCC...","..............CEEEEEEEEECCCCCCCCCCC...","..............CCEEEEEEECCCCCC.........","..............FFFFEEECCFFFFC..........","..............FFFFCCCCCFFFF...........","..............FFFF.CCCCFFFF...........","..............FFFF.....FFFF..........."],
    princess: [".....g..a.g.....",".....gggggg.....",".....gggggg.....","....ggggggggg...","....gggGGGggg...","...ggGGGGGGGgg..","...ggGGGGGGGgg..","...gGGGGGGGGGg..","...gGGmGGGmGGg..","...gGGGGGGGGGg..","....gwGGGGGwg...","....gGGGGGGGg...","......gGGGg.....","......HIIH......","...GG.HHHHHGG...",".....HHHHHH.....",".....HHHHHHH....","....HHHHHHHH....","....HHHHHHHHH...","...HHHHHHHHHH...","...HHHHHHHHHHH.."]
  };
  Object.keys(KSPR).forEach(function (k) { KSPR[k] = sprite(KSPR[k]); });
  var MONSTERS = ["slime", "skeleton", "ghost", "goblin", "bat", "goblinBig", "slimeking", "dragon"];
  function drawK(ctx, spr, x, y, flip, sc, tint, pal) {
    sc = sc || 1; pal = pal || KPAL; x = Math.round(x); y = Math.round(y);
    var h = spr.length, w = spr[0].length, xx, yy, X;
    ctx.fillStyle = PAL.K;
    for (yy = 0; yy < h; yy++) for (xx = 0; xx < w; xx++) {
      if (spr[yy][xx] === ".") continue;
      X = flip ? w - 1 - xx : xx;
      ctx.fillRect(x + X * sc - 1, y + yy * sc, sc + 2, sc); ctx.fillRect(x + X * sc, y + yy * sc - 1, sc, sc + 2);
    }
    for (yy = 0; yy < h; yy++) for (xx = 0; xx < w; xx++) {
      var ch = spr[yy][xx]; if (ch === ".") continue;
      X = flip ? w - 1 - xx : xx;
      ctx.fillStyle = tint || pal[ch]; ctx.fillRect(x + X * sc, y + yy * sc, sc, sc);
    }
  }
  function pageMonster() {
    var m = /t\d+_(\d+)\.html/.exec(PAGE), n = m ? +m[1] : 1;
    return MONSTERS[(Math.max(1, n) - 1) % MONSTERS.length];
  }
  function trackNow() {
    try { return JSON.parse(window.localStorage.getItem("practice-html-settings") || "{}").track || null; } catch (e) { return null; }
  }
  /* здоровье дракона: сколько упражнений своего уровня еще не решено (без уровня: упражнений, где не решен ни один вариант) */
  function dragonState() {
    var m = window.PRACTICE_MANIFEST;
    if (!m || !m.graded) return { left: 0, total: 0 };
    var s = solvedTasks(), tr = trackNow(), list;
    if (tr && m.graded[tr]) list = m.graded[tr].map(function (t) { return [t.file]; });
    else {
      var by = {};
      (m.exercises || []).forEach(function (t) { var k = t.page + "#" + (t.group || t.file); (by[k] = by[k] || []).push(t.file); });
      list = Object.keys(by).map(function (k) { return by[k]; });
    }
    var left = list.filter(function (fs) { return !fs.some(function (f) { return s[f]; }); }).length;
    return { left: left, total: list.length };
  }
  function drawMonster(c, mon, x, ground, t, tint) {
    var f = Math.floor(t / 14) % 2;
    if (mon === "slime") { drawK(c, KSPR.slime, x - 10, ground - 11 + f, true, 1, tint); drawK(c, KSPR.slime, x + 8, ground - 11 + (1 - f), true, 1, tint); }
    else if (mon === "skeleton") { for (var i = 0; i < 3; i++) drawK(c, KSPR.skeleton, x - 12 + i * 13, ground - 16, true, 1, tint); }
    else if (mon === "ghost") drawK(c, KSPR.ghost, x, ground - 22 + Math.round(Math.sin(t / 9) * 3), true, 1, tint);
    else if (mon === "goblin") drawK(c, KSPR.goblin, x, ground - 16, true, 1, tint);
    else if (mon === "bat") { for (var j = 0; j < 3; j++) drawK(c, KSPR.bat, x - 12 + j * 14, ground - 34 - j * 4 + Math.round(Math.sin(t / 7 + j) * 3), false, 1, tint); }
    else if (mon === "goblinBig") drawK(c, KSPR.goblin, x - 4, ground - 32, true, 2, tint);
    else if (mon === "slimeking") drawK(c, KSPR.slimeking, x - 4, ground - 28, true, 2, tint);
    else drawK(c, KSPR.dragon, x - 6, ground - 30 + (f ? 1 : 0), false, 1, tint);
  }
  function drawTower(c, x, ground) {
    c.fillStyle = PAL.K; c.fillRect(x - 1, ground - 51, 30, 51);
    c.fillStyle = "#8A90A3"; c.fillRect(x, ground - 50, 28, 50);
    c.fillStyle = "#6E7488";
    for (var r = 0; r < 10; r++) for (var q = 0; q < 4; q++) c.fillRect(x + q * 7 + (r % 2) * 3, ground - 48 + r * 5, 5, 1);
    for (var b = 0; b < 4; b++) { c.fillStyle = PAL.K; c.fillRect(x - 1 + b * 8, ground - 57, 7, 7); c.fillStyle = "#8A90A3"; c.fillRect(x + b * 8, ground - 56, 5, 6); }
    c.fillStyle = PAL.K; c.fillRect(x + 8, ground - 16, 12, 16); c.fillStyle = "#2A1E14"; c.fillRect(x + 9, ground - 15, 10, 15);
  }
  function loopKey() { return "practice-html-game:loop:" + PAGE; }
  function loopRows() { try { return JSON.parse(window.localStorage.getItem(loopKey()) || "[]"); } catch (e) { return []; } }
  function addLoopRow(ok) {
    var rows = loopRows(); rows.push({ ok: !!ok, hp: dragonState().left });
    try { window.localStorage.setItem(loopKey(), JSON.stringify(rows.slice(-50))); } catch (e) { /* недоступно */ }
  }
  function loopPanel(sc) {
    var box = sc.loopBox, d = dragonState(), rows = loopRows(), last = rows[rows.length - 1];
    var lines = ["hp = " + d.total + "   # упражнения вашего уровня", "while hp > 0:",
      "    решение = проверка()", "    if not решение:", "        continue", "    hp = hp - 1", "print(\"Принцесса свободна\")"];
    var on = d.left === 0 ? [1, 6] : !last ? [0] : last.ok ? [2, 5] : [2, 3, 4];
    box.innerHTML = "";
    var pre = document.createElement("pre"); pre.className = "game-loop-code";
    lines.forEach(function (l, i) { var s = document.createElement("span"); s.textContent = l; if (on.indexOf(i) >= 0) s.className = "is-on"; pre.appendChild(s); });
    var tb = document.createElement("table"); tb.className = "game-loop-trace";
    tb.innerHTML = "<thead><tr><th>Итерация</th><th>решение</th><th>hp</th></tr></thead>";
    var body = document.createElement("tbody");
    rows.slice(-6).forEach(function (r, i) {
      var tr = document.createElement("tr");
      [String(rows.length - Math.min(rows.length, 6) + i + 1), r.ok ? "True" : "False", r.hp + (r.ok ? "" : " (continue)")].forEach(function (v) { var td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
      body.appendChild(tr);
    });
    if (d.left === 0) { var tr0 = document.createElement("tr"); tr0.innerHTML = "<td colspan=\"3\">hp > 0 ложно: цикл окончен</td>"; body.appendChild(tr0); }
    tb.appendChild(body);
    box.appendChild(pre); box.appendChild(tb);
  }

  /* ---------------- звук (синтез, по умолчанию выключен) ---------------- */
  var audio = null;
  function beep(notes, type) {
    if (root.getAttribute("data-sound") !== "on") return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var t = audio.currentTime;
      notes.forEach(function (n, i) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = type || "square";
        o.frequency.value = n;
        g.gain.setValueAtTime(0.06, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.12);
        o.connect(g); g.connect(audio.destination);
        o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.13);
      });
    } catch (e) { /* звук недоступен */ }
  }
  var SFX = {
    coin: function () { beep([988, 1319]); },
    win: function () { beep([523, 659, 784, 1047, 784, 1047]); },
    fail: function () { beep([392, 330, 262], "triangle"); },
    jump: function () { beep([440, 660], "square"); }
  };

  /* ---------------- состояние уровня ---------------- */
  var PAGE = (window.location.pathname.split("/").pop() || "page");
  var STATE_KEY = "practice-html-game:" + PAGE;
  function loadState() {
    try { return JSON.parse(window.localStorage.getItem(STATE_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveState(st) {
    try { window.localStorage.setItem(STATE_KEY, JSON.stringify(st)); } catch (e) { /* хранилище недоступно */ }
  }
  var state = loadState();
  state.done = state.done || {};

  /* ---------------- механика: опыт, уровень героя, серия, значки ----------------
     Общая для всей практики (ключ practice-html-game). Опыт дается один раз
     за упражнение по его варианту: базовый 5, средний 8, продвинутый 12
     (VARIANT_XP; упражнение без вариантов 5).
     Серия считает задачи, решенные с первой попытки подряд; неверное решение
     опыт не отнимает, серия просто начинается заново. */
  var GAME_KEY = "practice-html-game";
  var XP = { exercise: 5, basic: 10, medium: 20, advanced: 30 };
  var TITLES = ["Лаборант", "Стажер", "Исследователь", "Аналитик", "Биоинформатик", "Профессор"];
  var PER_LEVEL = 50;
  var BADGES = {
    first: "Первая задача",
    streak5: "Серия из 5 с первой попытки",
    zone_basic: "Базовый уровень пройден",
    zone_medium: "Средний уровень пройден",
    zone_advanced: "Продвинутый уровень пройден",
    all: "Все упражнения практики во всех вариантах",
    flawless: "Страница без единой ошибки",
    star: "Первая задача со звездочкой",
    dragon: "Дракон повержен"
  };
  function loadG() {
    var g;
    try { g = JSON.parse(window.localStorage.getItem(GAME_KEY) || "{}"); } catch (e) { g = {}; }
    g.xp = g.xp || 0; g.streak = g.streak || 0; g.best = g.best || 0;
    g.awarded = g.awarded || {}; g.attempts = g.attempts || {}; g.badges = g.badges || {};
    return g;
  }
  function saveG(g) { try { window.localStorage.setItem(GAME_KEY, JSON.stringify(g)); } catch (e) { /* недоступно */ } }
  function heroLevel(xp) { return Math.floor(xp / PER_LEVEL) + 1; }
  function heroTitle(xp) { return TITLES[Math.min(TITLES.length - 1, heroLevel(xp) - 1)]; }

  var toastBox = null;
  function toast(title, text) {
    if (root.getAttribute("data-profile") !== "game") return;
    if (!toastBox) { toastBox = document.createElement("div"); toastBox.className = "game-toasts"; document.body.appendChild(toastBox); }
    var t = document.createElement("div");
    t.className = "game-toast";
    var b = document.createElement("b"); b.textContent = title; t.appendChild(b);
    if (text) { var p = document.createElement("span"); p.textContent = text; t.appendChild(p); }
    toastBox.appendChild(t);
    window.setTimeout(function () { t.className += " is-out"; }, 3800);
    window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4400);
  }

  function award(detail) {
    var g = loadG(), f = detail.file, lvl = detail.level || "exercise";
    g.attempts[f] = (g.attempts[f] || 0) + 1;
    if (!detail.solved) {
      if (!g.awarded[f]) { if (g.streak > 1) toast("Серия прервана", "Ошибка не отнимает опыт. Подсказки проверки ниже."); g.streak = 0; }
      saveG(g); refreshHud(); return;
    }
    if (g.awarded[f]) { saveG(g); return; }
    var VARIANT_XP = { basic: 5, medium: 8, advanced: 12 };
    /* версия 72: задача со звездочкой необязательная, опыта за нее больше, чем за упражнение того же уровня */
    var STAR_XP = { basic: 10, medium: 15, advanced: 20 };
    var before = heroLevel(g.xp), gain = lvl === "exercise" ? (VARIANT_XP[detail.variant] || 5)
      : lvl === "star" ? (STAR_XP[detail.variant] || 10) : (XP[lvl] || 5);
    g.awarded[f] = { level: lvl, first: g.attempts[f] === 1 };
    if (g.attempts[f] === 1) { g.streak += 1; g.best = Math.max(g.best, g.streak); } else { g.streak = 0; }
    g.xp += gain;
    var got = [];
    function badge(key) { if (!g.badges[key]) { g.badges[key] = true; got.push(BADGES[key]); } }
    badge("first");
    if (lvl === "star") badge("star");
    if (g.streak >= 5) badge("streak5");
    var m = window.PRACTICE_MANIFEST;
    if (m) {
      var allDone = true;
      Object.keys(m.graded).forEach(function (lv) {
        var list = m.graded[lv] || [];
        var done = list.length && list.every(function (t) { return g.awarded[t.file]; });
        if (done) badge("zone_" + lv); else allDone = false;
      });
      if (allDone) badge("all");
      var here = (m.pages.filter(function (pg) { return pg.href === PAGE; })[0] || { tasks: [] }).tasks;
      if (here.length && here.every(function (t) { return g.awarded[t.file] && g.awarded[t.file].first; })) badge("flawless");
    }
    saveG(g);
    toast("+" + gain + " XP" + (g.streak > 1 ? " · серия ×" + g.streak : ""),
      heroLevel(g.xp) > before ? "Новый уровень: " + heroLevel(g.xp) + " · " + heroTitle(g.xp)
        : "До уровня " + (heroLevel(g.xp) + 1) + " осталось " + (PER_LEVEL - g.xp % PER_LEVEL) + " XP");
    if (THEME === "knight" && !g.badges.dragon && dragonState().total && !dragonState().left) {
      g.badges.dragon = true; saveG(g);
      toast("Дракон повержен!", "Принцесса свободна: все упражнения вашего уровня решены, практику можно сдавать.");
    }
    got.forEach(function (b) { toast("Значок: " + b); });
    refreshHud();
  }

  /* HUD в верхней панели: уровень, опыт, серия, звезды за упражнения своего уровня */
  function refreshHud() {
    var box = document.querySelector(".topbar .tb-game");
    if (!box) return;
    var g = loadG(), m = window.PRACTICE_MANIFEST;
    box.innerHTML = "";
    function pill(text, cls) { var s = document.createElement("span"); s.className = "hud-pill" + (cls ? " " + cls : ""); s.textContent = text; box.appendChild(s); return s; }
    pill("Ур. " + heroLevel(g.xp) + " · " + heroTitle(g.xp));
    var xp = pill("XP ", "hud-xp");
    var bar = document.createElement("span"); bar.className = "hud-bar";
    var fill = document.createElement("i"); fill.style.width = Math.round(100 * (g.xp % PER_LEVEL) / PER_LEVEL) + "%";
    bar.appendChild(fill); xp.appendChild(bar);
    xp.appendChild(document.createTextNode(" " + (g.xp % PER_LEVEL) + "/" + PER_LEVEL));
    pill("Серия ×" + g.streak, "hud-streak");
    if (m) {
      var st = {};
      try { st = JSON.parse(window.localStorage.getItem("practice-html-settings") || "{}"); } catch (e) { st = {}; }
      var all = st.track && m.graded[st.track] ? m.graded[st.track]
        : [].concat.apply([], Object.keys(m.graded).map(function (k) { return m.graded[k]; }));
      pill("★ " + all.filter(function (t) { return g.awarded[t.file]; }).length + " / " + all.length);
      if (THEME === "knight") {
        var d = dragonState(), bar = "";
        for (var i = 0; i < d.total; i++) bar += i < d.left ? "■" : "□";
        pill(d.left ? "Дракон " + bar + " " + d.left + "/" + d.total : "Дракон повержен", "hud-dragon");
      }
    }
  }

  function solvedTasks() {
    var p = {};
    try { p = JSON.parse(window.localStorage.getItem("practice-html-progress") || "{}").tasks || {}; } catch (e) { p = {}; }
    return p;
  }

  /* ---------------- сцена ---------------- */
  var scenes = [];

  function Scene(block, index, count, isFinal) {
    this.block = block; this.index = index; this.count = count; this.isFinal = isFinal;
    this.file = block.getAttribute("data-file");
    this.kind = isFinal ? "portal" : THEME === "knight" ? "monster" : ["blob", "wall", "pit"][index % 3];
    this.mon = pageMonster();
    this.letter = LETTERS[index % 4];
    this.wrap = document.createElement("div");
    this.wrap.className = "game-scene";
    this.wrap.setAttribute("aria-hidden", "true");
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    this.canvas.width = W; this.canvas.height = H;
    this.hud = document.createElement("div");
    this.hud.className = "game-hud";
    this.caption = document.createElement("div");
    this.caption.className = "game-caption";
    this.wrap.appendChild(this.canvas); this.wrap.appendChild(this.hud); this.wrap.appendChild(this.caption);
    var bar = block.querySelector(".checker-bar");
    if (bar && bar.nextSibling) block.insertBefore(this.wrap, bar.nextSibling); else block.appendChild(this.wrap);
    if (THEME === "knight" && this.mon === "dragon" && block.closest(".task-exercise")) {
      this.loopBox = document.createElement("div"); this.loopBox.className = "game-loop";
      this.wrap.parentNode.insertBefore(this.loopBox, this.wrap.nextSibling); loopPanel(this);
    }
    this.ctx = this.canvas.getContext("2d");
    this.t = 0; this.visible = false; this.entered = false;
    this.obstX = 168; /* кратно 8: яма совпадает с плитками земли */
    this.reset(solvedTasks()[this.file] || state.done[this.file]);
    this.updateHud();
  }

  Scene.prototype.reset = function (solved) {
    this.mode = solved ? "done" : "idle";
    this.hx = solved ? 286 : 22; this.hy = GROUND - 16; this.vy = 0; this.vx = 0;
    this.coin = !solved && THEME !== "knight"; this.blink = 0; this.pose = "stand"; this.fx = [];
    this.dead = !!solved; this.struck = false; this.strikeT = 0; this.lunge = 0;
    if (solved && this.finale()) this.hx = 214;
    this.caption.textContent = solved ? (this.isFinal ? "Уровень пройден" : "Участок пройден") : "Задача " + (this.index + 1) + ": решите, чтобы пройти участок";
  };

  /* финал темы «Рыцарь»: сцена с драконом, здоровье дракона 0 */
  Scene.prototype.finale = function () { return THEME === "knight" && this.mon === "dragon" && !dragonState().left; };

  Scene.prototype.updateHud = function () {
    var s = solvedTasks(), n = 0;
    scenes.forEach(function (sc) { if (s[sc.file]) n++; });
    this.hud.innerHTML = "";
    var a = document.createElement("span"); a.textContent = "Участок " + (this.index + 1) + "/" + this.count;
    var g = loadG();
    var b = document.createElement("span"); b.textContent = "Серия ×" + g.streak;
    var c = document.createElement("span"); c.textContent = (THEME === "knight" ? "Побед " : "ДНК ") + n + "/" + this.count;
    this.hud.appendChild(a); this.hud.appendChild(b); this.hud.appendChild(c);
  };

  Scene.prototype.start = function () {
    this.mode = "wait"; this.caption.textContent = "Проверка…";
  };

  Scene.prototype.result = function (d) {
    if (this.loopBox && (d.level || "exercise") === "exercise") { addLoopRow(d.solved); scenes.forEach(function (s) { if (s.loopBox) loopPanel(s); }); }
    if (d.solved) {
      this.mode = "win"; this.vx = 1.7; this.pose = "run1";
      this.caption.textContent = this.isFinal ? "Вперед, к порталу!" : "Верно! Вперед";
      state.done[this.file] = true; saveState(state);
    } else {
      this.mode = "fail"; this.vx = 1.5; this.pose = "run1";
      this.failInfo = d;
      this.caption.textContent = "Пройдено тестов: " + d.passed + " из " + d.total;
    }
    if (reduced) this.finish(d.solved);
  };

  Scene.prototype.finish = function (win) {
    if (win) {
      this.mode = "done"; this.hx = this.finale() ? 214 : 286; this.hy = GROUND - 16; this.coin = false; this.dead = true;
      this.caption.textContent = this.isFinal ? "Уровень пройден! Все задачи решены" :
        "Участок пройден. Дальше: задача " + (this.index + 2);
      if (!reduced) SFX.win();
    } else {
      var fi = this.failInfo || {};
      this.caption.textContent = (fi.warn ? "Почти! Результат верный, нужен другой прием. " :
        (fi.total ? "Ой! Пройдено тестов " + fi.passed + " из " + fi.total + ". " : "Ой! ")) + "Подсказки ниже";
      saveState(state);
      this.mode = "idle"; this.hx = 22; this.hy = GROUND - 16; this.vx = 0; this.vy = 0; this.blink = 60; this.struck = false;
      if (!reduced) SFX.fail();
    }
    scenes.forEach(function (s) { s.updateHud(); });
  };

  /* ---------- физика и сценарии ---------- */
  Scene.prototype.step = function () {
    this.t++;
    if (this.blink > 0) this.blink--;
    var runPose = (Math.floor(this.t / 6) % 2) ? "run1" : "run2";
    var onGround = this.hy >= GROUND - 16;

    if (!this.entered && this.visible && this.mode === "idle") {
      /* вход слева: герой приходит с предыдущего участка */
      this.entered = true; this.hx = -14; this.mode = "enter";
    }
    if (this.mode === "enter") {
      this.hx += 1.2; this.pose = runPose;
      if (this.hx >= 22) { this.hx = 22; this.mode = "idle"; }
    } else if (this.mode === "idle" || this.mode === "done") {
      this.pose = "stand";
    } else if (this.mode === "wait") {
      this.pose = runPose;
      if (this.t % 8 === 0) this.fx.push({ x: this.hx - 2, y: GROUND - 3, life: 14, kind: "dust" });
    } else if (this.kind === "monster" && (this.mode === "win" || this.mode === "fail")) {
      this.stepKnight(runPose);
    } else if (this.mode === "win" || this.mode === "fail") {
      this.hx += this.vx;
      var jumpAt = this.obstX - 30;
      var win = this.mode === "win";
      if (win && this.kind !== "portal" && onGround && this.vy === 0 && this.hx >= jumpAt && this.hx < this.obstX) {
        this.vy = -3.3; SFX.jump();
      }
      if (!win && this.kind === "pit" && onGround && this.vy === 0 && this.hx >= jumpAt && this.hx < this.obstX) {
        this.vy = -1.8; this.vx = 0.9;
      }
      if (this.vy !== 0 || !onGround) {
        this.vy += 0.18; this.hy += this.vy;
        var overPit = this.kind === "pit" && this.hx + 6 > this.obstX + 1 && this.hx + 6 < this.obstX + 31;
        if (this.hy >= GROUND - 16 && !(overPit && !win)) { this.hy = GROUND - 16; this.vy = 0; }
        this.pose = this.vy < 0 || this.hy < GROUND - 16 ? "jump" : runPose;
      } else {
        this.pose = runPose;
      }
      /* нуклеотид */
      if (win && this.coin && Math.abs(this.hx + 6 - (this.obstX + 10)) < 8 && this.hy < GROUND - 30) {
        this.coin = false; SFX.coin();
        for (var i = 0; i < 8; i++) this.fx.push({ x: this.obstX + 10, y: GROUND - 40, vx: Math.cos(i) * 1.2, vy: Math.sin(i) * 1.2, life: 20, kind: "spark" });
      }
      if (!win) {
        var hit = false;
        if (this.kind === "blob" && this.hx + 11 >= this.obstX + 2) hit = true;
        if (this.kind === "wall" && this.hx + 11 >= this.obstX) hit = true;
        if (this.kind === "portal" && this.hx + 11 >= this.obstX + 4) hit = true;
        if (this.kind === "pit" && this.hy > H + 8) hit = true;
        if (hit && this.mode === "fail") {
          this.mode = "hurt"; this.vx = -1.4; this.vy = this.kind === "pit" ? 0 : -2; this.pose = "hurt"; this.hurtT = 40;
          if (this.kind !== "pit") for (var k = 0; k < 5; k++) this.fx.push({ x: this.hx + 10, y: this.hy + 2, vx: Math.random() * 2 - 1, vy: -Math.random() * 1.5, life: 24, kind: "star" });
        }
      }
      if (win && this.hx > W + 16) {
        if (this.isFinal) { this.mode = "portal"; this.portalT = 0; this.hx = W + 20; }
        else this.finish(true);
      }
      if (win && this.isFinal && this.hx >= this.obstX + 8 && this.mode === "win") {
        this.mode = "portal"; this.portalT = 0;
      }
    } else if (this.mode === "hurt") {
      this.hurtT--;
      this.hx += this.vx; this.vy += 0.18; this.hy += this.vy;
      if (this.hy >= GROUND - 16 && this.kind !== "pit") { this.hy = GROUND - 16; this.vy = 0; this.vx *= 0.8; }
      if (this.hurtT <= 0) this.finish(false);
    } else if (this.mode === "portal") {
      this.portalT++;
      if (this.portalT % 6 === 0) this.fx.push({ x: this.obstX + 6 + Math.random() * 12, y: GROUND - 30, vx: Math.random() * 2 - 1, vy: -1.5 - Math.random(), life: 40, kind: "spark" });
      if (this.portalT === 50) { for (var q = 0; q < 24; q++) this.fx.push({ x: W / 2, y: 30, vx: Math.cos(q) * 2.2, vy: Math.sin(q) * 2.2 - 1, life: 50, kind: "spark" }); }
      if (this.portalT > 80) this.finish(true);
    }
    this.fx = this.fx.filter(function (f) {
      f.life--; if (f.vx !== undefined) { f.x += f.vx; f.y += f.vy; f.vy += 0.05; }
      return f.life > 0;
    });
  };

  /* рыцарь подходит к монстру: верно, удар мечом и путь дальше; неверно, монстр отбрасывает */
  Scene.prototype.stepKnight = function (runPose) {
    var stop = this.obstX - 26;
    if (this.mode === "fail") {
      if (this.hx < stop) { this.hx += this.vx; this.pose = runPose; return; }
      this.mode = "hurt"; this.vx = -1.4; this.vy = -2; this.pose = "hurt"; this.hurtT = 40; this.lunge = 18;
      for (var k = 0; k < 5; k++) this.fx.push({ x: this.hx + 12, y: this.hy + 2, vx: Math.random() * 2 - 1, vy: -Math.random() * 1.5, life: 24, kind: "star" });
      return;
    }
    if (!this.dead) {
      if (this.hx < stop) { this.hx += this.vx; this.pose = runPose; return; }
      if (!this.struck) { this.struck = true; this.strikeT = 20; SFX.jump(); }
      this.pose = "strike";
      if (--this.strikeT === 10) {
        this.dead = true; SFX.coin();
        for (var i = 0; i < 12; i++) this.fx.push({ x: this.obstX + 8, y: GROUND - 14, vx: Math.cos(i) * 1.4, vy: Math.sin(i) * 1.4 - 0.6, life: 24, kind: "spark" });
      }
      return;
    }
    if (this.strikeT > 0) { this.strikeT--; this.pose = "strike"; return; }
    this.hx += this.vx; this.pose = runPose;
    if (this.hx > W + 16 || (this.finale() && this.hx >= 214)) this.finish(true);
  };

  /* ---------- отрисовка ---------- */
  Scene.prototype.draw = function () {
    var c = this.ctx, night = window.practiceTheme && window.practiceTheme() === "dark";
    var off = this.index * 180; /* фон продолжается с предыдущего участка */
    var sky = c.createLinearGradient(0, 0, 0, GROUND);
    var knight = THEME === "knight";
    sky.addColorStop(0, night ? "#141633" : knight ? "#C9A6D8" : "#6ECFF0");
    sky.addColorStop(1, night ? "#2A2E5C" : knight ? "#F7C59A" : "#CFF3FF");
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    if (night) {
      c.fillStyle = "#F4F1DE";
      for (var s = 0; s < 40; s++) {
        var sx = ((s * 97 + off * 0.1) % W + W) % W, sy = (s * 37) % (GROUND - 30);
        if ((s + Math.floor(this.t / 20)) % 7) c.fillRect(Math.round(sx), sy, 1, 1);
      }
      var MOON = ["..XXXXX..", ".XXXXXXX.", "XXXXXX...", "XXXXX....", "XXXXX....", "XXXXX....", "XXXXXX...", ".XXXXXXX.", "..XXXXX.."];
      c.fillStyle = "#F4F1DE";
      for (var my = 0; my < MOON.length; my++) for (var mx = 0; mx < 9; mx++) if (MOON[my][mx] === "X") c.fillRect(258 + mx, 8 + my, 1, 1);
    } else {
      for (var k = 0; k < 4; k++) {
        var cx = ((k * 110 - off * 0.2 - this.t * 0.08) % (W + 60) + W + 60) % (W + 60) - 40, cy = 8 + (k % 2) * 10;
        c.fillStyle = "#FFFFFF";
        c.fillRect(Math.round(cx), cy + 3, 26, 6); c.fillRect(Math.round(cx) + 5, cy, 14, 4);
      }
    }
    /* тема «Рыцарь»: замки на горизонте и дракон в небе, пока он жив */
    if (knight) {
      c.fillStyle = night ? "#2B2A4A" : "#8E7BA8";
      for (var ci = 0; ci < 3; ci++) {
        var tx = ((ci * 130 + 40 - off * 0.25) % (W + 120) + W + 120) % (W + 120) - 60;
        c.fillRect(tx, GROUND - 40, 16, 40); for (var cb = 0; cb < 3; cb++) c.fillRect(tx - 2 + cb * 7, GROUND - 44, 4, 4);
      }
      if (this.mon !== "dragon" && dragonState().left) drawK(c, KSPR.dragon, 210 + Math.round(Math.sin(this.t / 70 + this.index) * 40), 12 + Math.round(Math.sin(this.t / 23) * 2), false, 1);
    }
    /* дальние и ближние холмы */
    this.hills(c, off * 0.35, GROUND - 22, 34, night ? "#23264D" : "#8FD98C", 0.045);
    this.hills(c, off * 0.6, GROUND - 10, 20, night ? "#1C3A2A" : "#4DB45A", 0.07);
    /* земля */
    var pitX = this.kind === "pit" ? this.obstX : -999;
    for (var x = 0; x < W; x += 8) {
      if (x + 8 > pitX && x < pitX + 32) continue;
      var shift = Math.floor((off + x) / 8) % 2;
      c.fillStyle = night ? "#2FA866" : "#39B54A"; c.fillRect(x, GROUND, 8, 3);
      c.fillStyle = night ? "#5A3B22" : "#8B5A2B"; c.fillRect(x, GROUND + 3, 8, H - GROUND - 3);
      c.fillStyle = night ? "#46301C" : "#6E4520";
      c.fillRect(x + (shift ? 1 : 5), GROUND + 7, 2, 2); c.fillRect(x + (shift ? 5 : 2), GROUND + 12, 2, 2);
    }
    if (this.kind === "pit") {
      c.fillStyle = "#0B0C1A"; c.fillRect(pitX, GROUND, 32, H - GROUND);
      c.fillStyle = night ? "#46301C" : "#6E4520"; c.fillRect(pitX, GROUND, 2, H - GROUND); c.fillRect(pitX + 30, GROUND, 2, H - GROUND);
    }
    /* препятствие */
    if (this.kind === "monster") {
      if (this.finale() && (this.mode === "done" || this.mode === "idle")) {
        drawTower(c, 270, GROUND); drawK(c, KSPR.princess, 248, GROUND - 21, false, 1);
        if (this.t % 40 === 0) this.fx.push({ x: 254, y: GROUND - 26, vx: 0, vy: -0.6, life: 30, kind: "spark" });
      } else if (!this.dead || (this.struck && this.strikeT > 10)) {
        var lx = this.lunge > 0 ? -Math.min(12, this.lunge) : 0;
        if (this.lunge > 0) this.lunge--;
        drawMonster(c, this.mon, this.obstX + lx, GROUND, this.t, this.struck && this.strikeT % 4 < 2 ? "#FFFFFF" : null);
        if (this.mon === "dragon" && this.lunge > 0) {
          for (var fi = 0; fi < 60; fi += 3) { c.fillStyle = fi % 2 ? PAL.y : PAL.o; c.fillRect(this.obstX + lx - 8 - fi, GROUND - 16 + Math.round(Math.sin((this.t + fi) / 3)), 3 + fi / 12, 3 + fi / 12); }
        }
      }
    } else if (this.kind === "blob") {
      var bx = this.obstX + Math.round(Math.sin(this.t / 18) * 6);
      drawSprite(c, BLOB[Math.floor(this.t / 14) % 2], bx, GROUND - 9);
    } else if (this.kind === "wall") {
      for (var r = 0; r < 3; r++) for (var q = 0; q < 2; q++) this.tile(c, this.obstX + q * 8, GROUND - 8 - r * 8, night);
    } else if (this.kind === "portal") {
      var glow = this.mode === "portal" || this.mode === "done";
      if (glow) { c.fillStyle = "rgba(200,162,255," + (0.25 + 0.2 * Math.sin(this.t / 5)) + ")"; c.fillRect(this.obstX - 6, GROUND - 34, 26, 34); }
      drawSprite(c, TUBE, this.obstX, GROUND - 14 - 2);
      drawSprite(c, TUBE, this.obstX + 2, GROUND - 30);
    }
    /* нуклеотид */
    if (this.coin && this.kind !== "portal") this.nucleotide(c, this.obstX + 6, GROUND - 44 + Math.round(Math.sin(this.t / 10) * 2));
    /* указатель выхода */
    if (this.mode === "done" && !this.isFinal && !this.finale()) {
      c.fillStyle = "#8B5A2B"; c.fillRect(W - 14, GROUND - 16, 2, 16);
      c.fillStyle = "#F2C230"; c.fillRect(W - 22, GROUND - 20, 16, 7);
      c.fillStyle = "#1A1C2C"; c.fillRect(W - 19, GROUND - 17, 8, 1); c.fillRect(W - 13, GROUND - 18, 1, 3); c.fillRect(W - 12, GROUND - 17, 1, 1);
    }
    /* герой */
    var visibleHero = this.blink % 6 < 3 && this.hx > -16 && this.hx < W + 16 && this.hy < H &&
      !(this.mode === "portal" && this.portalT > 8) && !(this.isFinal && this.mode === "done");
    if (visibleHero && knight) drawK(c, KSPR["knight_" + this.pose] || KSPR.knight_stand, this.hx - 2, this.hy - 3, this.vx < 0 && this.mode === "hurt");
    else if (visibleHero) drawSprite(c, HERO[this.pose] || HERO.stand, this.hx, this.hy, this.vx < 0 && this.mode === "hurt");
    /* эффекты */
    this.fx.forEach(function (f) {
      if (f.kind === "dust") { c.fillStyle = "#E8E1C8"; c.fillRect(Math.round(f.x - (14 - f.life) / 2), f.y - Math.floor((14 - f.life) / 5), 2, 2); }
      if (f.kind === "spark") { c.fillStyle = f.life % 4 < 2 ? "#F2C230" : "#FFFFFF"; c.fillRect(Math.round(f.x), Math.round(f.y), 2, 2); }
      if (f.kind === "star") { c.fillStyle = "#F2C230"; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 3); c.fillRect(Math.round(f.x) - 1, Math.round(f.y) + 1, 3, 1); }
    });
  };

  Scene.prototype.hills = function (c, off, base, amp, color, freq) {
    c.fillStyle = color;
    for (var x = 0; x < W; x += 2) {
      var h = Math.round((Math.sin((x + off) * freq) * 0.5 + 0.5) * amp * 0.6 + amp * 0.4);
      c.fillRect(x, base - h + 12, 2, h);
    }
  };
  Scene.prototype.tile = function (c, x, y, night) {
    c.fillStyle = PAL.K; c.fillRect(x, y, 8, 8);
    c.fillStyle = night ? "#6C7AA8" : "#9AA5C8"; c.fillRect(x + 1, y + 1, 6, 6);
    c.fillStyle = night ? "#8C9AC8" : "#C9D0E8"; c.fillRect(x + 1, y + 1, 6, 1); c.fillRect(x + 1, y + 1, 1, 6);
    c.fillStyle = PAL.K; c.fillRect(x + 2, y + 2, 1, 1); c.fillRect(x + 5, y + 5, 1, 1);
  };
  Scene.prototype.nucleotide = function (c, x, y) {
    /* шестиугольник с буквой: собственный значок */
    c.fillStyle = PAL.K; c.fillRect(x + 2, y - 1, 6, 12); c.fillRect(x, y + 1, 10, 8); c.fillRect(x - 1, y + 3, 12, 4);
    c.fillStyle = PAL.y; c.fillRect(x + 2, y, 6, 10); c.fillRect(x + 1, y + 2, 8, 6); c.fillRect(x, y + 4, 10, 2);
    c.fillStyle = PAL.o; c.fillRect(x + 7, y + 2, 1, 6);
    var g = GLYPH[this.letter];
    c.fillStyle = PAL.K;
    for (var j = 0; j < 5; j++) for (var i = 0; i < 3; i++) if (g[j][i] === "1") c.fillRect(x + 3 + i, y + 2 + j, 1, 1);
  };


  /* ---------------- финальная игра практики (версия 72) ----------------
     Платформер на странице обзора, только в игровом режиме. Открывается, когда решены все
     упражнения своего уровня. Этапы это тематические страницы практики по порядку, в конце босс
     (в теме «Рыцарь» дракон). Здоровье: от 2 до 5 сердец на старте по доле упражнений, решенных
     с первой попытки; после этапа +1 сердце, излишек в щит (один); сердца кончились: этап заново
     с полным здоровьем. Кто дошел до босса, ни разу не потеряв сердце, получает значок и двойной удар.
     Прогресс игры не влияет на оценку. */
  var ARC = { MAX: 5, W: 320, H: 180, G: 160 };
  function practiceDone() {
    var m = window.PRACTICE_MANIFEST;
    if (!m || !m.graded) return null;
    var s = solvedTasks(), g = loadG(), tr = trackNow(), groups;
    if (tr && m.graded[tr]) groups = m.graded[tr].map(function (t) { return [t.file]; });
    else {
      var by = {};
      (m.exercises || []).forEach(function (t) { var k = t.page + "#" + (t.group || t.file); (by[k] = by[k] || []).push(t.file); });
      groups = Object.keys(by).map(function (k) { return by[k]; });
    }
    var done = 0, first = 0;
    groups.forEach(function (fs) {
      var sv = fs.filter(function (f) { return s[f]; });
      if (sv.length) { done++; if (sv.some(function (f) { return g.awarded[f] && g.awarded[f].first; })) first++; }
    });
    return { done: done, total: groups.length, first: first };
  }
  function arcStages() {
    var m = window.PRACTICE_MANIFEST || { pages: [] };
    return m.pages.filter(function (p) { return p.kind !== "overview"; }).map(function (p) { return p.number + " " + (p.name || p.title); });
  }
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function makeLevel(i) {
    var r = rng(i * 7919 + 13), len = Math.min(1300, 900 + i * 50), G = ARC.G, x = 0, lv = { len: len, grounds: [], plats: [], foes: [], coins: [] };
    while (x < len) {
      var seg = Math.round(150 + r() * 130), a = x, b = Math.min(len + 60, x + seg);
      lv.grounds.push([a, b]);
      if (a > 0) {
        if (r() < 0.75) { var pw = Math.round(36 + r() * 22), px = Math.round(a + 20 + r() * Math.max(10, seg - pw - 40)), py = Math.round(G - 36 - r() * 16);
          lv.plats.push({ x: px, y: py, w: pw }); for (var c = 0; c < 3; c++) lv.coins.push({ x: px + 6 + c * (pw - 12) / 2, y: py - 12, on: true }); }
        var nf = 1 + (i > 3 && r() < 0.5 ? 1 : 0);
        for (var f = 0; f < nf; f++) { var fa = a + 18, fb = b - 26; if (fb - fa > 30) lv.foes.push({ a: fa, b: fb, x: fa + r() * (fb - fa), d: r() < 0.5 ? -1 : 1, fly: r() < 0.25, alive: true, ph: r() * 6 }); }
      }
      x = b;
      if (x < len - 100) { var gap = Math.round(26 + r() * Math.min(20, 8 + i * 2)); lv.coins.push({ x: x + gap / 2 - 3, y: G - 46, on: true }); x += gap; }
    }
    return lv;
  }
  var ARC_ENEMY = ["slime", "skeleton", "ghost", "goblin", "bat", "goblin", "slime", "skeleton"];

  function Arcade() {
    var self = this;
    this.ov = document.createElement("div"); this.ov.className = "arc-overlay"; this.ov.setAttribute("role", "dialog"); this.ov.setAttribute("aria-label", "Финальная игра");
    this.ov.innerHTML = '<div class="arc-box"><div class="arc-top"><span class="arc-stage"></span><span class="arc-hp"></span><button type="button" class="arc-close">Закрыть</button></div>' +
      '<canvas class="arc-canvas" width="' + ARC.W + '" height="' + ARC.H + '" tabindex="0" aria-label="Игровое поле: стрелки и пробел"></canvas>' +
      '<p class="arc-msg" aria-live="polite"></p><div class="arc-pad"><button type="button" data-k="left" aria-label="Влево">◀</button><button type="button" data-k="right" aria-label="Вправо">▶</button><button type="button" data-k="jump" aria-label="Прыжок">▲</button></div></div>';
    document.body.appendChild(this.ov);
    this.cv = this.ov.querySelector("canvas"); this.c = this.cv.getContext("2d"); this.c.imageSmoothingEnabled = false;
    this.keys = {};
    var map = { ArrowLeft: "left", ArrowRight: "right", " ": "jump", ArrowUp: "jump", a: "left", d: "right", w: "jump", "ф": "left", "в": "right", "ц": "jump" };
    this.onKey = function (e) {
      if (e.key === "Escape") { self.close(); return; }
      var k = map[e.key]; if (!k) return;
      self.keys[k] = e.type === "keydown"; e.preventDefault();
    };
    this.ov.querySelector(".arc-close").addEventListener("click", function () { self.close(); });
    Array.prototype.forEach.call(this.ov.querySelectorAll(".arc-pad button"), function (b) {
      var k = b.getAttribute("data-k");
      b.addEventListener("pointerdown", function (e) { self.keys[k] = true; e.preventDefault(); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, function () { self.keys[k] = false; }); });
    });
    this.stages = arcStages();
    var pr = practiceDone() || { first: 0, total: 1 };
    this.startHp = Math.max(2, Math.min(ARC.MAX, 2 + Math.round(3 * pr.first / Math.max(1, pr.total))));
    this.hp = this.startHp; this.shield = false; this.flawless = true; this.coins = 0; this.stage = 0;
    this.loadStage(0, true);
  }
  Arcade.prototype.open = function () {
    var self = this;
    this.ov.hidden = false; document.addEventListener("keydown", this.onKey); document.addEventListener("keyup", this.onKey);
    this.cv.focus(); this.running = true; this.last = 0;
    var tick = function (ts) {
      if (!self.running) return;
      var dt = Math.min(0.05, (ts - (self.last || ts)) / 1000); self.last = ts;
      self.step(dt); self.draw();
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  Arcade.prototype.close = function () {
    this.running = false; this.ov.hidden = true; this.keys = {};
    document.removeEventListener("keydown", this.onKey); document.removeEventListener("keyup", this.onKey);
  };
  Arcade.prototype.msg = function (t) { this.ov.querySelector(".arc-msg").textContent = t; };
  Arcade.prototype.hud = function () {
    var boss = this.stage >= this.stages.length;
    this.ov.querySelector(".arc-stage").textContent = boss ? "Босс" + (THEME === "knight" ? ": дракон" : "") :
      "Этап " + (this.stage + 1) + " из " + this.stages.length + " · " + this.stages[this.stage];
    var h = ""; for (var i = 0; i < ARC.MAX; i++) h += i < this.hp ? "♥" : "♡";
    this.ov.querySelector(".arc-hp").textContent = h + (this.shield ? " ◆" : "") + "  ● " + this.coins;
  };
  Arcade.prototype.loadStage = function (i, keepMsg) {
    this.stage = i; this.boss = i >= this.stages.length;
    this.lv = this.boss ? { len: ARC.W, grounds: [[-40, ARC.W + 40]], plats: [{ x: 40, y: 122, w: 48 }, { x: 232, y: 122, w: 48 }], foes: [], coins: [] } : makeLevel(i);
    this.x = 20; this.y = ARC.G - 16; this.vx = 0; this.vy = 0; this.inv = 0; this.cam = 0; this.safeX = 20; this.face = 1; this.won = false;
    this.bossHp = 3; this.bx = 240; this.bd = -1; this.bInv = 0; this.fire = []; this.fireT = 1.5; this.over = false;
    if (this.boss && this.flawless) { this.double = true; this.badge("scratchless", "Без единой царапины"); }
    if (!keepMsg) this.msg(this.boss ? (this.double ? "Ни одного потерянного сердца: удар по боссу двойной!" : "Босс! Прыгайте ему на голову.") : "");
    this.hud();
  };
  Arcade.prototype.badge = function (key, name) {
    var g = loadG();
    if (!g.badges[key]) { g.badges[key] = true; saveG(g); toast("Значок: " + name); }
  };
  Arcade.prototype.hurt = function () {
    if (this.inv > 0) return;
    this.inv = 1.2; this.vy = -150; this.vx = -this.face * 60;
    if (this.shield) { this.shield = false; this.hud(); return; }
    this.hp--; this.flawless = false;
    if (this.hp <= 0) { this.hp = ARC.MAX; this.shield = false; this.loadStage(this.stage, true); this.msg("Сердца кончились: этап заново, здоровье полное."); }
    this.hud();
  };
  Arcade.prototype.clearStage = function () {
    if (this.hp < ARC.MAX) { this.hp++; this.msg("Этап пройден: +1 сердце."); }
    else if (!this.shield) { this.shield = true; this.msg("Этап пройден. Сердца полные: получен щит, он примет один удар."); }
    else this.msg("Этап пройден. Сердца полные, щит уже есть.");
    this.loadStage(this.stage + 1, true);
    if (this.boss) this.msg(this.double ? "Ни одного потерянного сердца: удар по боссу двойной!" : "Босс! Прыгайте ему на голову.");
  };
  Arcade.prototype.onGround = function (x) { return this.lv.grounds.some(function (g) { return x + 10 > g[0] && x + 2 < g[1]; }); };
  Arcade.prototype.step = function (dt) {
    if (this.over) return;
    var G = ARC.G, k = this.keys, lv = this.lv, self = this;
    var ax = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (ax) this.face = ax;
    if (this.inv < 0.9) this.vx = ax * 90;
    this.vy += 640 * dt;
    var ny = this.y + this.vy * dt, grounded = false;
    if (this.vy >= 0) {
      if (this.onGround(this.x) && this.y + 16 <= G + 1 && ny + 16 >= G) { ny = G - 16; this.vy = 0; grounded = true; this.safeX = this.x; }
      lv.plats.forEach(function (p) { if (self.x + 10 > p.x && self.x + 2 < p.x + p.w && self.y + 16 <= p.y + 1 && ny + 16 >= p.y) { ny = p.y - 16; self.vy = 0; grounded = true; } });
    }
    this.y = ny; this.x = Math.max(0, Math.min(lv.len + (this.boss ? -12 : 40), this.x + this.vx * dt));
    if (k.jump && grounded) { this.vy = -250; SFX.jump(); }
    if (this.inv > 0) this.inv -= dt;
    if (this.y > ARC.H + 20) { this.x = Math.max(0, this.safeX - 24); this.y = G - 40; this.vy = 0; this.hurt(); }
    lv.foes.forEach(function (f) {
      if (!f.alive) return;
      f.x += f.d * 26 * dt; if (f.x < f.a || f.x > f.b) f.d *= -1;
      f.ph += dt * 3;
      var fy = f.fly ? G - 34 + Math.sin(f.ph) * 8 : G - 12;
      if (self.x + 11 > f.x && self.x + 1 < f.x + 13 && self.y + 16 > fy && self.y < fy + 12) {
        if (self.vy > 0 && self.y + 16 < fy + 7) { f.alive = false; self.vy = -180; SFX.coin(); }
        else self.hurt();
      }
    });
    lv.coins.forEach(function (c) { if (c.on && Math.abs(self.x + 6 - c.x - 3) < 9 && Math.abs(self.y + 8 - c.y - 3) < 12) { c.on = false; self.coins++; SFX.coin(); self.hud(); } });
    if (this.boss) this.stepBoss(dt);
    else if (this.x > lv.len - 30) this.clearStage();
    this.cam = Math.max(0, Math.min(lv.len - ARC.W + (this.boss ? 0 : 40), this.x - 130));
  };
  Arcade.prototype.stepBoss = function (dt) {
    var G = ARC.G, self = this, bw = THEME === "knight" ? 38 : 36, bh = THEME === "knight" ? 30 : 27;
    if (this.bossHp <= 0) return;
    this.bx += this.bd * 40 * dt; if (this.bx < 120 || this.bx > ARC.W - bw - 8) this.bd *= -1;
    if (this.bInv > 0) this.bInv -= dt;
    this.fireT -= dt;
    if (this.fireT <= 0) { this.fireT = 2.2; this.fire.push({ x: this.bx, y: G - 18, vx: this.x < this.bx ? -110 : 110 }); }
    this.fire = this.fire.filter(function (f) {
      f.x += f.vx * dt;
      if (Math.abs(self.x + 6 - f.x) < 9 && Math.abs(self.y + 10 - f.y) < 9) { self.hurt(); return false; }
      return f.x > -20 && f.x < ARC.W + 20;
    });
    var by = G - bh;
    if (this.x + 11 > this.bx && this.x + 1 < this.bx + bw && this.y + 16 > by && this.y < G) {
      if (this.vy > 0 && this.y + 16 < by + 10 && this.bInv <= 0) {
        this.bossHp -= this.double ? 2 : 1; this.double = false; this.bInv = 1; this.vy = -230; SFX.coin();
        if (this.bossHp <= 0) {
          this.over = true; SFX.win();
          this.msg(THEME === "knight" ? "Дракон повержен, принцесса свободна! Практика пройдена." : "Босс повержен! Практика пройдена.");
          this.badge("arcade", "Финальная игра пройдена");
        }
      } else this.hurt();
    }
  };
  Arcade.prototype.draw = function () {
    var c = this.c, G = ARC.G, cam = Math.round(this.cam), t = (this.last || 0) / 16, knight = THEME === "knight", lv = this.lv;
    var sky = c.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, knight ? "#C9A6D8" : "#6ECFF0"); sky.addColorStop(1, knight ? "#F7C59A" : "#CFF3FF");
    c.fillStyle = sky; c.fillRect(0, 0, ARC.W, ARC.H);
    var hue = ["#8FD98C", "#7CC6E8", "#C9A6E8", "#E8C27C", "#8FD9C4", "#E89B8F", "#B4D98C", "#9FA8E8"][this.stage % 8];
    c.fillStyle = hue;
    for (var x = 0; x < ARC.W; x += 2) c.fillRect(x, G - 30 - Math.round((Math.sin((x + cam * 0.4) * 0.04) * 0.5 + 0.5) * 22), 2, 40);
    lv.grounds.forEach(function (g) {
      var a = g[0] - cam, b = g[1] - cam; if (b < 0 || a > ARC.W) return;
      c.fillStyle = PAL.K; c.fillRect(a - 1, G, b - a + 2, ARC.H - G);
      c.fillStyle = "#39B54A"; c.fillRect(a, G, b - a, 3); c.fillStyle = "#8B5A2B"; c.fillRect(a, G + 3, b - a, ARC.H - G - 3);
    });
    lv.plats.forEach(function (p) { c.fillStyle = PAL.K; c.fillRect(p.x - cam - 1, p.y - 1, p.w + 2, 7); c.fillStyle = "#8B5A2B"; c.fillRect(p.x - cam, p.y, p.w, 5); c.fillStyle = "#39B54A"; c.fillRect(p.x - cam, p.y, p.w, 2); });
    lv.coins.forEach(function (o) { if (!o.on) return; var cx = Math.round(o.x - cam), cy = Math.round(o.y + Math.sin(t / 10 + o.x) * 2);
      c.fillStyle = PAL.K; c.fillRect(cx - 1, cy - 1, 9, 9); c.fillStyle = PAL.y; c.fillRect(cx, cy, 7, 7); c.fillStyle = PAL.o; c.fillRect(cx + 5, cy + 1, 1, 5); });
    var self = this;
    lv.foes.forEach(function (f, i) {
      if (!f.alive) return;
      var fy = f.fly ? G - 34 + Math.sin(f.ph) * 8 : G - 12, fx = f.x - cam;
      if (knight) { var kind = f.fly ? "bat" : ARC_ENEMY[self.stage % ARC_ENEMY.length]; var sp = KSPR[kind] || KSPR.slime; drawK(c, sp, fx - 1, fy + 12 - sp.length, f.d > 0); }
      else drawSprite(c, BLOB[Math.floor(t / 12) % 2], fx, fy + 3, f.d > 0);
    });
    if (!this.boss) {
      var fx2 = lv.len - 24 - cam; c.fillStyle = PAL.K; c.fillRect(fx2, G - 40, 2, 40); c.fillStyle = knight ? "#E5484D" : PAL.y; c.fillRect(fx2 + 2, G - 40, 14, 9);
    } else {
      if (this.bossHp > 0 || (t % 8 < 4)) {
        var tint = this.bInv > 0 && t % 4 < 2 ? "#FFFFFF" : null;
        if (knight) drawK(c, KSPR.dragon, this.bx - cam, G - 30, this.bd > 0, 1, tint);
        else drawK(c, BLOB[Math.floor(t / 12) % 2], this.bx - cam, G - 27, false, 3, tint, PAL);
      }
      this.fire.forEach(function (f) { c.fillStyle = PAL.o; c.fillRect(f.x - cam - 3, f.y - 3, 7, 7); c.fillStyle = PAL.y; c.fillRect(f.x - cam - 1, f.y - 1, 3, 3); });
      c.fillStyle = PAL.K; c.fillRect(ARC.W / 2 - 31, 6, 62, 8);
      for (var hpi = 0; hpi < 3; hpi++) { c.fillStyle = hpi < this.bossHp ? "#D62839" : "#3A2A3A"; c.fillRect(ARC.W / 2 - 30 + hpi * 20, 7, 19, 6); }
      if (this.over && knight) { drawK(c, KSPR.princess, 290, G - 21, true, 1); }
    }
    if (!(this.inv > 0 && t % 6 < 3)) {
      var air = this.vy !== 0, pose = air ? "jump" : this.vx ? (Math.floor(t / 6) % 2 ? "run1" : "run2") : "stand";
      if (knight) drawK(c, KSPR["knight_" + pose], this.x - cam - 2, this.y - 3, this.face < 0);
      else drawSprite(c, HERO[pose], this.x - cam, this.y, this.face < 0);
    }
  };

  /* вход в финальную игру на странице обзора */
  var arcade = null;
  function arcadeEntry() {
    if (!/t\d+_00\.html$/.test(PAGE)) return;
    var main = document.querySelector("main.content");
    if (!main || !window.PRACTICE_MANIFEST) return;
    var box = document.getElementById("arcade-entry");
    if (!box) {
      box = document.createElement("section"); box.id = "arcade-entry"; box.className = "arc-entry";
      var goals = main.querySelector("section.goals");
      if (goals && goals.nextSibling) main.insertBefore(box, goals.nextSibling); else main.insertBefore(box, main.firstChild);
    }
    var pr = practiceDone() || { done: 0, total: 0 }, open = pr.total > 0 && pr.done === pr.total;
    box.innerHTML = "";
    var h = document.createElement("h2"); h.textContent = "Финальная игра"; box.appendChild(h);
    var p = document.createElement("p");
    p.textContent = open ? "Все упражнения вашего уровня решены. Пройдите все страницы практики как уровни игры" +
      (THEME === "knight" ? " и победите дракона." : " и победите босса.") + " Сердец на старте: чем больше упражнений решено с первой попытки, тем больше. На оценку игра не влияет."
      : "Откроется, когда будут решены все упражнения вашего уровня: решено " + pr.done + " из " + pr.total + ".";
    box.appendChild(p);
    var b = document.createElement("button"); b.type = "button"; b.className = "arc-play"; b.textContent = open ? "Играть" : "Пока закрыто"; b.disabled = !open;
    b.addEventListener("click", function () { if (arcade) { arcade.ov.remove(); } arcade = new Arcade(); arcade.open(); });
    box.appendChild(b);
  }

  /* ---------------- цикл ---------------- */
  var running = false;
  function loop() {
    if (root.getAttribute("data-profile") !== "game") { running = false; return; }
    scenes.forEach(function (s) { if (s.visible || s.mode !== "idle") { s.step(); s.draw(); } });
    window.requestAnimationFrame(loop);
  }

  function build() {
    if (scenes.length) return;
    var blocks = Array.prototype.slice.call(document.querySelectorAll(".checker[data-file]"));
    var count = blocks.length;
    blocks.forEach(function (b, i) {
      var isFinal = !!b.closest(".task-final");
      scenes.push(new Scene(b, i, count, isFinal));
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          scenes.forEach(function (s) { if (s.wrap === e.target) s.visible = e.isIntersecting; });
        });
      }, { threshold: 0.3 });
      scenes.forEach(function (s) { io.observe(s.wrap); });
    } else {
      scenes.forEach(function (s) { s.visible = true; });
    }
    scenes.forEach(function (s) { s.draw(); });
  }

  function activate() {
    refreshHud();
    arcadeEntry();
    if (root.getAttribute("data-profile") !== "game") return;
    build();
    scenes.forEach(function (s) { s.updateHud(); s.draw(); });
    if (!running && !reduced) { running = true; window.requestAnimationFrame(loop); }
  }

  /* «Сбросить» в блоке проверки: сцена возвращается к началу (решенная остается решенной) */
  document.addEventListener("checker:reset", function (e) {
    scenes.forEach(function (s) { if (s.block === e.target) { s.reset(solvedTasks()[s.file] || state.done[s.file]); if (s.draw) s.draw(); } });
  });
  document.addEventListener("checker:start", function (e) {
    scenes.forEach(function (s) { if (s.block === e.target) s.start(); });
  });
  document.addEventListener("checker:result", function (e) {
    award(e.detail);
    scenes.forEach(function (s) { if (s.block === e.target) { s.result(e.detail); if (reduced) s.draw(); } });
  });
  root.addEventListener("practice:settings", activate);

  function init() {
    /* блоки проверки строит checker.js; ждем их */
    var tries = 0;
    (function wait() {
      if (document.querySelector(".checker .checker-bar") || tries > 40) activate();
      else { tries++; window.setTimeout(wait, 50); }
    })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
