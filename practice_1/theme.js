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

   Версия 65. «Показ» в меню ⚙ (строка «Все материалы | Только задачи», настройка view,
   атрибут data-view у <html>): в режиме задач на странице с упражнениями видны заголовки
   разделов, упражнения и «Сдача работы», под заголовком раздела кнопка «Показать» открывает
   его материал; в боковом меню только список упражнений практики с номерами (из
   data/practice.js). Цветовой профиль (настройки pl и pd: профиль для светлой и для темной
   темы, атрибут data-palette): строка «Цветовой профиль» в меню ⚙ открывает панель с плитками
   профилей текущей темы; в игровом режиме профиль не действует. Таблицу PALETTES и блоки
   style.css собирает scripts/build_palettes.py. «Начать заново» возвращает исходные настройки:
   подробная теория, классический режим, профиль по умолчанию, все материалы.

   Подключается в <head> БЕЗ defer: data-theme и data-profile
   появляются до отрисовки, без вспышки. Настройки хранятся в localStorage;
   ссылки между страницами передают их параметрами адреса (для файлов,
   открытых с диска, у которых раздельное хранилище). */

(function () {
  "use strict";
  var KEY = "practice-html-settings";
  var PROGRESS_KEY = "practice-html-progress";
  var root = document.documentElement;
  /* palettes:begin */
  /* версия 65: цветовые профили (собирает scripts/build_palettes.py, вручную не правится):
     [ключ, название, режим, где встречается, цвета плитки: --c-bg, --c-surface, --c-border, --c-text, --c-text-2, --c-accent, --win-code-bg, --win-code-text, --tok-kw, --tok-builtin, --tok-num, --tok-str, --tok-op, --tok-com] */
  var PALETTES = [["vscode-light", "Light+", "light", "VS Code", ["#F8F8F8", "#FFFFFF", "#E5E5E5", "#1F1F1F", "#4D4D4D", "#005FB8", "#FFFFFF", "#000000", "#AF00DB", "#795E26", "#098658", "#A31515", "#000000", "#008000"]], ["vscode-dark", "Dark+", "dark", "VS Code", ["#1F1F1F", "#252526", "#3C3C3C", "#CCCCCC", "#A6A6A6", "#55A4FF", "#1E1E1E", "#D4D4D4", "#C586C0", "#DCDCAA", "#B5CEA8", "#CE9178", "#D4D4D4", "#6A9955"]], ["intellij", "IntelliJ Light", "light", "PyCharm", ["#F7F8FA", "#FFFFFF", "#EBECF0", "#1E1F22", "#494B57", "#2F66D4", "#FFFFFF", "#080808", "#0033B3", "#000080", "#1750EB", "#067D17", "#080808", "#737373"]], ["darcula", "Darcula", "dark", "PyCharm", ["#1E1F22", "#2B2D30", "#393B40", "#DFE1E5", "#B4B8BF", "#80A8F9", "#2B2B2B", "#A9B7C6", "#CF803E", "#8C8CC8", "#6897BB", "#809972", "#A9B7C6", "#939393"]], ["github-light", "GitHub Light", "light", "github.com, VS Code", ["#F6F8FA", "#FFFFFF", "#D1D9E0", "#1F2328", "#59636E", "#0969DA", "#F6F8FA", "#1F2328", "#CF222E", "#8250DF", "#0550AE", "#0A3069", "#CF222E", "#6B737D"]], ["github-dark", "GitHub Dark", "dark", "github.com, VS Code", ["#0D1117", "#151B23", "#3D444D", "#E6EDF3", "#9198A1", "#4A96F8", "#151B23", "#E6EDF3", "#FF7B72", "#D2A8FF", "#79C0FF", "#A5D6FF", "#FF7B72", "#8B949E"]], ["one-light", "One Light", "light", "Atom, VS Code", ["#FAFAFA", "#FFFFFF", "#DBDBDC", "#383A42", "#5C5F69", "#3767CF", "#FAFAFA", "#383A42", "#A626A4", "#986801", "#986801", "#3F7F3E", "#0178AB", "#707175"]], ["one-dark", "One Dark Pro", "dark", "Atom, VS Code", ["#282C34", "#2C313A", "#3E4451", "#D7DAE0", "#ABB2BF", "#74B9F1", "#21252B", "#ABB2BF", "#C678DD", "#E5C07B", "#D19A66", "#98C379", "#56B6C2", "#878B95"]], ["latte", "Catppuccin Latte", "light", "VS Code, JetBrains", ["#EFF1F5", "#FFFFFF", "#CCD0DA", "#4C4F69", "#5C5F77", "#8839EF", "#E6E9EF", "#4C4F69", "#8437E8", "#1B5DDF", "#B24608", "#2F751F", "#036F99", "#666879"]], ["mocha", "Catppuccin Mocha", "dark", "VS Code, JetBrains", ["#1E1E2E", "#313244", "#45475A", "#CDD6F4", "#BAC2DE", "#CDA9F7", "#181825", "#CDD6F4", "#CBA6F7", "#89B4FA", "#FAB387", "#A6E3A1", "#89DCEB", "#9399B2"]], ["dracula", "Dracula", "dark", "почти все редакторы", ["#282A36", "#343746", "#44475A", "#F8F8F2", "#C9CBD9", "#CDADFA", "#21222C", "#F8F8F2", "#FF79C6", "#8BE9FD", "#BD93F9", "#F1FA8C", "#FF79C6", "#7E8BB4"]], ["monokai", "Monokai", "dark", "Sublime Text, VS Code", ["#272822", "#32332C", "#49483E", "#F8F8F2", "#CFCFC2", "#A6E22E", "#1E1F1C", "#F8F8F2", "#F9337A", "#66D9EF", "#AE81FF", "#E6DB74", "#F9337A", "#8A8676"]], ["nord", "Nord", "dark", "почти все редакторы", ["#2E3440", "#3B4252", "#4C566A", "#ECEFF4", "#D8DEE9", "#A8D1DD", "#242933", "#D8DEE9", "#81A1C1", "#88C0D0", "#B48EAD", "#A3BE8C", "#81A1C1", "#8791A5"]], ["material-lighter", "Material Lighter", "light", "VS Code, JetBrains", ["#FAFAFA", "#FFFFFF", "#E0E0E0", "#37474F", "#546E7A", "#007782", "#F5F5F5", "#37474F", "#784BF7", "#526E9C", "#B45034", "#5D7639", "#28797F", "#606E75"]], ["material-darker", "Material Darker", "dark", "VS Code, JetBrains", ["#212121", "#292929", "#424242", "#EEFFFF", "#B0BEC5", "#80CBC4", "#1A1A1A", "#EEFFFF", "#C792EA", "#82AAFF", "#F78C6C", "#C3E88D", "#89DDFF", "#828282"]], ["light-owl", "Light Owl", "light", "VS Code", ["#FBFBFB", "#FFFFFF", "#D9D9D9", "#403F53", "#5F5E75", "#1F7871", "#F6F6F6", "#403F53", "#994CC3", "#426BC3", "#AA0982", "#AB5856", "#0A7B7F", "#6A6F7C"]], ["night-owl", "Night Owl", "dark", "VS Code", ["#011627", "#0B2942", "#1D3B53", "#D6DEEB", "#A7B6C7", "#7FDBCA", "#01111D", "#D6DEEB", "#C792EA", "#82AAFF", "#F78C6C", "#ECC48D", "#7FDBCA", "#6C7F7F"]], ["tokyo-day", "Tokyo Night Day", "light", "VS Code, Neovim", ["#E1E2E7", "#F2F2F5", "#C4C8DA", "#3760BF", "#4C5A8A", "#2564BA", "#E9E9ED", "#3760BF", "#8147CD", "#2666BF", "#A15400", "#557137", "#006A83", "#606684"]], ["tokyo-night", "Tokyo Night", "dark", "VS Code, Neovim", ["#1A1B26", "#24283B", "#292E42", "#C0CAF5", "#A9B1D6", "#82A8F7", "#16161E", "#C0CAF5", "#BB9AF7", "#7AA2F7", "#FF9E64", "#9ECE6A", "#89DDFF", "#7981A2"]], ["ayu-light", "Ayu Light", "light", "VS Code, Sublime Text", ["#FCFCFC", "#FFFFFF", "#E7EAED", "#5C6166", "#686E73", "#9F5A27", "#F8F9FA", "#5C6166", "#A85E2A", "#946A2D", "#8664A7", "#5E7D00", "#9F6244", "#6F6F71"]], ["ayu-dark", "Ayu Dark", "dark", "VS Code, Sublime Text", ["#0B0E14", "#131721", "#1E222A", "#BFBDB6", "#A6A49E", "#E6B450", "#0D1017", "#BFBDB6", "#FF8F40", "#FFB454", "#D2A6FF", "#AAD94C", "#F29668", "#757C84"]], ["solarized-light", "Solarized Light", "light", "почти все редакторы", ["#FDF6E3", "#FFFBF0", "#E3DCC6", "#586E75", "#566971", "#1E6FA7", "#F5EFDC", "#586E75", "#657400", "#1E6EA6", "#C03176", "#1F766F", "#657400", "#626C6C"]], ["solarized-dark", "Solarized Dark", "dark", "почти все редакторы", ["#002B36", "#073642", "#0E4A57", "#B0BABA", "#8E9E9F", "#78B7E3", "#00212B", "#93A1A1", "#859900", "#268BD2", "#DA5495", "#2AA198", "#859900", "#76888E"]], ["gruvbox-light", "Gruvbox Light", "light", "Vim, VS Code", ["#FBF1C7", "#F9F5D7", "#D5C4A1", "#3C3836", "#504945", "#076678", "#F2E5BC", "#3C3836", "#9D0006", "#8A5A0F", "#8F3F71", "#6A660C", "#3C7050", "#6F6458"]], ["gruvbox-dark", "Gruvbox Dark", "dark", "Vim, VS Code", ["#282828", "#32302F", "#504945", "#EBDBB2", "#D5C4A1", "#FABD2F", "#1D2021", "#EBDBB2", "#FB4934", "#FABD2F", "#D3869B", "#B8BB26", "#8EC07C", "#958778"]], ["rose-pine-dawn", "Rosé Pine Dawn", "light", "VS Code, Neovim", ["#FAF4ED", "#FFFAF3", "#DFDAD9", "#575279", "#68647E", "#746188", "#F2E9E1", "#575279", "#286983", "#905754", "#8F6020", "#8F6020", "#6A6781", "#6A6774"]], ["rose-pine", "Rosé Pine", "dark", "VS Code, Neovim", ["#191724", "#26233A", "#403D52", "#E0DEF4", "#A9A5C4", "#C4A7E7", "#1F1D2E", "#E0DEF4", "#568DA3", "#EBBCBA", "#F6C177", "#F6C177", "#908CAA", "#88859C"]], ["everforest-light", "Everforest Light", "light", "Vim, VS Code", ["#FDF6E3", "#FFFBEF", "#E0DCC7", "#5C6A72", "#5F6B65", "#616F01", "#F4F0D9", "#5C6A72", "#BC413E", "#637101", "#A34D88", "#8F6600", "#A45419", "#676F66"]], ["everforest-dark", "Everforest Dark", "dark", "Vim, VS Code", ["#2D353B", "#343F44", "#475258", "#D6C9AF", "#A8B3A9", "#B9CD9B", "#232A2E", "#D3C6AA", "#E67E80", "#A7C080", "#D699B6", "#DBBC7F", "#E69875", "#89958D"]], ["noctis-lux", "Noctis Lux", "light", "VS Code", ["#FEF8EC", "#FFFCF5", "#E9DCC0", "#005661", "#2F6B73", "#007482", "#F9F1E1", "#005661", "#BA406B", "#007A8A", "#5842FF", "#007D49", "#CA3900", "#5E6F6F"]], ["noctis", "Noctis", "dark", "VS Code", ["#052529", "#0A3237", "#16474D", "#B2CACD", "#91ACB0", "#40D4E7", "#041D20", "#B2CACD", "#DF769B", "#16A3B6", "#8173ED", "#49E9A6", "#E66533", "#60898E"]], ["kanagawa-lotus", "Kanagawa Lotus", "light", "Neovim, VS Code", ["#F2ECBC", "#F8F3D0", "#D5CEA3", "#545464", "#5D5C70", "#486392", "#E5DDB0", "#545464", "#624C83", "#46608D", "#8D4860", "#516439", "#6F5E3F", "#61605A"]], ["kanagawa", "Kanagawa Wave", "dark", "Neovim, VS Code", ["#1F1F28", "#2A2A37", "#363646", "#DCD7BA", "#C8C093", "#8DA8DD", "#16161D", "#DCD7BA", "#957FB8", "#7E9CD8", "#D27E99", "#98BB6C", "#C0A36E", "#83827B"]], ["xcode-light", "Xcode Light", "light", "Xcode", ["#FFFFFF", "#FFFFFF", "#E0E0E0", "#262626", "#545454", "#0064E1", "#FFFFFF", "#262626", "#9B2393", "#326D74", "#1C00CF", "#C41A16", "#262626", "#5D6C79"]], ["xcode-dark", "Xcode Dark", "dark", "Xcode", ["#1F1F24", "#292A30", "#3A3A40", "#DFDFE0", "#A3A3A8", "#54AAFF", "#1F1F24", "#DFDFE0", "#FF7AB2", "#67B7A4", "#D9C97C", "#FF8170", "#DFDFE0", "#7F8C98"]], ["palenight", "Palenight", "dark", "VS Code", ["#292D3E", "#34324A", "#3A3F58", "#C3C9E9", "#A6ACCD", "#D1A6EE", "#232637", "#A6ACCD", "#C792EA", "#82AAFF", "#F78C6C", "#C3E88D", "#89DDFF", "#878CAB"]], ["cobalt2", "Cobalt2", "dark", "VS Code", ["#193549", "#1F4662", "#255A80", "#FFFFFF", "#C2D4E2", "#FFC600", "#122738", "#FFFFFF", "#FF9D00", "#FFC600", "#FF628C", "#3AD900", "#FF9D00", "#088CFF"]], ["shades-of-purple", "Shades of Purple", "dark", "VS Code", ["#2D2B55", "#393665", "#4A4785", "#FFFFFF", "#C6BEF5", "#FAD000", "#1E1E3F", "#FFFFFF", "#FF9D00", "#FAD000", "#FF628C", "#A5FF90", "#FF9D00", "#B362FF"]], ["synthwave", "SynthWave '84", "dark", "VS Code", ["#262335", "#34294F", "#495495", "#F0EFF5", "#C4BFD4", "#FF86DD", "#241B2F", "#F0EFF5", "#FEDE5D", "#36F9F6", "#F97E72", "#FF8B39", "#FEDE5D", "#848BBD"]], ["andromeda", "Andromeda", "dark", "VS Code", ["#23262E", "#2B2F38", "#3B3F4A", "#D5CED9", "#B6B0BB", "#00E8C6", "#1B1D23", "#D5CED9", "#C74DED", "#FFE66D", "#F39C12", "#96E072", "#EE5D43", "#A0A1A7"]]];
  /* palettes:end */

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
  /* версия 65: цветовой профиль для текущей темы; в игровом режиме не действует */
  function modeOf(s) {
    if (s.theme === "light" || s.theme === "dark") return s.theme;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function paletteInfo(k) { for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i][0] === k) return PALETTES[i]; return null; }
  function paletteOf(s) {
    if (s.profile === "game") return null;
    var m = modeOf(s), k = m === "dark" ? s.pd : s.pl, p = paletteInfo(k);
    return p && p[2] === m ? k : null;
  }
  function apply(s) {
    root.classList.add("theme-switching");
    if (s.theme === "light" || s.theme === "dark") root.setAttribute("data-theme", s.theme);
    else root.removeAttribute("data-theme");
    root.setAttribute("data-profile", s.profile === "game" ? "game" : "classic");
    root.setAttribute("data-sound", s.sound ? "on" : "off");
    if (s.track) root.setAttribute("data-track", s.track); else root.removeAttribute("data-track");
    root.setAttribute("data-theory", theoryOf(s));
    root.setAttribute("data-os", osOf(s));
    if (s.view === "tasks") root.setAttribute("data-view", "tasks"); else root.removeAttribute("data-view");
    var pk = paletteOf(s);
    if (pk) root.setAttribute("data-palette", pk); else root.removeAttribute("data-palette");
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
    q.replace(/[?&](theme|profile|sound|track|theory|os|view|pl|pd)=([^&]*)/g, function (_, k, v) {
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
  function refresh() { refreshGroups(); refreshThemeBtn(); refreshSound(); refreshProgress(); refreshTrack(); refreshLevel(); refreshPalette(); refreshExNav(); }

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
       "объем теории (подробно), цветовой профиль (по умолчанию), показ (все материалы), система для терминала (по вашему компьютеру)."]].forEach(function (it) {
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
        /* версия 65: исходные настройки явно; объем теории подробно, даже если у страницы вариант по умолчанию «кратко» */
        write(KEY, { theory: "full" });
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

  /* ---------- версия 65: цветовой профиль ---------- */
  var palBtn = null, palNote = null, palPanel = null, palPop = null;
  var SNIP = [[["n", 7], [" = ", 12], ["3", 10], ["  "], ["# копии", 13]], [["if", 8], [" n ", 7], [">", 12], [" "], ["2", 10], [":", 7]],
    [["    "], ["print", 9], ["(", 7], ['"да"', 11], [")", 7]]];
  /* цвета плитки «По умолчанию»: те же, что у сайта без профиля (в порядке PALETTES[..][4]) */
  var SITE_PREVIEW = { light: ["#FAF7F2", "#FFFFFF", "#E5DFD6", "#2C2A28", "#5F5952", "#257A48", "#282C34", "#ABB2BF", "#C678DD", "#E5C07B", "#D19A66", "#98C379", "#56B6C2", "#7F848E"],
    dark: ["#161513", "#211F1C", "#3A3631", "#ECE7DF", "#BDB5AA", "#52C98F", "#1C1F25", "#ABB2BF", "#C678DD", "#E5C07B", "#D19A66", "#98C379", "#56B6C2", "#7F848E"] };
  function paletteKey() { var m = modeOf(settings); return (m === "dark" ? settings.pd : settings.pl) || "default"; }
  function palColors(k) { var p = paletteInfo(k); return p ? p[4] : SITE_PREVIEW[modeOf(settings)]; }
  function palName(k) { var p = paletteInfo(k); return p ? p[1] : "По умолчанию"; }
  function swatch(k) {
    var c = palColors(k), s = el("span", "pal-sw");
    s.style.background = c[0]; s.style.boxShadow = "inset 0 0 0 1px " + c[2];
    [c[5], c[6], c[8], c[11]].forEach(function (x) { var i = el("i"); i.style.background = x; s.appendChild(i); });
    return s;
  }
  function preview(k) {
    var c = palColors(k), box = el("span", "pal-mini");
    box.style.background = c[0]; box.style.borderColor = c[2];
    var bar = el("span", "pal-mini-bar"); bar.style.background = c[1]; bar.style.borderColor = c[2];
    var dot = el("i"); dot.style.background = c[5]; bar.appendChild(dot); box.appendChild(bar);
    var l1 = el("span", "pal-mini-line"); l1.style.background = c[3]; box.appendChild(l1);
    var l2 = el("span", "pal-mini-line short"); l2.style.background = c[4]; box.appendChild(l2);
    var pre = el("pre"); pre.style.background = c[6];
    SNIP.forEach(function (line, i) {
      line.forEach(function (p) { var sp = el("span", "", p[0]); sp.style.color = p[1] ? c[p[1]] : c[7]; if (p[1] === 13) sp.style.fontStyle = "italic"; pre.appendChild(sp); });
      if (i < SNIP.length - 1) pre.appendChild(document.createTextNode("\n"));
    });
    box.appendChild(pre);
    return box;
  }
  function paletteRow(pop) {
    palPop = pop;
    var row = el("div", "tb-row pal-row");
    row.appendChild(el("span", "tb-label", "Цветовой профиль"));
    var box = el("div", "pal-ctl");
    palBtn = el("button", "pal-open"); palBtn.type = "button";
    palBtn.addEventListener("click", function (e) { e.stopPropagation(); openPalettes(); });
    box.appendChild(palBtn);
    palNote = el("p", "pal-note", "В игровом режиме своя палитра: профиль не меняется.");
    box.appendChild(palNote);
    row.appendChild(box);
    return row;
  }
  function refreshPalette() {
    if (!palBtn) return;
    var k = paletteKey(), game = settings.profile === "game";
    palBtn.innerHTML = "";
    palBtn.appendChild(swatch(k));
    palBtn.appendChild(el("span", "pal-name", palName(k)));
    palBtn.appendChild(el("span", "pal-chev", "›"));
    palBtn.disabled = game;
    palNote.hidden = !game;
    if (game) closePalettes();
    if (palPanel) renderPalettes();
  }
  function closePalettes() {
    if (!palPanel) return;
    palPanel.parentNode.removeChild(palPanel); palPanel = null;
    palPop.classList.remove("pal-sub");
  }
  function openPalettes() {
    if (palPanel || settings.profile === "game") return;
    palPanel = el("div", "pal-panel");
    palPop.appendChild(palPanel);
    palPop.classList.add("pal-sub");
    renderPalettes();
    var first = palPanel.querySelector(".pal-tile[aria-pressed=\"true\"]") || palPanel.querySelector(".pal-back");
    if (first) first.focus();
  }
  function renderPalettes() {
    var m = modeOf(settings), cur = paletteKey();
    var keys = ["default"].concat(PALETTES.filter(function (p) { return p[2] === m; }).map(function (p) { return p[0]; }));
    palPanel.innerHTML = "";
    var head = el("div", "pal-head");
    var back = el("button", "pal-back", "‹ Настройки"); back.type = "button";
    back.addEventListener("click", function (e) { e.stopPropagation(); closePalettes(); });
    head.appendChild(back);
    var t = el("span", "pal-title", "Цветовой профиль");
    t.appendChild(el("small", "", (m === "dark" ? "темная тема" : "светлая тема") + " · " + keys.length));
    head.appendChild(t);
    palPanel.appendChild(head);
    var grid = el("div", "pal-tiles");
    keys.forEach(function (k) {
      var p = paletteInfo(k), b = el("button", "pal-tile"); b.type = "button";
      b.setAttribute("aria-pressed", String(k === cur));
      b.appendChild(preview(k));
      b.appendChild(el("span", "pal-tile-name", palName(k)));
      b.appendChild(el("small", "", p ? p[3] : "цвета сайта"));
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        settings[m === "dark" ? "pd" : "pl"] = k === "default" ? undefined : k;
        if (k === "default") delete settings[m === "dark" ? "pd" : "pl"];
        changed();
      });
      grid.appendChild(b);
    });
    palPanel.appendChild(grid);
    palPanel.appendChild(el("p", "pal-hint", m === "dark"
      ? "Показаны темные профили. Для светлой темы профиль выбирается отдельно: переключите тему кнопкой в панели."
      : "Показаны светлые профили. Для темной темы профиль выбирается отдельно: переключите тему кнопкой в панели."));
  }

  /* ---------- версия 65: режим «Только задачи» ---------- */
  var exNav = null;
  function pageFile() { var p = window.location.pathname; return p.slice(p.lastIndexOf("/") + 1) || "index.html"; }
  function tasksMode() {
    var main = document.querySelector("main");
    if (!main || main.querySelector(".view-banner")) return;
    var hasEx = !!main.querySelector(".task-exercise");
    if (hasEx) main.classList.add("has-exercises");
    var banner = el("div", "view-banner");
    banner.appendChild(el("span", "", hasEx ? "Показаны только упражнения. Теория, примеры и «Практика» скрыты."
      : "На этой странице нет упражнений, поэтому она показана целиком."));
    var all = el("button", "view-all", "Показать все"); all.type = "button";
    all.addEventListener("click", function () { settings.view = "all"; changed(); });
    banner.appendChild(all);
    var goal = main.querySelector(".goal-line");
    if (goal) goal.parentNode.insertBefore(banner, goal);
    else { var hd = main.querySelector(".page-header"); main.insertBefore(banner, hd ? hd.nextSibling : main.firstChild); }
    if (hasEx) Array.prototype.forEach.call(main.querySelectorAll(".subsection"), function (sec) {
      var h2 = sec.querySelector(":scope > h2");
      if (!h2) return;
      var b = el("button", "view-peek"); b.type = "button";
      b.setAttribute("aria-expanded", "false");
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>';
      var txt = el("span", "", "Теория, примеры и «Практика» раздела скрыты"), act = el("b", "", "Показать");
      b.appendChild(txt); b.appendChild(act);
      b.addEventListener("click", function () {
        var on = sec.classList.toggle("view-open");
        b.setAttribute("aria-expanded", String(on));
        txt.textContent = on ? "Теория и примеры раздела открыты" : "Теория, примеры и «Практика» раздела скрыты";
        act.textContent = on ? "Скрыть" : "Показать";
      });
      h2.parentNode.insertBefore(b, h2.nextSibling);
    });
    /* боковое меню: только упражнения практики с номерами */
    var side = document.querySelector(".sidebar"), m = window.PRACTICE_MANIFEST;
    if (!side || !m || !m.pages) return;
    exNav = el("nav", "ex-nav"); exNav.setAttribute("aria-label", "Упражнения практики");
    var ol = el("ol", "ex-list"), groupsEx = [], seen = {};
    m.pages.forEach(function (p) {
      (p.tasks || []).forEach(function (t) {
        var key = p.href + "#" + (t.group || t.file);
        if (!seen[key]) { seen[key] = { page: p.href, id: t.group || t.id, code: "", titles: {}, files: {} }; groupsEx.push(seen[key]); }
        var mm = /^Упражнение\s+(\d+(?:\.\d+)+)\.\s*(.*)$/.exec(t.title || "");
        seen[key].code = mm ? mm[1] : seen[key].code;
        seen[key].titles[t.variant || "basic"] = mm ? mm[2] : t.title;
        seen[key].files[t.variant || "basic"] = t.file;
      });
    });
    var here = pageFile();
    groupsEx.forEach(function (g) {
      var li = el("li"), a = el("a", "ex-item" + (g.page === here ? " is-here" : ""));
      a.href = (g.page === here ? "" : g.page) + "#" + g.id;
      a.appendChild(el("span", "ex-num", g.code));
      a._g = g;
      a.appendChild(el("span", "ex-name"));
      a.appendChild(el("span", "st"));
      li.appendChild(a); ol.appendChild(li);
    });
    exNav.appendChild(ol);
    side.insertBefore(exNav, side.firstChild);
    refreshExNav();
  }
  function refreshExNav() {
    if (!exNav) return;
    var solved = (read(PROGRESS_KEY).tasks || {}), tr = settings.track;
    Array.prototype.forEach.call(exNav.querySelectorAll(".ex-item"), function (a) {
      var g = a._g, v = tr && g.titles[tr] ? tr : "basic";
      a.querySelector(".ex-name").textContent = g.titles[v] || g.titles.basic || "";
      var done = tr ? !!solved[g.files[tr]] : Object.keys(g.files).some(function (k) { return solved[g.files[k]]; });
      a.querySelector(".st").className = "st" + (done ? " st-solved" : "");
      a.title = done ? "Решено" : "Не решено";
    });
    if (settings.view !== "tasks") Array.prototype.forEach.call(document.querySelectorAll(".subsection.view-open"), function (s) {
      s.classList.remove("view-open");
      var b = s.querySelector(".view-peek"); if (b) { b.setAttribute("aria-expanded", "false"); b.lastChild.textContent = "Показать"; b.children[1].textContent = "Теория, примеры и «Практика» раздела скрыты"; }
    });
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
    pop.appendChild(paletteRow(pop));
    pop.appendChild(segment("Показ", "view", [["all", "Все материалы"], ["tasks", "Только задачи"]], "all"));
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
    function close() { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); closePalettes(); }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      btn.setAttribute("aria-expanded", String(!pop.hidden));
    });
    document.addEventListener("click", function (e) { if (document.contains(e.target) && !wrap.contains(e.target)) close(); });
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
      (settings.theory ? "&theory=" + settings.theory : "") + (settings.os ? "&os=" + settings.os : "") +
      (settings.view ? "&view=" + settings.view : "") + (settings.pl ? "&pl=" + settings.pl : "") + (settings.pd ? "&pd=" + settings.pd : "") + hash);
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
  root.addEventListener("practice:progress", function () { refreshProgress(); refreshExNav(); });

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
    tasksMode();
    osSwitches();
    refresh();
    document.addEventListener("click", carrySettings, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", function () { apply(settings); refresh(); fire(root, "practice:settings", settings); });
  }
})();
