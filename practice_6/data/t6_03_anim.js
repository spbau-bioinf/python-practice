/* Анимации страницы t6_03 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {esc, Py, pyRepr, dictRepr, dictView, setPair, delPair, reg} = A;
{
  const IDS = ["s1", "s2", "s1"], LENS = [8, 12, 5];
  function lists(k) {
    const row = (name, arr) => `<div class="an-list"><span class="an-brace">${name} = [</span>` + arr.map((x, i) =>
      `<span class="an-item ${i === k ? "found" : ""}"><span class="an-idx">${i}</span>${esc(pyRepr(x))}</span>`).join('<span class="an-comma">,</span>') + '<span class="an-brace">]</span></div>';
    return row("ids", IDS) + row("lengths", LENS);
  }
  const step = i => s => { s.k = i; s.mark[IDS[i]] = setPair(s.pairs, IDS[i], LENS[i]); s.pair = `("${IDS[i]}", ${LENS[i]})`; };
  reg("t6_03_s1", {file: "build.py", 
    code: ['ids = ["s1", "s2", "s1"]', 'lengths = [8, 12, 5]', 'length_of = dict(zip(ids, lengths))', 'print(length_of)'],
    init: () => ({pairs: [], k: null, pair: ""}),
    view: s => lists(s.k) + (s.pair ? `<div class="an-formula">пара из zip(): <b>${esc(s.pair)}</b></div>` : "") + dictView("length_of", s.pairs, s.mark),
    steps: [
      {line: 0, title: "Два параллельных списка", text: "Названия и длины лежат в разных списках, связаны только позицией. Название <code>\"s1\"</code> встречается дважды: образец прочитали еще раз.", caption: "Словаря пока нет."},
      {line: 2, title: "Первая пара", text: "<code>zip()</code> берет элементы с позицией 0 из обоих списков, <code>dict()</code> записывает пару в словарь.", caption: "<code>\"s1\"</code> → 8.", act: step(0)},
      {line: 2, title: "Вторая пара", text: "Позиция 1: новый ключ <code>\"s2\"</code> встает в конец.", caption: "<code>\"s2\"</code> → 12.", act: step(1)},
      {line: 2, title: "Повторный ключ", text: "Позиция 2: ключ <code>\"s1\"</code> уже есть. Как при обычном присваивании, значение заменяется, а место ключа остается прежним.", caption: "<code>\"s1\"</code>: 8 → <b>5</b>. В словаре остается последнее значение.", act: step(2)},
      {line: 3, title: "Итог", text: "Пар две, а не три: ключи в словаре не повторяются.", caption: "<code>len(length_of)</code> = <b>2</b>.",
       act: s => { s.k = null; s.pair = ""; s.out.push({t: dictRepr(s.pairs)}); }}
    ]
  });
}
{
  const PAIRS = [{k: "T", v: 8}, {k: "A", v: 12}, {k: "G", v: 15}];
  reg("t6_03_s2", {file: "order.py", 
    code: ['counts = {"T": 8, "A": 12, "G": 15}', 'for base, count in counts.items():', '    if count > 10:', '        print(base, count)', 'print(sorted(counts))'],
    init: () => ({pairs: PAIRS.map(p => ({...p})), now: null, sorted: null}),
    view: s => dictView("counts", s.pairs, s.mark) + (s.now ? `<div class="an-formula">base = <b>${s.now.k}</b>, count = <b>${s.now.v}</b> → ${s.now.v > 10 ? "больше 10, печатаем" : "не больше 10"}</div>` : "") + (s.sorted ? `<div class="an-formula">sorted(counts) = <b>${esc(s.sorted)}</b> — новый список, словарь не изменился</div>` : ""),
    steps: [
      {line: 0, title: "Порядок вставки", text: "Ключи записаны в порядке T, A, G — в нем же пойдет перебор.", caption: "Три пары."},
      ...PAIRS.map((p, i) => ({line: p.v > 10 ? 3 : 2, title: `Шаг цикла ${i + 1}: ${p.k}`, text: `<code>items()</code> отдает пару «ключ, значение», и она сразу распаковывается в <code>base</code> и <code>count</code>.`,
        caption: `${p.k}: ${p.v} ${p.v > 10 ? "→ печатается" : "→ пропускается"}.`,
        act: s => { s.now = p; s.mark[p.k] = "found"; if (p.v > 10) s.out.push({t: p.k + " " + p.v}); }})),
      {line: 4, title: "sorted()", text: "<code>sorted(counts)</code> перебирает ключи и возвращает новый список по алфавиту. Сам словарь остается в порядке вставки.", caption: "<b>['A', 'G', 'T']</b>.",
       act: s => { s.now = null; s.sorted = "['A', 'G', 'T']"; s.out.push({t: "['A', 'G', 'T']"}); }}
    ]
  });
}
{
  const START = [{k: "A", v: 12}, {k: "T", v: 8}, {k: "G", v: 15}, {k: "C", v: 9}];
  reg("t6_03_s3", {file: "remove.py", 
    code: ['counts = {"A": 12, "T": 8, "G": 15, "C": 9}', 'for base in counts:  # неверно', '    if counts[base] < 10:', '        del counts[base]', 'for base in list(counts):  # верно', '    if counts[base] < 10:', '        del counts[base]', 'print(counts)'],
    note: "В настоящей программе после ошибки первый цикл до второго не дошел бы; здесь оба цикла показаны по очереди на одном и том же исходном словаре.",
    init: () => ({pairs: START.map(p => ({...p})), copy: null}),
    view: s => dictView("counts", s.pairs, s.mark) + (s.copy ? `<div class="an-list"><span class="an-brace">list(counts) = [</span>${s.copy.map(k => `<span class="an-item ${s.cur === k ? "found" : ""}">'${k}'</span>`).join('<span class="an-comma">,</span>')}<span class="an-brace">]</span></div>` : ""),
    steps: [
      {line: 0, title: "Удалим счетчики меньше 10", text: "Нужно убрать из словаря буквы, встретившиеся меньше 10 раз: <code>T</code> и <code>C</code>.", caption: "Четыре пары."},
      {line: 2, title: "Цикл прямо по словарю", text: "Первые ключи: <code>A</code> (12) остается, <code>T</code> (8) нужно удалить.", caption: "Дошли до <code>T</code>.", act: s => { s.mark.T = "error"; }},
      {line: 3, title: "RuntimeError", text: "Удаление меняет число пар в словаре, по которому идет цикл. Python не может продолжить перебор и останавливает программу.", caption: "<b>RuntimeError</b>: dictionary changed size during iteration.",
       act: s => { s.mark.T = "error"; s.out.push({t: "RuntimeError: dictionary changed size during iteration", err: true}); }},
      {line: 4, title: "Перебор списка ключей", text: "Вернемся к исходному словарю. <code>list(counts)</code> — отдельный список ключей. Цикл идет по нему, а удалять можно из словаря.", caption: "Список ключей сделан до цикла.",
       act: s => { s.out.length = 0; s.copy = START.map(p => p.k); }},
      ...["A", "T", "G", "C"].map(k => ({line: START.find(p => p.k === k).v < 10 ? 6 : 5, title: `Ключ ${k}`, text: START.find(p => p.k === k).v < 10 ? "Значение меньше 10 — пара удаляется из словаря. Список ключей не меняется, цикл идет дальше." : "Значение не меньше 10 — пара остается.",
        caption: `${k}: ${START.find(p => p.k === k).v}.`,
        act: s => { s.cur = k; if (START.find(p => p.k === k).v < 10) { delPair(s.pairs, k); } else s.mark[k] = "found"; }})),
      {line: 7, title: "Итог", text: "Остались <code>A</code> и <code>G</code>. Ошибки нет: цикл шел по списку, а не по словарю.", caption: "<b>{'A': 12, 'G': 15}</b>.",
       act: s => { s.cur = null; s.out.push({t: "{'A': 12, 'G': 15}"}); }}
    ]
  });
}
});
