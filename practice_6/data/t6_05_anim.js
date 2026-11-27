/* Анимации страницы t6_05 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {esc, reg} = A;
function chips(name, items, mark, open, close) {
  return `<div class="an-list"><span class="an-brace">${esc(name)} ${open}</span>` +
    (items.length ? items.map(x => `<span class="an-item ${mark[x] || ""}">'${esc(x)}'</span>`).join('<span class="an-comma">,</span>') : '<span class="an-empty">пусто</span>') +
    `<span class="an-brace">${close}</span></div>`;
}
{
  const SEQ = "GATTACA";
  const steps = [
    {line: 0, title: "Последовательность", text: "Соберем буквы <code>GATTACA</code> в множество. <code>set(seq)</code> делает это одним вызовом; здесь то же самое разложено на шаги.", caption: "Семь букв, среди них есть повторы."},
    {line: 1, title: "Пустое множество", text: "Пустое множество создают только вызовом <code>set()</code>: пустые фигурные скобки дали бы словарь.", caption: "<code>bases</code> пусто.", act: s => { s.made = true; }}
  ];
  [...SEQ].forEach((ch, i) => {
    const dup = SEQ.slice(0, i).includes(ch);
    steps.push({line: 3, title: `Буква ${i + 1}: ${ch}`, text: dup ? `Буква <code>${ch}</code> уже есть. <code>add()</code> ничего не меняет и ошибки не дает.` : `Буквы <code>${ch}</code> еще нет — <code>add()</code> добавляет ее.`,
      caption: dup ? `<code>${ch}</code> — повтор, элементов по-прежнему ${new Set(SEQ.slice(0, i)).size}.` : `<code>${ch}</code> добавлена, элементов <b>${new Set(SEQ.slice(0, i + 1)).size}</b>.`,
      act: s => { s.k = i; if (dup) s.mark[ch] = "found"; else { s.items.push(ch); s.mark[ch] = "new"; } }});
  });
  steps.push({line: 4, title: "Печать через sorted()", text: "Порядок элементов множества не гарантирован, поэтому его печатают через <code>sorted()</code> — список по алфавиту.", caption: "<b>['A', 'C', 'G', 'T']</b>.",
    act: s => { s.k = null; s.out.push({t: "['A', 'C', 'G', 'T']"}); }});
  steps.push({line: 5, title: "Число разных букв", text: "В строке 7 букв, разных среди них 4.", caption: "<code>len(bases)</code> = <b>4</b>.", act: s => { s.out.push({t: "4"}); }});
  reg("t6_05_s1", {file: "bases.py", 
    code: ['seq = "GATTACA"', 'bases = set()', 'for base in seq:', '    bases.add(base)', 'print(sorted(bases))', 'print(len(bases))'],
    init: () => ({items: [], k: null, made: false}),
    view: s => '<div class="an-list"><span class="an-brace">seq =</span>' + [...SEQ].map((ch, i) => `<span class="an-item ${i === s.k ? "found" : ""}"><span class="an-idx">${i}</span>${ch}</span>`).join("") + "</div>"
      + (s.made ? chips("bases =", s.items, s.mark, "{", "}") : ""),
    steps
  });
}
{
  const a = ["A", "C", "G", "T"], b = ["G", "N", "T"];
  const OPS = [
    {op: "a | b", line: 2, title: "Объединение", text: "Элементы, которые есть хотя бы в одном множестве. Общие G и T входят один раз.", res: ["A", "C", "G", "N", "T"]},
    {op: "a & b", line: 3, title: "Пересечение", text: "Только общие элементы.", res: ["G", "T"]},
    {op: "a - b", line: 4, title: "Разность a - b", text: "Элементы <code>a</code>, которых нет в <code>b</code>.", res: ["A", "C"]},
    {op: "b - a", line: 5, title: "Разность b - a", text: "Порядок операндов поменялся — результат другой: элементы <code>b</code>, которых нет в <code>a</code>.", res: ["N"]},
    {op: "a ^ b", line: 6, title: "Симметрическая разность", text: "Элементы ровно одного из множеств: вместе обе разности.", res: ["A", "C", "N"]}
  ];
  reg("t6_05_s2", {file: "sets.py", 
    code: ['a = set("GATTACA")', 'b = set("TTGN")', 'print(sorted(a | b))', 'print(sorted(a & b))', 'print(sorted(a - b))', 'print(sorted(b - a))', 'print(sorted(a ^ b))'],
    init: () => ({cur: null}),
    view: s => {
      const res = s.cur ? s.cur.res : [];
      const mk = arr => Object.fromEntries(arr.map(x => [x, res.includes(x) ? "found" : ""]));
      return chips("a =", a, mk(a), "{", "}") + chips("b =", b, mk(b), "{", "}")
        + (s.cur ? `<div class="an-formula">sorted(${s.cur.op}) = <b>[${res.map(x => "'" + x + "'").join(", ")}]</b></div>` : "");
    },
    steps: [
      {line: 1, title: "Два множества", text: "Буквы <code>GATTACA</code> и буквы <code>TTGN</code>. Общие — G и T.", caption: "<code>a</code> — 4 элемента, <code>b</code> — 3."},
      ...OPS.map(o => ({line: o.line, title: o.title, text: o.text + " Исходные множества не меняются.", caption: `<code>${o.op}</code>: синие элементы попадают в результат.`,
        act: s => { s.cur = o; s.out.push({t: "[" + o.res.map(x => "'" + x + "'").join(", ") + "]"}); }}))
    ]
  });
}
});
