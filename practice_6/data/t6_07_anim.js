/* Анимации страницы t6_07 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {dictView, setPair, reg} = A;
{
  const TEXT = "GATATAT", K = 3, N = TEXT.length - K + 1;
  const textView = from => '<div class="an-list"><span class="an-brace">text =</span>' + [...TEXT].map((ch, i) =>
    `<span class="an-item ${from !== null && i >= from && i < from + K ? "found" : ""}"><span class="an-idx">${i}</span>${ch}</span>`).join("") + "</div>";
  const steps = [
    {line: 1, title: "Строка и длина окна", text: `В строке ${TEXT.length} букв, окно длины ${K}. Окон <code>${TEXT.length} - ${K} + 1 = ${N}</code>.`, caption: "Счетчик пока пуст."},
    {line: 3, title: "Пустой Counter", text: "Для нового k-мера <code>Counter</code> дает 0, поэтому <code>+= 1</code> работает сразу.", caption: "<code>counts</code> пуст.", act: s => { s.made = true; }}
  ];
  for (let i = 0; i < N; i += 1) {
    const kmer = TEXT.slice(i, i + K), seen = [...Array(i).keys()].some(j => TEXT.slice(j, j + K) === kmer);
    steps.push({line: 5, title: `Окно ${i + 1}: ${kmer}`, text: i === 0 ? "Окно с началом 0 — срез <code>text[0:3]</code>." : (seen ? `<code>${kmer}</code> уже встречался: окно сдвинулось на одну букву и перекрывается с прежним вхождением, но считается отдельно.` : "Окно сдвинулось на одну букву вправо: соседние окна перекрываются."),
      caption: `<code>text[${i}:${i + K}]</code> = <b>'${kmer}'</b>` + (seen ? " — второе вхождение." : "."),
      act: s => { s.from = i; const p = s.pairs.find(x => x.k === kmer); s.mark[kmer] = setPair(s.pairs, kmer, p ? p.v + 1 : 1); }});
  }
  steps.push({line: 6, title: "Итог", text: "ATA и TAT встречаются по два раза, хотя их вхождения делят буквы. Метод <code>count()</code> у строки перекрытия не считает.", caption: "Пять окон, три разных 3-мера.",
    act: s => { s.from = null; s.out.push({t: "Counter({'ATA': 2, 'TAT': 2, 'GAT': 1})"}); }});
  reg("t6_07_s3", {file: "window.py",
    code: ['from collections import Counter', 'text = "GATATAT"', 'k = 3', 'counts = Counter()', 'for start in range(len(text) - k + 1):', '    counts[text[start:start + k]] += 1', 'print(counts)'],
    init: () => ({pairs: [], from: null, made: false}),
    view: s => textView(s.from) + (s.made ? dictView("counts", s.pairs, s.mark) : ""),
    steps
  });
}
});
