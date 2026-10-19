"use strict";
// Budget vs werkelijk per hoofdcategorie en maand.
/* budget vs werkelijk: dezelfde tabel als het budget, maar alleen om te bekijken */
// Eén tabel: per categorie vier regels (budget, werkelijk, verschil, resultaat) met de maanden als kolommen.
// Verschil is gunstig (+) als je minder uitgaf of meer ontving/spaarde dan begroot. Resultaat is het opgebouwde
// verschil tot en met die maand. Maanden zonder ingelezen transacties worden niet vergeleken (·).
const fmtCell = (v, signed) => {
  const n = eur0.format(Math.abs(v)).replace("€", "").trim();
  return signed ? (v > 0.5 ? "+" : v < -0.5 ? "−" : "") + n : (v < -0.5 ? "−" : "") + n;
};
function goCompare() {
  S.tab = "vergelijk";
  go();
}
function viewCompare(main) {
  const Y = S.year,
    { T, cnt, unkN } = totals(Y);
  let from = 0,
    upto = 0;
  for (let k = 1; k <= 12; k++)
    if (cnt[k]) {
      if (!from) from = k;
      upto = k;
    }
  const has = k => cnt[k] > 0;
  const last = 12,
    MS = MONTHS;
  const net = Array(13).fill(0);
  for (const t of S.tx) if (Math.floor(t.d / 10000) === Y) net[Math.floor(t.d / 100) % 100] += t.a;
  const KINDS = ["Budget", "Werkelijk", "Verschil", "Resultaat"];
  // a(k)/b(k): werkelijk en budget in maand k; good: +1 als meer werkelijk gunstig is (inkomsten, sparen), −1 bij uitgaven.
  const block = (label, a, b, good, toTx, cls) => {
    const rows = KINDS.map(() => []);
    let cum = 0,
      sa = 0,
      sb = 0;
    for (let k = 1; k <= last; k++) {
      const B = b(k),
        on = has(k),
        A = on ? a(k) : 0,
        d = good * (A - B);
      if (on) {
        cum += d;
        sa += A;
        sb += B;
      }
      rows[0].push({ v: B, show: B >= 0.5 || (on && Math.abs(A) >= 0.5) });
      rows[1].push({ v: A, show: on, go: toTx && toTx(k) });
      rows[2].push({ v: d, show: on, signed: true });
      rows[3].push({ v: cum, show: on, signed: true, res: true });
    }
    const dy = good * (sa - sb),
      any = !!upto;
    rows[0].push({ v: sb, show: any });
    rows[1].push({ v: sa, show: any, go: toTx && toTx(0) });
    rows[2].push({ v: dy, show: any, signed: true });
    rows[3].push({ v: dy, show: any, signed: true, res: true });
    return rows.map((cells, ri) =>
      el(
        "tr",
        { class: "k" + ri + (ri === 0 ? " first" : "") + (cls ? " " + cls : "") },
        ri === 0 ? el("th", { class: "cat", rowspan: 4, scope: "rowgroup" }, label) : null,
        el("th", { class: "kind", scope: "row" }, KINDS[ri]),
        ...cells.map((c, j) => {
          const yr = j === last,
            tone = c.signed && c.show ? (c.v > 0.5 ? " pos" : c.v < -0.5 ? " neg" : " even") : "";
          const txt = c.show ? fmtCell(c.v, !!c.signed) : ri > 0 && !yr ? "·" : "";
          const tip =
            label +
            ", " +
            (yr ? "jaar" : MONTHS_LONG[j]) +
            ": " +
            KINDS[ri].toLowerCase() +
            " " +
            (c.show ? eur0.format(c.v) : "nog geen gegevens");
          return el(
            "td",
            { class: "c" + tone + (yr ? " yr" : "") + (c.show ? "" : " empty") },
            c.go && c.show
              ? el("button", { title: tip + " — tik voor de transacties", "aria-label": tip, onclick: c.go }, txt)
              : el("span", { title: tip }, txt),
          );
        }),
      ),
    );
  };
  // Alleen de hoofdcategorieën (Inkomsten, Vaste lasten, …); de losse posten staan op het overzicht en bij Transacties.
  const toTx = f => k => () => {
    S.tab = "transacties";
    S.fCat = f;
    S.fUnk = false;
    S.month = k;
    S.shown = 50;
    go();
  };
  const body = [];
  GROUPS.forEach(grp => {
    const good = grp.kind === "uit" ? -1 : 1;
    if (!grp.cats.some(c => budgetOf(Y, c, 0) >= 0.5 || (T[c] || []).some(v => Math.abs(v) >= 0.5))) return;
    body.push(
      ...block(
        grp.name,
        k => grp.cats.reduce((s, c) => s + actual(grp, (T[c] || [])[k] || 0), 0),
        k => grp.cats.reduce((s, c) => s + budgetOf(Y, c, k), 0),
        good,
        toTx("grp:" + grp.name),
      ),
    );
  });
  main.append(
    el(
      "div",
      { class: "cmphead" },
      el(
        "div",
        {},
        el("h2", {}, "Budget vs werkelijk " + Y),
        el(
          "div",
          { class: "of" },
          "Resultaat = opgebouwd verschil. Groen is gunstig. Tik op een werkelijk bedrag voor de transacties." +
            (upto && upto < 12 ? " · = nog geen transacties ingelezen." : ""),
        ),
      ),
      el(
        "button",
        {
          class: "btn sm",
          onclick: () => {
            S.tab = "overzicht";
            S.editBudget = true;
            go();
          },
        },
        "Budget bewerken",
      ),
    ),
  );
  if (!body.length) {
    main.append(el("div", { class: "empty" }, "Nog geen budget of transacties in " + Y + "."));
    return;
  }
  const yrLabel = upto && (from > 1 || upto < 12) ? "t/m " + MONTHS[upto - 1].toLowerCase() : "Jaar";
  const head = el(
    "tr",
    {},
    el("th", { class: "cat" }, ""),
    el("th", { class: "kind" }, ""),
    ...MS.map((m, j) => el("th", { class: has(j + 1) ? "" : "nodata" }, m)),
    el("th", { class: "yr" }, yrLabel),
  );
  main.append(
    el(
      "div",
      { class: "bgridwrap" },
      el("table", { class: "bgrid cmp" }, el("thead", {}, head), el("tbody", {}, ...body)),
    ),
  );
  main.append(incomeVsSpending(Y, has, from, upto, net, toTx));
  if (unkN[0])
    main.append(
      el(
        "p",
        { class: "prose" },
        "Uitgaven (werkelijk) en Over tellen ook de " + nTx(unkN[0]) + " zonder categorie mee. ",
        aiButton("Laat AI ze indelen", "linkbtn"),
      ),
    );
}

