"use strict";
// Budget bewerken: tabel met een rij per categorie en een kolom per maand.
/* budget bewerken: een tabel met een rij per categorie en een kolom per maand */
// Kolom 0 is "Elke maand": daar vul je één bedrag in voor alle maanden. Kolommen 1–12 zijn de maanden zelf.
function setAllMonths(Y, c, v) {
  const y = S.budgets[Y] || (S.budgets[Y] = {});
  if (v > 0) y[c] = { base: v, m: {} };
  else delete y[c];
  saveBudgets();
}
const cellId = (i, k) => "g-" + i + "-" + k;
const monthSum = (grp, Y, k) => grp.cats.reduce((s, c) => s + budgetOf(Y, c, k), 0);
// Begrote inkomsten, uitgaven (vaste lasten, variabel, reserveringen) en sparen, en wat er overblijft (k = 0: jaar).
const incOf = (Y, k) => monthSum(GROUPS[0], Y, k);
const uitOf = (Y, k) => GROUPS.filter(g => g.kind === "uit").reduce((s, g) => s + monthSum(g, Y, k), 0);
const spOf = (Y, k) => GROUPS.filter(g => g.kind === "spaar").reduce((s, g) => s + monthSum(g, Y, k), 0);
const overOf = (Y, k) => incOf(Y, k) - uitOf(Y, k) - spOf(Y, k);
const gridNum = v => (Math.abs(v) < 0.5 ? "" : eur0.format(v).replace("€", "").trim());
// Na een wijziging alleen de getallen bijwerken, zodat cursor en toetsenbord in het volgende vak blijven.
function gridRefresh(Y, c) {
  const i = ALLCATS.indexOf(c),
    gi = GROUPS.findIndex(g => g.cats.includes(c)),
    b = (S.budgets[Y] || {})[c],
    act = document.activeElement;
  const all = $("#" + cellId(i, 0));
  if (all && all !== act) all.value = fmtIn(b ? b.base || 0 : 0);
  for (let k = 1; k <= 12; k++) {
    const e = $("#" + cellId(i, k));
    if (!e) continue;
    if (e !== act) e.value = fmtIn(budgetOf(Y, c, k));
    e.classList.toggle("diff", !!(b && b.base && b.m && b.m[k] != null));
  }
  const t = $("#gy-" + i);
  if (t) t.textContent = gridNum(budgetOf(Y, c, 0));
  for (let k = 0; k <= 12; k++) {
    const g = $("#gs-" + gi + "-" + k);
    if (g) g.textContent = gridNum(monthSum(GROUPS[gi], Y, k));
    for (const [id, f] of [
      ["inc", incOf],
      ["uit", uitOf],
      ["sp", spOf],
      ["ov", overOf],
    ]) {
      const o = $("#" + id + "-" + k);
      if (o) o.replaceWith(sumCell(id, f, Y, k));
    }
  }
}
function sumCell(id, f, Y, k) {
  const v = f(Y, k),
    tone = id === "ov" ? (v < -0.5 ? " neg" : " pos") : "";
  return el(
    "td",
    { class: "num" + tone + (k ? "" : " yr"), id: id + "-" + k },
    Math.abs(v) < 0.5 ? "" : eur0.format(v),
  );
}
// Pijltjes en Enter verplaatsen je door de tabel, zoals in een spreadsheet.
function gridKey(e) {
  const [, i, k] = e.target.id.split("-").map(Number);
  let ni = i,
    nk = k;
  if (e.key === "Enter" || e.key === "ArrowDown") ni = i + 1;
  else if (e.key === "ArrowUp") ni = i - 1;
  else if (e.key === "ArrowRight" && e.target.selectionEnd === e.target.value.length) nk = k + 1;
  else if (e.key === "ArrowLeft" && e.target.selectionStart === 0) nk = k - 1;
  else return;
  const n = $("#" + cellId(ni, nk));
  if (!n) {
    if (e.key === "Enter") e.preventDefault();
    return;
  }
  e.preventDefault();
  n.focus();
  n.select();
}
// Plakken uit Excel of Numbers: meerdere getallen (tabs en regels) vullen de tabel vanaf dit vak.
function gridPaste(e, Y) {
  const txt = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  if (!/[\t\n]/.test(txt.trim())) return;
  e.preventDefault();
  const [, i0, k0] = e.target.id.split("-").map(Number);
  txt
    .replace(/\r/g, "")
    .split("\n")
    .filter((l, j, a) => l !== "" || j < a.length - 1)
    .forEach((line, r) => {
      const c = ALLCATS[i0 + r];
      if (!c) return;
      line.split("\t").forEach((val, j) => {
        const k = k0 + j;
        if (k > 12) return;
        const v = parseAmount(val);
        if (k === 0) setAllMonths(Y, c, v);
        else setMonthBudget(Y, c, k, v);
      });
    });
  render();
}
function viewBudgetEdit(main) {
  const Y = S.year,
    ref = budgetRef(Y),
    yb = S.budgets[Y] || {};
  const more = [];
  if (ref.year != null)
    more.push(
      el(
        "button",
        {
          class: "btn sm",
          onclick: () => {
            for (const grp of GROUPS)
              for (const c of grp.cats) {
                if (budgetOf(Y, c, 0)) continue;
                const a = ref.avg(grp, c);
                if (a >= 1) setAllMonths(Y, c, roundBudget(a));
              }
            render();
          },
        },
        "Lege rijen vullen met gemiddelde " + ref.year,
      ),
    );
  if (S.budgets[Y - 1] && Object.keys(S.budgets[Y - 1]).length)
    more.push(
      el(
        "button",
        {
          class: "btn sm",
          onclick: () => {
            if (
              Object.keys(yb).length &&
              !confirm("Het budget van " + Y + " wordt vervangen door dat van " + (Y - 1) + ". Doorgaan?")
            )
              return;
            S.budgets[Y] = JSON.parse(JSON.stringify(S.budgets[Y - 1]));
            saveBudgets();
            render();
          },
        },
        "Neem " + (Y - 1) + " over",
      ),
    );
  if (Object.keys(yb).length)
    more.push(
      el(
        "button",
        {
          class: "btn sm",
          onclick: () => {
            if (!confirm("Alle budgetten van " + Y + " wissen?")) return;
            delete S.budgets[Y];
            saveBudgets();
            render();
          },
        },
        "Wissen",
      ),
    );
  main.append(
    el(
      "div",
      { class: "card" },
      el(
        "div",
        { class: "herotop" },
        el(
          "div",
          {},
          el("h2", {}, "Budget " + Y),
          el(
            "div",
            { class: "prose" },
            "Vul bij ",
            el("b", {}, "Elke maand"),
            " één bedrag in voor het hele jaar, of per maand een eigen bedrag.",
          ),
        ),
        el(
          "button",
          {
            class: "btn pri",
            onclick: () => {
              S.editBudget = false;
              render();
              window.scrollTo(0, 0);
            },
          },
          "Klaar",
        ),
      ),
      el(
        "div",
        { class: "tools" },
        ...more,
        el(
          "button",
          {
            class: "btn sm",
            onclick: () => {
              S.editBudget = false;
              goCompare();
            },
          },
          "Vergelijk per maand",
        ),
      ),
    ),
  );
  const head = el(
    "tr",
    {},
    el("th", { class: "cat" }, ""),
    el("th", { class: "all" }, "Elke maand"),
    ...MONTHS.map(m => el("th", {}, m)),
    el("th", { class: "yr" }, "Jaar"),
  );
  const body = el("tbody");
  GROUPS.forEach((grp, gi) => {
    body.append(el("tr", { class: "grp" }, el("th", { class: "cat" }, grp.name), el("td", { colspan: 14 })));
    for (const c of grp.cats) {
      const i = ALLCATS.indexOf(c),
        b = yb[c];
      const cellIn = (k, val, label, on, cls) =>
        el(
          "td",
          { class: cls || "" },
          el("input", {
            id: cellId(i, k),
            type: "text",
            inputmode: "decimal",
            enterkeyhint: "next",
            autocomplete: "off",
            value: fmtIn(val),
            "aria-label": label,
            class: k && b && b.base && b.m && b.m[k] != null ? "diff" : "",
            onkeydown: gridKey,
            onpaste: e => gridPaste(e, Y),
            onfocus: e => e.target.select(),
            onchange: on,
          }),
        );
      body.append(
        el(
          "tr",
          {},
          el("th", { class: "cat", scope: "row" }, c),
          cellIn(
            0,
            b ? b.base || 0 : 0,
            c + " elke maand",
            e => {
              setAllMonths(Y, c, parseAmount(e.target.value));
              e.target.value = fmtIn(parseAmount(e.target.value));
              gridRefresh(Y, c);
            },
            "all",
          ),
          ...MONTHS.map((m, j) =>
            cellIn(j + 1, budgetOf(Y, c, j + 1), c + " " + MONTHS_LONG[j], e => {
              setMonthBudget(Y, c, j + 1, parseAmount(e.target.value));
              e.target.value = fmtIn(budgetOf(Y, c, j + 1));
              gridRefresh(Y, c);
            }),
          ),
          el("td", { class: "yr num", id: "gy-" + i }, gridNum(budgetOf(Y, c, 0))),
        ),
      );
    }
    body.append(
      el(
        "tr",
        { class: "sum" },
        el("th", { class: "cat" }, "Totaal"),
        el("td", { class: "all" }),
        ...MONTHS.map((m, j) =>
          el("td", { class: "num", id: "gs-" + gi + "-" + (j + 1) }, gridNum(monthSum(grp, Y, j + 1))),
        ),
        el("td", { class: "yr num", id: "gs-" + gi + "-0" }, gridNum(monthSum(grp, Y, 0))),
      ),
    );
  });
  // Onderaan: verwachte inkomsten tegenover uitgaven en sparen, per maand.
  const sumRow = (id, label, f, cls) =>
    el(
      "tr",
      { class: cls },
      el("th", { class: "cat" }, label),
      el("td", { class: "all" }),
      ...MONTHS.map((m, j) => sumCell(id, f, Y, j + 1)),
      sumCell(id, f, Y, 0),
    );
  const foot = el(
    "tfoot",
    {},
    sumRow("inc", "Inkomsten (verwacht)", incOf, "inc"),
    sumRow("uit", "Uitgaven", uitOf, "uit"),
    sumRow("sp", "Sparen", spOf, "sp"),
    sumRow("ov", "Over", overOf, "over"),
  );
  main.append(el("div", { class: "bgridwrap" }, el("table", { class: "bgrid" }, el("thead", {}, head), body, foot)));
  main.append(
    el(
      "p",
      { class: "prose" },
      "Enter en de pijltjes verplaatsen je door de tabel. Je kunt ook een blok getallen uit Excel of Numbers plakken. Onderaan zie je per maand de verwachte inkomsten, de uitgaven en wat je spaart; Over is wat er dan overblijft.",
    ),
  );
}
