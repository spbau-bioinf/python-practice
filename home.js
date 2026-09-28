/* home.js: главная страница сайта курса (версия 36, вариант A с кольцами).
   Подключается в <head> главной без defer: тема и режим ставятся до отрисовки.
   - кнопка темы: светлая, темная, как в системе (те же настройки, что на страницах практик);
   - меню ⚙: режим (классический, игровой);
   - кольцо прогресса у каждой открытой практики: решенные упражнения своего уровня
     (без уровня: упражнения, где решен любой вариант) из манифеста practice_X/data/practice.js
     и прогресса в браузере. Без JavaScript кольца пустые, ссылки работают. */
(function () {
  "use strict";
  var KEY = "practice-html-settings", PROGRESS_KEY = "practice-html-progress";
  var root = document.documentElement;
  function read(k) { try { return JSON.parse(window.localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }
  function write(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } }
  var settings = read(KEY);
  /* версия 38: настройки из адреса (их передают ссылки со страниц практик, это нужно,
     когда страницы открыты с диска и у каждой свое хранилище) */
  (function fromQuery() {
    var q = window.location.search, got = false;
    if (!q) return;
    q.replace(/[?&](theme|profile|sound|track|theory|os)=([^&]*)/g, function (_, k, v) {
      settings[k] = k === "sound" ? v === "on" : decodeURIComponent(v); got = true;
    });
    if (got) {
      write(KEY, settings);
      try { window.history.replaceState(null, "", window.location.pathname + window.location.hash); } catch (e) { /* не мешает */ }
    }
  })();
  function systemDark() { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function theme() { return settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system"; }
  function apply() {
    var t = theme();
    root.setAttribute("data-theme", t === "system" ? (systemDark() ? "dark" : "light") : t);
    root.setAttribute("data-profile", settings.profile === "game" ? "game" : "classic");
    if (settings.track) root.setAttribute("data-track", settings.track); else root.removeAttribute("data-track");
  }
  apply();

  var ICON = { light: "sun", dark: "moon", system: "auto" }, NAME = { light: "светлая", dark: "темная", system: "как в системе" };
  function paintThemeBtn(b) {
    var t = theme(), text = "Тема: " + NAME[t] + ". Нажмите, чтобы переключить";
    b.innerHTML = '<span class="i i-' + ICON[t] + '" aria-hidden="true"></span>'; b.setAttribute("data-tip", text); b.setAttribute("aria-label", text);
  }

  var LEVEL = { basic: "базовый", medium: "средний", advanced: "продвинутый" };
  function ring(card, done, total) {
    var fg = card.querySelector(".home-ring-fg"), txt = card.querySelector(".home-ring-t");
    if (!fg || !txt) return;
    var c = 94.2, part = total ? done / total : 0;
    fg.setAttribute("stroke-dasharray", (c * part).toFixed(1) + " " + c);
    fg.style.opacity = done ? "1" : "0";   /* при нуле скругленный конец линии рисовал точку */
    txt.textContent = done + "/" + total;
    card.classList.toggle("is-done", total > 0 && done === total);
    /* версия 40 (карточка M2): уровень под кольцом, полоса прогресса внизу карточки */
    var lvl = card.querySelector(".home-lvl");
    if (lvl) lvl.textContent = LEVEL[settings.track] ? LEVEL[settings.track] + " уровень" : "уровень не выбран";
    var bar = card.querySelector(".home-progress i");
    if (bar) bar.style.width = (total ? Math.round(100 * done / total) : 0) + "%";
    var ringBox = card.querySelector(".home-ring");
    if (ringBox) ringBox.setAttribute("aria-label", "Решено упражнений: " + done + " из " + total);
  }
  function progressFor(card, m) {
    var p = read(PROGRESS_KEY), solved = p.tasks || {};
    if (!m || !m.graded) return;
    var tr = settings.track, list = (m.graded[tr] || []), total, done;
    if (list.length) {
      total = list.length;
      done = list.filter(function (t) { return solved[t.file]; }).length;
    } else {
      var groups = {};
      Object.keys(m.graded).forEach(function (lv) {
        (m.graded[lv] || []).forEach(function (t) {
          var g = t.page + "#" + t.group;
          groups[g] = groups[g] || solved[t.file] || false;
        });
      });
      total = Object.keys(groups).length;
      done = Object.keys(groups).filter(function (g) { return groups[g]; }).length;
    }
    ring(card, done, total);
  }
  /* манифесты подгружаются по очереди: каждый пишет window.PRACTICE_MANIFEST; копия
     остается у карточки, чтобы пересчитать кольцо при возврате на главную */
  function loadAll(cards, i) {
    if (i >= cards.length) return;
    var card = cards[i], s = document.createElement("script");
    s.src = card.getAttribute("data-manifest");
    s.onload = function () { card._manifest = window.PRACTICE_MANIFEST; progressFor(card, card._manifest); window.PRACTICE_MANIFEST = null; loadAll(cards, i + 1); };
    s.onerror = function () { loadAll(cards, i + 1); };
    document.head.appendChild(s);
  }

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "_" + p(d.getHours()) + "-" + p(d.getMinutes());
  }
  function exportProgress() {                         /* тот же формат, что в theme.js */
    var data = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("practice-html") === 0) data[k] = localStorage.getItem(k); }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: "practice-html-progress", saved: new Date().toISOString(), data: data }, null, 1)], { type: "application/json" }));
    a.download = "progress_python_" + stamp() + ".json"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function resetAll() {
    var d = mk("dialog", "rs-dlg");
    var x = mk("button", "tb-icon rs-x"); x.type = "button"; x.setAttribute("aria-label", "Закрыть");
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
    x.onclick = function () { d.close(); }; d.appendChild(x);
    d.appendChild(mk("h3", "", "Начать заново?"));
    d.appendChild(mk("p", "", "Будут сброшены все данные сайта в этом браузере:"));
    var ul = mk("ul");
    [["решенные упражнения и прогресс", ": отметки, кольца на главной, опыт и значки игрового режима;"], ["код", " в полях проверки и в примерах;"],
     ["настройки", ": тема (как в системе), режим (классический), звук (выключен), уровень (не выбран), объем теории (подробно), система для терминала (по вашему компьютеру)."]
    ].forEach(function (it) { var li = mk("li"); li.appendChild(mk("b", "", it[0])); li.appendChild(document.createTextNode(it[1])); ul.appendChild(li); });
    d.appendChild(ul);
    d.appendChild(mk("p", "rs-warn", "Отменить сброс нельзя. Перед сбросом файл с прогрессом и настройками скачается сам, если вы не сохранили его кнопкой ниже: его можно загрузить обратно через ⚙ → «Прогресс» → «Загрузить» на странице практики."));
    var acts = mk("div", "rs-acts"), saved = false;
    var sb = mk("button", "tb-btn rs-save", "Сохранить прогресс в файл"); sb.type = "button";
    sb.onclick = function () { exportProgress(); saved = true; sb.textContent = "Файл сохранен"; };
    acts.appendChild(sb); acts.appendChild(mk("span", "rs-flex"));
    var yes = mk("button", "tb-btn rs-yes", "Сбросить все"); yes.type = "button";
    yes.onclick = function () {
      yes.disabled = true; if (!saved) exportProgress();
      setTimeout(function () {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("practice-html") === 0 && k.indexOf("practice-html-teacher") !== 0) keys.push(k); }
        keys.forEach(function (k) { localStorage.removeItem(k); });
        location.replace(location.pathname);
      }, 700);
    };
    acts.appendChild(yes);
    var no = mk("button", "tb-btn", "Отмена"); no.type = "button"; no.onclick = function () { d.close(); }; acts.appendChild(no);
    d.appendChild(acts);
    d.addEventListener("close", function () { d.remove(); });
    document.body.appendChild(d); d.showModal();
  }

  function init() {
    var tb = document.querySelector(".home-theme");
    if (tb) {
      paintThemeBtn(tb);
      tb.addEventListener("click", function () {
        var order = ["light", "dark", "system"];
        settings.theme = order[(order.indexOf(theme()) + 1) % order.length];
        write(KEY, settings); apply(); paintThemeBtn(tb);
      });
    }
    /* версия 54: «Начать заново» и на главной: то же окно, что на страницах практики */
    var rb = document.querySelector(".home-reset");
    if (rb) rb.addEventListener("click", resetAll);
    var gear = document.querySelector(".home-gear"), pop = document.querySelector(".home-pop");
    if (gear && pop) {
      gear.addEventListener("click", function () {
        var open = pop.hidden;
        pop.hidden = !open; gear.setAttribute("aria-expanded", String(open));
      });
      /* версия 38: меню закрывается щелчком вне него и клавишей Esc */
      document.addEventListener("click", function (e) {
        if (pop.hidden || pop.contains(e.target) || gear.contains(e.target)) return;
        pop.hidden = true; gear.setAttribute("aria-expanded", "false");
      });
      Array.prototype.forEach.call(pop.querySelectorAll("[data-profile-set]"), function (b) {
        b.setAttribute("aria-pressed", String((settings.profile || "classic") === b.getAttribute("data-profile-set")));
        b.addEventListener("click", function () {
          settings.profile = b.getAttribute("data-profile-set"); write(KEY, settings); apply();
          Array.prototype.forEach.call(pop.querySelectorAll("[data-profile-set]"), function (x) {
            x.setAttribute("aria-pressed", String(x === b));
          });
        });
      });
      /* версия 45: объем теории и система на главной; без выбора: теория как у страниц
         по умолчанию («Подробно»), система по браузеру */
      function detectOs() {
        var p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "").toLowerCase();
        return p.indexOf("win") >= 0 ? "win" : (p.indexOf("mac") >= 0 || p.indexOf("iphone") >= 0 || p.indexOf("ipad") >= 0) ? "mac" : "linux";
      }
      function paintSets() {
        Array.prototype.forEach.call(pop.querySelectorAll("[data-set]"), function (b) {
          var k = b.getAttribute("data-set"), cur = k === "track" ? settings.track :
            settings[k] || (k === "theory" ? "full" : detectOs());
          b.setAttribute("aria-pressed", String(cur === b.getAttribute("data-val")));
        });
      }
      Array.prototype.forEach.call(pop.querySelectorAll("[data-set]"), function (b) {
        b.addEventListener("click", function () {
          settings[b.getAttribute("data-set")] = b.getAttribute("data-val"); write(KEY, settings); paintSets();
          if (b.getAttribute("data-set") === "track") { apply(); resync(); }
        });
      });
      paintSets();
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { pop.hidden = true; gear.focus(); } });
    }
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var h = function () { if (theme() === "system") apply(); };
      if (mq.addEventListener) mq.addEventListener("change", h); else if (mq.addListener) mq.addListener(h);
    }
    var cards = Array.prototype.slice.call(document.querySelectorAll(".home-card[data-manifest]"));
    loadAll(cards, 0);
    /* версия 38: вернулись со страницы практики (кнопка «Назад», другая вкладка): уровень
       и прогресс перечитываются, кольца пересчитываются */
    function resync() {
      settings = read(KEY); apply();
      if (tb) paintThemeBtn(tb);
      cards.forEach(function (c) { if (c._manifest) progressFor(c, c._manifest); });
    }
    window.addEventListener("pageshow", function (e) { if (e.persisted) resync(); });
    window.addEventListener("storage", function (e) { if (e.key === KEY || e.key === PROGRESS_KEY) resync(); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) resync(); });
    /* настройки уходят в ссылку на практику, как между страницами практики */
    cards.forEach(function (card) {
      var a = card.querySelector(".home-card-link");
      if (!a) return;
      a.addEventListener("click", function () {
        var h = a.getAttribute("href"), t = theme();
        a.setAttribute("href", h + "?theme=" + t + "&profile=" + (settings.profile === "game" ? "game" : "classic") +
          (settings.track ? "&track=" + settings.track : "") + (settings.theory ? "&theory=" + settings.theory : "") +
          (settings.os ? "&os=" + settings.os : ""));
        window.setTimeout(function () { a.setAttribute("href", h); }, 0);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