// Onderaan: verwachte en werkelijke inkomsten, uitgaven en sparen, en wat er overblijft, per maand.
// De jaarkolom telt (net als de tabel erboven) alleen de maanden met ingelezen transacties.
function incomeVsSpending(Y, has, from, upto, net, toTx) {
  const { T } = totals(Y);
  const incAct = k => GROUPS[0].cats.reduce((s, c) => s + ((T[c] || [])[k] || 0), 0);
  const spAct = k => GROUPS[4].cats.reduce((s, c) => s - ((T[c] || [])[k] || 0), 0);
  const uitAct = k => incAct(k) - net[k] - spAct(k); // alles behalve inkomsten en sparen, ook zonder categorie
  const yearOf = f => {
    let s = 0;
    for (let k = from; k <= upto; k++) s += f(k);
    return s;
  };
  const rows = [
    ["Inkomsten", "Verwacht", k => incOf(Y, k), false],
    ["Inkomsten", "Werkelijk", incAct, true, toTx("grp:Inkomsten")],
    ["Uitgaven", "Begroot", k => uitOf(Y, k), false],
    ["Uitgaven", "Werkelijk", uitAct, true],
    ["Sparen", "Begroot", k => spOf(Y, k), false],
    ["Sparen", "Werkelijk", spAct, true, toTx("grp:Sparen en beleggen")],
    ["Over", "Verwacht", k => overOf(Y, k), false, null, true],
    ["Over", "Werkelijk", k => net[k], true, null, true],
  ];
  const tr = rows.map(([label, kind, f, actual, go2, tone], ri) =>
    el(
      "tr",
      { class: "k" + (ri % 2 ? 1 : 0) + (ri % 2 ? "" : " first") + (label === "Over" ? " over" : "") },
      ri % 2 ? null : el("th", { class: "cat", rowspan: 2, scope: "rowgroup" }, label),
      el("th", { class: "kind", scope: "row" }, kind),
      ...MONTHS.map((m, j) => {
        const k = j + 1,
          show = !actual || has(k),
          v = show ? f(k) : 0;
        return sumTd(v, show, tone, go2 && go2(k), label + ", " + MONTHS_LONG[j] + ": " + kind.toLowerCase());
      }),
      sumTd(upto ? yearOf(f) : 0, !!upto, tone, go2 && go2(0), label + ", " + Y + ": " + kind.toLowerCase(), true),
    ),
  );
  const head = el(
    "tr",
    {},
    el("th", { class: "cat" }, ""),
    el("th", { class: "kind" }, ""),
    ...MONTHS.map((m, j) => el("th", { class: has(j + 1) ? "" : "nodata" }, m)),
    el("th", { class: "yr" }, upto && (from > 1 || upto < 12) ? "t/m " + MONTHS[upto - 1].toLowerCase() : "Jaar"),
  );
  return el(
    "section",
    { class: "ivu" },
    el("h2", {}, "Inkomsten vs uitgaven per maand"),
    el(
      "div",
      { class: "bgridwrap" },
      el("table", { class: "bgrid cmp" }, el("thead", {}, head), el("tbody", {}, ...tr)),
    ),
  );
}
function sumTd(v, show, tone, go2, tip, yr) {
  const t = show && tone ? (v > 0.5 ? " pos" : v < -0.5 ? " neg" : " even") : "";
  const txt = show ? fmtCell(v, false) : "·";
  return el(
    "td",
    { class: "c" + t + (yr ? " yr" : "") + (show ? "" : " empty") },
    go2 && show
      ? el("button", { title: tip + " — tik voor de transacties", "aria-label": tip, onclick: go2 }, txt)
      : el("span", { title: tip }, txt),
  );
}
