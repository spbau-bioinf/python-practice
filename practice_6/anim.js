/* anim.js (Skill practice-python-html, версия 116): пошаговые сцены в теории.
   Блок оформлен как пример: заголовок и переключатель «Разбор: Сразу | По шагам» (как setupStepper в checker.js).
   «Сразу» (открыт первым): окно кода с выводом в комментариях # → и окно «Вывод»; вывод берется из шагов сцены.
   «По шагам» (строится при первом открытии) — один столбец: текст шага, кнопки, код во всю ширину,
   «Состояние» (картинка сцены), «Вывод». Высоты текста, состояния и вывода равны самым большим по всем шагам:
   при листании кнопки и блоки не скачут. Имя файла и код копируются (window.PracticeSteps из checker.js).
   anim.js подключается с defer ДО checker.js: окно кода «Сразу» должно существовать, когда checker.js
   добавляет кнопки копирования, правки и запуска.
   Разметка страницы: <figure class="anim" data-anim="tX_YY_sN"> с figcaption.anim-title (название без слова
   «Анимация») и p.anim-lede; сцены лежат в data/tX_YY_anim.js: (window.ANIM_SCENES ||= []).push(A => { A.reg("tX_YY_sN", {...}) }).
   Сцена: file, code (строки), init() → состояние, view(st) → HTML, steps [{line, title, text, caption, act(st)}], note.
   Состояние шага n собирается заново: init(), затем act шагов 1..n; st.out — строки вывода,
   st.mark — подсветка текущего шага. Кнопки «Дальше», «Назад», «Авто», «Сначала», стрелки влево и вправо. */
