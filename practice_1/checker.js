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
   7. ЗАПУСК БЕЗ ТЕСТОВ (версия 62). Кнопка «▶ Запустить» рядом с «Проверить» выполняет
      программу на данных из поля «Ввод» и показывает вывод; тесты не запускаются.
      Текст приглашения в input("…") при проверке в вывод не попадает.
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
    "            if echo:",
    "                out.write(str(prompt))",
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
    if (t.hidden) return hints;
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
      if (r0) {
        if (spec.read_all) {
          hints.push("Программа прочитала строк: " + r0.reads + " из " + r0.lines +
            ". В этой задаче нужно прочитать все строки ввода до конца: не завершайте программу досрочно.");
        } else {
          hints.push("Программа читает строк: " + r0.reads + ", а во входных данных их " + r0.lines +
            ". Каждая строка входных данных читается отдельным input().");
        }
      }
    }
    var outs = results.map(function (r) { return normalize(r.out).join("\n"); });
    var exps = all.filter(function (t) { return !t.hidden; }).map(function (t) { return normalize(t.output).join("\n"); });
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
  /* версия 72: ответы скрытых тестов на сайте хранятся как SHA-256 (поле h; соль «файл#номер теста»),
     а не текстом. После запуска хэш вывода студента сравнивается с h: совпал, значит вывод и есть ответ,
     и он подставляется в копию данных; не совпал, ответ остается неизвестным (NO_MATCH).
     Дальше работает обычная проверка. Типичные ошибки скрытых тестов хранятся так же.
     ponytail: crypto.subtle есть только в защищенном контексте (https, localhost, file://). */
  var NO_MATCH = "\u0000";
  function sha256(s) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return (x + 256).toString(16).slice(1); }).join("");
    });
  }
  function resolveHashed(file, spec, res) {
    var all = spec.tests.concat(spec.extra || []);
    if (res.syntax || !all.some(function (t) { return t.h; })) return Promise.resolve(spec);
    return Promise.all(res.results.map(function (r, i) {
      return sha256(file + "#" + i + "\n" + normalize(r.out).join("\n"));
    })).then(function (hs) {
      function fix(t, i) {
        if (!t.h) return t;
        var known = function (h) { return hs[i] === h ? res.results[i].out : NO_MATCH; };
        return Object.assign({}, t, { hidden: true, output: known(t.h), wrong: (t.wrong || []).map(function (w) {
          return w.h ? Object.assign({}, w, { output: known(w.h) }) : w;
        }) });
      }
      var n = spec.tests.length;
      return Object.assign({}, spec, { tests: spec.tests.map(fix),
        extra: (spec.extra || []).map(function (t, j) { return fix(t, n + j); }) });
    });
  }
  function checkCode(file, spec, code, tests) {
    return runCode(code, tests, false).then(function (out) {
      return resolveHashed(file, spec, out).then(function (sp) { out.spec = sp; return out; });
    });
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
  /* версия 76: значок в начале надписи кнопки («▶ Запустить») скрыт от экранного диктора */
  var BTN_ICON = /^([\u2190-\u2BFF]) /;
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    var m = tag === "button" && text !== undefined && BTN_ICON.exec(text);
    if (m) {
      var ic = document.createElement("span"); ic.setAttribute("aria-hidden", "true"); ic.textContent = m[0];
      node.appendChild(ic); node.appendChild(document.createTextNode(text.slice(m[0].length)));
    } else if (text !== undefined) node.textContent = text;
    return node;
  }
  /* одна скрытая подсказка на страницу для всех полей кода (aria-describedby) */
  function editorHint() {
    if (document.getElementById("kbd-editor-hint")) return;
    var h = el("span", "sr-only", "Tab вставляет четыре пробела. Чтобы выйти из поля: Esc, затем Tab.");
    h.id = "kbd-editor-hint"; document.body.appendChild(h);
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


  /* ---------------- подсветка Python в редакторах ---------------- */
  var PY_KW = {}, PY_BI = {};
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case".split(" ").forEach(function (w) { PY_KW[w] = 1; });
  "abs all any bool bytes chr dict divmod enumerate eval filter float format frozenset getattr hasattr hash hex id input int isinstance issubclass iter len list map max min next object oct open ord pow print range repr reversed round set setattr slice sorted str sum super tuple type zip".split(" ").forEach(function (w) { PY_BI[w] = 1; });
  function escHTML(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  var PY_WORDS = Object.keys(PY_KW).concat(Object.keys(PY_BI)).sort(function (a, b) { return b.length - a.length; }).join("|");
  var PY_RE_SRC = '(?:[fFrRbBuU]{0,2})(?:"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')|#[^\\n]*|\\b(?:' + PY_WORDS + ')\\b|\\b\\d[\\d_]*(?:\\.[\\d_]+)?\\b|[+\\-*/%=<>!&|^~]+';
  function pyHighlight(code) {
    var re = new RegExp(PY_RE_SRC, "g");
    var out = "", last = 0, m;
    while ((m = re.exec(code))) {
      out += escHTML(code.slice(last, m.index));
      var tok = m[0], cls = "tok-op";
      if (tok.charAt(0) === "#") cls = "tok-com";
      else if (/^(?:[fFrRbBuU]{0,2})(?:"""|'''|"|')/.test(tok)) cls = "tok-str";
      else if (/^\d/.test(tok)) cls = "tok-num";
      else if (tok === "True" || tok === "False" || tok === "None") cls = "tok-const";
      else if (PY_KW[tok]) cls = "tok-kw";
      else if (PY_BI[tok]) cls = "tok-builtin";
      out += '<span class="' + cls + '">' + escHTML(tok) + '</span>';
      last = m.index + tok.length;
    }
    out += escHTML(code.slice(last));
    return out || "\n";
  }

  /* ---------------- копирование кода ---------------- */
  var COPY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PENCIL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20l4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20zM14 6.5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z" fill="currentColor"/></svg>';
  function fallbackCopy(text) {
    var t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.left = "-9999px";
    document.body.appendChild(t);
    t.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(t);
    return ok;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function copyButton(getText, cls) {
    var b = el("button", "tb-copy-code " + (cls || ""));
    b.type = "button";
    b.innerHTML = COPY_SVG;
    b.setAttribute("aria-label", "Скопировать код");
    b.setAttribute("title", "Скопировать код");
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      copyText(getText() || "").then(function (ok) {
        if (!ok) return;
        b.classList.add("is-copied");
        b.innerHTML = CHECK_SVG;
        b.setAttribute("aria-label", "Скопировано");
        b.setAttribute("title", "Скопировано");
        window.setTimeout(function () {
          b.classList.remove("is-copied");
          b.innerHTML = COPY_SVG;
          b.setAttribute("aria-label", "Скопировать код");
          b.setAttribute("title", "Скопировать код");
        }, 1400);
      });
    });
    return b;
  }
  function iconButton(svg, label, cls) {
    var b = el("button", "ex-btn ex-btn-icon " + (cls || ""));
    b.type = "button";
    b.innerHTML = svg;
    b.title = label;
    b.setAttribute("aria-label", label);
    return b;
  }

  /* ---------------- редактор с номерами строк и подсветкой ---------------- */
  function makeEditor(area, cls, opts) {
    opts = opts || {};
    var wrap = el("div", "code-editor " + (cls || ""));
    if (opts.header) {
      var head = el("div", "code-editor-head");
      var dots = el("span", "code-dots");
      ["r", "y", "g"].forEach(function (c) { dots.appendChild(el("i", "code-dot-" + c)); });
      head.appendChild(dots);
      head.appendChild(el("span", "code-file", opts.file || "solution.py"));
      if (opts.copy) head.appendChild(copyButton(function () { return area.value; }, "tb-copy-head"));
      if (opts.save && opts.file) {
        var saveBtn = el("button", "tb-save-code");
        saveBtn.type = "button";
        saveBtn.title = "Сохранить как " + opts.file;
        saveBtn.setAttribute("aria-label", "Сохранить как " + opts.file);
        saveBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>';
        saveBtn.addEventListener("click", function () {
          var blob = new Blob([area.value], {type: "text/x-python"});
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = opts.file;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        });
        head.appendChild(saveBtn);
      }
      wrap.appendChild(head);
    }
    var body = el("div", "code-editor-body");
    var gutter = el("pre", "code-gutter");
    gutter.setAttribute("aria-hidden", "true");
    var areaBox = el("div", "code-area");
    var highlight = el("pre", "code-highlight");
    highlight.setAttribute("aria-hidden", "true");
    areaBox.appendChild(highlight);
    areaBox.appendChild(area);
    body.appendChild(gutter);
    body.appendChild(areaBox);
    wrap.appendChild(body);
    area.setAttribute("wrap", "off");
    area.setAttribute("spellcheck", "false");
    function sync() {
      var n = area.value.split("\n").length;
      var t = "";
      for (var i = 1; i <= n; i++) t += i + "\n";
      gutter.textContent = t;
      highlight.innerHTML = pyHighlight(area.value);
      gutter.scrollTop = area.scrollTop;
      highlight.scrollTop = area.scrollTop;
      highlight.scrollLeft = area.scrollLeft;
    }
    area.addEventListener("input", sync);
    area.addEventListener("scroll", function () {
      gutter.scrollTop = area.scrollTop;
      highlight.scrollTop = area.scrollTop;
      highlight.scrollLeft = area.scrollLeft;
    });
    /* версия 76: Tab вставляет 4 пробела; Esc, затем Tab переводят фокус дальше по странице */
    var escOut = false;
    area.setAttribute("aria-describedby", "kbd-editor-hint");
    editorHint();
    area.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { escOut = true; return; }
      if (e.key === "Tab" && !e.shiftKey && !escOut) {
        e.preventDefault();
        var a = area.selectionStart, b = area.selectionEnd;
        area.value = area.value.slice(0, a) + "    " + area.value.slice(b);
        area.selectionStart = area.selectionEnd = a + 4;
        sync();
      }
      escOut = false;
    });
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
  /* >>> progress-codec (версия 84). Одинаковый блок в checker.js, theme.js, game.js, home.js:
     selftest.py сверяет копии, правится во всех четырех сразу. Глобального объекта нет, иначе
     прогресс подделывается одной строкой в консоли.
     Ключи practice-html-progress и practice-html-game* хранятся как "ph1:" + base64(XOR(подпись + JSON));
     подпись: два FNV-1a от секрета, ключа и JSON. Правка значения вручную делает его недействительным.
     Открытый JSON до версии 84 переводится один раз (отметка ph-m), потом не принимается.
     ponytail: защита от любопытных, не от подделки: секрет лежит в браузере, оценка ставится по репозиторию. */
  var progressCodec = (function () {
    var S = "3f9c-ph-7a1e-2026", MARK = "ph-m", PRE = "ph1:";
    function prot(k) { return k === "practice-html-progress" || k.indexOf("practice-html-game") === 0; }
    function fnv(s, h) {
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return ("0000000" + h.toString(16)).slice(-8);
    }
    function sig(k, s) { return fnv(S + k + s, 2166136261) + fnv(s + k + S, 84696351); }
    function xor(u8, k) {
      var key = S + k, out = new Uint8Array(u8.length);
      for (var i = 0; i < u8.length; i++) out[i] = u8[i] ^ key.charCodeAt(i % key.length) ^ (i * 31 & 255);
      return out;
    }
    function encode(k, v) {
      var s = JSON.stringify(v), u = xor(new TextEncoder().encode(sig(k, s) + s), k), b = "";
      for (var i = 0; i < u.length; i += 8192) b += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
      return PRE + btoa(b);
    }
    function decode(k, raw) {                       /* undefined: значение недействительно */
      if (raw.indexOf(PRE) !== 0) return undefined;
      try {
        var b = atob(raw.slice(PRE.length)), u = new Uint8Array(b.length);
        for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        var t = new TextDecoder().decode(xor(u, k)), s = t.slice(16);
        return t.slice(0, 16) === sig(k, s) ? JSON.parse(s) : undefined;
      } catch (e) { return undefined; }
    }
    try {                                           /* разовый перевод открытого JSON */
      var ls = window.localStorage;
      if (!ls.getItem(MARK)) {
        for (var i = 0; i < ls.length; i++) {
          var k = ls.key(i), raw = ls.getItem(k);
          if (k && prot(k) && raw && raw.indexOf(PRE) !== 0) {
            try { ls.setItem(k, encode(k, JSON.parse(raw))); } catch (e) { /* битый JSON оставляем */ }
          }
        }
        ls.setItem(MARK, "1");
      }
    } catch (e) { /* хранилище недоступно */ }
    return {
      get: function (k, def) {
        try {
          var raw = window.localStorage.getItem(k);
          if (raw == null) return def;
          if (!prot(k)) return JSON.parse(raw);
          var v = decode(k, raw);
          return v === undefined ? def : v;
        } catch (e) { return def; }
      },
      set: function (k, v) {
        try { window.localStorage.setItem(k, prot(k) ? encode(k, v) : JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ }
      },
      /* загрузка файла прогресса: открытый JSON из старого файла кодируется */
      importRaw: function (k, raw) {
        if (prot(k) && raw && raw.indexOf(PRE) !== 0) { try { raw = encode(k, JSON.parse(raw)); } catch (e) { return; } }
        try { window.localStorage.setItem(k, raw); } catch (e) { /* хранилище недоступно */ }
      }
    };
  })();
  /* <<< progress-codec */
  var STORE_KEY = "practice-html-progress";
  function loadProgress() {
    return progressCodec.get(STORE_KEY, {}) || {};
  }
  function saveProgress(p) {
    progressCodec.set(STORE_KEY, p);
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
      var art = c.closest("[data-variant]"), grp = c.closest(".ex-variants, .star-variants");
      return { file: c.getAttribute("data-file"), variant: art ? art.getAttribute("data-variant") : null,
               group: grp ? (grp.getAttribute("data-exercise") || grp.getAttribute("data-star")) : null };
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
          } else if (t.hidden) {
            li.appendChild(el("p", "checker-note-test", "Ответ дополнительного теста не показывается. " +
              "Сравните программу с условием и с примерами из таблицы."));
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
      var readAllFailed = !!spec.read_all && results.some(function (r) {
        return !r.err && r.lines > 0 && r.reads < r.lines;
      });
      var reqFailed = readAllFailed ||
        (spec.require || []).some(function (r) { return !new RegExp(r.re).test(result.nc || ""); }) ||
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

  function testWord(n, prep) {
    var d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return prep ? "тесте" : "тест";
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return prep ? "тестах" : "теста";
    return prep ? "тестах" : "тестов";
  }
  function checkerHelpText(file, n, setMode, spec) {
    return "Вставьте код из файла `" + file + "` или выберите сам файл и нажмите «Проверить». " +
      "Программа запускается на " + n + " " + testWord(n, true) + ": на примерах из таблицы «Примеры» и на дополнительных, которые скрыты. " +
      (setMode
        ? "Строки с исходными данными уже вставлены в поле: не меняйте имена переменных, проверка подставляет в эти строки свои значения."
        : "Данные программа читает через `input()`, каждую строку входных данных отдельным `input()`: `s = input()`, `n = int(input())`. " +
          "Текст в скобках, например `input(\"Введите n: \")`, писать можно: проверка его не учитывает.") +
      " Кнопка «Запустить» только выполняет программу на ваших данных, без тестов." +
      (spec.template_note ? " " + spec.template_note : "");
  }
  var helpSeq = 0;
          var REC_NAMES = {
    "t4_01_1_basic.py": [
      "seq",
      "base",
      "rna"
    ],
    "t4_01_1_medium.py": [
      "seq",
      "base",
      "masked"
    ],
    "t4_01_1_advanced.py": [
      "seq",
      "base",
      "prev",
      "count",
      "code"
    ],
    "t4_01_star_basic.py": [
      "seq",
      "base",
      "masked"
    ],
    "t4_01_star_medium.py": [
      "seq",
      "base",
      "rc"
    ],
    "t4_01_star_advanced.py": [
      "code",
      "seq",
      "letter",
      "digits"
    ],
    "t4_02_1_basic.py": [
      "count",
      "index"
    ],
    "t4_02_1_medium.py": [
      "seq",
      "index"
    ],
    "t4_02_1_advanced.py": [
      "seq",
      "frame",
      "length",
      "last",
      "index"
    ],
    "t4_02_star_basic.py": [
      "seq",
      "position",
      "index"
    ],
    "t4_02_star_medium.py": [
      "seq",
      "window",
      "length",
      "index"
    ],
    "t4_02_star_advanced.py": [
      "seq",
      "line",
      "index"
    ],
    "t4_03_1_basic.py": [
      "count",
      "cells",
      "hours"
    ],
    "t4_03_1_medium.py": [
      "number",
      "count"
    ],
    "t4_03_1_advanced.py": [
      "number",
      "bits"
    ],
    "t4_03_2_basic.py": [
      "count",
      "line"
    ],
    "t4_03_2_medium.py": [
      "total",
      "length"
    ],
    "t4_03_2_advanced.py": [
      "capacity",
      "cells",
      "free",
      "length"
    ],
    "t4_03_star_basic.py": [
      "number",
      "total"
    ],
    "t4_03_star_medium.py": [
      "count",
      "month",
      "older",
      "young",
      "born"
    ],
    "t4_03_star_advanced.py": [
      "seq",
      "passes",
      "collapsed"
    ],
    "t4_04_1_basic.py": [
      "seq",
      "position",
      "index"
    ],
    "t4_04_1_medium.py": [
      "seq",
      "answer",
      "index"
    ],
    "t4_04_1_advanced.py": [
      "seq",
      "result",
      "start",
      "index",
      "count",
      "codon"
    ],
    "t4_04_2_basic.py": [
      "seq",
      "base"
    ],
    "t4_04_2_medium.py": [
      "line",
      "sequence",
      "count"
    ],
    "t4_04_2_advanced.py": [
      "motif",
      "number",
      "answer",
      "read"
    ],
    "t4_04_star_basic.py": [
      "quality",
      "threshold",
      "answer",
      "index"
    ],
    "t4_04_star_medium.py": [
      "number",
      "bad_line",
      "header",
      "line",
      "letter"
    ],
    "t4_04_star_advanced.py": [
      "seq",
      "size",
      "answer",
      "run",
      "index"
    ],
    "t4_05_1_basic.py": [
      "seq",
      "count",
      "base"
    ],
    "t4_05_1_medium.py": [
      "seq",
      "mass",
      "base"
    ],
    "t4_05_1_advanced.py": [
      "first",
      "second",
      "transitions",
      "transversions",
      "index"
    ],
    "t4_05_2_basic.py": [
      "seq",
      "gc",
      "base"
    ],
    "t4_05_2_medium.py": [
      "gc",
      "total",
      "line"
    ],
    "t4_05_2_advanced.py": [
      "seq",
      "gc",
      "total",
      "base"
    ],
    "t4_05_star_basic.py": [
      "count",
      "total",
      "read"
    ],
    "t4_05_star_medium.py": [
      "seq",
      "count_c",
      "count_g",
      "cpg",
      "index"
    ],
    "t4_05_star_advanced.py": [
      "seq",
      "window",
      "difference",
      "count",
      "index"
    ],
    "t4_06_1_basic.py": [
      "count",
      "maximum",
      "index",
      "value"
    ],
    "t4_06_1_medium.py": [
      "count",
      "maximum",
      "index",
      "value",
      "position"
    ],
    "t4_06_1_advanced.py": [
      "count",
      "first",
      "second",
      "index",
      "value"
    ],
    "t4_06_star_basic.py": [
      "names",
      "best",
      "name"
    ],
    "t4_06_star_medium.py": [
      "values",
      "best",
      "run",
      "index"
    ],
    "t4_06_star_advanced.py": [
      "values",
      "best",
      "current",
      "value"
    ],
    "t4_07_1_basic.py": [
      "first",
      "second",
      "distance",
      "index"
    ],
    "t4_07_1_medium.py": [
      "seq",
      "current",
      "best",
      "index"
    ],
    "t4_07_1_advanced.py": [
      "seq",
      "skew",
      "min_skew",
      "position",
      "index"
    ],
    "t4_07_star_basic.py": [
      "seq",
      "skew",
      "moved",
      "answer",
      "index"
    ],
    "t4_07_star_medium.py": [
      "seq",
      "skew",
      "low",
      "position",
      "index"
    ],
    "t4_07_star_advanced.py": [
      "seq",
      "skew",
      "low",
      "best",
      "base"
    ],
    "t4_08_1_basic.py": [
      "text",
      "motif",
      "count",
      "start"
    ],
    "t4_08_1_medium.py": [
      "text",
      "motif",
      "count",
      "start",
      "differences"
    ],
    "t4_08_1_advanced.py": [
      "seq",
      "k",
      "best",
      "best_count",
      "index",
      "kmer",
      "count"
    ],
    "t4_08_star_basic.py": [
      "seq",
      "first",
      "second",
      "count",
      "index"
    ],
    "t4_08_star_medium.py": [
      "seq",
      "length",
      "count",
      "index",
      "first",
      "second",
      "pair"
    ],
    "t4_08_star_advanced.py": [
      "first",
      "second",
      "best",
      "index",
      "length"
    ],
    "t5_01_1_basic.py": [
      "sequences"
    ],
    "t5_01_1_medium.py": [
      "sequences",
      "sequence"
    ],
    "t5_01_1_advanced.py": [
      "sequences",
      "seen",
      "repeats"
    ],
    "t5_01_star_basic.py": [
      "sequences",
      "total",
      "average",
      "result"
    ],
    "t5_01_star_medium.py": [
      "first",
      "second",
      "common"
    ],
    "t5_01_star_advanced.py": [
      "sequences",
      "unique",
      "counts",
      "best",
      "index"
    ],
    "t5_02_1_basic.py": [
      "sequences",
      "draft"
    ],
    "t5_02_1_medium.py": [
      "sequences",
      "masked",
      "index"
    ],
    "t5_02_1_advanced.py": [
      "sequences",
      "shift",
      "length",
      "shifted",
      "index"
    ],
    "t5_02_star_basic.py": [
      "sequences",
      "masked",
      "number",
      "index"
    ],
    "t5_02_star_medium.py": [
      "sequences",
      "swapped",
      "index"
    ],
    "t5_02_star_advanced.py": [
      "first",
      "second",
      "length",
      "answer",
      "shift",
      "index"
    ],
    "t5_03_1_basic.py": [
      "sequences",
      "count"
    ],
    "t5_03_1_medium.py": [
      "sequences"
    ],
    "t5_03_1_advanced.py": [
      "sequences",
      "start",
      "end",
      "part"
    ],
    "t5_03_2_basic.py": [
      "sequences",
      "first"
    ],
    "t5_03_2_medium.py": [
      "sequences",
      "min_length",
      "sequence"
    ],
    "t5_03_2_advanced.py": [
      "sequences",
      "skipped",
      "command",
      "sequence",
      "text"
    ],
    "t5_03_star_basic.py": [
      "sequences",
      "result",
      "sequence"
    ],
    "t5_03_star_medium.py": [
      "sequences",
      "k",
      "result",
      "index"
    ],
    "t5_03_star_advanced.py": [
      "sequences",
      "step",
      "order",
      "index"
    ],
    "t5_04_1_basic.py": [
      "name",
      "length",
      "gc"
    ],
    "t5_04_1_medium.py": [
      "first",
      "rest"
    ],
    "t5_04_1_advanced.py": [
      "name1",
      "start1",
      "end1",
      "name2",
      "start2",
      "end2",
      "start",
      "end"
    ],
    "t5_04_star_basic.py": [
      "threshold",
      "count",
      "names",
      "index",
      "name",
      "gc"
    ],
    "t5_04_star_medium.py": [
      "count",
      "best_name",
      "best_sum",
      "index",
      "name",
      "values",
      "total",
      "value"
    ],
    "t5_04_star_advanced.py": [
      "month",
      "lifespan",
      "ages",
      "index",
      "month_index",
      "newborn"
    ],
    "t5_05_1_basic.py": [
      "seq",
      "letter",
      "positions",
      "index",
      "base"
    ],
    "t5_05_1_medium.py": [
      "sequences",
      "motif",
      "numbers",
      "index",
      "sequence"
    ],
    "t5_05_1_advanced.py": [
      "seq",
      "scores",
      "quality",
      "last",
      "index",
      "score",
      "trimmed"
    ],
    "t5_05_2_basic.py": [
      "first",
      "second",
      "same",
      "index"
    ],
    "t5_05_2_medium.py": [
      "first",
      "second",
      "positions",
      "index"
    ],
    "t5_05_2_advanced.py": [
      "first",
      "second",
      "distance",
      "index"
    ],
    "t5_05_star_basic.py": [
      "sequences",
      "position",
      "column"
    ],
    "t5_05_star_medium.py": [
      "sequences",
      "columns",
      "column"
    ],
    "t5_05_star_advanced.py": [
      "sequences",
      "distance",
      "best",
      "best_count",
      "count",
      "index",
      "difference"
    ],
    "t5_06_1_basic.py": [
      "sequences"
    ],
    "t5_06_1_medium.py": [
      "sequences"
    ],
    "t5_06_1_advanced.py": [
      "lengths",
      "sequence",
      "count"
    ],
    "t5_06_2_basic.py": [
      "sequences"
    ],
    "t5_06_2_medium.py": [
      "count",
      "records",
      "index",
      "names",
      "gc",
      "name"
    ],
    "t5_06_2_advanced.py": [
      "count",
      "records",
      "index",
      "sequence",
      "gc",
      "names",
      "gc_desc",
      "name"
    ],
    "t5_06_star_basic.py": [
      "sequences"
    ],
    "t5_06_star_medium.py": [
      "sequences",
      "records",
      "index",
      "sequence",
      "result",
      "count_g"
    ],
    "t5_06_star_advanced.py": [
      "sequences",
      "gcs",
      "sequence",
      "order",
      "ranks",
      "gc"
    ],
    "t5_07_1_basic.py": [
      "sequences",
      "counts",
      "sequence"
    ],
    "t5_07_1_medium.py": [
      "sequences",
      "threshold",
      "gcs",
      "sequence",
      "rich",
      "count_g"
    ],
    "t5_07_1_advanced.py": [
      "first",
      "second",
      "k",
      "hits",
      "index",
      "inner"
    ],
    "t5_07_star_basic.py": [
      "sequences",
      "sequence"
    ],
    "t5_07_star_medium.py": [
      "sequences",
      "count",
      "pairs",
      "index",
      "inner"
    ],
    "t5_07_star_advanced.py": [
      "sequences",
      "consensus",
      "index",
      "column"
    ],
    "t5_08_1_basic.py": [
      "seq",
      "vector",
      "base"
    ],
    "t5_08_1_medium.py": [
      "count",
      "records",
      "index",
      "name",
      "seq",
      "vector",
      "base"
    ],
    "t5_08_1_advanced.py": [
      "count",
      "names",
      "matrix",
      "index",
      "seq",
      "base",
      "sums",
      "column",
      "best",
      "best_distance",
      "value",
      "distance"
    ],
    "t5_08_star_basic.py": [
      "count",
      "matrix",
      "index",
      "seq",
      "base",
      "column"
    ],
    "t5_08_star_medium.py": [
      "count",
      "index",
      "name",
      "seq",
      "shares",
      "base"
    ],
    "t5_08_star_advanced.py": [
      "count",
      "names",
      "matrix",
      "index",
      "seq",
      "base",
      "best",
      "inner",
      "first",
      "distance"
    ],
    "t5_09_1_basic.py": [
      "sequences",
      "letter",
      "row",
      "column"
    ],
    "t5_09_1_medium.py": [
      "sequences",
      "consensus",
      "column",
      "distances",
      "index",
      "sequence"
    ],
    "t5_09_1_advanced.py": [
      "sequences",
      "consensus",
      "column",
      "counts",
      "base",
      "best"
    ],
    "t5_09_star_basic.py": [
      "sequences",
      "best_position",
      "best_count",
      "index",
      "column",
      "top"
    ],
    "t5_09_star_medium.py": [
      "group_a",
      "group_b",
      "consensus_a",
      "column",
      "consensus_b",
      "difference",
      "index"
    ],
    "t5_09_star_advanced.py": [
      "count",
      "sequences",
      "index",
      "line",
      "columns",
      "base"
    ],
    "t1_04_1_basic.py": [
      "cells"
    ],
    "t1_04_1_medium.py": [
      "volume",
      "sample"
    ],
    "t1_04_1_advanced.py": [
      "count",
      "sample"
    ],
    "t1_04_star_basic.py": [
      "healthy",
      "infected"
    ],
    "t1_04_star_medium.py": [
      "stage1",
      "stage2",
      "stage3",
      "born"
    ],
    "t1_04_star_advanced.py": [
      "stage1",
      "stage2",
      "stage3",
      "total"
    ],
    "t1_05_1_basic.py": [
      "first",
      "second"
    ],
    "t1_05_1_medium.py": [
      "motif",
      "times"
    ],
    "t1_05_1_advanced.py": [
      "plate",
      "well"
    ],
    "t1_05_2_basic.py": [
      "volume"
    ],
    "t1_05_2_medium.py": [
      "text"
    ],
    "t1_05_2_advanced.py": [
      "flag1",
      "flag2"
    ],
    "t1_05_star_basic.py": [
      "motif",
      "times"
    ],
    "t1_05_star_medium.py": [
      "plate",
      "well"
    ],
    "t1_05_star_advanced.py": [
      "last",
      "width"
    ],
    "t1_06_1_basic.py": [
      "length"
    ],
    "t1_06_1_medium.py": [
      "length"
    ],
    "t1_06_1_advanced.py": [
      "length",
      "shift"
    ],
    "t1_06_2_basic.py": [
      "read1",
      "read2",
      "read3"
    ],
    "t1_06_2_medium.py": [
      "sample",
      "buffer"
    ],
    "t1_06_2_advanced.py": [
      "concentration1",
      "concentration2",
      "volume1",
      "volume2"
    ],
    "t1_06_star_basic.py": [
      "start",
      "end"
    ],
    "t1_06_star_medium.py": [
      "samples",
      "wells",
      "plates"
    ],
    "t1_06_star_advanced.py": [
      "length",
      "position",
      "shift"
    ],
    "t1_07_1_basic.py": [
      "mass1",
      "mass2"
    ],
    "t1_07_1_medium.py": [
      "measured",
      "nominal",
      "percent"
    ],
    "t1_07_1_advanced.py": [
      "measured",
      "nominal",
      "percent",
      "floor"
    ],
    "t1_07_2_basic.py": [
      "value"
    ],
    "t1_07_2_medium.py": [
      "total",
      "part1",
      "part2"
    ],
    "t1_07_2_advanced.py": [
      "initial",
      "dilution",
      "steps",
      "target"
    ],
    "t1_07_star_basic.py": [
      "nominal",
      "measured",
      "tolerance"
    ],
    "t1_07_star_medium.py": [
      "measured",
      "nominal",
      "percent"
    ],
    "t1_07_star_advanced.py": [
      "measured",
      "nominal",
      "percent",
      "floor"
    ],
    "t1_08_1_basic.py": [
      "length",
      "count_g",
      "count_c"
    ],
    "t1_08_1_medium.py": [
      "length",
      "count_g",
      "count_c",
      "gc"
    ],
    "t1_08_1_advanced.py": [
      "length",
      "count_g",
      "count_c",
      "count_at"
    ],
    "t1_08_star_basic.py": [
      "reads",
      "passed",
      "percent"
    ],
    "t1_08_star_medium.py": [
      "length",
      "gc",
      "percent"
    ],
    "t1_08_star_advanced.py": [
      "length",
      "gc"
    ],
    "t1_09_1_basic.py": [
      "reads",
      "duplicates"
    ],
    "t1_09_1_medium.py": [
      "seconds"
    ],
    "t1_09_1_advanced.py": [
      "hours",
      "minutes",
      "days",
      "total"
    ],
    "t1_09_2_basic.py": [
      "name",
      "volume"
    ],
    "t1_09_2_medium.py": [
      "first",
      "second",
      "third",
      "mean"
    ],
    "t1_09_2_advanced.py": [
      "concentration",
      "volume",
      "mass"
    ],
    "t1_09_star_basic.py": [
      "name",
      "start",
      "size"
    ],
    "t1_09_star_medium.py": [
      "total_seconds",
      "hours",
      "minutes",
      "seconds"
    ],
    "t1_09_star_advanced.py": [
      "start_hours",
      "start_minutes",
      "end_hours",
      "end_minutes",
      "days",
      "total_minutes"
    ],
    "t1_10_1_basic.py": [
      "count_a",
      "count_t",
      "count_g",
      "count_c",
      "length"
    ],
    "t1_10_1_medium.py": [
      "count_g",
      "count_c",
      "skew"
    ],
    "t1_10_1_advanced.py": [
      "length",
      "count_g",
      "count_c",
      "count_n",
      "gc"
    ],
    "t1_10_star_basic.py": [
      "record_id",
      "seq"
    ],
    "t1_10_star_medium.py": [
      "length1",
      "gc1",
      "length2",
      "gc2",
      "gc"
    ],
    "t1_10_star_advanced.py": [
      "length1",
      "gc1",
      "length2",
      "gc2",
      "k",
      "gc_k",
      "total",
      "gc"
    ],
    "t2_01_1_basic.py": [
      "seq"
    ],
    "t2_01_1_medium.py": [
      "seq"
    ],
    "t2_01_1_advanced.py": [
      "seq",
      "position"
    ],
    "t2_01_star_basic.py": [
      "seq",
      "position"
    ],
    "t2_01_star_medium.py": [
      "seq",
      "start"
    ],
    "t2_01_star_advanced.py": [
      "seq",
      "length",
      "end"
    ],
    "t2_02_1_basic.py": [
      "seq",
      "length"
    ],
    "t2_02_1_medium.py": [
      "seq",
      "index"
    ],
    "t2_02_1_advanced.py": [
      "seq",
      "trim"
    ],
    "t2_02_2_basic.py": [
      "seq"
    ],
    "t2_02_2_medium.py": [
      "seq",
      "start"
    ],
    "t2_02_2_advanced.py": [
      "seq",
      "start",
      "end"
    ],
    "t2_02_star_basic.py": [
      "seq",
      "cut"
    ],
    "t2_02_star_medium.py": [
      "seq",
      "start",
      "step"
    ],
    "t2_02_star_advanced.py": [
      "seq",
      "frame",
      "length"
    ],
    "t2_03_1_basic.py": [
      "seq",
      "motif"
    ],
    "t2_03_1_medium.py": [
      "seq",
      "motif",
      "offset"
    ],
    "t2_03_1_advanced.py": [
      "seq",
      "motif"
    ],
    "t2_03_2_basic.py": [
      "seq"
    ],
    "t2_03_2_medium.py": [
      "seq",
      "position",
      "replacement"
    ],
    "t2_03_2_advanced.py": [
      "seq",
      "start",
      "end"
    ],
    "t2_03_star_basic.py": [
      "seq",
      "start",
      "end"
    ],
    "t2_03_star_medium.py": [
      "seq",
      "k",
      "codon"
    ],
    "t2_03_star_advanced.py": [
      "seq",
      "motif",
      "position",
      "length",
      "padded"
    ],
    "t2_04_1_basic.py": [
      "name"
    ],
    "t2_04_1_medium.py": [
      "symbol"
    ],
    "t2_04_1_advanced.py": [
      "first",
      "second"
    ],
    "t2_04_2_basic.py": [
      "seq",
      "motif"
    ],
    "t2_04_2_medium.py": [
      "seq",
      "motif"
    ],
    "t2_04_2_advanced.py": [
      "seq",
      "motif",
      "start",
      "stop"
    ],
    "t2_04_star_basic.py": [
      "seq",
      "motif"
    ],
    "t2_04_star_medium.py": [
      "seq",
      "motif"
    ],
    "t2_04_star_advanced.py": [
      "seq",
      "motif",
      "ring"
    ],
    "t2_05_1_basic.py": [
      "seq"
    ],
    "t2_05_1_medium.py": [
      "seq",
      "masked"
    ],
    "t2_05_1_advanced.py": [
      "seq",
      "complement"
    ],
    "t2_05_star_basic.py": [
      "seq"
    ],
    "t2_05_star_medium.py": [
      "seq",
      "rest"
    ],
    "t2_05_star_advanced.py": [
      "seq",
      "complement"
    ],
    "t2_06_1_basic.py": [
      "record",
      "parts"
    ],
    "t2_06_1_medium.py": [
      "name"
    ],
    "t2_06_1_advanced.py": [
      "parts",
      "genus",
      "species"
    ],
    "t2_06_star_basic.py": [
      "parts"
    ],
    "t2_06_star_medium.py": [
      "line"
    ],
    "t2_06_star_advanced.py": [
      "header"
    ],
    "t2_07_1_basic.py": [
      "share"
    ],
    "t2_07_1_medium.py": [
      "sample",
      "reads",
      "gc"
    ],
    "t2_07_1_advanced.py": [
      "position",
      "bar"
    ],
    "t2_07_star_basic.py": [
      "before",
      "after"
    ],
    "t2_07_star_medium.py": [
      "chrom",
      "start",
      "end"
    ],
    "t2_07_star_advanced.py": [
      "row",
      "column"
    ],
    "t2_08_1_basic.py": [
      "symbol",
      "number"
    ],
    "t2_08_1_medium.py": [
      "quality"
    ],
    "t2_08_1_advanced.py": [
      "text"
    ],
    "t2_08_star_basic.py": [
      "symbol",
      "quality"
    ],
    "t2_08_star_medium.py": [
      "text"
    ],
    "t2_08_star_advanced.py": [
      "quality",
      "first_position",
      "last_position"
    ],
    "t2_09_1_basic.py": [
      "seq",
      "gc"
    ],
    "t2_09_1_medium.py": [
      "header",
      "seq",
      "seq_id",
      "gc"
    ],
    "t2_09_1_advanced.py": [
      "header",
      "seq",
      "seq_id",
      "gc",
      "third",
      "gc3"
    ],
    "t2_09_star_basic.py": [
      "seq",
      "count_g",
      "count_c"
    ],
    "t2_09_star_medium.py": [
      "header",
      "seq",
      "seq_id",
      "count_n",
      "gc"
    ],
    "t2_09_star_advanced.py": [
      "header",
      "seq",
      "seq_id",
      "count_c",
      "count_g",
      "gc",
      "ratio"
    ],
    "t3_01_1_basic.py": [
      "ph"
    ],
    "t3_01_1_medium.py": [
      "volume",
      "count",
      "dilution"
    ],
    "t3_01_1_advanced.py": [
      "limit",
      "first",
      "second",
      "third"
    ],
    "t3_01_2_basic.py": [
      "first",
      "second"
    ],
    "t3_01_2_medium.py": [
      "first",
      "second"
    ],
    "t3_01_2_advanced.py": [
      "first",
      "second",
      "key1",
      "key2"
    ],
    "t3_01_star_basic.py": [
      "before",
      "after"
    ],
    "t3_01_star_medium.py": [
      "first",
      "second"
    ],
    "t3_01_star_advanced.py": [
      "first",
      "second",
      "key1",
      "key2"
    ],
    "t3_02_1_basic.py": [
      "primer"
    ],
    "t3_02_1_medium.py": [
      "low",
      "high",
      "value"
    ],
    "t3_02_1_advanced.py": [
      "limit",
      "first",
      "second"
    ],
    "t3_02_2_basic.py": [
      "base"
    ],
    "t3_02_2_medium.py": [
      "first",
      "second"
    ],
    "t3_02_2_advanced.py": [
      "old",
      "new",
      "old_purine",
      "new_purine"
    ],
    "t3_02_star_basic.py": [
      "primer",
      "good_len"
    ],
    "t3_02_star_medium.py": [
      "start1",
      "end1",
      "start2",
      "end2"
    ],
    "t3_02_star_advanced.py": [
      "start1",
      "end1",
      "start2",
      "end2",
      "limit",
      "lengths_ok",
      "cross_ok"
    ],
    "t3_03_1_basic.py": [
      "primer"
    ],
    "t3_03_1_medium.py": [
      "seq",
      "position",
      "base"
    ],
    "t3_03_1_advanced.py": [
      "seq",
      "limit",
      "gc"
    ],
    "t3_03_star_basic.py": [
      "base"
    ],
    "t3_03_star_medium.py": [
      "seq",
      "last",
      "is_stop"
    ],
    "t3_03_star_advanced.py": [
      "seq",
      "position",
      "index",
      "right",
      "left"
    ],
    "t3_04_1_basic.py": [
      "density"
    ],
    "t3_04_1_medium.py": [
      "seq"
    ],
    "t3_04_1_advanced.py": [
      "start",
      "end",
      "strand",
      "position",
      "pos"
    ],
    "t3_04_star_basic.py": [
      "concentration",
      "volume"
    ],
    "t3_04_star_medium.py": [
      "length",
      "start",
      "end",
      "distance"
    ],
    "t3_04_star_advanced.py": [
      "length",
      "start",
      "end",
      "position",
      "size"
    ],
    "t3_05_1_basic.py": [
      "temperature",
      "group"
    ],
    "t3_05_1_medium.py": [
      "ct",
      "result"
    ],
    "t3_05_1_advanced.py": [
      "first",
      "second",
      "third",
      "median"
    ],
    "t3_05_2_basic.py": [
      "quality",
      "grade"
    ],
    "t3_05_2_medium.py": [
      "volume",
      "concentration",
      "ratio",
      "errors"
    ],
    "t3_05_2_advanced.py": [
      "systolic",
      "diastolic",
      "category"
    ],
    "t3_05_star_basic.py": [
      "old",
      "new",
      "old_purine",
      "new_purine",
      "kind"
    ],
    "t3_05_star_medium.py": [
      "first",
      "second",
      "third",
      "base"
    ],
    "t3_05_star_advanced.py": [
      "before",
      "after",
      "difference",
      "kind"
    ],
    "t3_06_1_basic.py": [
      "seq"
    ],
    "t3_06_1_medium.py": [
      "seq_id",
      "seq",
      "name"
    ],
    "t3_06_1_advanced.py": [
      "signal",
      "background"
    ],
    "t3_06_star_basic.py": [
      "gene",
      "seq_id"
    ],
    "t3_06_star_medium.py": [
      "value1",
      "value2",
      "value3"
    ],
    "t3_06_star_advanced.py": [
      "value1",
      "value2",
      "value3",
      "count",
      "total"
    ],
    "t3_07_1_basic.py": [
      "text",
      "mass"
    ],
    "t3_07_1_medium.py": [
      "text_a",
      "text_b",
      "mass_a",
      "mass_b",
      "result"
    ],
    "t3_07_1_advanced.py": [
      "limit",
      "text0",
      "text1",
      "text2",
      "value0",
      "value1",
      "value2",
      "cycle"
    ],
    "t3_07_star_basic.py": [
      "value1",
      "value2",
      "value3",
      "last"
    ],
    "t3_07_star_medium.py": [
      "value1",
      "value2",
      "value3",
      "low"
    ],
    "t3_07_star_advanced.py": [
      "difference",
      "value0",
      "value1",
      "value2",
      "previous",
      "jump"
    ],
    "t3_08_1_basic.py": [
      "tm"
    ],
    "t3_08_1_medium.py": [
      "volume",
      "concentration",
      "message"
    ],
    "t3_08_1_advanced.py": [
      "well",
      "result"
    ],
    "t3_08_star_basic.py": [
      "primer",
      "gc",
      "result"
    ],
    "t3_08_star_medium.py": [
      "number",
      "row",
      "column",
      "result"
    ],
    "t3_08_star_advanced.py": [
      "well",
      "result",
      "row",
      "column"
    ],
    "t3_09_1_basic.py": [
      "base",
      "group"
    ],
    "t3_09_1_medium.py": [
      "header",
      "seq",
      "seq_id",
      "result"
    ],
    "t3_09_1_advanced.py": [
      "seq",
      "text",
      "known",
      "result"
    ],
    "t3_09_star_basic.py": [
      "line",
      "text",
      "known",
      "kind"
    ],
    "t3_09_star_medium.py": [
      "first",
      "second",
      "pair",
      "code"
    ],
    "t3_09_star_advanced.py": [
      "text",
      "exact",
      "two",
      "three",
      "four",
      "result"
    ]
  };





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

    var head = el("div", "checker-head");
    head.appendChild(el("p", "checker-title", "Проверка решения"));
    var helpWrap = el("span", "checker-help-wrap");
    var helpBtn = el("button", "checker-help");
    helpBtn.type = "button";
    helpBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9.1a2.7 2.7 0 0 1 5.2.8c0 1.8-2.7 2-2.7 3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1" fill="currentColor"/></svg>';
    helpBtn.setAttribute("aria-label", "Как проверяется задача");
    var helpPop = el("div", "checker-help-pop");
    helpPop.id = "checker-help-" + (++helpSeq);
    helpPop.hidden = true;
    helpPop.appendChild(hintEl("div", "", checkerHelpText(file, n, setMode, spec)));
    helpBtn.setAttribute("aria-describedby", helpPop.id);
    helpWrap.appendChild(helpBtn);
    helpWrap.appendChild(helpPop);
    head.appendChild(helpWrap);
    block.appendChild(head);
    var rec = REC_NAMES[file];
    block.appendChild(hintEl("p", "checker-note checker-note-short",
      rec ? "Рекомендуемые имена переменных: " + rec.map(function (x) { return "`" + x + "`"; }).join(", ") + "."
        : "Тестов: " + n + " · примеры и скрытые · " + (setMode ? "данные уже вставлены" : "ввод через `input()`")));
    var helpPinned = false;
    function showHelp() { helpPop.hidden = false; }
    function hideHelp() { if (!helpPinned) helpPop.hidden = true; }
    helpWrap.addEventListener("mouseenter", showHelp);
    helpWrap.addEventListener("mouseleave", hideHelp);
    helpBtn.addEventListener("focus", showHelp);
    helpBtn.addEventListener("blur", hideHelp);
    helpBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      helpPinned = !helpPinned;
      helpPop.hidden = !helpPinned;
    });
    document.addEventListener("click", function (e) {
      if (!helpWrap.contains(e.target)) { helpPinned = false; helpPop.hidden = true; }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { helpPinned = false; helpPop.hidden = true; }
    });
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
    var editor = makeEditor(area, "checker-editor", {file: file, header: true, save: true, copy: true});
    block.appendChild(editor);

    /* «Запустить» без тестов (версия 62): программа выполняется на данных из поля «Ввод»,
       прогресс и игровой режим не меняются */
    var stdin = null, stdin0 = "";
    if (!setMode) {
      stdin0 = (spec.tests[0] && spec.tests[0].input || "").replace(/\n$/, "");
      block.appendChild(el("span", "ex-stdin-label checker-stdin-label", "Ввод для «Запустить» (строки ввода, как в левой колонке «Примеров»):"));
      stdin = el("textarea", "ex-stdin checker-stdin");
      stdin.value = stdin0;
      stdin.rows = Math.max(1, stdin0.split("\n").length);
      stdin.setAttribute("spellcheck", "false");
      stdin.setAttribute("aria-label", "Ввод для запуска: строки ввода, как в левой колонке «Примеров»");
      block.appendChild(stdin);
    }

    var bar = el("div", "checker-bar");
    var run = el("button", "checker-run", "Проверить");
    run.type = "button";
    var tryBtn = el("button", "checker-try", "▶ Запустить");
    tryBtn.type = "button";
    tryBtn.title = "Выполнить программу на данных из поля «Ввод», без проверки тестами";
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
    bar.appendChild(run); bar.appendChild(tryBtn); bar.appendChild(pick); bar.appendChild(clear);
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
      /* версия 76: свой код стирается только после подтверждения */
      if (area.value !== template && !window.confirm("Стереть ваш код и вернуть шаблон?")) return;
      area.value = template; resetSize(area); editor.sync(); area.scrollTop = 0;
      if (stdin) stdin.value = stdin0;
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
    tryBtn.addEventListener("click", function () {
      var code = area.value;
      if (!code.trim()) {
        box.className = "checker-result is-fail";
        box.textContent = "Вставьте код программы в поле выше.";
        return;
      }
      var data = stdin ? stdin.value.replace(/\r\n?/g, "\n") + "\n" : "";
      tryBtn.disabled = true;
      box.className = "checker-result is-wait";
      box.textContent = workerReady ? "Запускаю…" : LOADING;
      runCode(code, [{ input: data, set: null }], true).then(function (res) {
        box.innerHTML = "";
        box.className = "checker-result is-run";
        box.appendChild(el("p", "checker-verdict", "Вывод программы (без проверки тестами)"));
        var pre = el("pre", "checker-run-out");
        renderRunOutput(pre, res);
        box.appendChild(pre);
      })
        .catch(function (e) { box.className = "checker-result is-fail"; box.textContent = "✗ " + failText(e); })
        .then(function () { tryBtn.disabled = false; });
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
      checkCode(file, spec, code, tests).then(function (res) {
        var spec = res.spec;
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
    return checkCode(file, spec, code, tests).then(function (res) {
      var spec = res.spec;
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
    var copyBtn = copyButton(function () { return editor ? editor.value : original.text; });
    var edit = iconButton(PENCIL_SVG, "Изменить");
    var play = iconButton(PLAY_SVG, "Изменить и запустить", "ex-btn-run");
    tools.appendChild(copyBtn);
    tools.appendChild(edit);
    tools.appendChild(play);
    codeBlock.appendChild(tools);

    var editor = null, editorWrap = null, stdin = null, runBtn = null, resetBtn = null;

    function enterEdit(auto) {
      editor = el("textarea", "ex-editor");
      editor.value = original.text;
      editor.setAttribute("spellcheck", "false");
      editor.setAttribute("aria-label", "Код примера");
      editor.rows = Math.max(3, original.text.split("\n").length + 1);
      codePre.hidden = true;
      var codeLabel = codeBlock.querySelector(".code-label");
      editorWrap = makeEditor(editor, "ex-editor-wrap", {file: codeLabel ? codeLabel.textContent.trim() : ""});
      codeBlock.insertBefore(editorWrap, codePre.nextSibling);
      reveal(out);
      if (kbds.length) {
        stdin = el("textarea", "ex-stdin");
        stdin.value = stdin0;
        stdin.rows = Math.max(1, kbds.length);
        stdin.setAttribute("aria-label", "Ввод: строки, которые прочитает input()");
        var lab = el("span", "ex-stdin-label", "Ввод (строки, которые прочитает input()):");
        out.insertBefore(lab, outPre);
        out.insertBefore(stdin, outPre);
      }
      tools.innerHTML = "";
      runBtn = el("button", "ex-btn ex-btn-run", "▶ Запустить");
      resetBtn = el("button", "ex-btn", "↺ Сбросить");
      runBtn.type = resetBtn.type = "button";
      tools.appendChild(copyBtn); tools.appendChild(runBtn); tools.appendChild(resetBtn);
      runBtn.addEventListener("click", run);
      resetBtn.addEventListener("click", reset);
      codeBlock.classList.add("is-editing");
      if (auto !== true) editor.focus();
    }
    function run() {
      runBtn.disabled = true;
      outPre.textContent = workerReady ? "Запускаю…" : LOADING;
      var data = stdin ? stdin.value.replace(/\r\n?/g, "\n") + "\n" : "";
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
      tools.appendChild(copyBtn);
      tools.appendChild(edit);
      tools.appendChild(play);
      codeBlock.classList.remove("is-editing");
    }
    edit.addEventListener("click", function () { enterEdit(false); });
    play.addEventListener("click", function () { enterEdit(true); run(); });
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

  /* ---------------- версия 69: типичная ошибка «Правка | До и после» ----------------
     В заголовке карточки переключатель; выбор общий для сайта (настройка mv в theme.js,
     атрибут data-mistake у <html>). «До и после»: два окна кода рядом, измененные строки
     подсвечены, под каждым свой результат. */
  function mvOf() { var s = window.practiceSettings ? window.practiceSettings() : {}; return s.mv === "side" ? "side" : "diff"; }
  var mvSegs = [];
  function refreshMv() {
    var v = mvOf();
    document.documentElement.setAttribute("data-mistake", v);
    mvSegs.forEach(function (g) { Array.prototype.forEach.call(g.children, function (b) { b.setAttribute("aria-pressed", String(b._v === v)); }); });
  }
  function codeHtmlLines(block) {
    var code = block.querySelector("pre code") || block.querySelector("pre");
    var c = code.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll(".tok-out"), function (x) { x.parentNode.removeChild(x); });
    var lns = c.querySelectorAll(".ln");
    if (lns.length) return Array.prototype.map.call(lns, function (l) { return l.innerHTML.replace(/\s+$/, ""); });
    return c.textContent.replace(/\s+$/, "").split("\n").map(function (t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; });
  }
  function setupMistakeSide(card) {
    var wrong = card.querySelector(":scope > .code-wrong"), right = card.querySelector(":scope > .code-right");
    var cap = card.querySelector(":scope > .mistake-caption");
    if (!wrong || !right || !cap || card.querySelector(":scope > .mside")) return;
    var title = el("span", "mk-title"); while (cap.firstChild) title.appendChild(cap.firstChild);
    cap.appendChild(title); cap.classList.add("mk-head");
    var g = el("div", "seg"); g.setAttribute("role", "group"); g.setAttribute("aria-label", "Вид типичной ошибки");
    [["diff", "Правка"], ["side", "До и после"]].forEach(function (o) {
      var b = el("button", "seg-btn", o[1]); b.type = "button"; b._v = o[0];
      b.addEventListener("click", function () { if (window.practiceSet) window.practiceSet("mv", o[0]); else { document.documentElement.setAttribute("data-mistake", o[0]); } refreshMv(); });
      g.appendChild(b);
    });
    cap.appendChild(g); mvSegs.push(g);
    var a = codeLines(wrong), b2 = codeLines(right), d = lineDiff(a, b2), chW = {}, chR = {}, iw = 0, ir = 0;
    d.forEach(function (x) { if (x[0] === " ") { iw++; ir++; } else if (x[0] === "-") { chW[iw++] = 1; } else { chR[ir++] = 1; } });
    var why = ((wrong.querySelector(".code-label") || {}).textContent || "").replace(/^\s*Неверно:?\s*/, "");
    var side = el("div", "mside");
    [[wrong, "С ошибкой", why, "bad", chW], [right, "Исправлено", "верно", "good", chR]].forEach(function (x) {
      var col = el("div", "mside-col mside-" + x[3]);
      var win = el("div", "mside-win");
      var bar = el("div", "mside-bar"); bar.appendChild(el("b", "", x[1])); bar.appendChild(el("span", "", x[2]));
      win.appendChild(bar);
      var pre = el("pre", "mside-code"), code = el("code");
      code.innerHTML = codeHtmlLines(x[0]).map(function (h, i) { return '<span class="ml' + (x[4][i] ? " is-chg" : "") + '">' + (h || " ") + "</span>"; }).join("");
      pre.appendChild(code); win.appendChild(pre); col.appendChild(win);
      var out = resultOf(x[0]);
      if (out) {
        var isErr = out.classList.contains("error-output");
        var box = el("div", "mdiff-box mdiff-" + x[3]);
        box.appendChild(el("span", "mdiff-sub", x[1] + (isErr ? " · сообщение об ошибке" : " · вывод")));
        var o = el("pre", "mdiff-out" + (isErr ? " mdiff-err" : "")); o.textContent = (out.querySelector("pre") || out).textContent;
        box.appendChild(o); col.appendChild(box);
      }
      side.appendChild(col);
    });
    var res = card.querySelector(":scope > .mdiff-res");
    card.insertBefore(side, res ? res.nextSibling : cap.nextSibling);
  }

  /* ---------------- версия 69: пример «Сразу | По шагам» ----------------
     Данные готовит build_steps.py (script.steps-data в article.example): строки кода, шаги
     с подставленными значениями, переменные, строки таблицы трассировки, пояснения.
     Высота блока по шагам постоянна: кнопки не сдвигаются, таблица прокручивается внутри. */
  var SPEEDS = [[0.5, "0,5×"], [1, "1×"], [2, "2×"]];
  function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function setupStepper(art) {
    var src = art.querySelector(":scope > script.steps-data");
    var h3 = art.querySelector(":scope > h3");
    if (!src || !h3 || art.querySelector(":scope > .st-head")) return;
    var D; try { D = JSON.parse(src.textContent); } catch (e) { return; }
    var last = D.steps.length - 1, step = 0, timer = null, speed = 1, mode = "whole";
    var outInTable = D.columns.indexOf("напечатано") >= 0;
    var names = []; D.steps[last].vars.forEach(function (v) { names.push(v[0]); });
    var head = el("div", "st-head"); art.insertBefore(head, h3); head.appendChild(h3);
    var sw = el("div", "st-switch"); sw.appendChild(el("span", "st-switch-label", "Разбор"));
    var g = el("div", "seg"); g.setAttribute("role", "group"); g.setAttribute("aria-label", "Разбор примера");
    [["whole", "Сразу"], ["steps", "По шагам"]].forEach(function (o) {
      var b = el("button", "seg-btn", o[1]); b.type = "button"; b._v = o[0];
      b.addEventListener("click", function () { stop(); mode = o[0]; step = 0; render(); });
      g.appendChild(b);
    });
    sw.appendChild(g); head.appendChild(sw);

    var box = el("div", "stp"); box.hidden = true; box.tabIndex = -1; art.appendChild(box);
    box.innerHTML =
      '<p class="st-lead">«Дальше» выполняет одну строку. Подсвечена строка, которая выполняется; в ней вместо имен стоят их значения.</p>' +
      '<div class="st-grid"><div class="st-left"><div class="code-block st-code"><span class="code-label"></span><div class="st-lines-wrap"><div class="st-lines"></div></div></div>' +
      '<div class="st-note" aria-live="polite"></div></div>' +
      '<div class="st-right"><div class="st-right-in"><div class="st-vars"><span class="st-vars-h">Переменные</span><div class="st-vars-b"></div></div>' +
      (D.columns.length ? '<div class="st-trace"><table class="data trace"><thead><tr>' + D.columns.map(function (c) { return "<th>" + escHtml(c) + "</th>"; }).join("") + '</tr></thead><tbody></tbody></table></div>' : "") +
      (outInTable ? "" : '<div class="output-block st-out"><span class="output-label">Вывод</span><pre></pre></div>') +
      "</div></div></div>" +
      '<div class="st-ctrl"><button type="button" class="st-btn" data-a="back">← Назад</button><button type="button" class="st-btn is-main" data-a="next">Дальше →</button>' +
      '<button type="button" class="st-btn is-play" data-a="auto" aria-pressed="false"></button><div class="seg st-speed" role="group" aria-label="Скорость"></div>' +
      '<button type="button" class="st-btn" data-a="reset">Сначала</button><span class="st-count"></span></div>';
    box.querySelector(".code-label").textContent = D.file || "";
    var linesEl = box.querySelector(".st-lines"), noteEl = box.querySelector(".st-note"), varsEl = box.querySelector(".st-vars-b");
    var tbody = box.querySelector("tbody"), traceEl = box.querySelector(".st-trace"), outEl = box.querySelector(".st-out pre");
    var bBack = box.querySelector('[data-a="back"]'), bNext = box.querySelector('[data-a="next"]'), bAuto = box.querySelector('[data-a="auto"]');
    var bReset = box.querySelector('[data-a="reset"]'), cnt = box.querySelector(".st-count"), sp = box.querySelector(".st-speed");
    SPEEDS.forEach(function (s) {
      var b = el("button", "seg-btn", s[1]); b.type = "button"; b._v = s[0];
      b.addEventListener("click", function () { speed = s[0]; if (timer) play(); else render(); });
      sp.appendChild(b);
    });
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      stop(); if (step >= last) step = 0;
      timer = setInterval(function () { if (step < last) step++; if (step >= last) stop(); render(); }, Math.round(1500 / speed));
      render();
    }
    bBack.addEventListener("click", function () { stop(); step = Math.max(0, step - 1); render(); });
    bNext.addEventListener("click", function () { stop(); step = Math.min(last, step + 1); render(); });
    bAuto.addEventListener("click", function () { if (timer) { stop(); render(); } else play(); });
    bReset.addEventListener("click", function () { stop(); step = 0; render(); });
    box.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); bNext.click(); } else if (e.key === "ArrowLeft") { e.preventDefault(); bBack.click(); }
    });
    var ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1v10l9-5z"/></svg>';
    var ICON_PAUSE = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1" width="3" height="10"/><rect x="7.5" y="1" width="3" height="10"/></svg>';
    function render() {
      Array.prototype.forEach.call(g.children, function (b) { b.setAttribute("aria-pressed", String(b._v === mode)); });
      art.classList.toggle("is-steps", mode === "steps");
      box.hidden = mode !== "steps";
      if (mode !== "steps") return;
      if (!fitted) fit();
      draw();
    }
    /* версия 69: если вся таблица трассировки выше колонки кода не больше чем на треть окна
       кода, блок растет до полной таблицы и прокрутки нет; иначе таблица прокручивается */
    var fitted = false;
    function fit() {
      fitted = true;
      var grid = box.querySelector(".st-grid"), rin = box.querySelector(".st-right-in");
      var left = box.querySelector(".st-left"), code = box.querySelector(".st-code");
      grid.style.minHeight = "";
      if (window.getComputedStyle(rin).position !== "absolute") return;
      var keep = step; step = last; draw(); step = keep;
      var gap = parseFloat(window.getComputedStyle(rin).rowGap) || 0, need = 0, n = 0;
      Array.prototype.forEach.call(rin.children, function (c) {
        need += c.classList.contains("st-trace") ? c.querySelector("table").offsetHeight + 2 : c.offsetHeight; n++;
      });
      need += gap * Math.max(0, n - 1);
      var have = Math.max(left.offsetHeight, grid.offsetHeight);
      if (need > have && need - have <= code.offsetHeight / 3) grid.style.minHeight = Math.ceil(need) + "px";
    }
    window.addEventListener("resize", function () { if (mode === "steps") { fitted = false; render(); } });
    function draw() {
      var cur = D.steps[step];
      linesEl.innerHTML = D.code.map(function (h, i) {
        var on = cur.line === i + 1;
        return '<span class="st-ln' + (on ? " is-cur" : "") + '">' + ((on ? cur.html : h) || " ") + "</span>";
      }).join("");
      var vals = {}; cur.vars.forEach(function (v) { vals[v[0]] = v; });
      varsEl.innerHTML = names.map(function (n) {
        var v = vals[n];
        return '<div class="st-var' + (v && v[2] ? " is-chg" : "") + (v ? "" : " is-none") + '"><b>' + escHtml(n) + "</b><span>" + (v ? escHtml(v[1]) : "—") + "</span></div>";
      }).join("");
      if (tbody) {
        var rows = [];
        for (var k = 0; k <= step; k++) if (D.steps[k].row) rows.push('<tr' + (k === step ? ' class="is-new"' : "") + ">" + D.steps[k].row.map(function (c) { return "<td>" + escHtml(c) + "</td>"; }).join("") + "</tr>");
        tbody.innerHTML = rows.join("") || '<tr><td colspan="' + D.columns.length + '" class="st-empty">Строки появятся после первого прохода цикла.</td></tr>';
        traceEl.scrollTop = traceEl.scrollHeight;
      }
      if (outEl) outEl.textContent = cur.out ? cur.out.replace(/\n$/, "") : "";
      noteEl.textContent = cur.note;
      noteEl.classList.toggle("is-final", cur.line === 0);
      bBack.disabled = step === 0; bNext.disabled = step >= last; bReset.disabled = step === 0 && !timer;
      bAuto.innerHTML = timer ? ICON_PAUSE + "Пауза" : ICON_PLAY + (step >= last ? "Еще раз" : "Авто");
      bAuto.setAttribute("aria-pressed", String(!!timer));
      Array.prototype.forEach.call(sp.children, function (b) { b.setAttribute("aria-pressed", String(b._v === speed)); });
      cnt.textContent = "Шаг " + (step + 1) + " из " + (last + 1);
    }
    render();
  }

  function addCopyButtons() {
    Array.prototype.forEach.call(document.querySelectorAll(".code-block"), function (block) {
      if (block.querySelector(".ex-tools .tb-copy-code") || block.querySelector(":scope > .tb-copy-floating")) return;
      var pre = block.querySelector("pre");
      if (!pre) return;
      block.appendChild(copyButton(function () {
        var ed = block.querySelector(".ex-editor");
        return ed ? ed.value : pre.textContent;
      }, "tb-copy-floating"));
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".level-tabs"), setupTabs);
    Array.prototype.forEach.call(document.querySelectorAll(".output-block.predict"), setupPredict);
    initProgress();
    setupAnchors();
    Array.prototype.forEach.call(document.querySelectorAll(".mistake"), setupMistakeDiff);
    Array.prototype.forEach.call(document.querySelectorAll(".mistake.mistake-diff"), setupMistakeSide);
    refreshMv();
    document.documentElement.addEventListener("practice:settings", refreshMv);
    Array.prototype.forEach.call(document.querySelectorAll("article.example"), setupStepper);
    if (typeof Worker === "undefined" || typeof Blob === "undefined") { addCopyButtons(); return; }
    var blocks = document.querySelectorAll(".checker");
    for (var i = 0; i < blocks.length; i++) {
      var fb = blocks[i].querySelector(".checker-fallback");
      if (fb) fb.parentNode.removeChild(fb);
      setupChecker(blocks[i]);
    }
    var codes = document.querySelectorAll(".code-block");
    for (var j = 0; j < codes.length; j++) setupExample(codes[j]);
    addCopyButtons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
