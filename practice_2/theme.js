/* theme.js: верхняя панель и настройки страницы практической работы.

   Панель во всю ширину над страницей:
     слева   название курса и практики;
     центр   прогресс всей практики: задания практики «2 из 7» с полосой
             и упражнения разделов «3 из 9» (по data/practice.js);
             если студент выбрал свой уровень, считаются задания этого уровня;
             в игровом режиме на этом месте уровень героя, опыт и серия (game.js);
     справа  кнопка темы (светлая → темная → как в системе) и меню ⚙:
             режим (классический, игровой), звук (в игровом режиме),
             прогресс (сохранить в файл, загрузить, сбросить).
     Свой уровень студент выбирает кнопкой «Сделать моим уровнем» во вкладке
     уровня любого упражнения (кнопки [data-track]).

   Объем теории (версия 27): «Кратко» или «Подробно». Вариант по умолчанию
   задает преподаватель (атрибут data-theory-default у <html>, его ставит
   set_theory.py), выбор студента хранится в настройках и действует на всех
   страницах. Переключатель стоит в шапке страницы справа от заголовка (версия 31) и в меню ⚙;
   он появляется только на страницах, где есть блоки .th-full.
   CSS прячет .th-full в режиме «Кратко» и .th-brief в режиме «Подробно»
   по атрибуту data-theory у <html>.

   Подключается в <head> БЕЗ defer: data-theme и data-profile
   появляются до отрисовки, без вспышки. Настройки хранятся в localStorage;
   ссылки между страницами передают их параметрами адреса (для файлов,
   открытых с диска, у которых раздельное хранилище). */

