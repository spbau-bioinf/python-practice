/* Анимации страницы t6_04 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {esc, Py, dictView, setPair, reg} = A;
function seqView(seq, k) {
  return '<div class="an-list"><span class="an-brace">seq =</span>' + [...seq].map((ch, i) =>
    `<span class="an-item ${i === k ? "found" : ""}"><span class="an-idx">${i}</span>${esc(ch)}</span>`).join("") + "</div>";
}
{
  const SEQ = "GATTACA";
  const steps = [
    {line: 0, title: "Последовательность", text: "Посчитаем, сколько раз встречается каждая буква <code>GATTACA</code>.", caption: "Счетчика пока нет."},
    {line: 1, title: "Пустой счетчик", text: "Какие буквы встретятся, заранее неизвестно, поэтому словарь начинают пустым.", caption: "<code>counts</code> пуст.",
     act: s => { s.made = true; }}
  ];
  [...SEQ].forEach((ch, i) => {
    steps.push({line: 3, title: `Буква ${i + 1}: ${ch}`, text: i === 0 ? "Буквы <code>G</code> в словаре нет: <code>counts.get(\"G\", 0)</code> дает 0, и строка записывает 0 + 1." : "<code>get()</code> читает прежнее число буквы (0, если ее еще нет), строка записывает число на 1 больше.",
      caption: "", act: s => {
        const p = s.pairs.find(x => x.k === ch); const before = p ? p.v : 0;
        s.mark[ch] = setPair(s.pairs, ch, before + 1); s.k = i;
        s.f = `counts.get("${ch}", 0) = <b>${before}</b> → counts["${ch}"] = <b>${before + 1}</b>`;
      }});
  });
  steps.slice(2).forEach((st, i) => {
    const ch = SEQ[i], prev = [...SEQ.slice(0, i)].filter(x => x === ch).length;
    st.caption = prev ? `<code>${ch}</code> уже был: ${prev} → <b>${prev + 1}</b>.` : `<code>${ch}</code> новая буква: пара встает в конец, значение <b>1</b>.`;
  });
  steps.push({line: 4, title: "Итог", text: "Ключи стоят в порядке первого появления букв: G, A, T, C. Больше всего <code>A</code> — 3.", caption: "Четыре пары, сумма значений 7 — длина последовательности.",
    act: s => { s.k = null; s.f = ""; s.out.push({t: "{'G': 1, 'A': 3, 'T': 2, 'C': 1}"}); }});
  reg("t6_04_s1", {file: "counts.py", 
    code: ['seq = "GATTACA"', 'counts = {}', 'for base in seq:', '    counts[base] = counts.get(base, 0) + 1', 'print(counts)'],
    init: () => ({pairs: [], k: null, f: "", made: false}),
    view: s => seqView(SEQ, s.k) + (s.f ? `<div class="an-formula">${s.f}</div>` : "") + (s.made ? dictView("counts", s.pairs, s.mark) : ""),
    steps
  });
}
{
  const SEQS = ["ATG", "GC", "TAA", "AT"];
  const listRepr = arr => new Py("[" + arr.map(x => "'" + x + "'").join(", ") + "]");
  const steps = [
    {line: 0, title: "Четыре последовательности", text: "Соберем их в группы по длине: ключ — длина, значение — список последовательностей.", caption: "Групп пока нет."},
    {line: 1, title: "Пустой словарь групп", text: "Какие длины встретятся, заранее неизвестно.", caption: "<code>groups</code> пуст.", act: s => { s.made = true; }}
  ];
  const seen = new Set();
  SEQS.forEach((seq, i) => {
    const len = seq.length;
    if (!seen.has(len)) {
      steps.push({line: 5, title: `${seq}: новая длина ${len}`, text: `Группы длины ${len} нет, поэтому сначала под нее кладут пустой список.`, caption: `<code>groups[${len}] = []</code>.`,
        act: s => { s.k = i; s.f = `len("${seq}") = <b>${len}</b>, ${len} not in groups → <b>True</b>`; s.mark[len] = setPair(s.pairs, len, []); }});
      seen.add(len);
      steps.push({line: 6, title: `${seq}: в группу`, text: "Теперь группа есть, и <code>append()</code> дописывает в ее список последовательность.", caption: `<code>"${seq}"</code> в группе ${len}.`,
        act: s => { s.k = i; s.f = ""; const p = s.pairs.find(x => x.k === len); p.v = p.v.concat([seq]); s.mark[len] = "changed"; }});
    } else {
      steps.push({line: 6, title: `${seq}: группа уже есть`, text: `Длина ${len} уже встречалась: проверка дает <code>False</code>, пустой список не создается, последовательность дописывается к прежним.`, caption: `<code>"${seq}"</code> в группе ${len}, рядом с прежними.`,
        act: s => { s.k = i; s.f = `len("${seq}") = <b>${len}</b>, ${len} not in groups → <b>False</b>`; const p = s.pairs.find(x => x.k === len); p.v = p.v.concat([seq]); s.mark[len] = "changed"; }});
    }
  });
  steps.push({line: 7, title: "Итог", text: "Две группы; длина 3 встретилась первой, поэтому ее группа идет первой. Внутри групп — порядок ввода.", caption: "<code>{3: ['ATG', 'TAA'], 2: ['GC', 'AT']}</code>.",
    act: s => { s.k = null; s.f = ""; s.out.push({t: "{3: ['ATG', 'TAA'], 2: ['GC', 'AT']}"}); }});
  reg("t6_04_s2", {file: "groups.py", 
    code: ['seqs = ["ATG", "GC", "TAA", "AT"]', 'groups = {}', 'for seq in seqs:', '    length = len(seq)', '    if length not in groups:', '        groups[length] = []', '    groups[length].append(seq)', 'print(groups)'],
    init: () => ({pairs: [], k: null, f: "", made: false}),
    view: s => '<div class="an-list"><span class="an-brace">seqs = [</span>' + SEQS.map((x, i) => `<span class="an-item ${i === s.k ? "found" : ""}"><span class="an-idx">${i}</span>'${x}'</span>`).join('<span class="an-comma">,</span>') + '<span class="an-brace">]</span></div>'
      + (s.f ? `<div class="an-formula">${s.f}</div>` : "")
      + (s.made ? dictView("groups", s.pairs.map(p => ({k: p.k, v: listRepr(p.v)})), s.mark) : ""),
    steps
  });
}
});
