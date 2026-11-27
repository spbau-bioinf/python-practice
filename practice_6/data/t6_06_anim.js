/* Анимации страницы t6_06 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {Py, dictView, reg} = A;
const asCounter = (name, obj, mark) => dictView(name, Object.entries(obj).map(([k, v]) => ({k, v})), mark || {});
{
  const first = {A: 2, C: 1, G: 1}, second = {A: 1, C: 2, T: 1};
  const LETTERS = ["A", "C", "G", "T"];
  const steps = [
    {line: 0, title: "Два прочтения", text: "Сравним состав двух прочтений одного участка. <code>Counter</code> подключен из модуля <code>collections</code>.", caption: "Счетчиков пока нет."},
    {line: 1, title: "Первое прочтение", text: "<code>Counter(\"AACG\")</code>: две A, по одной C и G.", caption: "<code>first</code> — состав первого прочтения.", act: s => { s.show1 = true; }},
    {line: 2, title: "Второе прочтение", text: "<code>Counter(\"ACCT\")</code>: одна A, две C, одна T.", caption: "<code>second</code> — состав второго.", act: s => { s.show2 = true; }},
    {line: 3, title: "Сумма", text: "Числа одинаковых букв складываются; буква, которая есть только в одном счетчике, переходит с тем же числом.", caption: "A: 2 + 1, C: 1 + 2, G: 1 + 0, T: 0 + 1.",
     act: s => { s.res = {name: "first + second", obj: {A: 3, C: 3, G: 1, T: 1}}; s.out.push({t: "Counter({'A': 3, 'C': 3, 'G': 1, 'T': 1})"}); }}
  ];
  LETTERS.forEach((b, i) => {
    const d = (first[b] || 0) - (second[b] || 0);
    steps.push({line: 4, title: `Разность: ${b}`, text: i === 0 ? "Разность вычитает числа по буквам. Положительный результат остается в счетчике." : (d > 0 ? "Результат положительный — буква остается." : "Результат не положительный — буква в разность не попадает."),
      caption: `${b}: ${first[b] || 0} − ${second[b] || 0} = <b>${d}</b>` + (d > 0 ? " — остается." : " — отброшено."),
      act: s => { if (i === 0) s.res = {name: "first - second", obj: {}}; s.cur = b; s.drop = null; if (d > 0) { s.res.obj[b] = d; s.mark[b] = "new"; } else { s.drop = b; } }});
  });
  steps.push({line: 4, title: "Итог разности", text: "Остались A и G — то, чего в первом прочтении больше. <code>second - first</code> дала бы C и T.", caption: "<b>Counter({'A': 1, 'G': 1})</b>.",
    act: s => { s.cur = null; s.drop = null; s.out.push({t: "Counter({'A': 1, 'G': 1})"}); }});
  reg("t6_06_s2", {file: "reads.py", 
    code: ['from collections import Counter', 'first = Counter("AACG")', 'second = Counter("ACCT")', 'print(first + second)', 'print(first - second)'],
    init: () => ({show1: false, show2: false, res: null, cur: null, drop: null}),
    view: s => (s.show1 ? asCounter("first", first, s.cur ? {[s.cur]: "found"} : {}) : "")
      + (s.show2 ? asCounter("second", second, s.cur ? {[s.cur]: "found"} : {}) : "")
      + (s.drop ? `<div class="an-row"><span class="an-tag is-red">${s.drop}: не положительно — отброшено</span></div>` : "")
      + (s.res ? asCounter(s.res.name, s.res.obj, s.mark) : ""),
    steps
  });
}
{
  reg("t6_06_s3", {file: "trap.py", 
    code: ['from collections import defaultdict', 'groups = defaultdict(list)', 'print(groups.get(5))', 'print(5 in groups)', 'print(groups[5])', 'print(5 in groups, len(groups))'],
    init: () => ({pairs: [], made: false, q: null}),
    view: s => (s.made ? dictView("groups", s.pairs, s.mark) : "") + (s.q ? `<div class="an-row"><span class="an-formula">${s.q}</span><span class="an-tag ${s.tagc || ""}">${s.tag}</span></div>` : ""),
    steps: [
      {line: 0, title: "Ловушка defaultdict", text: "Посмотрим, какие обращения к <code>defaultdict</code> меняют словарь, а какие нет.", caption: "Словаря пока нет."},
      {line: 1, title: "Пустой defaultdict", text: "Фабрика <code>list</code>: для отсутствующего ключа будет создан пустой список.", caption: "Пар нет.", act: s => { s.made = true; }},
      {line: 2, title: "get() ничего не создает", text: "<code>get()</code> работает как у обычного словаря: ключа нет — <code>None</code>. Фабрика не вызывается.", caption: "<code>groups.get(5)</code> → <b>None</b>, пар по-прежнему 0.",
       act: s => { s.q = "groups.get(5)"; s.tag = "словарь не изменился"; s.tagc = ""; s.out.push({t: "None"}); }},
      {line: 3, title: "in ничего не создает", text: "<code>in</code> только проверяет ключ.", caption: "<code>5 in groups</code> → <b>False</b>.",
       act: s => { s.q = "5 in groups"; s.tag = "словарь не изменился"; s.tagc = ""; s.out.push({t: "False"}); }},
      {line: 4, title: "Чтение создает пару", text: "Квадратные скобки для отсутствующего ключа вызывают фабрику: в словаре появляется пара «5 : пустой список», и чтение возвращает этот список.", caption: "<code>groups[5]</code> → <b>[]</b>, и пара 5 появилась.",
       act: s => { s.q = "groups[5]"; s.tag = "создана пара"; s.tagc = "is-red"; s.pairs.push({k: 5, v: new Py("[]")}); s.mark[5] = "new"; s.out.push({t: "[]"}); }},
      {line: 5, title: "Ключ уже есть", text: "После чтения ключ 5 в словаре. Поэтому, чтобы проверить ключ, пишут <code>in</code>, а не читают <code>groups[key]</code>.", caption: "<code>5 in groups</code> → <b>True</b>, пар <b>1</b>.",
       act: s => { s.q = null; s.out.push({t: "True 1"}); }}
    ]
  });
}
});
