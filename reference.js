/* Справочник (версия 122): поиск и фильтр по практикам. Данные строки: data-p (номер практики), текст строки. */
(function () {
  var q = document.getElementById("ref-q"), rows = Array.prototype.slice.call(document.querySelectorAll(".ref-row"));
  var chips = Array.prototype.slice.call(document.querySelectorAll(".ref-chip")), none = document.getElementById("ref-none");
  var on = {}; // выбранные практики; пусто = все
  function apply() {
    var t = (q.value || "").trim().toLowerCase(), any = false;
    rows.forEach(function (r) {
      var ok = (!Object.keys(on).length || on[r.getAttribute("data-p")]) && (!t || r.textContent.toLowerCase().indexOf(t) >= 0);
      r.hidden = !ok; if (ok) any = true;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".ref-sec"), function (s) {
      s.hidden = !s.querySelector(".ref-row:not([hidden])");
    });
    none.hidden = any;
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var p = c.getAttribute("data-p");
      if (on[p]) { delete on[p]; c.setAttribute("aria-pressed", "false"); } else { on[p] = 1; c.setAttribute("aria-pressed", "true"); }
      apply();
    });
  });
  q.addEventListener("input", apply);
})();
