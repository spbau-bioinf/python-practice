/* checker.js: живые примеры и проверка решений на странице практической работы.

   1. ПРОВЕРКА РЕШЕНИЯ. Под задачей стоит блок
        <div class="checker" data-file="t1_06_1_basic.py">
          <p class="checker-fallback">…</p>
          <script type="application/json" class="checker-tests">{…}</script>
        </div>
      Скрипт строит поле для кода, кнопки и область результата.

      Формат JSON:
        {"compare": "exact" | "float",
         "tests": [ТЕСТ, …],            // тесты из таблицы задачи
         "extra": [ТЕСТ, …],            // дополнительные тесты
         "require": [{"re": "import\\s+math", "msg": "…"}],   // необязательно
         "forbid":  [{"re": "==", "msg": "…"}]}               // необязательно
      ТЕСТ:
        {"input": "3\n4\n", "output": "5.0"}                 // данные через input()
        {"set": {"a": "3", "b": "4"}, "output": "5.0"}       // исходные данные в переменных
        необязательные поля: "note" (что проверяет тест),
                             "wrong": [{"output": "29.0", "hint": "…"}] (типичные неверные ответы)
                             "errors": [{"type": "IndexError", "hint": "…"}] (типичные ошибки,
                                        которые падают при выполнении; версия 56)
      Режим "set" нужен, пока input() не изучен: студент пишет исходные данные
      в начале программы (a = 3), проверка подставляет в эти строки свои значения.

   2. ЖИВЫЕ ПРИМЕРЫ. У каждого примера с выводом в заголовке окна кода
      появляется кнопка «Изменить и запустить»: код можно править и запускать,
      кнопка «Сбросить» возвращает исходный код и вывод.
   3. «ПРЕДСКАЖИТЕ ВЫВОД». У .output-block.predict вывод скрыт за кнопкой
      «Показать вывод»; без JavaScript он виден сразу.
   4. ПРОГРЕСС. Решенные задачи отмечаются «✓ решено», в меню у страниц
      появляется счетчик «3/5» или «✓». Данные хранятся в localStorage
      этого браузера и никуда не отправляются.
   5. ШАБЛОН. В режиме set поле проверки заранее содержит строки с исходными
      данными; "template" в JSON задает свой шаблон. Код в поле сохраняется
      в этом браузере и восстанавливается при следующем открытии.
   6. СОБЫТИЯ. Блок .checker отправляет checker:start и checker:result
      (detail: file, passed, total, solved); их слушает game.js.

   Код выполняется настоящим CPython (Pyodide) в отдельном потоке.
   Без JavaScript или интернета страница остается рабочей и статичной. */

