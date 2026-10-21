"use strict";
// Budget vs werkelijk per hoofdcategorie en maand, voor het hele jaar of één kwartaal.
// Per hoofdcategorie drie regels (budget, werkelijk, verschil), per post daaronder alleen het verschil.
// Verschil is gunstig (+) als je minder uitgaf of meer ontving/spaarde dan begroot; elke maand staat op zichzelf.
// De totaalkolom telt de maanden met ingelezen transacties op. Zijn er nog maanden zonder transacties, dan staat
// ernaast het budget voor de hele periode: wat je aan het begin van het jaar verwachtte.
const fmtCell = (v, signed) => {
  const n = eur0.format(Math.abs(v)).replace("€", "").trim();
  return signed ? (v > 0.5 ? "+" : v < -0.5 ? "−" : "") + n : (v < -0.5 ? "−" : "") + n;
};
function goCompare() {
  S.tab = "vergelijk";
  go();
}
// Maanden in de gekozen periode (0 = heel jaar, 1–4 = kwartaal) en welke daarvan transacties hebben.
function cmpPeriod(has) {
  const Q = S.cmpQ || 0,
    ks = Q ? [3 * Q - 2, 3 * Q - 1, 3 * Q] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    on = ks.filter(has),
    name = Q ? "Q" + Q : "Jaar";
  const partial = on.length > 0 && on.length < ks.length;
  return {
    Q,
    ks,
    on,
    partial,
    totLabel: partial ? "t/m " + MONTHS[on[on.length - 1] - 1].toLowerCase() : name,
    fullLabel: Q ? "Heel Q" + Q : "Heel jaar",
  };
}
function quarterSwitch() {
  return el(
    "div",
    { class: "yearseg qseg", role: "group", "aria-label": "Periode" },
    ["Jaar", "Q1", "Q2", "Q3", "Q4"].map((t, q) =>
      el(
        "button",
        {
          class: "seg",
          "aria-pressed": (S.cmpQ || 0) === q,
          onclick: () => {
            if ((S.cmpQ || 0) !== q) {
              S.cmpQ = q;
              go();
            }
          },
        },
        t,
      ),
    ),
  );
}
// Eén cel; c = { v, show, signed, go, blank }.
function cmpTd(c, tip, cls) {
  const tone = (c.signed || c.tone) && c.show ? (c.v > 0.5 ? " pos" : c.v < -0.5 ? " neg" : " even") : "";
  const txt = c.show ? fmtCell(c.v, !!c.signed) : c.blank ? "" : "·";
  const t = tip + " " + (c.show ? eur0.format(c.v) : "nog geen gegevens");
  return el(
    "td",
    { class: "c" + tone + (cls ? " " + cls : "") + (c.show ? "" : " empty") },
    c.go && c.show
      ? el("button", { title: t + " — tik voor de transacties", "aria-label": t, onclick: c.go }, txt)
      : el("span", { title: t }, txt),
  );
}
function viewCompare(main) {
  const Y = S.year,
    { T, cnt, unkN } = totals(Y);
  const has = k => cnt[k] > 0;
  const P = cmpPeriod(has);
  const net = Array(13).fill(0);
  for (const t of S.tx) if (Math.floor(t.d / 10000) === Y) net[Math.floor(t.d / 100) % 100] += t.a;
  const KINDS = ["Budget", "Werkelijk", "Verschil"];
  const toTx = f => k => () => {
    S.tab = "transacties";
    S.fCat = f;
    S.fUnk = false;
    S.month = k;
    S.shown = 50;
    go();
  };
  // Cellen voor één regel: maanden, totaal (opgeteld over maanden met transacties) en eventueel het hele budget.
  const cellsOf = (f, opt) => {
    const cells = P.ks.map(k => ({ v: f(k), show: opt.always || has(k), signed: opt.signed, go: opt.go && opt.go(k) }));
    const sum = P.on.reduce((s, k) => s + f(k), 0);
    const totShow = P.on.length > 0 || opt.always;
    cells.push({
      v: P.on.length ? sum : P.ks.reduce((s, k) => s + f(k), 0),
      show: totShow,
      signed: opt.signed,
      go: opt.go && !P.Q && opt.go(0),
      tot: true,
    });
    if (P.partial)
      cells.push(
        opt.always ? { v: P.ks.reduce((s, k) => s + f(k), 0), show: true, full: true } : { blank: true, full: true },
      );
    return cells;
  };
  const tds = (cells, tip) =>
    cells.map((c, j) =>
      cmpTd(
        c,
        tip + ", " + (c.full ? P.fullLabel.toLowerCase() : c.tot ? P.totLabel : MONTHS_LONG[P.ks[j] - 1]) + ":",
        c.full ? "yr full" : c.tot ? "yr" : "",
      ),
    );
  // a(k)/b(k): werkelijk en budget in maand k; good: +1 als meer werkelijk gunstig is (inkomsten, sparen), −1 bij uitgaven.
  const block = (label, a, b, good, go2) => {
    const rows = [
      cellsOf(b, { always: true }),
      cellsOf(a, { go: go2 }),
      cellsOf(k => good * (a(k) - b(k)), { signed: true }),
    ];
    return rows.map((cells, ri) =>
      el(
        "tr",
        { class: "k" + ri + (ri === 0 ? " first" : "") },
        ri === 0 ? el("th", { class: "cat", rowspan: 3, scope: "rowgroup" }, label) : null,
        el("th", { class: "kind", scope: "row" }, KINDS[ri]),
        ...tds(cells, label + " " + KINDS[ri].toLowerCase()),
      ),
    );
  };
  const subRow = (c, grp, lastSub) => {
    const good = grp.kind === "uit" ? -1 : 1;
    const d = k => good * (actual(grp, (T[c] || [])[k] || 0) - budgetOf(Y, c, k));
    return el(
      "tr",
      { class: "sub" + (lastSub ? " sublast" : "") },
      el("th", { class: "cat", scope: "row", title: c }, c),
      el("th", { class: "kind" }, "Verschil"),
      ...tds(cellsOf(d, { signed: true, go: toTx(c) }), c + " verschil"),
    );
  };
  const used = c => budgetOf(Y, c, 0) >= 0.5 || (T[c] || []).some(v => Math.abs(v) >= 0.5);
  const body = [];
  GROUPS.forEach(grp => {
    if (!grp.cats.some(used)) return;
    body.push(
      ...block(
        grp.name,
        k => grp.cats.reduce((s, c) => s + actual(grp, (T[c] || [])[k] || 0), 0),
        k => grp.cats.reduce((s, c) => s + budgetOf(Y, c, k), 0),
        grp.kind === "uit" ? -1 : 1,
        toTx("grp:" + grp.name),
      ),
    );
    // Daaronder per post alleen het verschil met het budget.
    const subs = grp.cats.filter(used);
    subs.forEach((c, i) => body.push(subRow(c, grp, i === subs.length - 1)));
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
          "Verschil per maand; groen is gunstig. Per post staat alleen het verschil. Tik op een bedrag voor de transacties." +
            (P.partial ? " · = nog geen transacties ingelezen." : ""),
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
    quarterSwitch(),
  );
  if (!body.length) {
    main.append(el("div", { class: "empty" }, "Nog geen budget of transacties in " + Y + "."));
    return;
  }
  main.append(
    el(
      "div",
      { class: "bgridwrap" },
      el("table", { class: "bgrid cmp" }, el("thead", {}, cmpHead(P, has)), el("tbody", {}, ...body)),
    ),
  );
  main.append(incomeVsSpending(Y, has, P, net, toTx, cellsOf, tds));
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
function cmpHead(P, has) {
  return el(
    "tr",
    {},
    el("th", { class: "cat" }, ""),
    el("th", { class: "kind" }, ""),
    ...P.ks.map(k => el("th", { class: has(k) ? "" : "nodata" }, MONTHS[k - 1])),
    el("th", { class: "yr" }, P.totLabel),
    P.partial ? el("th", { class: "yr full" }, P.fullLabel) : null,
  );
}

// Onderaan: verwachte en werkelijke inkomsten, uitgaven en sparen, en wat er overblijft, per maand.
// De totaalkolom telt (net als de tabel erboven) alleen de maanden met ingelezen transacties.
function incomeVsSpending(Y, has, P, net, toTx, cellsOf, tds) {
  const { T } = totals(Y);
  const incAct = k => GROUPS[0].cats.reduce((s, c) => s + ((T[c] || [])[k] || 0), 0);
  const spAct = k => GROUPS[4].cats.reduce((s, c) => s - ((T[c] || [])[k] || 0), 0);
  const uitAct = k => incAct(k) - net[k] - spAct(k); // alles behalve inkomsten en sparen, ook zonder categorie
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
  const tr = rows.map(([label, kind, f, isActual, go2, tone], ri) => {
    const cells = cellsOf(f, { always: !isActual, go: go2 });
    if (tone) cells.forEach(c => (c.tone = true));
    return el(
      "tr",
      { class: "k" + (ri % 2 ? 1 : 0) + (ri % 2 ? "" : " first") + (label === "Over" ? " over" : "") },
      ri % 2 ? null : el("th", { class: "cat", rowspan: 2, scope: "rowgroup" }, label),
      el("th", { class: "kind", scope: "row" }, kind),
      ...tds(cells, label + " " + kind.toLowerCase()),
    );
  });
  return el(
    "section",
    { class: "ivu" },
    el("h2", {}, "Inkomsten vs uitgaven per maand"),
    el(
      "div",
      { class: "bgridwrap" },
      el("table", { class: "bgrid cmp" }, el("thead", {}, cmpHead(P, has)), el("tbody", {}, ...tr)),
    ),
  );
}