(function () {
  "use strict";
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  class Py { constructor(s) { this.s = s; } toString() { return this.s; } }
  function pyRepr(v) { return v instanceof Py ? v.s : typeof v === "string" ? "'" + v + "'" : String(v); }
  function dictRepr(pairs) { return "{" + pairs.map(p => pyRepr(p.k) + ": " + pyRepr(p.v)).join(", ") + "}"; }
  function dictView(name, pairs, mark, extra) {
    const cards = pairs.map(p => `<span class="an-pair ${(mark && mark[p.k]) || ""}"><span class="an-pk">${esc(pyRepr(p.k))}</span><span class="an-colon">:</span><span class="an-pv">${esc(pyRepr(p.v))}</span></span>`).join('<span class="an-comma">,</span>');
    return `<div class="an-dict"><span class="an-brace">${esc(name)} = {</span>${cards || '<span class="an-empty">пусто</span>'}<span class="an-brace">}</span></div>${extra || ""}`;
  }
  function setPair(pairs, k, v) { const p = pairs.find(x => x.k === k); if (p) { p.v = v; return "changed"; } pairs.push({ k, v }); return "new"; }
  function delPair(pairs, k) { const i = pairs.findIndex(x => x.k === k); if (i >= 0) pairs.splice(i, 1); }
  function cells(n, html) { return `<div class="an-cells" data-n="${n}">${html}</div>`; }

  /* подсветка Python: те же правила и классы tok-*, что pyHighlight в checker.js */
  const KW = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "));
  const BI = new Set("abs all any bool dict divmod enumerate filter float frozenset hash input int isinstance len list map max min print range reversed round set sorted str sum tuple type zip".split(" "));
  const TOK = new RegExp('"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|#[^\\n]*|\\b[A-Za-z_]\\w*\\b|\\b\\d[\\d_]*(?:\\.[\\d_]+)?\\b|[+\\-*/%=<>!&|^~]+', "g");
  function hl(code) {
    let out = "", last = 0, m;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(code))) {
      const t = m[0]; let cls = null;
      if (t[0] === "#") cls = "tok-com";
      else if (t[0] === '"' || t[0] === "'") cls = "tok-str";
      else if (/^\d/.test(t)) cls = "tok-num";
      else if (t === "True" || t === "False" || t === "None") cls = "tok-const";
      else if (KW.has(t)) cls = "tok-kw";
      else if (BI.has(t)) cls = "tok-builtin";
      else if (!/^\w/.test(t)) cls = "tok-op";
      out += esc(code.slice(last, m.index)) + (cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t));
      last = m.index + t.length;
    }
    return out + esc(code.slice(last));
  }

  const scenes = {};
  const A = { esc, Py, pyRepr, dictRepr, dictView, setPair, delPair, cells, reg: (id, cfg) => { scenes[id] = cfg; } };
  const SPEEDS = [[0.5, "0,5×"], [1, "1×"], [2, "2×"]];
  const ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1v10l9-5z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1" width="3" height="10"/><rect x="7.5" y="1" width="3" height="10"/></svg>';

  function mountSteps(fig, cfg) {
    const steps = cfg.steps, last = steps.length - 1;
    const box = document.createElement("div");
    box.className = "stp an-stp";
    box.tabIndex = 0;
    box.setAttribute("aria-label", "Анимация по шагам: стрелки влево и вправо листают шаги");
    box.innerHTML =
      '<div class="an-col"><div class="an-note" aria-live="polite"><p class="an-step-title"></p><p class="an-text"></p></div>' +
      '<div class="st-ctrl"><button type="button" class="st-btn" data-a="back">← Назад</button><button type="button" class="st-btn is-main" data-a="next">Дальше →</button>' +
      '<button type="button" class="st-btn is-play" data-a="auto" aria-pressed="false"></button><div class="seg st-speed" role="group" aria-label="Скорость"></div>' +
      '<button type="button" class="st-btn" data-a="reset">Сначала</button><span class="st-count"></span></div>' +
      '<div class="code-block st-code"><span class="code-label"></span><div class="st-lines-wrap"><div class="st-lines"></div></div></div>' +
      '<div class="st-vars an-state"><span class="st-vars-h">Состояние</span><div class="an-view"></div><p class="an-caption" aria-live="polite"></p></div>' +
      '<div class="output-block st-out an-out"><span class="output-label">Вывод</span><pre></pre></div></div>' +
      (cfg.note ? `<p class="an-model-note">${cfg.note}</p>` : "");
    fig.appendChild(box);
    fig.classList.add("is-ready");
    const $ = s => box.querySelector(s);
    $(".code-label").textContent = cfg.file || "program.py";
    if (window.PracticeSteps) window.PracticeSteps.decorate($(".st-code"), fig.querySelector(".an-whole .code-block"));
    const linesEl = $(".st-lines"), noteBox = $(".an-note"), titleEl = $(".an-step-title"), textEl = $(".an-text");
    const stateEl = $(".an-state"), viewEl = $(".an-view"), capEl = $(".an-caption"), outEl = $(".an-out pre");
    const bBack = $('[data-a="back"]'), bNext = $('[data-a="next"]'), bAuto = $('[data-a="auto"]'), bReset = $('[data-a="reset"]');
    const cnt = $(".st-count"), sp = $(".st-speed");
    const codeHtml = cfg.code.map(l => hl(l) || " ");
    let step = 0, timer = null, speed = 1;
    SPEEDS.forEach(([v, label]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "seg-btn"; b.textContent = label; b._v = v;
      b.addEventListener("click", () => { speed = v; if (timer) play(); else draw(step); });
      sp.appendChild(b);
    });
    function stateAt(n) {
      const st = cfg.init();
      st.out = []; st.mark = {};
      for (let i = 1; i <= n; i += 1) { st.mark = {}; if (steps[i].act) steps[i].act(st); }
      return st;
    }
    function paint(n) {
      const st = stateAt(n), cur = steps[n];
      linesEl.innerHTML = codeHtml.map((h, i) => `<span class="st-ln${cur.line === i ? " is-cur" : ""}">${h}</span>`).join("");
      viewEl.innerHTML = cfg.view(st);
      viewEl.querySelectorAll(".an-cells[data-n]").forEach(c => c.style.setProperty("--an-n", c.dataset.n));
      outEl.innerHTML = st.out.map(o => o.err ? `<span class="an-err">${esc(o.t)}</span>` : esc(o.t)).join("\n");
      titleEl.textContent = cur.title;
      textEl.innerHTML = cur.text;
      capEl.innerHTML = cur.caption || "";
      noteBox.classList.toggle("is-final", n === last);
    }
    function draw(n) {
      paint(n);
      bBack.disabled = n === 0; bNext.disabled = n >= last; bReset.disabled = n === 0 && !timer;
      bAuto.innerHTML = timer ? ICON_PAUSE + "Пауза" : ICON_PLAY + (n >= last ? "Еще раз" : "Авто");
      bAuto.setAttribute("aria-pressed", String(!!timer));
      Array.prototype.forEach.call(sp.children, b => b.setAttribute("aria-pressed", String(b._v === speed)));
      cnt.textContent = "Шаг " + (n + 1) + " из " + (last + 1);
    }
    /* высота каждой части — наибольшая по всем шагам; пересчет при смене ширины */
    const parts = [noteBox, stateEl, outEl];
    let fittedWidth = -1;
    function fit() {
      const w = box.clientWidth;
      if (!w || w === fittedWidth) return;
      fittedWidth = w;
      parts.forEach(p => { p.style.minHeight = ""; });
      const max = parts.map(() => 0);
      for (let n = 0; n <= last; n += 1) {
        paint(n);
        parts.forEach((p, i) => { max[i] = Math.max(max[i], Math.ceil(p.getBoundingClientRect().height)); });
      }
      parts.forEach((p, i) => { p.style.minHeight = max[i] + "px"; });
      draw(step);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    box._stop = () => { stop(); draw(step); };
    function play() {
      stop(); if (step >= last) step = 0;
      timer = setInterval(() => { if (step < last) step += 1; if (step >= last) stop(); draw(step); }, Math.round(1800 / speed));
      draw(step);
    }
    bBack.addEventListener("click", () => { stop(); step = Math.max(0, step - 1); draw(step); });
    bNext.addEventListener("click", () => { stop(); step = Math.min(last, step + 1); draw(step); });
    bAuto.addEventListener("click", () => { if (timer) { stop(); draw(step); } else play(); });
    bReset.addEventListener("click", () => { stop(); step = 0; draw(step); });
    box.addEventListener("keydown", e => {
      if (e.target.closest && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); bNext.click(); } else if (e.key === "ArrowLeft") { e.preventDefault(); bBack.click(); }
    });
    draw(0);
    fit();
    if (window.ResizeObserver) new ResizeObserver(() => fit()).observe(box);
    else window.addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fittedWidth = -1; fit(); });
    /* тема, игровой профиль и настройки страницы меняют шрифты и рамки — высоты считаются заново */
    if (window.MutationObserver) new MutationObserver(() => { fittedWidth = -1; requestAnimationFrame(fit); })
      .observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme", "data-profile", "data-theory", "class"]});
  }

  /* «Сразу»: вывод каждого шага приписывается к его строке кода */
  function wholeOutputs(cfg) {
    const steps = cfg.steps, st = cfg.init(), byLine = {}, all = [];
    st.out = []; st.mark = {};
    for (let i = 1; i < steps.length; i += 1) {
      const before = st.out.length; st.mark = {};
      if (steps[i].act) steps[i].act(st);
      const add = st.out.slice(before);
      if (add.length) {
        const ln = steps[i].line;
        byLine[ln] = (byLine[ln] || []).concat(add);
      }
    }
    st.out.forEach(o => all.push(o));
    return {byLine, all};
  }
  function mount(fig, cfg) {
    const cap = fig.querySelector(".anim-title"), lede = fig.querySelector(".anim-lede");
    const head = document.createElement("div"); head.className = "st-head an-head";
    fig.insertBefore(head, cap); head.appendChild(cap);
    const sw = document.createElement("div"); sw.className = "st-switch";
    sw.innerHTML = '<span class="st-switch-label">Разбор</span><div class="seg" role="group" aria-label="Разбор анимации"></div>';
    head.appendChild(sw);
    const {byLine, all} = wholeOutputs(cfg);
    const commented = cfg.code.map((l, i) => byLine[i] ? l.length : 0);
    const col = Math.max(...commented) + 2;
    const lines = cfg.code.map((l, i) => {
      const o = byLine[i];
      if (!o) return `<span class="ln">${hl(l)}</span>`;
      const txt = o.map(x => x.t).join(", ");
      return `<span class="ln">${hl(l)}${" ".repeat(Math.max(1, col - l.length))}<span class="tok-out"># → ${esc(txt)}</span></span>`;
    }).join("\n");
    const outHtml = all.map(o => o.err ? `<span class="an-err">${esc(o.t)}</span>` : esc(o.t)).join("\n");
    const whole = document.createElement("div"); whole.className = "an-whole";
    whole.innerHTML =
      `<div class="run-pair"><div class="code-block"><span class="code-label">${esc(cfg.file || "program.py")}</span><pre><code>${lines}</code></pre></div>` +
      (all.length ? `<div class="output-block"><span class="output-label">Вывод</span><pre>${outHtml}</pre></div>` : "") + `</div>`;
    (lede ? lede.after(whole) : fig.appendChild(whole));
    fig.classList.add("is-ready");
    let box = null;
    const g = sw.querySelector(".seg");
    function setMode(m) {
      Array.prototype.forEach.call(g.children, b => b.setAttribute("aria-pressed", String(b._v === m)));
      whole.hidden = m !== "whole";
      if (m === "steps" && !box) { mountSteps(fig, cfg); box = fig.querySelector(".an-stp"); }
      if (box) { box.hidden = m !== "steps"; if (m !== "steps" && box._stop) box._stop(); }
      fig.dataset.mode = m;
    }
    [["whole", "Сразу"], ["steps", "По шагам"]].forEach(([v, label]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "seg-btn"; b.textContent = label; b._v = v;
      b.addEventListener("click", () => setMode(v)); g.appendChild(b);
    });
    setMode("whole");
  }

  function init() {
    (window.ANIM_SCENES || []).forEach(fn => { try { fn(A); } catch (err) { console.error("anim.js: сцены не загружены", err); } });
    document.querySelectorAll("figure.anim[data-anim]").forEach(fig => {
      const cfg = scenes[fig.dataset.anim];
      if (!cfg) { console.error("anim.js: нет сцены " + fig.dataset.anim); return; }
      if (!fig.querySelector(".an-stp")) mount(fig, cfg);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
