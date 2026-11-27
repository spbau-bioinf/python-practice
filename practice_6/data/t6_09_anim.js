/* Анимации страницы t6_09 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {esc, reg} = A;
{
  const S1 = "ACGTACGT", S2 = "ACGTTCGT", K = 3;
  const wins = s => [...Array(s.length - K + 1).keys()].map(i => s.slice(i, i + K));
  const set1 = [...new Set(wins(S1))], set2 = [...new Set(wins(S2))];
  const common = set1.filter(x => set2.includes(x)), union = [...set1, ...set2.filter(x => !set1.includes(x))];
  const chips = (name, items, mark) => `<div class="an-list"><span class="an-brace">${esc(name)} {</span>` +
    (items.length ? items.map(x => `<span class="an-item ${mark(x)}">'${esc(x)}'</span>`).join('<span class="an-comma">,</span>') : '<span class="an-empty">пусто</span>') + '<span class="an-brace">}</span></div>';
  const strView = (name, s, from) => `<div class="an-list"><span class="an-brace">${name} =</span>` + [...s].map((ch, i) =>
    `<span class="an-item ${from !== null && i >= from && i < from + K ? "found" : ""}">${ch}</span>`).join("") + "</div>";
  const steps = [
    {line: 0, title: "Две строки", text: "Сравним <code>ACGTACGT</code> и <code>ACGTTCGT</code> по множествам 3-меров. Строки отличаются одной буквой в середине.", caption: "Множеств пока нет."}
  ];
  [[S1, "kmers1", "first", 1], [S2, "kmers2", "second", 2]].forEach(([s, name, sname, n]) => {
    wins(s).forEach((w, i) => {
      const dup = wins(s).slice(0, i).includes(w);
      steps.push({line: n === 1 ? 5 : 8, title: `${sname}: окно ${i + 1}`, text: dup ? `Окно <code>${w}</code> уже есть в множестве: <code>add()</code> его не повторяет.` : `<code>add()</code> кладет срез <code>${w}</code> одним элементом.`,
        caption: `<code>${sname}[${i}:${i + K}]</code> = <b>'${w}'</b>` + (dup ? " — повтор." : "."),
        act: s2 => { s2.cur = {str: n, from: i}; if (!s2.sets[n].includes(w)) s2.sets[n].push(w); s2.hit = w; }});
    });
  });
  steps.push({line: 9, title: "Общие k-меры", text: "Пересечение <code>kmers1 &amp; kmers2</code> — окна, которые есть в обеих строках.", caption: `Общих <b>${common.length}</b>: ${common.join(", ")}.`,
    act: s => { s.cur = null; s.hit = null; s.mode = "common"; s.out.push({t: "['" + [...common].sort().join("', '") + "']"}); }});
  steps.push({line: 10, title: "Все различные", text: "Объединение <code>kmers1 | kmers2</code> — все различные окна обеих строк, каждое один раз.", caption: `Различных <b>${union.length}</b>.`,
    act: s => { s.mode = "union"; s.out.push({t: String(union.length)}); }});
  steps.push({line: 11, title: "Мера Жаккара", text: "Доля общих среди всех различных. Одна замененная буква испортила сразу три окна, поэтому мера заметно меньше 1.", caption: `J = ${common.length} / ${union.length} ≈ <b>${Math.round(common.length / union.length * 100) / 100}</b>.`,
    act: s => { s.mode = "j"; s.out.push({t: String(Math.round(common.length / union.length * 100) / 100)}); }});
  reg("t6_09_s3", {file: "jaccard.py",
    code: ['first = "ACGTACGT"', 'second = "ACGTTCGT"', 'k = 3', 'kmers1 = set()', 'for i in range(len(first) - k + 1):', '    kmers1.add(first[i:i + k])', 'kmers2 = set()', 'for i in range(len(second) - k + 1):', '    kmers2.add(second[i:i + k])', 'print(sorted(kmers1 & kmers2))', 'print(len(kmers1 | kmers2))', 'print(round(len(kmers1 & kmers2) / len(kmers1 | kmers2), 2))'],
    init: () => ({sets: {1: [], 2: []}, cur: null, hit: null, mode: null}),
    view: s => {
      const mark = x => (s.mode && common.includes(x)) ? "found" : (s.hit === x ? "new" : "");
      return strView("first", S1, s.cur && s.cur.str === 1 ? s.cur.from : null) + strView("second", S2, s.cur && s.cur.str === 2 ? s.cur.from : null)
        + chips("kmers1 =", s.sets[1], mark) + chips("kmers2 =", s.sets[2], mark)
        + (s.mode === "union" || s.mode === "j" ? `<div class="an-formula">общих <b>${common.length}</b>, различных <b>${union.length}</b></div>` : "");
    },
    steps
  });
}
});