(function () {
  "use strict";
  var KEY = "practice-html-settings";
  var PROGRESS_KEY = "practice-html-progress";
  var root = document.documentElement;

  /* ---------- версия 59: публикация по site-config.js ----------
     Страница в составе сайта подключает ../site-config.js. Если практика для студентов еще не
     открыта (scheduled до момента from, soon, hidden), страница показывает заглушку «Откроется …»
     со ссылкой на главную. В копии преподавателя ("preview": true) страница не закрывается, сверху
     пометка, когда ее увидят студенты. Без файла настроек ничего не меняется. */
  var MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function openAt(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
  }
  function ruDate(s) {
    var d = openAt(s); if (!d) return "";
    var t = d.getHours() || d.getMinutes() ? " в " + d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2) : "";
    return d.getDate() + " " + MONTHS_RU[d.getMonth()] + t;
  }
  var siteGate = (function () {
    var cfg = window.SITE_CONFIG, m = /practice_(\d+)\//.exec(window.location.pathname);
    if (!cfg || !cfg.practices || !m) return null;
    var n = m[1], c = cfg.practices[n];
    if (!c) return null;
    var st = c.state, at = openAt(c.from);
    var open = st === "open" || (st === "scheduled" && at && new Date() >= at);
    if (open) return null;
    var g = { n: n, title: c.title || "", state: st, from: c.from || "", preview: !!cfg.preview };
    if (!g.preview) root.classList.add("site-locked");
    return g;
  })();
  function siteStub() {
    if (!siteGate) return;
    var home = root.getAttribute("data-home") || "../index.html";
    var when = siteGate.state === "scheduled" ? "Откроется " + ruDate(siteGate.from) :
      siteGate.state === "soon" && siteGate.from ? "Ориентировочно откроется " + ruDate(siteGate.from) : "Практика пока закрыта";
    if (siteGate.preview) {
      var bar = document.createElement("p");
      bar.className = "site-preview";
      bar.textContent = "Предпросмотр. Для студентов: " + (siteGate.state === "hidden" ? "практика скрыта" :
        siteGate.state === "soon" ? "карточка «Скоро», страниц на сайте нет" : when.charAt(0).toLowerCase() + when.slice(1)) + ".";
      document.body.insertBefore(bar, document.body.firstChild);
      return;
    }
    var box = document.createElement("div");
    box.className = "site-stub";
    box.innerHTML = '<div class="site-stub-card"><svg class="site-stub-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>' +
      '<p class="site-stub-kick"></p><h1></h1><p class="site-stub-date"></p><p class="site-stub-text">Страницы появятся здесь в этот день. Пока можно вернуться к открытым практикам.</p>' +
      '<a class="site-stub-home">← Все практики курса</a></div>';
    box.querySelector(".site-stub-kick").textContent = "Практика " + siteGate.n;
    box.querySelector("h1").textContent = siteGate.title || "Практика " + siteGate.n;
    box.querySelector(".site-stub-date").textContent = when;
    if (siteGate.state !== "scheduled") box.querySelector(".site-stub-text").textContent = "Пока можно вернуться к открытым практикам.";
    box.querySelector(".site-stub-home").href = home;
    document.body.appendChild(box);
    document.title = (siteGate.title ? "Практика " + siteGate.n + ". " + siteGate.title : "Практика " + siteGate.n) + ": скоро";
  }

  function read(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || "{}"); } catch (e) { return {}; }
  }
  function write(key, v) {
    try { window.localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ }
  }
  /* объем теории: выбор студента или вариант преподавателя для этой страницы */
  /* версия 36: операционная система для примеров с терминалом (выбор студента или по браузеру) */
  var OS_OPTS = [["win", "Windows"], ["mac", "macOS"], ["linux", "Linux"]];
  function detectOs() {
    var p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "").toLowerCase();
    if (p.indexOf("win") >= 0) return "win";
    if (p.indexOf("mac") >= 0 || p.indexOf("iphone") >= 0 || p.indexOf("ipad") >= 0) return "mac";
    return "linux";
  }
  function osOf(s) { return s.os === "win" || s.os === "mac" || s.os === "linux" ? s.os : detectOs(); }
  function theoryDefault() { return root.getAttribute("data-theory-default") === "full" ? "full" : "brief"; }
  function theoryOf(s) { return s.theory === "full" || s.theory === "brief" ? s.theory : theoryDefault(); }
  function apply(s) {
    root.classList.add("theme-switching");
    if (s.theme === "light" || s.theme === "dark") root.setAttribute("data-theme", s.theme);
    else root.removeAttribute("data-theme");
    root.setAttribute("data-profile", s.profile === "game" ? "game" : "classic");
    root.setAttribute("data-sound", s.sound ? "on" : "off");
    if (s.track) root.setAttribute("data-track", s.track); else root.removeAttribute("data-track");
    root.setAttribute("data-theory", theoryOf(s));
    root.setAttribute("data-os", osOf(s));
    window.setTimeout(function () { root.classList.remove("theme-switching"); }, 50);
  }
  function fire(target, name, detail) {
    var e;
    try { e = new CustomEvent(name, { detail: detail }); }
    catch (x) { e = document.createEvent("CustomEvent"); e.initCustomEvent(name, false, false, detail); }
    target.dispatchEvent(e);
  }

  /* источники настроек: режим для снимков, параметры адреса, localStorage */
  function fromQuery() {
    var q = window.location.search, out = null;
    if (!q) return null;
    q.replace(/[?&](theme|profile|sound|track|theory|os)=([^&]*)/g, function (_, k, v) {
      out = out || {};
      out[k] = k === "sound" ? v === "on" : decodeURIComponent(v);
    });
    return out;
  }
  var forced = window.PRACTICE_FORCE_SETTINGS || null;
  var settings = forced || read(KEY);
  var q = forced ? null : fromQuery();
  if (q) {
    for (var k in q) if (q.hasOwnProperty(k)) settings[k] = q[k];
    write(KEY, settings);
    try { window.history.replaceState(null, "", window.location.pathname + window.location.hash); } catch (e) { /* не мешает */ }
  }
  apply(settings);

  /* текущие настройки для других скриптов (вкладки уровней берут отсюда свой уровень) */
  window.practiceSettings = function () { return settings; };

  window.practiceTheme = function () {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function icon(name) { var s = el("span", "i i-" + name); s.setAttribute("aria-hidden", "true"); return s; }
  function changed() {
    if (!forced) write(KEY, settings);
    apply(settings);
    fire(root, "practice:settings", settings);
    refresh();
  }

  /* ---------- прогресс всей практики ---------- */
  var progFill = null, progText = null, progSub = null;
  var TRACK_RU = { basic: "базовый", medium: "средний", advanced: "продвинутый" };
  function practiceProgress() {
    var m = window.PRACTICE_MANIFEST, p = read(PROGRESS_KEY), solved = (p.tasks || {});
    if (!m) return null;
    /* Засчитываются упражнения своего уровня (версия 22). Выбран уровень: считаются
       варианты этого уровня; не выбран: упражнение решено, если решен любой вариант. */
    if (settings.track && m.graded && m.graded[settings.track]) {
      var g = m.graded[settings.track];
      return { done: g.filter(function (t) { return solved[t.file]; }).length, total: g.length };
    }
    var groups = {};
    (m.exercises || []).forEach(function (t) {
      var key = t.page + "#" + (t.group || t.file);
      (groups[key] = groups[key] || []).push(t);
    });
    var keys = Object.keys(groups), ed = 0;
    keys.forEach(function (k) { if (groups[k].some(function (t) { return solved[t.file]; })) ed++; });
    return { done: ed, total: keys.length };
  }
  function refreshProgress() {
    if (!progText) return;
    var pr = practiceProgress();
    if (!pr) { progText.parentNode.parentNode.hidden = true; return; }
    progText.textContent = (settings.track ? "Уровень " + TRACK_RU[settings.track] + ": " : "Упражнения: ") +
      pr.done + " из " + pr.total;
    progSub.textContent = settings.track ? "" : "уровень не выбран";
    progSub.hidden = !!settings.track;
    progFill.style.width = pr.total ? Math.round(100 * pr.done / pr.total) + "%" : "0";
    progFill.parentNode.setAttribute("aria-valuenow", String(pr.done));
    progFill.parentNode.setAttribute("aria-valuemax", String(pr.total));
  }

  /* версия 46: иконки панели и меню (звук, прогресс); подсказки при наведении дает CSS по data-tip */
  var SVG = {"spk": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 9.5h3.5L12 5.5v13l-4.5-4H4Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "mute": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 9.5h3.5L12 5.5v13l-4.5-4H4Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M16 9.5l5 5M21 9.5l-5 5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "dl": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "ul": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "trash": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M5 7h14M10 11v6M14 11v6M6.5 7l1 12.5h9L17.5 7M9.5 7V4.5h5V7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"};
  function tip(elm, text) { elm.setAttribute("data-tip", text); elm.setAttribute("aria-label", text); elm.removeAttribute("title"); }

  /* ---------- кнопка темы ---------- */
  var themeBtn = null;
  var THEMES = [["light", "sun", "Светлая тема"], ["dark", "moon", "Темная тема"], ["system", "auto", "Тема как в системе"]];
  function currentTheme() { return settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system"; }
  function refreshThemeBtn() {
    if (!themeBtn) return;
    var cur = currentTheme(), t = THEMES.filter(function (x) { return x[0] === cur; })[0];
    themeBtn.innerHTML = "";
    themeBtn.appendChild(icon(t[1]));
    tip(themeBtn, t[2] + ". Нажмите, чтобы переключить");
  }

  /* ---------- кнопка звука (версия 46): только в игровом режиме, между темой и настройками ---------- */
  var soundBtn = null;
  function refreshSound() {
    if (!soundBtn) return;
    soundBtn.hidden = settings.profile !== "game";
    soundBtn.innerHTML = settings.sound ? SVG.spk : SVG.mute;
    soundBtn.setAttribute("aria-pressed", String(!!settings.sound));
    tip(soundBtn, settings.sound ? "Звук включен. Нажмите, чтобы выключить" : "Звук выключен. Нажмите, чтобы включить");
  }

  /* ---------- меню настроек ---------- */
  var groups = [];
  function segment(label, key, options, def) {
    var row = el("div", "tb-row");
    row.appendChild(el("span", "tb-label", label));
    var seg = el("div", "seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", label);
    options.forEach(function (o) {
      var b = el("button", "seg-btn", o[1]);
      b.type = "button";
      b._value = o[0];
      b.addEventListener("click", function () {
        if (key === "theory") { setTheory(o[0]); return; }
        settings[key] = o[0]; changed();
      });
      seg.appendChild(b);
    });
    row.appendChild(seg);
    groups.push({ key: key, seg: seg, def: def, row: row });
    return row;
  }
  function refreshGroups() {
    groups.forEach(function (g) {
      var cur = g.key === "theory" ? theoryOf(settings) : g.key === "os" ? osOf(settings) :
        (settings[g.key] === undefined ? g.def : settings[g.key]);
      Array.prototype.forEach.call(g.seg.children, function (b) { b.setAttribute("aria-pressed", String(b._value === cur)); });
      if (g.key === "sound") g.row.hidden = settings.profile !== "game";
    });
  }
  /* кнопки выбора своего уровня (data-track) на любой странице */
  function refreshTrack() {
    Array.prototype.forEach.call(document.querySelectorAll("button[data-track]:not(.lvl-opt)"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-track") === settings.track));
    });
    /* «Сбросить выбор» виден только рядом с кнопкой выбранного уровня */
    Array.prototype.forEach.call(document.querySelectorAll(".mine-controls"), function (box) {
      var btn = box.querySelector("[data-track]"), rst = box.querySelector(".mine-reset");
      if (rst) rst.hidden = !(btn && btn.getAttribute("data-track") === settings.track);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.level-tabs [role="tab"]'), function (t) {
      t.classList.toggle("is-mine", t.getAttribute("data-level") === settings.track);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".menu-levels li"), function (li) {
      var c = li.querySelector(".lvl-count");
      li.classList.toggle("is-mine", !!c && c.getAttribute("data-level") === settings.track);
    });
  }
  document.addEventListener("click", function (e) {
    var r = e.target && e.target.closest ? e.target.closest(".mine-reset") : null;
    if (r) { delete settings.track; changed(); return; }
    /* версия 58: только кнопки; у <html> тоже есть data-track, и раньше любой щелчок повторно выбирал
       уровень и возвращал вкладку упражнения на свой уровень */
    var b = e.target && e.target.closest ? e.target.closest("button[data-track]") : null;
    if (!b) return;
    settings.track = b.getAttribute("data-track");
    changed();
  });
  function refresh() { refreshGroups(); refreshThemeBtn(); refreshSound(); refreshProgress(); refreshTrack(); refreshLevel(); }

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "_" + p(d.getHours()) + "-" + p(d.getMinutes());
  }
  function exportProgress() {
    var data = {};
    for (var i = 0; i < window.localStorage.length; i++) {
      var k = window.localStorage.key(i);
      if (k && k.indexOf("practice-html") === 0) data[k] = window.localStorage.getItem(k);
    }
    var blob = new Blob([JSON.stringify({ format: "practice-html-progress", saved: new Date().toISOString(), data: data }, null, 1)],
      { type: "application/json" });
    var a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = "progress_python_" + stamp() + ".json";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 500);
  }
  function importProgress() {
    var inp = el("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var obj = JSON.parse(String(r.result));
          if (obj.format !== "practice-html-progress") throw new Error("format");
          Object.keys(obj.data).forEach(function (key) {
            if (key.indexOf("practice-html") === 0) window.localStorage.setItem(key, obj.data[key]);
          });
          window.location.reload();
        } catch (e) { window.alert("Это не файл прогресса практических работ."); }
      };
      r.readAsText(f, "utf-8");
    });
    inp.click();
  }
  function resetProgress() {
    if (!window.confirm("Удалить отметки о решенных задачах, сохраненный код и игровой прогресс в этом браузере?")) return;
    var keys = [];
    for (var i = 0; i < window.localStorage.length; i++) {
      var key = window.localStorage.key(i);
      if (key && key.indexOf("practice-html") === 0 && key !== KEY) keys.push(key);
    }
    keys.forEach(function (key) { window.localStorage.removeItem(key); });
    window.location.reload();
  }

  /* ---------- «Начать заново» (версия 54): прогресс, код и все настройки ----------
     Кнопка всегда в верхней панели. Окно подтверждения перечисляет, что сбросится; файл с
     прогрессом и настройками скачивается перед сбросом всегда: кнопкой в окне или сам.
     Отметки страницы преподавателя (practice-html-teacher) не трогаются. */
  var RESET_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.9h3.9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>';
  function resetAll() {
    var d = el("dialog", "rs-dlg");
    d.setAttribute("aria-labelledby", "rs-title");
    var x = el("button", "tb-icon rs-x"); x.type = "button"; x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    x.setAttribute("aria-label", "Закрыть"); x.onclick = function () { d.close(); };
    d.appendChild(x);
    var h = el("h3", "", "Начать заново?"); h.id = "rs-title"; d.appendChild(h);
    d.appendChild(el("p", "", "Будут сброшены все данные сайта в этом браузере:"));
    var ul = el("ul");
    [["решенные упражнения и прогресс", ": отметки, кольца на главной, опыт и значки игрового режима;"],
     ["код", " в полях проверки и в примерах;"],
     ["настройки", ": тема (как в системе), режим (классический), звук (выключен), уровень (не выбран), " +
       "объем теории (подробно), система для терминала (по вашему компьютеру)."]].forEach(function (it) {
      var li = el("li"); li.appendChild(el("b", "", it[0])); li.appendChild(document.createTextNode(it[1])); ul.appendChild(li);
    });
    d.appendChild(ul);
    d.appendChild(el("p", "rs-warn", "Отменить сброс нельзя. Перед сбросом файл с прогрессом и настройками скачается сам, " +
      "если вы не сохранили его кнопкой ниже: его можно загрузить обратно через ⚙ → «Прогресс» → «Загрузить»."));
    var acts = el("div", "rs-acts"), saved = false;
    var sb = el("button", "tb-btn rs-save"); sb.type = "button";
    sb.innerHTML = SVG.dl + "<span>Сохранить прогресс в файл</span>";
    sb.onclick = function () { exportProgress(); saved = true; sb.querySelector("span").textContent = "Файл сохранен"; };
    acts.appendChild(sb);
    acts.appendChild(el("span", "rs-flex"));
    var yes = el("button", "tb-btn rs-yes", "Сбросить все"); yes.type = "button";
    yes.onclick = function () {
      yes.disabled = true;
      if (!saved) exportProgress();              /* резервная копия скачивается всегда */
      window.setTimeout(function () {
        var keys = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var key = window.localStorage.key(i);
          if (key && key.indexOf("practice-html") === 0 && key.indexOf("practice-html-teacher") !== 0) keys.push(key);
        }
        keys.forEach(function (key) { window.localStorage.removeItem(key); });
        window.location.replace(window.location.pathname);
      }, 700);
    };
    acts.appendChild(yes);
    var no = el("button", "tb-btn", "Отмена"); no.type = "button"; no.onclick = function () { d.close(); };
    acts.appendChild(no);
    d.appendChild(acts);
    d.addEventListener("close", function () { d.parentNode && d.parentNode.removeChild(d); });
    document.body.appendChild(d);
    d.showModal();
  }

  /* ---------- объем теории (версия 27) ---------- */
  var THEORY_OPTS = [["brief", "Кратко"], ["full", "Подробно"]];
  function hasTheory() { return !!document.querySelector("main .th-full"); }
  /* элемент, который останется на месте после переключения: первый видимый
     под верхней панелью и не зависящий от объема теории */
  function readingAnchor() {
    var bar = document.querySelector(".topbar"), top = bar ? bar.getBoundingClientRect().bottom : 0;
    var list = document.querySelectorAll("main.content h2, main.content h3, main.content .step, main.content p, " +
      "main.content .run-pair, main.content .level-tabs, main.content table");
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n.closest(".th-full, .th-brief")) continue;
      var r = n.getBoundingClientRect();
      if (r.height && r.bottom > top + 4) return { node: n, y: r.top };
    }
    return null;
  }
  function setTheory(v) {
    if (theoryOf(settings) === v) { settings.theory = v; if (!forced) write(KEY, settings); return; }
    var a = readingAnchor();
    settings.theory = v;
    changed();
    if (a) window.scrollBy(0, a.node.getBoundingClientRect().top - a.y);
  }
  function theorySwitch() {
    if (!hasTheory() || document.querySelector(".theory-switch")) return;
    var box = el("div", "theory-switch");
    box.appendChild(el("span", "theory-switch-label", "Объем теории"));
    var seg = el("div", "seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Объем теории");
    THEORY_OPTS.forEach(function (o) {
      var b = el("button", "seg-btn", o[1]);
      b.type = "button";
      b._value = o[0];
      /* версия 57: подсказка, как отличить дополнительный материал */
      b.title = o[0] === "full" ? "Краткая теория и дополнительный материал: он обведен пунктирной рамкой с подписью «Дополнительно»"
        : "Только то, что нужно для упражнений";
      b.addEventListener("click", function () { setTheory(o[0]); });
      seg.appendChild(b);
    });
    box.appendChild(seg);
    groups.push({ key: "theory", seg: seg, def: theoryDefault(), row: box });
    /* версия 31: переключатель в шапке страницы справа от заголовка (вариант D);
       содержимое шапки уходит в левую колонку .ph-main, переключатель в правую */
    var header = document.querySelector(".page-header");
    if (header) {
      var row = el("div", "ph-row");
      var left = el("div", "ph-main");
      while (header.firstChild) left.appendChild(header.firstChild);
      row.appendChild(left);
      row.appendChild(box);
      header.appendChild(row);
      return;
    }
    var main = document.querySelector("main.content");
    if (main) main.insertBefore(box, main.firstChild);
  }

  function gearMenu() {
    var wrap = el("div", "tb-menu");
    var btn = el("button", "tb-icon");
    btn.type = "button";
    btn.className = "tb-icon tip";
    btn.appendChild(icon("gear"));
    tip(btn, "Настройки");
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    var pop = el("div", "tb-pop tb-pop-grid");
    pop.hidden = true;
    pop.appendChild(segment("Режим", "profile", [["classic", "Классический"], ["game", "Игровой"]], "classic"));
    /* версия 46: уровень в меню; та же настройка, что «Сделать моим уровнем», общая для всех страниц */
    var lvl = segment("Уровень", "track", [["basic", "Базовый"], ["medium", "Средний"], ["advanced", "Продвинутый"]], null);
    Array.prototype.forEach.call(lvl.querySelectorAll(".seg-btn"), function (b) {
      var d = el("span", "lvl-dot lvl-dot-" + b._value);
      d.setAttribute("aria-hidden", "true");
      b.insertBefore(d, b.firstChild);
    });
    /* версия 58: уровни тремя кружками со значком, под ними строка о выбранном уровне */
    lvl.querySelector(".seg").classList.add("lvl-seg");
    lvlDesc = el("p", "lvl-desc");
    lvl.appendChild(lvlDesc);
    pop.appendChild(lvl);
    /* версия 45: объем теории и система во всех меню, в том числе на страницах без этих
       блоков: настройки общие для сайта, выбор действует на всех страницах */
    pop.appendChild(segment("Теория", "theory", THEORY_OPTS, theoryDefault()));
    pop.appendChild(segment("Система", "os", OS_OPTS, detectOs()));
    var pr = el("div", "tb-row");
    pr.appendChild(el("span", "tb-label", "Прогресс"));
    var links = el("div", "tb-prog-ic");
    [["dl", "Сохранить прогресс в файл", exportProgress, ""], ["ul", "Загрузить прогресс из файла", importProgress, ""],
     ["trash", "Начать заново: сбросить прогресс и настройки", resetAll, " tb-danger"]].forEach(function (x) {
      var b = el("button", "tb-icon tip" + x[3]);
      b.type = "button";
      b.innerHTML = SVG[x[0]];
      tip(b, x[1]);
      b.addEventListener("click", function () { close(); x[2](); });
      links.appendChild(b);
    });
    pr.appendChild(links);
    pop.appendChild(pr);
    pop.appendChild(el("p", "tb-pop-note",
      "Отметки и код хранятся только в этом браузере. Чтобы продолжить на другом компьютере, сохраните файл и загрузите его там. Зачет ставит преподаватель на сдаче практики."));
    function close() { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      btn.setAttribute("aria-expanded", String(!pop.hidden));
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

  /* ---------- версия 58: уровень в панели ----------
     Значок из трех столбиков (число закрашенных = уровень, цвет уровня), зеленая точка, пока уровень
     не выбран. По нажатию снизу открывается окно выбора с пояснением и сбросом. */
  var TRACK_NAME = { basic: "Базовый", medium: "Средний", advanced: "Продвинутый" };
  var TRACK_DESC = { basic: "повторить разобранное в примере", medium: "применить самостоятельно",
    advanced: "задачи с неочевидным шагом" };
  var levelBtn = null, levelDlg = null, lvlDesc = null;
  function lvIcon(v) { var s = el("span", "lv-ic"); s.setAttribute("data-v", v || "none"); s.setAttribute("aria-hidden", "true"); return s; }
  function levelDialog() {
    var d = el("dialog", "lvl-dlg");
    var sh = el("div", "lvl-sheet");
    sh.setAttribute("role", "radiogroup");
    sh.setAttribute("aria-labelledby", "lvl-h");
    sh.appendChild(el("div", "grab"));
    var h = el("h3", "", "Ваш уровень"); h.id = "lvl-h"; sh.appendChild(h);
    sh.appendChild(el("p", "lvl-note", "Уровень вы выбираете один раз за семестр вместе с преподавателем. Здесь он задает, " +
      "какие варианты упражнений открываются первыми и что считается в прогрессе. Остальные варианты остаются доступны."));
    ["basic", "medium", "advanced"].forEach(function (k) {
      var o = el("button", "lvl-opt");
      o.type = "button";
      o.setAttribute("role", "radio");
      o.setAttribute("data-track", k);
      o.appendChild(lvIcon(k));
      o.appendChild(el("b", "", TRACK_NAME[k]));
      o.appendChild(el("small", "", TRACK_DESC[k]));
      sh.appendChild(o);
    });
    var un = el("button", "lvl-unset mine-reset", "Сбросить выбор уровня"); un.type = "button"; sh.appendChild(un);
    var cl = el("button", "lvl-close", "Закрыть"); cl.type = "button"; sh.appendChild(cl);
    d.appendChild(sh);
    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest(".lvl-close")) d.close(); });
    document.body.appendChild(d);
    return d;
  }
  function levelButton() {
    levelBtn = el("button", "tb-level tip");
    levelBtn.type = "button";
    levelBtn.appendChild(lvIcon(null));
    levelBtn.appendChild(el("span", "lv-badge"));
    levelBtn.addEventListener("click", function () {
      if (!levelDlg) levelDlg = levelDialog();
      if (root.classList.contains("menu-open")) { var mb = document.querySelector(".tb-menu-btn"); if (mb) mb.click(); }
      refreshLevel();
      if (levelDlg.showModal) levelDlg.showModal(); else levelDlg.setAttribute("open", "");
    });
    return levelBtn;
  }
  function refreshLevel() {
    var t = TRACK_NAME[settings.track] ? settings.track : null;
    if (levelBtn) {
      levelBtn.querySelector(".lv-ic").setAttribute("data-v", t || "none");
      levelBtn.classList.toggle("is-unset", !t);
      tip(levelBtn, t ? "Уровень: " + TRACK_NAME[t].toLowerCase() + ". Изменить" : "Выбрать уровень");
    }
    if (levelDlg) {
      Array.prototype.forEach.call(levelDlg.querySelectorAll(".lvl-opt"), function (o) { o.setAttribute("aria-checked", String(o.getAttribute("data-track") === t)); });
      levelDlg.querySelector(".lvl-unset").hidden = !t;
    }
    if (lvlDesc) {
      lvlDesc.textContent = "";
      if (t) { lvlDesc.appendChild(el("b", "", TRACK_NAME[t])); lvlDesc.appendChild(document.createTextNode(": " + TRACK_DESC[t])); }
      else lvlDesc.textContent = "Уровень не выбран";
    }
  }
  /* название уровня в начале строки под вкладками: на телефоне вкладки без подписи (CSS) */
  function levelNames() {
    Array.prototype.forEach.call(document.querySelectorAll(".tab-panel .panel-note"), function (p) {
      if (p.querySelector(".lv-name")) return;
      var m = /-(basic|medium|advanced)$/.exec((p.closest(".tab-panel") || {}).id || "");
      if (m) p.insertBefore(el("span", "lv-name", TRACK_NAME[m[1]] + ". "), p.firstChild);
    });
  }

  function buildTopbar() {
    if (document.querySelector(".topbar")) return;
    var bar = el("header", "topbar");
    bar.setAttribute("aria-label", "Панель практики");
    /* версия 33: на узком экране меню свернуто в кнопку «Содержание»: раньше оно стояло
       над текстом целиком, и заголовок страницы оказывался ниже первого экрана */
    var side = document.querySelector(".sidebar");
    if (side) {
      if (!side.id) side.id = "site-menu";
      var mbtn = el("button", "tb-btn tb-menu-btn");
      mbtn.type = "button";
      mbtn.setAttribute("aria-controls", side.id);
      mbtn.setAttribute("aria-expanded", "false");
      mbtn.appendChild(el("span", "tb-menu-ic"));
      mbtn.appendChild(el("span", "tb-menu-text", "Содержание"));
      mbtn.setAttribute("aria-label", "Содержание");
      var setOpen = function (on) {
        root.classList.toggle("menu-open", on);
        mbtn.setAttribute("aria-expanded", String(on));
      };
      mbtn.addEventListener("click", function () { setOpen(!root.classList.contains("menu-open")); });
      /* переход к разделу или упражнению этой страницы закрывает меню */
      side.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (a) setOpen(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && root.classList.contains("menu-open")) { setOpen(false); mbtn.focus(); }
      });
      bar.appendChild(mbtn);
    }
    /* версия 38: в составе сайта (data-home от build_site.py) ссылка на главную со всеми практиками */
    var home = root.getAttribute("data-home");
    if (home && side && !side.querySelector(".side-home")) {
      var sh = el("a", "side-home", "← Все практики курса");
      sh.href = home;
      side.insertBefore(sh, side.firstChild);
    }
    if (home) {
      /* версия 40: круглая кнопка с домиком; левый край на одной линии с активным пунктом меню */
      var hl = el("a", "tb-icon tip tip-left tb-home");
      hl.href = home;
      hl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 11.5 12 4l9 7.5" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10v9.5h5v-5h3v5h5V10" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
      tip(hl, "Все практики курса");
      bar.appendChild(hl);
    }
    var brand = el("a", "tb-brand");
    brand.href = (document.querySelector('.menu a[href$=".html"]') || { getAttribute: function () { return "#"; } }).getAttribute("href");
    var title = document.querySelector(".sidebar-title");
    brand.textContent = title ? title.textContent.replace(/\s+/g, " ").trim() : "Python";
    bar.appendChild(brand);

    var prog = el("div", "tb-progress");
    prog.appendChild(el("span", "tb-progress-label", "Практика"));
    var track = el("span", "tb-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    progFill = el("span", "tb-fill");
    track.appendChild(progFill);
    prog.appendChild(track);
    var txt = el("span", "tb-progress-text");
    progText = el("b", "");
    progSub = el("span", "tb-progress-sub");
    txt.appendChild(progText);
    txt.appendChild(progSub);
    prog.appendChild(txt);
    bar.appendChild(prog);

    var game = el("div", "tb-game");     /* заполняет game.js */
    bar.appendChild(game);
    bar.appendChild(el("div", "tb-spacer"));
    bar.appendChild(levelButton());

    themeBtn = el("button", "tb-icon tip");
    themeBtn.type = "button";
    themeBtn.addEventListener("click", function () {
      var order = ["light", "dark", "system"], i = order.indexOf(currentTheme());
      settings.theme = order[(i + 1) % order.length];
      changed();
    });
    bar.appendChild(themeBtn);
    soundBtn = el("button", "tb-icon tip tb-sound");
    soundBtn.type = "button";
    soundBtn.addEventListener("click", function () { settings.sound = !settings.sound; changed(); });
    bar.appendChild(soundBtn);
    /* версия 58: «Начать заново» в меню ⚙, раздел «Прогресс» (то же окно с резервной копией) */
    bar.appendChild(gearMenu());

    document.body.insertBefore(bar, document.body.firstChild);
    root.classList.add("has-topbar");
    refresh();
  }

  /* ссылки на соседние страницы передают режим (для файлов с диска) */
  function isLocalPage(a) {
    var h = a.getAttribute("href") || "";
    return /^[\w.\-\/]+\.html(#.*)?$/.test(h) && h.indexOf("//") < 0;
  }
  function carrySettings(e) {
    var a = e.target;
    while (a && a.tagName !== "A") a = a.parentNode;
    if (!a || !isLocalPage(a) || forced) return;
    var h = a.getAttribute("href"), hash = "", i = h.indexOf("#");
    if (i >= 0) { hash = h.slice(i); h = h.slice(0, i); }
    a.setAttribute("href", h + "?theme=" + currentTheme() + "&profile=" + (settings.profile === "game" ? "game" : "classic") +
      "&sound=" + (settings.sound ? "on" : "off") + (settings.track ? "&track=" + settings.track : "") +
      (settings.theory ? "&theory=" + settings.theory : "") + (settings.os ? "&os=" + settings.os : "") + hash);
    window.setTimeout(function () { a.setAttribute("href", h + hash); }, 0);
  }
  function resync() {
    if (forced) return;
    var fresh = read(KEY);
    if (JSON.stringify(fresh) === JSON.stringify(settings)) { refreshProgress(); return; }
    settings = fresh;
    apply(settings);
    fire(root, "practice:settings", settings);
    refresh();
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) resync(); });
  window.addEventListener("storage", function (e) { if (e.key === KEY) resync(); else if (e.key === PROGRESS_KEY) refreshProgress(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) resync(); });
  root.addEventListener("practice:progress", refreshProgress);

  /* переключатель систем в окне терминала: div.os-switch с вариантами [data-os] */
  function osSwitches() {
    Array.prototype.forEach.call(document.querySelectorAll(".os-switch"), function (box) {
      if (box.querySelector(".os-bar")) return;
      var bar = el("div", "os-bar");
      var first = box.querySelector("[data-os] .output-label, [data-os] .code-label");
      bar.appendChild(el("span", "os-bar-label", first ? first.textContent.replace(/\s*·.*$/, "") : "Терминал"));
      var seg = el("div", "seg");
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", "Операционная система");
      OS_OPTS.forEach(function (o) {
        var b = el("button", "seg-btn", o[1]);
        b.type = "button";
        b._value = o[0];
        b.addEventListener("click", function () { settings.os = o[0]; changed(); });
        seg.appendChild(b);
      });
      bar.appendChild(seg);
      box.insertBefore(bar, box.firstChild);
      groups.push({ key: "os", seg: seg, def: detectOs(), row: bar });
    });
  }

  function init() {
    siteStub();
    buildTopbar();
    levelNames();
    theorySwitch();
    osSwitches();
    refresh();
    document.addEventListener("click", carrySettings, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", function () { fire(root, "practice:settings", settings); });
  }
})();