(function () {
  "use strict";

  var PYODIDE_VERSION = "0.27.6";
  var INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
  var TIME_LIMIT_MS = 4000;
  var LOAD_LIMIT_MS = 90000;
  var ECHO_START = "\u0001", ECHO_END = "\u0002";

  var HARNESS = [
    "import sys, io, json, ast, tokenize, traceback",
    "",
    "def _prepare(code, setv):",
    "    tree = ast.parse(code, 'solution.py')",
    "    missing = []",
    "    if setv:",
    "        found = set()",
    "        for node in tree.body:",
    "            if (isinstance(node, ast.Assign) and len(node.targets) == 1",
    "                    and isinstance(node.targets[0], ast.Name)):",
    "                name = node.targets[0].id",
    "                if name in setv and name not in found:",
    "                    new = ast.parse(setv[name], mode='eval').body",
    "                    for n in ast.walk(new):",
    "                        n.lineno, n.col_offset = node.value.lineno, node.value.col_offset",
    "                        n.end_lineno, n.end_col_offset = node.value.end_lineno, node.value.end_col_offset",
    "                    node.value = new",
    "                    found.add(name)",
    "        missing = [n for n in setv if n not in found]",
    "    return compile(tree, 'solution.py', 'exec'), missing",
    "",
    "def _no_comments(code):",
    "    try:",
    "        toks = [t for t in tokenize.generate_tokens(io.StringIO(code).readline)",
    "                if t.type != tokenize.COMMENT]",
    "        return tokenize.untokenize(toks)",
    "    except Exception:",
    "        return code",
    "",
    "def run_all(code, tests_json, echo=False):",
    "    tests = json.loads(tests_json)",
    "    try:",
    "        compile(code, 'solution.py', 'exec')",
    "    except SyntaxError as e:",
    "        return json.dumps({'syntax': 'SyntaxError: %s (строка %s)' % (e.msg, e.lineno)})",
    "    results = []",
    "    for t in tests:",
    "        data = t.get('input') or ''",
    "        out = io.StringIO()",
    "        src = io.StringIO(data)",
    "        st = {'prompt': False, 'reads': 0}",
    "        def _input(prompt=''):",
    "            if prompt != '':",
    "                st['prompt'] = True",
    "            out.write(str(prompt))",
    "            line = src.readline()",
    "            if line == '':",
    "                raise EOFError('EOF when reading a line')",
    "            st['reads'] += 1",
    "            value = line[:-1] if line.endswith('\\n') else line",
    "            if echo:",
    "                out.write('\\u0001' + value + '\\u0002\\n')",
    "            return value",
    "        try:",
    "            compiled, missing = _prepare(code, t.get('set'))",
    "        except Exception as e:",
    "            results.append({'out': '', 'err': 'SetupError: ' + str(e), 'prompt': False,",
    "                            'reads': 0, 'lines': 0, 'missing': []})",
    "            continue",
    "        env = {'__name__': '__main__', 'input': _input}",
    "        old_out, old_in = sys.stdout, sys.stdin",
    "        sys.stdout, sys.stdin = out, src",
    "        err = None",
    "        try:",
    "            exec(compiled, env)",
    "        except SystemExit:",
    "            pass",
    "        except EOFError:",
    "            err = 'EOF'",
    "        except BaseException as e:",
    "            err = ''.join(traceback.format_exception_only(type(e), e)).strip()",
    "        finally:",
    "            sys.stdout, sys.stdin = old_out, old_in",
    "        lines = len([x for x in data.split('\\n') if x != ''])",
    "        results.append({'out': out.getvalue()[:20000], 'err': err, 'prompt': st['prompt'],",
    "                        'reads': st['reads'], 'lines': lines, 'missing': missing})",
    "    return json.dumps({'results': results, 'nc': _no_comments(code)})"
  ].join("\n");

  /* ---------------- сравнение и диагностика ---------------- */
  function normalize(text) {
    var lines = String(text).replace(/\r\n?/g, "\n").split("\n").map(function (s) {
      return s.replace(/[ \t]+$/, "");
    });
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines;
  }
  function isNum(s) { return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(String(s).trim()); }
  function sameNumber(a, b) {
    if (!isNum(a) || !isNum(b)) return false;
    var x = Number(a), y = Number(b);
    return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y));
  }
  function outputsMatch(got, expected, mode) {
    var g = normalize(got), e = normalize(expected);
    if (g.length !== e.length) return false;
    for (var i = 0; i < e.length; i++) {
      if (g[i] === e[i]) continue;
      if (mode !== "float") return false;
      var gt = g[i].trim().split(/\s+/), et = e[i].trim().split(/\s+/);
      if (gt.length !== et.length) return false;
      for (var j = 0; j < et.length; j++) {
        if (gt[j] !== et[j] && !sameNumber(gt[j], et[j])) return false;
      }
    }
    return true;
  }

  function testData(t) {
    if (t.set) {
      return Object.keys(t.set).map(function (k) { return k + " = " + t.set[k]; }).join("\n");
    }
    return String(t.input || "").replace(/\n$/, "");
  }

  /* подсказки к одному неверному ответу */
  /* версия 47: текст подсказки выводится как текст (без HTML), а фрагменты в обратных
     кавычках `int()` становятся <code>: теги в подсказках больше не видны буквально */
  function hintEl(tag, cls, text) {
    var node = el(tag, cls);
    String(text).split("`").forEach(function (part, i) {
      if (!part) return;
      if (i % 2) node.appendChild(el("code", "", part)); else node.appendChild(document.createTextNode(part));
    });
    return node;
  }
  function explainMismatch(got, t) {
    var hints = [];
    var gl = normalize(got), el = normalize(t.output);
    (t.wrong || []).forEach(function (w) {
      if (outputsMatch(got, w.output, "exact")) hints.push(w.hint);
    });
    /* версия 56: несколько типичных ошибок дают тот же вывод: показываем их как возможные причины */
    if (hints.length > 1) return ["Возможные причины:"].concat(hints);
    if (hints.length) return hints;
    if (gl.length === 0 && el.length > 0) {
      return ["Программа ничего не вывела. Проверьте, что результат передается в print()."];
    }
    if (gl.length !== el.length) {
      hints.push("Ожидается строк вывода: " + el.length + ", выведено: " + gl.length +
        ". Выводите только то, что требует условие, без поясняющего текста.");
    }
    var n = Math.min(gl.length, el.length);
    for (var i = 0; i < n; i++) {
      var g = gl[i].trim(), e = el[i].trim();
      if (g === e) continue;
      var where = el.length > 1 ? "В строке " + (i + 1) + ": " : "";
      if (isNum(g) && isNum(e) && Number(g) === Number(e)) {
        if (e.indexOf(".") >= 0 && g.indexOf(".") < 0) {
          hints.push(where + "значение верное, но ожидается вещественное число («" + e + "»), а выведено целое («" + g +
            "»). Проверьте, какой оператор деления нужен и какого типа исходные данные.");
        } else if (g.indexOf(".") >= 0 && e.indexOf(".") < 0) {
          hints.push(where + "значение верное, но ожидается целое число («" + e + "»), а выведено вещественное («" + g +
            "»). Возможно, нужно // вместо /.");
        } else {
          hints.push(where + "значение верное, но записано иначе: ожидается «" + e + "», выведено «" + g + "».");
        }
      } else if (isNum(g) && isNum(e) && sameNumber(g, e)) {
        hints.push(where + "число почти совпадает, отличаются последние знаки. Проверьте порядок действий: " +
          "другой порядок дает другую погрешность вещественных чисел.");
      } else if (e !== "" && g.indexOf(e) >= 0) {
        hints.push(where + "ответ есть, но в строке лишний текст («" + g + "»). Выводите только ответ.");
      } else if ((g === "True" && e === "False") || (g === "False" && e === "True")) {
        hints.push(where + "логический результат противоположный. Проверьте, каким способом сравниваются числа.");
      } else if (isNum(g) && isNum(e) && Number(g) === -Number(e)) {
        hints.push(where + "знак результата противоположный. Проверьте порядок вычитания.");
      }
    }
    return hints;
  }

  function errorType(err) {
    var m = /^\s*([A-Za-z_][\w.]*)(?::|$)/m.exec(String(err).split("\n").pop());
    return m ? m[1] : "";
  }
  function errorHints(err, t) {
    var type = errorType(err);
    return (t.errors || []).filter(function (w) { return w.type === type; });
  }
  function explainError(err) {
    var type = errorType(err);
    var map = {
      NameError: "Имя не определено: проверьте написание имени и, если это функция модуля, подключен ли модуль командой import.",
      TypeError: "Действие не подходит для таких типов данных: например, строку сложили с числом или вызвали то, что не является функцией.",
      ValueError: "Значение не подходит: например, int() получил текст, который не является целым числом.",
      ZeroDivisionError: "Деление на ноль. Проверьте, что делитель не может оказаться равным нулю.",
      IndexError: "Обращение к символу или элементу с номером, которого нет: например, s[0] у пустой строки. Проверьте длину до обращения по номеру.",
      KeyError: "В словаре нет такого ключа: проверьте ключ перед обращением.",
      ModuleNotFoundError: "Модуль не найден: проверьте имя модуля в import.",
      AttributeError: "У объекта нет такого имени после точки: проверьте написание, например math.sqrt, а не math.sqr.",
      IndentationError: "Лишний или недостающий отступ в начале строки.",
      "decimal.InvalidOperation": "Decimal не смог разобрать число: создавайте Decimal из строки с числом, например Decimal('0.1')."
    };
    return map[type] || "";
  }

  /* общие подсказки по всей проверке */
  function generalHints(spec, all, results, ncCode) {
    var hints = [];
    (spec.require || []).forEach(function (r) {
      if (!new RegExp(r.re).test(ncCode)) hints.push(r.msg);
    });
    (spec.forbid || []).forEach(function (r) {
      if (new RegExp(r.re).test(ncCode)) hints.push(r.msg);
    });
    var missing = {};
    results.forEach(function (r) { (r.missing || []).forEach(function (m) { missing[m] = true; }); });
    var miss = Object.keys(missing);
    if (miss.length) {
      hints.push("Проверка подставляет свои исходные данные в строки вида «" + miss[0] + " = …» в начале программы, " +
        "но не нашла таких строк для: " + miss.join(", ") + ". Задайте исходные данные отдельными строками " +
        "именно под этими именами, как в условии.");
    }
    var usesInput = all.some(function (t) { return t.input && t.input.trim() !== ""; });
    if (usesInput && results.every(function (r) { return r.reads === 0 && !r.err; })) {
      hints.push("Программа не читает входные данные: в ней нет input(). Числа из примера нельзя записывать прямо в код: " +
        "проверка запускает программу с другими данными и ждет, что программа прочитает их через input().");
    } else if (usesInput) {
      var r0 = results.filter(function (r) { return !r.err && r.reads > 0 && r.reads < r.lines; })[0];
      if (r0) hints.push("Программа читает строк: " + r0.reads + ", а во входных данных их " + r0.lines +
        ". Каждое значение стоит на своей строке и читается отдельным input().");
    }
    if (results.some(function (r) { return r.prompt; })) {
      hints.push("В input() передан текст приглашения, он попадает в вывод. В задачах данные читаются без него: input().");
    }
    var outs = results.map(function (r) { return normalize(r.out).join("\n"); });
    var exps = all.map(function (t) { return normalize(t.output).join("\n"); });
    var sameOut = outs.length > 1 && outs.every(function (o) { return o === outs[0]; }) && outs[0] !== "";
    var diffExp = exps.some(function (e) { return e !== exps[0]; });
    if (sameOut && diffExp && !miss.length) {
      hints.push("При разных исходных данных программа выводит одно и то же. Скорее всего, в выражении записаны " +
        "готовые числа вместо " + (usesInput ? "прочитанных значений" : "переменных с исходными данными") + ".");
    }
    return hints;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { HARNESS: HARNESS, outputsMatch: outputsMatch, explainMismatch: explainMismatch,
                       errorHints: errorHints, explainError: explainError,
                       generalHints: generalHints, testData: testData };
    return;
  }

  /* ---------------- поток с интерпретатором ---------------- */
  var WORKER_SRC =
    "importScripts(" + JSON.stringify(INDEX_URL + "pyodide.js") + ");\n" +
    "var ready = null;\n" +
    "self.onmessage = function (ev) {\n" +
    "  if (!ready) {\n" +
    "    ready = loadPyodide({indexURL: " + JSON.stringify(INDEX_URL) + "}).then(function (py) {\n" +
    "      py.runPython(" + JSON.stringify(HARNESS) + ");\n" +
    "      return py;\n" +
    "    });\n" +
    "  }\n" +
    "  ready.then(function (py) {\n" +
    "    if (ev.data.warmup) { self.postMessage({ready: true}); return; }\n" +
    "    var res = py.globals.get('run_all')(ev.data.code, JSON.stringify(ev.data.tests), !!ev.data.echo);\n" +
    "    self.postMessage({json: res});\n" +
    "  }).catch(function (e) { self.postMessage({fatal: String(e)}); });\n" +
    "};\n";

  var worker = null, workerReady = false;

  function newWorker() {
    var url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    worker = new Worker(url);
    workerReady = false;
  }
  function callWorker(message, limitMs) {
    return new Promise(function (resolve, reject) {
      if (!worker) newWorker();
      var w = worker;
      var timer = setTimeout(function () {
        w.terminate();
        if (worker === w) { worker = null; workerReady = false; }
        reject({ timeout: true });
      }, limitMs);
      w.onmessage = function (ev) {
        clearTimeout(timer);
        if (ev.data.fatal) { reject({ fatal: ev.data.fatal }); return; }
        workerReady = true;
        resolve(ev.data);
      };
      w.onerror = function (ev) {
        clearTimeout(timer);
        w.terminate();
        if (worker === w) { worker = null; workerReady = false; }
        reject({ fatal: ev.message || "worker error" });
      };
      w.postMessage(message);
    });
  }
  function ensureLoaded() {
    if (workerReady && worker) return Promise.resolve();
    return callWorker({ warmup: true }, LOAD_LIMIT_MS).catch(function () { throw { load: true }; });
  }
  function runCode(code, tests, echo) {
    return ensureLoaded().then(function () {
      return callWorker({ code: code, tests: tests, echo: !!echo }, TIME_LIMIT_MS * tests.length + 1000);
    }).then(function (msg) { return JSON.parse(msg.json); });
  }
  function failText(e) {
    if (e && e.timeout) return "Программа работает слишком долго. Возможно, она ждет лишних данных или не завершается.";
    return "Не удалось загрузить интерпретатор Python. Проверьте подключение к интернету " +
      "или запустите программу в своем редакторе.";
  }
  var LOADING = "Загружаю интерпретатор Python. Первый раз это занимает 10–30 секунд, дальше запуск идет быстро.";

  /* ---------------- DOM-помощники ---------------- */
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function ioBlock(parent, label, text, markEmpty) {
    var wrap = el("div", "checker-io");
    wrap.appendChild(el("span", "checker-io-label", label));
    var pre = el("pre", "checker-io-text", text === "" ? "(пусто)" : text);
    /* версия 56: пустые строки ввода видны серой пометкой, как в таблице «Примеры» */
    if (markEmpty && text !== "") {
      pre.textContent = "";
      text.split("\n").forEach(function (line, i) {
        if (i) pre.appendChild(document.createTextNode("\n"));
        if (line === "") pre.appendChild(el("span", "io-empty", "(пустая строка)"));
        else pre.appendChild(document.createTextNode(line));
      });
    }
    wrap.appendChild(pre);
    parent.appendChild(wrap);
    return wrap;
  }


  /* ---------------- редактор с номерами строк ---------------- */
  function makeEditor(area, cls) {
    var wrap = el("div", "code-editor " + (cls || ""));
    var gutter = el("pre", "code-gutter");
    gutter.setAttribute("aria-hidden", "true");
    function sync() {
      var n = area.value.split("\n").length;
      var t = "";
      for (var i = 1; i <= n; i++) t += i + "\n";
      gutter.textContent = t;
      gutter.scrollTop = area.scrollTop;
    }
    area.addEventListener("input", sync);
    area.addEventListener("scroll", function () { gutter.scrollTop = area.scrollTop; });
    area.addEventListener("keydown", function (e) {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        var a = area.selectionStart, b = area.selectionEnd;
        area.value = area.value.slice(0, a) + "    " + area.value.slice(b);
        area.selectionStart = area.selectionEnd = a + 4;
        sync();
      }
    });
    wrap.appendChild(gutter);
    wrap.appendChild(area);
    wrap.sync = sync;
    setTimeout(sync, 0);
    return wrap;
  }

  /* Сброс размера, который студент изменил, потянув за угол поля (resize) */
  function resetSize() {
    for (var i = 0; i < arguments.length; i++) {
      var t = arguments[i];
      if (t && t.style) { t.style.height = ""; t.style.width = ""; }
    }
  }

  /* ---------------- прогресс (хранится только в этом браузере) ---------------- */
  var STORE_KEY = "practice-html-progress";
  function loadProgress() {
    try { return JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) { /* хранилище недоступно */ }
  }
  function pageName() {
    var parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "index.html";
  }
  /* Состояния задачи: нет записи (не начато), "progress" (в работе: код изменен),
     "error" (последняя проверка неудачная), "solved" (решено). */
  var STATE_TEXT = { todo: "Не начато", progress: "В работе", error: "Есть ошибка", solved: "Решено" };
  function taskState(p, file) {
    if ((p.tasks || {})[file]) return "solved";
    return (p.states || {})[file] || "todo";
  }
  function setState(file, state) {
    var p = loadProgress();
    p.states = p.states || {};
    p.tasks = p.tasks || {};
    if (state === "solved") p.tasks[file] = true;
    if (!p.tasks[file]) p.states[file] = state;
    saveProgress(p);
    refreshStates();
    document.documentElement.dispatchEvent(new CustomEvent("practice:progress"));
  }
  function markTask(file, solved) { if (file && solved) setState(file, "solved"); }

  function stateIcon(state) { var s = el("span", "st st-" + state); s.setAttribute("aria-hidden", "true"); return s; }
  function setStateEl(host, cls, state, withText) {
    var e = host.querySelector("." + cls);
    if (!e) { e = el("span", cls); host.appendChild(e); }
    e.className = cls + " is-" + state;
    e.innerHTML = "";
    e.appendChild(stateIcon(state));
    if (withText) e.appendChild(document.createTextNode(STATE_TEXT[state]));
    e.title = STATE_TEXT[state] || "";
  }
  function currentTrack() {
    if (window.practiceSettings) return (window.practiceSettings() || {}).track;
    try { return JSON.parse(window.localStorage.getItem("practice-html-settings") || "{}").track; } catch (e) { return null; }
  }
  /* упражнение в вариантах: состояние варианта своего уровня; без выбранного уровня лучший из вариантов */
  function groupState(p, items) {
    var tr = currentTrack(), mine = items.filter(function (x) { return x.variant === tr; })[0];
    if (mine) return taskState(p, mine.file);
    var st = items.map(function (x) { return taskState(p, x.file); });
    if (st.indexOf("solved") >= 0) return "solved";
    if (st.some(function (x) { return x !== "todo"; })) return "progress";
    return "todo";
  }
  function unitStates(p, tasks) {
    var groups = {}, out = [];
    tasks.forEach(function (t) {
      if (t.group) (groups[t.group] = groups[t.group] || []).push(t);
      else out.push(taskState(p, t.file));
    });
    Object.keys(groups).forEach(function (g) { out.push(groupState(p, groups[g])); });
    return out;
  }
  function domTasks(root) {
    return Array.prototype.map.call(root.querySelectorAll(".checker[data-file]"), function (c) {
      var art = c.closest("[data-variant]"), grp = c.closest(".ex-variants");
      return { file: c.getAttribute("data-file"), variant: art ? art.getAttribute("data-variant") : null,
               group: grp ? grp.getAttribute("data-exercise") : null };
    });
  }
  function combine(states) {
    if (!states.length) return "todo";
    if (states.every(function (x) { return x === "solved"; })) return "solved";
    if (states.some(function (x) { return x !== "todo"; })) return "progress";
    return "todo";
  }
  function refreshStates() {
    var p = loadProgress(), m = window.PRACTICE_MANIFEST;
    /* задачи на странице */
    Array.prototype.forEach.call(document.querySelectorAll(".checker[data-file]"), function (c) {
      var box = c.closest(".task, .task-final"), h = box && box.querySelector("h3");
      if (h) setStateEl(h, "task-state", taskState(p, c.getAttribute("data-file")), true);
    });
    /* разделы страницы в боковом меню (версия 26): значок только у раздела с упражнением,
       он показывает состояние упражнения своего уровня (без уровня: любого варианта).
       У раздела без упражнения значка нет: раньше он отмечался «прочитано» по прокрутке,
       и галочки появлялись от одного перехода по меню. */
    Array.prototype.forEach.call(document.querySelectorAll("section.subsection[id]"), function (sec) {
      var items = domTasks(sec);
      var st = items.length ? combine(unitStates(p, items)) : "none";
      Array.prototype.forEach.call(document.querySelectorAll('.menu-anchors [data-section="' + sec.id + '"]'), function (a) {
        /* версия 32: у разделов значка нет, состояние показывает пункт упражнения */
        if (a.closest(".menu-anchors").querySelector("[data-ex-link]")) return;
        setStateEl(a, "nav-state", st, false);
        a.title = items.length ? "Упражнение раздела: " + (STATE_TEXT[st] || "").toLowerCase() : "";
      });
    });
    /* упражнения в подменю (версия 32): состояние варианта своего уровня */
    Array.prototype.forEach.call(document.querySelectorAll(".menu-anchors [data-ex-link]"), function (a) {
      var box = document.getElementById(a.getAttribute("data-ex-link"));
      var items = box ? domTasks(box) : [];
      var st = items.length ? combine(unitStates(p, items)) : "todo";
      setStateEl(a, "nav-state", st, false);
      a.title = "Упражнение: " + (STATE_TEXT[st] || "").toLowerCase();
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-task]'), function (a) {
      setStateEl(a, "nav-state", taskState(p, a.getAttribute("data-task")), false);
    });
    if (!m) return;
    /* страницы в меню */
    m.pages.forEach(function (pg) {
      var a = document.querySelector('.menu a[href="' + pg.href + '"]');
      if (!a || pg.kind === "overview") return;
      var st = combine(unitStates(p, pg.tasks));
      if (st === "todo" && (p.visited || {})[pg.href]) st = "progress";
      if (!pg.tasks.length && (p.visited || {})[pg.href]) st = "solved";
      setStateEl(a, "menu-state", st, false);
    });
    /* счетчики упражнений своего уровня в боковом меню */
    Object.keys(m.graded).forEach(function (lv) {
      var list = m.graded[lv] || [], done = list.filter(function (t) { return (p.tasks || {})[t.file]; }).length;
      Array.prototype.forEach.call(document.querySelectorAll('.lvl-count[data-level="' + lv + '"]'), function (e) {
        e.textContent = done + " / " + list.length;
        e.className = "lvl-count" + (list.length && done === list.length ? " is-done" : "");
      });
    });
  }
  function initProgress() {
    var p = loadProgress();
    p.visited = p.visited || {};
    p.visited[pageName()] = true;
    saveProgress(p);
    refreshStates();
  }
  window.practiceRefreshStates = refreshStates;

  /* ---------------- разделы страницы в боковом меню (версия 23) ----------------
     Подсвечивается раздел, заголовок которого последним прошел верх экрана
     (под верхней панелью); боковое меню прокручивается так, чтобы текущая
     страница и ее разделы были видны. */
  function setupAnchors() {
    var list = document.querySelector(".menu-anchors");
    if (!list) return;
    var links = Array.prototype.slice.call(list.querySelectorAll("a[data-section]"));
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute("data-section")); });
    var side = list.closest(".sidebar");
    var cur = side && side.querySelector("a.current");
    if (side && cur && side.scrollHeight > side.clientHeight) {
      var top = cur.offsetTop - side.offsetTop - 60;
      if (top > 0) side.scrollTop = top;
    }
    var ticking = false;
    function spy() {
      ticking = false;
      var bar = document.querySelector(".topbar");
      var edge = (bar ? bar.getBoundingClientRect().bottom : 0) + 90;
      var idx = 0;
      secs.forEach(function (sec, i) { if (sec && sec.getBoundingClientRect().top <= edge) idx = i; });
      /* дочитали до конца страницы: текущий последний раздел */
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = secs.length - 1;
      links.forEach(function (a, i) {
        a.classList.toggle("is-current", i === idx);
        if (i === idx) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; window.requestAnimationFrame(spy); } }, { passive: true });
    window.addEventListener("resize", spy);
    spy();
  }

  /* ---------------- вкладки уровней (tab component, WAI-ARIA) ----------------
     .level-tabs > .tabs-list > button.tab[role=tab][aria-controls] + .tab-panel.
     Без JavaScript видны все панели подряд. Открывается вкладка выбранного
     уровня студента (настройка track), иначе последняя открытая или первая. */
  function setupTabs(box) {
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    box.classList.add("js-tabs");
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab, panel = document.getElementById(t.getAttribute("aria-controls"));
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        if (panel) { panel.classList.toggle("is-active", on); panel.hidden = !on; }
      });
      try { window.sessionStorage.setItem("practice-html-tab:" + groupKey, tab.getAttribute("data-level")); } catch (e) { /* нет */ }
      if (focus) tab.focus();
    }
    var groupKey = box.getAttribute("data-exercise") || "tasks";
    function byId(id) { return tabs.filter(function (t) { return t.getAttribute("aria-controls") === id; })[0]; }
    function byLevel(lv) { return lv ? tabs.filter(function (t) { return t.getAttribute("data-level") === lv; })[0] : null; }
    function initial() {
      var hash = (window.location.hash || "").slice(1), s = {}, last = null;
      if (window.practiceSettings) s = window.practiceSettings() || {};
      else { try { s = JSON.parse(window.localStorage.getItem("practice-html-settings") || "{}"); } catch (e) { s = {}; } }
      try { last = window.sessionStorage.getItem("practice-html-tab:" + groupKey); } catch (e) { last = null; }
      var target = hash && document.getElementById(hash);
      var fromHash = target && box.contains(target) && (byId(hash) || byId((target.closest(".tab-panel") || {}).id));
      return fromHash || byLevel(s.track) || byLevel(last) || tabs[0];
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var j = null;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    select(initial(), false);
    document.documentElement.addEventListener("practice:settings", function (e) {
      var tr = e.detail && e.detail.track;
      if (tr && byLevel(tr)) select(byLevel(tr), false);
      refreshStates();
    });
    window.addEventListener("hashchange", function () { var t = initial(); if (t) select(t, false); });
  }

  /* ---------------- «предскажите вывод» ---------------- */
  function predictCode(out) {
    var prev = out.previousElementSibling;
    return prev && prev.classList.contains("code-block") ? prev : null;
  }
  function setupPredict(out) {
    var pre = out.querySelector("pre");
    if (!pre || out.querySelector(".predict-cover")) return;
    pre.hidden = true;
    var code = predictCode(out);
    if (code) code.classList.add("predict-pending");
    var cover = el("div", "predict-cover");
    cover.appendChild(el("p", "predict-text", "Сначала предскажите, что выведет программа, затем откройте вывод и сравните."));
    var btn = el("button", "predict-btn", "Показать вывод");
    btn.type = "button";
    btn.addEventListener("click", function () { reveal(out); });
    cover.appendChild(btn);
    out.insertBefore(cover, pre);
  }
  function reveal(out) {
    var code = predictCode(out);
    if (code) code.classList.remove("predict-pending");
    var cover = out.querySelector(".predict-cover");
    if (cover) cover.parentNode.removeChild(cover);
    var pre = out.querySelector("pre");
    if (pre) pre.hidden = false;
  }

  /* ---------------- проверка решения ---------------- */
  function render(result, spec, box) {
    box.innerHTML = "";
    box.className = "checker-result";
    if (result.syntax) {
      box.classList.add("is-fail");
      box.appendChild(el("p", "checker-verdict", "✗ Решение не принято: в программе синтаксическая ошибка."));
      ioBlock(box, "Сообщение интерпретатора", result.syntax);
      box.appendChild(el("p", "checker-hint",
        "Python не смог прочитать программу и не запускал ее. Посмотрите на указанную строку и на строку перед ней: " +
        "частые причины: незакрытая скобка или кавычка, пропущенный знак действия."));
      return;
    }
    var all = spec.tests.map(function (t) { return { t: t, visible: true }; })
      .concat((spec.extra || []).map(function (t) { return { t: t, visible: false }; }));
    var tests = all.map(function (x) { return x.t; });
    var results = result.results;
    var passed = 0, list = el("ol", "checker-tests-list");

    all.forEach(function (item, i) {
      var r = results[i], t = item.t;
      var ok = !r.err && outputsMatch(r.out, t.output, spec.compare);
      if (ok) passed++;
      var li = el("li", ok ? "is-pass" : "is-fail");
      var name = "Тест " + (i + 1) + (item.visible ? " (пример из таблицы)" : " (дополнительный)");
      var status = ok ? "верно" : r.err === "EOF" ? "программа ждет больше данных, чем есть в тесте"
        : r.err ? "ошибка выполнения" : "неверный ответ";
      li.appendChild(el("span", "checker-test-name", (ok ? "✓ " : "✗ ") + name + ": " + status));
      if (!ok) {
        if (t.note) li.appendChild(el("p", "checker-note-test", "Что проверяет тест: " + t.note));
        var data = testData(t);
        ioBlock(li, t.set ? "Исходные данные" : "Входные данные", data, !t.set);
        if (r.err && r.err !== "EOF") {
          ioBlock(li, "Сообщение интерпретатора", r.err);
          /* версия 56: подсказки к типичным ошибкам, которые падают при выполнении */
          var own = errorHints(r.err, t);
          /* несколько типичных ошибок дают одно исключение: показываем их как возможные причины */
          if (own.length > 1) li.appendChild(el("p", "checker-hint", "Возможные причины:"));
          own.forEach(function (w) {
            li.appendChild(hintEl("p", "checker-hint", w.hint));
            if (w.why) li.appendChild(el("p", "checker-why", "Почему: " + w.why));
          });
          var ex = own.length ? "" : explainError(r.err);
          if (ex) li.appendChild(el("p", "checker-hint", ex));
        } else if (!r.err) {
          ioBlock(li, "Вывод программы", r.out.replace(/\n$/, ""));
          if (item.visible) {
            ioBlock(li, "Ожидалось", t.output);
          } else {
            var det = el("details", "checker-reveal");
            det.appendChild(el("summary", "", "Показать ожидаемый ответ"));
            det.appendChild(el("pre", "checker-io-text", t.output));
            li.appendChild(det);
          }
          explainMismatch(r.out, t).forEach(function (h) { li.appendChild(hintEl("p", "checker-hint", h)); });
          (t.wrong || []).forEach(function (w) {
            if (w.why && outputsMatch(r.out, w.output, "exact")) li.appendChild(el("p", "checker-why", "Почему: " + w.why));
          });
        }
      }
      list.appendChild(li);
    });

    var total = all.length;
    if (passed === total) {
      box.classList.add("is-pass");
      box.appendChild(el("p", "checker-verdict", "✓ Решение верное: пройдены все тесты (" + total + " из " + total + ")."));
      box.solved = true;
    } else {
      box.classList.add("is-fail");
      box.appendChild(el("p", "checker-verdict", "✗ Решение неверное: пройдено " + passed + " из " + total + " тестов."));
    }
    var hints = generalHints(spec, tests, results, result.nc || "");
    if (hints.length) {
      var hbox = el("div", "checker-hints");
      hbox.appendChild(el("p", "checker-hints-title", passed === total ? "Замечания" : "Что, скорее всего, не так"));
      var ul = el("ul", "");
      hints.forEach(function (h) { ul.appendChild(hintEl("li", "", h)); });
      hbox.appendChild(ul);
      box.appendChild(hbox);
      var reqFailed = (spec.require || []).some(function (r) { return !new RegExp(r.re).test(result.nc || ""); }) ||
        (spec.forbid || []).some(function (r) { return new RegExp(r.re).test(result.nc || ""); });
      if (passed === total && reqFailed) {
        /* результат верный, но не использован прием, ради которого дана задача:
           это не провал, а замечание (желтое состояние) */
        box.className = "checker-result is-warn";
        box.firstChild.textContent = "Результат правильный. Но в этой задаче нужно использовать прием, " +
          "который отрабатывается на этой странице: см. замечание ниже.";
        hbox.firstChild.textContent = "Что поправить";
        box.solved = false;
        box.warn = true;
      }
    }
    box.appendChild(list);
  }

  function setupChecker(block) {
    var file = block.getAttribute("data-file") || "решение.py";
    /* данные задачи: data/<страница>.js (PRACTICE_DATA), для старых страниц JSON внутри блока */
    var spec = (window.PRACTICE_DATA || {})[file];
    if (!spec) {
      var specNode = block.querySelector("script.checker-tests");
      if (!specNode) return;
      try { spec = JSON.parse(specNode.textContent); } catch (e) { return; }
    }
    var n = spec.tests.length + (spec.extra || []).length;
    var setMode = spec.tests.concat(spec.extra || []).some(function (t) { return t.set; });

    block.appendChild(el("p", "checker-title", "Проверка решения"));
    block.appendChild(el("p", "checker-note",
      "Вставьте код из файла " + file + " или выберите сам файл и нажмите «Проверить». Программа запускается на " +
      n + " тестах: на примерах из таблицы «Примеры» и на дополнительных, которые скрыты." +
      (setMode ? " Строки с исходными данными уже вставлены в поле: не меняйте имена переменных, проверка подставляет в эти строки свои значения." : "") +
      (spec.template_note ? " " + spec.template_note : "")));
    var area = el("textarea", "checker-code");
    area.setAttribute("spellcheck", "false");
    area.setAttribute("aria-label", "Код решения " + file);
    area.rows = 9;
    /* шаблон: строки с исходными данными уже на месте (режим set) */
    var template = "";
    if (spec.template !== undefined) {
      template = spec.template;
    } else if (setMode && spec.tests[0] && spec.tests[0].set) {
      template = Object.keys(spec.tests[0].set).map(function (k) { return k + " = " + spec.tests[0].set[k]; }).join("\n") +
        "\n\n";
    }
    var CODE_KEY = "practice-html-code:" + file;
    var saved = null;
    try { saved = window.localStorage.getItem(CODE_KEY); } catch (e) { saved = null; }
    area.value = saved !== null ? saved : template;
    var saveTimer = null;
    area.addEventListener("input", function () {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(function () {
        try {
          if (area.value === template) window.localStorage.removeItem(CODE_KEY);
          else window.localStorage.setItem(CODE_KEY, area.value);
        } catch (e) { /* хранилище недоступно */ }
        var cur = taskState(loadProgress(), file);
        if (cur === "todo" && area.value.trim() !== template.trim()) setState(file, "progress");
      }, 400);
    });
    var editor = makeEditor(area, "checker-editor");
    block.appendChild(editor);

    var bar = el("div", "checker-bar");
    var run = el("button", "checker-run", "Проверить");
    run.type = "button";
    var pick = el("label", "checker-file", "Выбрать файл .py");
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".py,text/x-python,text/plain";
    pick.appendChild(input);
    /* «Сбросить» возвращает блок в исходное состояние (версия 24): шаблон кода, размер поля,
       пустой результат, выбор файла, состояние задачи «Не начато». Решенная задача остается
       решенной: прогресс сбрасывается только в меню ⚙. */
    var clear = el("button", "checker-clear", "↺ Сбросить");
    clear.type = "button";
    clear.title = template ? "Вернуть шаблон и убрать результат проверки" : "Очистить поле и убрать результат проверки";
    bar.appendChild(run); bar.appendChild(pick); bar.appendChild(clear);
    block.appendChild(bar);

    var box = el("div", "checker-result");
    box.setAttribute("aria-live", "polite");
    block.appendChild(box);

    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        area.value = String(reader.result); editor.sync();
        area.dispatchEvent(new Event("input"));
      };
      reader.readAsText(f, "utf-8");
    });
    clear.addEventListener("click", function () {
      area.value = template; resetSize(area); editor.sync(); area.scrollTop = 0;
      box.innerHTML = ""; box.className = "checker-result";
      input.value = "";                               /* тот же файл можно выбрать снова */
      try { window.localStorage.removeItem(CODE_KEY); } catch (e) { /* хранилище недоступно */ }
      var p = loadProgress();
      if (!(p.tasks || {})[file] && (p.states || {})[file]) {
        delete p.states[file];
        saveProgress(p);
        refreshStates();
        document.documentElement.dispatchEvent(new CustomEvent("practice:progress"));
      }
      block.dispatchEvent(new CustomEvent("checker:reset", { bubbles: true, detail: { file: file } }));
    });
    run.addEventListener("click", function () {
      var code = area.value;
      if (!code.trim()) {
        box.className = "checker-result is-fail";
        box.textContent = "Вставьте код программы в поле выше.";
        return;
      }
      var tests = spec.tests.concat(spec.extra || []).map(function (t) { return { input: t.input || "", set: t.set || null }; });
      run.disabled = true;
      box.className = "checker-result is-wait";
      box.textContent = workerReady ? "Проверяю…" : LOADING;
      block.dispatchEvent(new CustomEvent("checker:start", { bubbles: true, detail: { file: file } }));
      runCode(code, tests, false).then(function (res) {
        box.solved = false;
        box.warn = false;
        render(res, spec, box);
        if (box.solved) markTask(file, true);
        else setState(file, box.warn ? "progress" : "error");
        var total = spec.tests.length + (spec.extra || []).length;
        var passed = res.syntax ? 0 : res.results.filter(function (r, i) {
          var t = i < spec.tests.length ? spec.tests[i] : spec.extra[i - spec.tests.length];
          return !r.err && outputsMatch(r.out, t.output, spec.compare);
        }).length;
        block.dispatchEvent(new CustomEvent("checker:result", { bubbles: true,
          detail: { file: file, passed: passed, total: total, solved: !!box.solved, warn: !!box.warn,
                    level: spec.level || "exercise", variant: spec.variant || null } }));
      })
        .catch(function (e) {
          box.className = "checker-result is-fail"; box.textContent = "✗ " + failText(e);
          block.dispatchEvent(new CustomEvent("checker:result", { bubbles: true,
            detail: { file: file, passed: 0, total: 1, solved: false, error: true } }));
        })
        .then(function () { run.disabled = false; });
    });
  }

  /* ---------------- проверка для страницы преподавателя (версия 49) ----------------
     window.practiceCheckCode(file, code, box): тот же запуск и тот же разбор, что у кнопки
     «Проверить», но без отметок в прогрессе браузера. Возвращает {passed, total, solved}. */
  window.practiceCheckCode = function (file, code, box) {
    var spec = (window.PRACTICE_DATA || {})[file];
    if (!spec) return Promise.reject(new Error("нет данных проверки для " + file));
    var tests = spec.tests.concat(spec.extra || []).map(function (t) { return { input: t.input || "", set: t.set || null }; });
    box.className = "checker-result is-wait";
    box.textContent = workerReady ? "Проверяю…" : LOADING;
    return runCode(code, tests, false).then(function (res) {
      box.solved = false;
      box.warn = false;
      render(res, spec, box);
      var total = spec.tests.length + (spec.extra || []).length;
      /* версия 51: номера непройденных тестов для строки итога на странице преподавателя */
      var fails = [];
      var passed = res.syntax ? 0 : res.results.filter(function (r, i) {
        var t = i < spec.tests.length ? spec.tests[i] : spec.extra[i - spec.tests.length];
        var ok = !r.err && outputsMatch(r.out, t.output, spec.compare);
        if (!ok) fails.push({ n: i + 1, visible: i < spec.tests.length });
        return ok;
      }).length;
      return { passed: passed, total: total, solved: !!box.solved, syntax: !!res.syntax, fails: fails };
    }, function (e) {
      box.className = "checker-result is-fail"; box.textContent = "✗ " + failText(e);
      return { passed: 0, total: 0, solved: false, error: failText(e), fails: [] };
    });
  };

  /* ---------------- живые примеры ---------------- */
  function exampleOutput(codeBlock) {
    var anchor = codeBlock;
    var sib = anchor.nextElementSibling;
    while (sib && sib.classList.contains("output-block")) {
      if (!sib.classList.contains("file-output")) return sib;
      sib = sib.nextElementSibling;
    }
    return null;
  }

  function renderRunOutput(pre, res) {
    pre.innerHTML = "";
    if (res.syntax) { pre.appendChild(el("span", "ex-error", res.syntax)); return; }
    var r = res.results[0];
    var text = r.out;
    var parts = text.split(ECHO_START);
    pre.appendChild(document.createTextNode(parts[0]));
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i].split(ECHO_END);
      var k = el("kbd", "user-input", p[0]);
      pre.appendChild(k);
      pre.appendChild(document.createTextNode(p.slice(1).join(ECHO_END)));
    }
    if (r.err) {
      if (text && !/\n$/.test(text)) pre.appendChild(document.createTextNode("\n"));
      pre.appendChild(el("span", "ex-error", r.err === "EOF"
        ? "EOFError: программа ждет ввода, а поле «Ввод» закончилось" : r.err));
    }
    if (!text && !r.err) pre.appendChild(el("span", "ex-empty", "(программа ничего не вывела)"));
  }

  function setupExample(codeBlock) {
    if (codeBlock.closest(".task, .task-final, .task-summary, .checker")) return;
    var out = exampleOutput(codeBlock);
    if (!out) return;
    var codePre = codeBlock.querySelector("pre");
    var outPre = out.querySelector("pre");
    if (!codePre || !outPre) return;
    var original = { code: codePre.innerHTML, out: outPre.innerHTML, text: codePre.textContent };
    var kbds = outPre.querySelectorAll("kbd.user-input");
    var stdin0 = Array.prototype.map.call(kbds, function (k) { return k.textContent; }).join("\n");

    var tools = el("span", "ex-tools");
    var edit = el("button", "ex-btn", "✎ Изменить и запустить");
    edit.type = "button";
    edit.title = "Изменить код и запустить";
    tools.appendChild(edit);
    codeBlock.appendChild(tools);

    var editor = null, editorWrap = null, stdin = null, runBtn = null, resetBtn = null;

    function enterEdit(auto) {
      editor = el("textarea", "ex-editor");
      editor.value = original.text;
      editor.setAttribute("spellcheck", "false");
      editor.setAttribute("aria-label", "Код примера");
      editor.rows = Math.max(3, original.text.split("\n").length + 1);
      codePre.hidden = true;
      editorWrap = makeEditor(editor, "ex-editor-wrap");
      codeBlock.insertBefore(editorWrap, codePre.nextSibling);
      reveal(out);
      if (kbds.length) {
        stdin = el("textarea", "ex-stdin");
        stdin.value = stdin0;
        stdin.rows = Math.max(1, kbds.length);
        stdin.setAttribute("aria-label", "Ввод: каждое значение с новой строки");
        var lab = el("span", "ex-stdin-label", "Ввод (каждое значение с новой строки):");
        out.insertBefore(lab, outPre);
        out.insertBefore(stdin, outPre);
      }
      tools.innerHTML = "";
      runBtn = el("button", "ex-btn ex-btn-run", "▶ Запустить");
      resetBtn = el("button", "ex-btn", "↺ Сбросить");
      runBtn.type = resetBtn.type = "button";
      tools.appendChild(runBtn); tools.appendChild(resetBtn);
      runBtn.addEventListener("click", run);
      resetBtn.addEventListener("click", reset);
      codeBlock.classList.add("is-editing");
      if (auto !== true) editor.focus();
    }
    function run() {
      runBtn.disabled = true;
      outPre.textContent = workerReady ? "Запускаю…" : LOADING;
      var data = stdin ? stdin.value.replace(/\s+$/, "") + "\n" : "";
      runCode(editor.value, [{ input: data, set: null }], true)
        .then(function (res) { renderRunOutput(outPre, res); })
        .catch(function (e) { outPre.textContent = failText(e); })
        .then(function () { runBtn.disabled = false; });
    }
    function reset() {
      if (editorWrap) editorWrap.parentNode.removeChild(editorWrap);
      if (stdin) { stdin.previousSibling.parentNode.removeChild(stdin.previousSibling); stdin.parentNode.removeChild(stdin); }
      editor = editorWrap = stdin = null;
      codePre.innerHTML = original.code;
      codePre.hidden = false;
      outPre.innerHTML = original.out;
      tools.innerHTML = "";
      tools.appendChild(edit);
      codeBlock.classList.remove("is-editing");
    }
    edit.addEventListener("click", enterEdit);
    /* «Практика»: пример сразу открыт для правки; «Сбросить» возвращает исходный код */
    if (codeBlock.closest(".try-block")) {
      enterEdit(true);
      resetBtn.removeEventListener("click", reset);
      resetBtn.addEventListener("click", function () {
        editor.value = original.text;
        resetSize(editor, stdin);
        if (stdin) stdin.value = stdin0;
        if (editorWrap && editorWrap.sync) editorWrap.sync();
        outPre.innerHTML = original.out;
        reveal(out);
      });
      tools.removeChild(resetBtn);
      tools.appendChild(resetBtn);
    }
  }


  /* ---------------- типичная ошибка: разница строк (версия 36, вариант C) ----------------
     Карточка .mistake с .code-wrong и .code-right показывается одним окном кода: строка «−»
     неверная, «+» исправленная, общие строки без знака; под окном два результата рядом.
     Исходные окна остаются в разметке (их проверяет check_page.py) и видны без JavaScript. */
  function codeLines(block) {
    var code = block.querySelector("pre code") || block.querySelector("pre");
    if (!code) return [];
    var c = code.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll(".tok-out"), function (x) { x.parentNode.removeChild(x); });
    return c.textContent.replace(/\s+$/, "").split("\n").map(function (l) { return l.replace(/\s+$/, ""); });
  }
  function lineDiff(a, b) {
    var n = a.length, m = b.length, L = [], i, j;
    for (i = 0; i <= n; i++) { L.push([]); for (j = 0; j <= m; j++) L[i].push(0); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push([" ", a[i]]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) out.push(["-", a[i++]]);
      else out.push(["+", b[j++]]);
    }
    while (i < n) out.push(["-", a[i++]]);
    while (j < m) out.push(["+", b[j++]]);
    return out;
  }
  function resultOf(block) {
    var n = block.nextElementSibling;
    return n && n.classList.contains("output-block") ? n : null;
  }
  function setupMistakeDiff(card) {
    var wrong = card.querySelector(":scope > .code-wrong"), right = card.querySelector(":scope > .code-right");
    if (!wrong || !right || card.classList.contains("mistake-diff")) return;
    var why = ((wrong.querySelector(".code-label") || {}).textContent || "").replace(/^\s*Неверно:?\s*/, "");
    var win = el("div", "mdiff-win");
    var bar = el("div", "mdiff-bar");
    bar.appendChild(el("span", "mdiff-name", why ? "Неверно: " + why : "Неверно и верно"));
    var leg = el("span", "mdiff-leg");
    leg.innerHTML = '<i class="mdiff-m">−</i> неверно <i class="mdiff-p">+</i> верно';
    bar.appendChild(leg);
    win.appendChild(bar);
    var pre = el("pre", "mdiff-code");
    lineDiff(codeLines(wrong), codeLines(right)).forEach(function (d) {
      var row = el("span", "mdiff-l" + (d[0] === "-" ? " mdiff-minus" : d[0] === "+" ? " mdiff-plus" : ""));
      row.appendChild(el("b", "", d[0] === "-" ? "−" : d[0]));
      row.appendChild(document.createTextNode(d[1] || " "));
      pre.appendChild(row);
    });
    win.appendChild(pre);
    var res = el("div", "mdiff-res");
    [[wrong, "С ошибкой", "bad"], [right, "Исправлено", "good"]].forEach(function (x) {
      var out = resultOf(x[0]);
      if (!out) return;
      var box = el("div", "mdiff-box mdiff-" + x[2]);
      var isErr = out.classList.contains("error-output");
      box.appendChild(el("span", "mdiff-sub", x[1] + (isErr ? " · сообщение об ошибке" : " · вывод")));
      var o = el("pre", "mdiff-out" + (isErr ? " mdiff-err" : ""));
      o.textContent = (out.querySelector("pre") || out).textContent;
      box.appendChild(o);
      res.appendChild(box);
    });
    var cap = card.querySelector(":scope > .mistake-caption");
    var at = cap ? cap.nextSibling : card.firstChild;
    card.insertBefore(win, at);
    card.insertBefore(res, win.nextSibling);
    card.classList.add("mistake-diff");
  }
  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".level-tabs"), setupTabs);
    Array.prototype.forEach.call(document.querySelectorAll(".output-block.predict"), setupPredict);
    initProgress();
    setupAnchors();
    Array.prototype.forEach.call(document.querySelectorAll(".mistake"), setupMistakeDiff);
    if (typeof Worker === "undefined" || typeof Blob === "undefined") return;
    var blocks = document.querySelectorAll(".checker");
    for (var i = 0; i < blocks.length; i++) {
      var fb = blocks[i].querySelector(".checker-fallback");
      if (fb) fb.parentNode.removeChild(fb);
      setupChecker(blocks[i]);
    }
    var codes = document.querySelectorAll(".code-block");
    for (var j = 0; j < codes.length; j++) setupExample(codes[j]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
