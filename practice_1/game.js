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
    flawless: "Страница без единой ошибки"
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
    var before = heroLevel(g.xp), gain = lvl === "exercise" ? (VARIANT_XP[detail.variant] || 5) : (XP[lvl] || 5);
    g.awarded[f] = { level: lvl, first: g.attempts[f] === 1 };
    if (g.attempts[f] === 1) { g.streak += 1; g.best = Math.max(g.best, g.streak); } else { g.streak = 0; }
    g.xp += gain;
    var got = [];
    function badge(key) { if (!g.badges[key]) { g.badges[key] = true; got.push(BADGES[key]); } }
    badge("first");
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
    this.kind = isFinal ? "portal" : ["blob", "wall", "pit"][index % 3];
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
    this.ctx = this.canvas.getContext("2d");
    this.t = 0; this.visible = false; this.entered = false;
    this.obstX = 168; /* кратно 8: яма совпадает с плитками земли */
    this.reset(solvedTasks()[this.file] || state.done[this.file]);
    this.updateHud();
  }

  Scene.prototype.reset = function (solved) {
    this.mode = solved ? "done" : "idle";
    this.hx = solved ? 286 : 22; this.hy = GROUND - 16; this.vy = 0; this.vx = 0;
    this.coin = !solved; this.blink = 0; this.pose = "stand"; this.fx = [];
    this.caption.textContent = solved ? (this.isFinal ? "Уровень пройден" : "Участок пройден") : "Задача " + (this.index + 1) + ": решите, чтобы пройти участок";
  };

  Scene.prototype.updateHud = function () {
    var s = solvedTasks(), n = 0;
    scenes.forEach(function (sc) { if (s[sc.file]) n++; });
    this.hud.innerHTML = "";
    var a = document.createElement("span"); a.textContent = "Участок " + (this.index + 1) + "/" + this.count;
    var g = loadG();
    var b = document.createElement("span"); b.textContent = "Серия ×" + g.streak;
    var c = document.createElement("span"); c.textContent = "ДНК " + n + "/" + this.count;
    this.hud.appendChild(a); this.hud.appendChild(b); this.hud.appendChild(c);
  };

  Scene.prototype.start = function () {
    this.mode = "wait"; this.caption.textContent = "Проверка…";
  };

  Scene.prototype.result = function (d) {
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
      this.mode = "done"; this.hx = 286; this.hy = GROUND - 16; this.coin = false;
      this.caption.textContent = this.isFinal ? "Уровень пройден! Все задачи решены" :
        "Участок пройден. Дальше: задача " + (this.index + 2);
      if (!reduced) SFX.win();
    } else {
      var fi = this.failInfo || {};
      this.caption.textContent = (fi.warn ? "Почти! Результат верный, нужен другой прием. " :
        (fi.total ? "Ой! Пройдено тестов " + fi.passed + " из " + fi.total + ". " : "Ой! ")) + "Подсказки ниже";
      saveState(state);
      this.mode = "idle"; this.hx = 22; this.hy = GROUND - 16; this.vx = 0; this.vy = 0; this.blink = 60;
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

  /* ---------- отрисовка ---------- */
  Scene.prototype.draw = function () {
    var c = this.ctx, night = window.practiceTheme && window.practiceTheme() === "dark";
    var off = this.index * 180; /* фон продолжается с предыдущего участка */
    var sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, night ? "#141633" : "#6ECFF0");
    sky.addColorStop(1, night ? "#2A2E5C" : "#CFF3FF");
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
    if (this.kind === "blob") {
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
    if (this.mode === "done" && !this.isFinal) {
      c.fillStyle = "#8B5A2B"; c.fillRect(W - 14, GROUND - 16, 2, 16);
      c.fillStyle = "#F2C230"; c.fillRect(W - 22, GROUND - 20, 16, 7);
      c.fillStyle = "#1A1C2C"; c.fillRect(W - 19, GROUND - 17, 8, 1); c.fillRect(W - 13, GROUND - 18, 1, 3); c.fillRect(W - 12, GROUND - 17, 1, 1);
    }
    /* герой */
    var visibleHero = this.blink % 6 < 3 && this.hx > -16 && this.hx < W + 16 && this.hy < H &&
      !(this.mode === "portal" && this.portalT > 8) && !(this.isFinal && this.mode === "done");
    if (visibleHero) drawSprite(c, HERO[this.pose] || HERO.stand, this.hx, this.hy, this.vx < 0 && this.mode === "hurt");
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
