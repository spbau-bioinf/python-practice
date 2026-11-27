/* Анимации страницы t6_02 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {esc, Py, pyRepr, dictRepr, dictView, setPair, delPair, reg} = A;
{
  function cellsView(s) {
    let html = `<div class="an-cells" data-n="${s.size}">`;
    for (let i = 0; i < s.size; i += 1) {
      const slot = s.slots[i];
      const cls = [slot ? "filled" : "", s.mark[i] || ""].join(" ");
      html += `<div class="an-cell ${cls}"><span class="an-no">${i}</span>${slot ? esc(slot.k) + `<span class="an-cv">${esc(slot.v)}</span>` : ""}</div>`;
    }
    return (s.f ? `<div class="an-formula">${s.f}</div>` : "") + html + "</div>";
  }
  function insert(s, key, val) {
    let slot = key % s.size; const start = slot; let probes = [];
    while (s.slots[slot]) { s.mark[slot] = "error"; probes.push(slot); slot = (slot + 1) % s.size; }
    s.slots[slot] = {k: key, v: val}; s.mark[slot] = "new";
    s.f = `hash(${key}) = <b>${key}</b> → ${key} % ${s.size} = <b>${start}</b>` + (probes.length ? ` → занято ${probes.join(", ")} → ячейка <b>${slot}</b>` : "");
  }
  function lookup(s, key) {
    let slot = key % s.size; const path = [];
    while (s.slots[slot] && s.slots[slot].k !== key) { s.mark[slot] = "probe"; path.push(slot); slot = (slot + 1) % s.size; }
    path.push(slot);
    if (s.slots[slot]) { s.mark[slot] = "found"; s.out.push({t: s.slots[slot].v}); }
    else { s.mark[slot] = "probe"; s.out.push({t: "KeyError: " + key, err: true}); }
    s.f = `поиск ${key}: проверены ячейки <b>${path.join(", ")}</b>`;
  }
  reg("t6_02_s1", {file: "table.py", 
    code: ['d = {}', 'd[10] = "A"', 'd[18] = "C"', 'd[26] = "G"', 'print(d[18])', 'print(d[15])'],
    note: "Учебная модель упрощена: в CPython следующая ячейка вычисляется формулой от хеша, а хеш строки зависит от случайной соли и меняется от запуска к запуску. Правило поиска — остановиться на равном ключе или на пустой ячейке — то же.",
    init: () => ({size: 8, slots: new Array(8).fill(null), f: ""}),
    view: cellsView,
    steps: [
      {line: 0, title: "Пустая таблица", text: "Внутри словаря — таблица из ячеек. Пусть их 8: <code>size = 8</code>.", caption: "Все ячейки пусты."},
      {line: 1, title: "Ключ 10", text: "У небольших целых чисел хеш равен самому числу: <code>hash(10)</code> равно 10. Начальная ячейка — остаток <code>10 % 8</code>, то есть 2. Она свободна.", caption: "10 → ячейка <b>2</b>.",
       act: s => insert(s, 10, "A")},
      {line: 2, title: "Коллизия", text: "<code>18 % 8</code> тоже 2, а ячейка 2 занята ключом 10. Это коллизия: новый ключ проверяет следующую ячейку, 3, и встает в нее.", caption: "18 → ячейка 2 занята → ячейка <b>3</b>.",
       act: s => insert(s, 18, "C")},
      {line: 3, title: "Две коллизии подряд", text: "<code>26 % 8</code> снова 2. Заняты ячейки 2 и 3, ключ встает в 4.", caption: "26 → 2 и 3 заняты → ячейка <b>4</b>.",
       act: s => insert(s, 26, "G")},
      {line: 4, title: "Поиск идет тем же путем", text: "Поиск начинается с ячейки 2 и сравнивает ключи оператором <code>==</code>. В ячейке 2 ключ 10 — не тот, в ячейке 3 ключ 18 — найден.", caption: "<code>d[18]</code>: ячейки 2, 3 → <b>C</b>.",
       act: s => lookup(s, 18)},
      {line: 5, title: "Пустая ячейка — ключа нет", text: "<code>15 % 8</code> равно 7. Ячейка 7 пуста: поиск останавливается, ключа в словаре нет. Поэтому таблицу никогда не заполняют целиком.", caption: "<code>d[15]</code>: ячейка 7 пуста → <b>KeyError</b>.",
       act: s => lookup(s, 15)}
    ]
  });
}
{
  const CELL = {"(17, 100)": 7, "(13, 100)": 3, "1": 1};
  const HASH = {"(17, 100)": "689249996352362279", "(13, 100)": "-1420762738194193525", "1": "1"};
  function view(s) {
    let html = '<div class="an-cells" data-n="8">';
    for (let i = 0; i < 8; i += 1) {
      const slot = s.slots[i];
      html += `<div class="an-cell ${slot ? "filled" : ""} ${s.mark[i] || ""}"><span class="an-no">${i}</span>${slot ? esc(slot.k) + `<span class="an-cv">${esc(slot.v)}</span>` : ""}</div>`;
    }
    return (s.f ? `<div class="an-formula">${s.f}</div>` : "") + html + "</div>" + dictView("d", s.pairs, s.pm);
  }
  function put(s, key, shown, val) {
    const cell = CELL[key]; s.pm = {};
    s.f = `hash(${esc(shown)}) = <b>${HASH[key]}</b> → % 8 = <b>${cell}</b>`;
    if (s.slots[cell]) { s.slots[cell].v = val; s.mark[cell] = "found"; s.pm[s.slots[cell].k] = "changed"; s.pairs.find(p => String(p.k) === s.slots[cell].k).v = val; }
    else { s.slots[cell] = {k: shown, v: val}; s.mark[cell] = "new"; s.pairs.push({k: new Py(shown), v: val}); s.pm[shown] = "new"; }
  }
  reg("t6_02_s2", {file: "keys.py", 
    code: ['d = {}', 'd[(17, 100)] = "G"', 'd[13, 100] = "T"', 'd[["A", "T"]] = 1', 'd[1] = "int"', 'd[1.0] = "float"', 'print(d)'],
    init: () => ({slots: new Array(8).fill(null), pairs: [], f: "", pm: {}}),
    view: view,
    steps: [
      {line: 0, title: "Пустой словарь", text: "Таблица из 8 ячеек. Ключи будут разных типов.", caption: "Словарь пуст."},
      {line: 1, title: "Кортеж — хороший ключ", text: "Кортеж нельзя изменить, поэтому его хеш постоянный. Хеш кортежа Python вычисляет из хешей его элементов.", caption: "Ключ <code>(17, 100)</code> → ячейка <b>7</b>.",
       act: s => put(s, "(17, 100)", "(17, 100)", "G")},
      {line: 2, title: "Та же позиция, другая хромосома", text: "<code>d[13, 100]</code> — тоже кортеж, скобки можно не писать. Хеш у него другой, ячейка другая: пары не путаются.", caption: "Ключ <code>(13, 100)</code> → ячейка <b>3</b>.",
       act: s => put(s, "(13, 100)", "(13, 100)", "T")},
      {line: 3, title: "Список ключом быть не может", text: "Список можно изменить после вставки — тогда изменился бы и хеш, и словарь искал бы ключ не в той ячейке. Поэтому у списка хеша нет, и программа останавливается.", caption: "<b>TypeError</b>: список нехешируем; словарь не изменился.",
       act: s => { s.pm = {}; s.f = 'hash(["A", "T"]) → <b>ошибка</b>'; s.out.push({t: "TypeError: unhashable type: 'list'", err: true}); }},
      {line: 4, title: "Целое 1", text: "Чтобы продолжить, считаем, что строка 4 убрана. <code>hash(1)</code> равно 1, ключ встает в ячейку 1.", caption: "Ключ <code>1</code> → ячейка <b>1</b>.",
       act: s => { s.out.length = 0; put(s, "1", "1", "int"); }},
      {line: 5, title: "1.0 — тот же ключ", text: "<code>1.0 == 1</code>, и хеши у них равны. Поиск находит в ячейке 1 равный ключ и заменяет значение. Ключом остается первым записанный — целое 1.", caption: "Ячейка 1: значение заменено, ключ остался <b>1</b>.",
       act: s => put(s, "1", "1.0", "float")},
      {line: 6, title: "Печать", text: "В словаре три пары, а не четыре: 1 и 1.0 — один ключ. Так же с ними равно и <code>True</code>.", caption: "Пар <b>3</b>.",
       act: s => { s.pm = {}; s.f = ""; s.out.push({t: "{(17, 100): 'G', (13, 100): 'T', 1: 'float'}"}); }}
    ]
  });
}
});
