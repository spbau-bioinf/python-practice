/* Анимации страницы t6_08 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {esc, reg} = A;
{
  const RNA = "AUGUUUGGCUAAGCU";
  const CODE = {AUG: "M", UUU: "F", GGC: "G", UAA: "*", GCU: "A"};
  const rnaView = (from, stopAt) => '<div class="an-list"><span class="an-brace">rna =</span>' + [...RNA].map((ch, i) => {
      let cls = "";
      if (from !== null && i >= from && i < from + 3) cls = stopAt === from ? "error" : "found";
      else if (stopAt !== null && i >= stopAt + 3) cls = "gone";
      return `<span class="an-item ${cls}"><span class="an-idx">${i}</span>${ch}</span>`;
    }).join("") + "</div>";
  const steps = [
    {line: 0, title: "мРНК из пяти кодонов", text: "Чтение начинается с первой буквы: кодоны — буквы 0–2, 3–5 и так далее.", caption: "Белок пока пуст."},
    {line: 1, title: "Пустой белок", text: "Белок будем собирать строкой, дописывая по одной букве.", caption: "<code>protein = \"\"</code>.", act: s => { s.made = true; }}
  ];
  [0, 3, 6, 9].forEach(start => {
    const codon = RNA.slice(start, start + 3), aa = CODE[codon];
    if (aa !== "*") {
      steps.push({line: 3, title: `Кодон ${codon}`, text: `<code>start = ${start}</code>: срез <code>rna[${start}:${start + 3}]</code> — кодон <code>${codon}</code>, по словарю — <code>${aa}</code>. Это не стоп, поэтому буква дописывается к белку.`,
        caption: `<code>${codon}</code> → <b>${aa}</b>.`,
        act: s => { s.from = start; s.f = `code["${codon}"] = <b>'${aa}'</b>`; s.protein += aa; s.added = true; }});
    } else {
      steps.push({line: 5, title: `Стоп-кодон ${codon}`, text: `<code>start = ${start}</code>: кодон <code>${codon}</code> дает <code>*</code> — стоп. <code>break</code> прерывает цикл, оставшиеся буквы не читаются.`,
        caption: `<code>${codon}</code> → <b>*</b>, трансляция окончена.`,
        act: s => { s.from = start; s.stopAt = start; s.f = `code["${codon}"] = <b>'*'</b> → break`; s.added = false; }});
    }
  });
  steps.push({line: 7, title: "Белок", text: "Кодон <code>GCU</code> после стопа не прочитан, хотя в словаре у него есть аминокислота.", caption: "Белок <b>MFG</b> из трех аминокислот.",
    act: s => { s.from = null; s.f = ""; s.added = false; s.out.push({t: "MFG"}); }});
  reg("t6_08_s2", {file: "translate.py",
    code: ['rna = "AUGUUUGGCUAAGCU"', 'protein = ""', 'for start in range(0, len(rna), 3):', '    amino_acid = code[rna[start:start + 3]]', '    if amino_acid == "*":', '        break', '    protein = protein + amino_acid', 'print(protein)'],
    init: () => ({from: null, stopAt: null, f: "", protein: "", made: false, added: false}),
    view: s => rnaView(s.from, s.stopAt) + (s.f ? `<div class="an-formula">${s.f}</div>` : "")
      + (s.made ? `<div class="an-list"><span class="an-brace">protein =</span><span class="an-item ${s.added ? "new" : ""}">'${esc(s.protein)}'</span></div>` : ""),
    steps
  });
}
});
