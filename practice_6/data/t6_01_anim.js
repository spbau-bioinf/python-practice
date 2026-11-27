/* Анимации страницы t6_01 (anim.js, версия 115). */
(window.ANIM_SCENES = window.ANIM_SCENES || []).push(function (A) {
"use strict";
const {esc, Py, pyRepr, dictRepr, dictView, setPair, delPair, reg} = A;
{
  const REC = ["BRCA1", 17, 1863];
  const GENE = [{k: "id", v: "BRCA1"}, {k: "chromosome", v: 17}, {k: "protein_length", v: 1863}];
  function listView(items, found) {
    return '<div class="an-list"><span class="an-brace">rec = [</span>' + items.map((x, i) =>
      `<span class="an-item ${found === i ? "found" : ""}"><span class="an-idx">${i}</span>${esc(pyRepr(x))}</span>`).join('<span class="an-comma">,</span>') + '<span class="an-brace">]</span></div>';
  }
  reg("t6_01_s1", {file: "gene.py", 
    code: ['rec = ["BRCA1", 17, 1863]', 'gene = {"id": "BRCA1", "chromosome": 17,', '        "protein_length": 1863}', 'print(rec[2])', 'print(gene["protein_length"])', 'print(len(gene))'],
    init: () => ({found: null, pairs: GENE.map(p => ({...p}))}),
    view: s => listView(REC, s.found) + dictView("gene", s.pairs, s.mark),
    steps: [
      {line: 0, title: "Одна запись — две формы", text: "Список хранит значения по номерам позиций, словарь — под ключами. Данные одинаковые, разный способ к ним обратиться.", caption: "Слева номера позиций списка, в карточках словаря — пары «ключ : значение»."},
      {line: 3, title: "По номеру позиции", text: "<code>rec[2]</code> — третий элемент списка. Чтобы прочитать длину белка, нужно помнить, что она стоит под номером 2.", caption: "Номер 2 → <b>1863</b>.",
       act: s => { s.found = 2; s.out.push({t: "1863"}); }},
      {line: 4, title: "По ключу", text: "<code>gene[\"protein_length\"]</code> находит значение по ключу. Помнить порядок не нужно: ключ сам говорит, что это за число.", caption: "Ключ <code>\"protein_length\"</code> → <b>1863</b>.",
       act: s => { s.found = null; s.mark.protein_length = "found"; s.out.push({t: "1863"}); }},
      {line: 5, title: "Число пар", text: "<code>len()</code> у словаря возвращает число пар, а не число символов.", caption: "Три пары — <b>3</b>.",
       act: s => { s.out.push({t: "3"}); }}
    ]
  });
}
{
  reg("t6_01_s2", {file: "counts.py", 
    code: ['counts = {"A": 12, "T": 8}', 'counts["G"] = 15', 'counts["A"] = 13', 'del counts["T"]', 'counts["T"] = 1', 'print(counts)'],
    init: () => ({pairs: [{k: "A", v: 12}, {k: "T", v: 8}]}),
    view: s => dictView("counts", s.pairs, s.mark) + `<div class="an-formula">len(counts) = <b>${s.pairs.length}</b></div>`,
    steps: [
      {line: 0, title: "Две пары", text: "Словарь создан литералом: ключи <code>\"A\"</code> и <code>\"T\"</code> в порядке записи.", caption: "Две пары."},
      {line: 1, title: "Нового ключа не было — пара добавлена", text: "Присваивание по ключу, которого нет, добавляет пару. Новая пара встает в конец.", caption: "<code>\"G\"</code> добавлен в конец, пар стало <b>3</b>.",
       act: s => { s.mark.G = setPair(s.pairs, "G", 15); }},
      {line: 2, title: "Ключ был — значение заменено", text: "Присваивание по существующему ключу заменяет значение. Второй пары с ключом <code>\"A\"</code> не появляется, место ключа не меняется.", caption: "<code>\"A\"</code>: 12 → <b>13</b>, пар по-прежнему 3.",
       act: s => { s.mark.A = setPair(s.pairs, "A", 13); }},
      {line: 3, title: "Удаление", text: "<code>del</code> удаляет пару вместе с ключом.", caption: "Пара <code>\"T\"</code> удалена, пар <b>2</b>.",
       act: s => { delPair(s.pairs, "T"); }},
      {line: 4, title: "Ключ вернулся — в конец", text: "Удаленный и добавленный снова ключ встает в конец: прежнее место при удалении не сохраняется.", caption: "<code>\"T\"</code> снова в словаре, но теперь последним.",
       act: s => { s.mark.T = setPair(s.pairs, "T", 1); }},
      {line: 5, title: "Печать", text: "<code>print()</code> показывает пары в порядке вставки ключей.", caption: "Порядок: A, G, T.",
       act: s => { s.out.push({t: dictRepr(s.pairs)}); }}
    ]
  });
}
{
  reg("t6_01_s3", {file: "get.py", 
    code: ['counts = {"A": 12, "T": 8}', 'print("N" in counts)', 'print(counts.get("N"))', 'print(counts.get("N", 0))', 'print(len(counts))', 'print(counts["N"])'],
    init: () => ({pairs: [{k: "A", v: 12}, {k: "T", v: 8}], q: null}),
    view: s => dictView("counts", s.pairs, s.mark) + (s.q ? `<div class="an-row"><span class="an-formula">запрос: <b>${esc(s.q)}</b></span><span class="an-tag ${s.tagc || ""}">${s.tag}</span></div>` : ""),
    steps: [
      {line: 0, title: "Ключа N нет", text: "В словаре только <code>\"A\"</code> и <code>\"T\"</code>. Посмотрим, как разные способы отвечают на запрос <code>\"N\"</code>.", caption: "Ключа <code>\"N\"</code> в словаре нет."},
      {line: 1, title: "in: есть ли ключ", text: "<code>in</code> проверяет только ключи и отвечает <code>True</code> или <code>False</code>.", caption: "<code>\"N\" in counts</code> → <b>False</b>.",
       act: s => { s.q = '"N" in counts'; s.tag = "ключа нет"; s.tagc = ""; s.out.push({t: "False"}); }},
      {line: 2, title: "get() без второго аргумента", text: "<code>get()</code> возвращает значение, а для отсутствующего ключа — <code>None</code>.", caption: "<code>counts.get(\"N\")</code> → <b>None</b>.",
       act: s => { s.q = 'counts.get("N")'; s.tag = "None"; s.out.push({t: "None"}); }},
      {line: 3, title: "get() со значением по умолчанию", text: "Второй аргумент — то, что вернуть вместо отсутствующего значения. Удобно для счетчиков: нет буквы — 0.", caption: "<code>counts.get(\"N\", 0)</code> → <b>0</b>.",
       act: s => { s.q = 'counts.get("N", 0)'; s.tag = "0"; s.out.push({t: "0"}); }},
      {line: 4, title: "Словарь не изменился", text: "Ни <code>in</code>, ни <code>get()</code> не добавляют ключ: пар по-прежнему две.", caption: "<code>len(counts)</code> → <b>2</b>.",
       act: s => { s.out.push({t: "2"}); s.q = null; }},
      {line: 5, title: "Квадратные скобки: ошибка", text: "Квадратные скобки не проверяют, есть ли ключ. Программа останавливается ошибкой <code>KeyError</code>, в сообщении — сам ключ.", caption: "<code>counts[\"N\"]</code> → <b>KeyError: 'N'</b>.",
       act: s => { s.q = 'counts["N"]'; s.tag = "ошибка"; s.tagc = "is-red"; s.out.push({t: "KeyError: 'N'", err: true}); }}
    ]
  });
}
});
