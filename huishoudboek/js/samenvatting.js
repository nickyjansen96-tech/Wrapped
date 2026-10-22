"use strict";
// Maandsamenvatting door een AI-chat: de app zet de cijfers van één maand (met budget, vorige maanden, het jaar tot
// nu toe en het budget van de volgende maand) in een tekst met vraag. Die plak je in Claude of ChatGPT, die er een
// kort overzicht van maakt: terugblik op de maand en vooruitblik op de volgende. Rekeningnummers gaan niet mee.

// Maanden met transacties als jjjjmm, oudste eerst.
function txMonths() {
  return [...new Set(S.tx.map(t => Math.floor(t.d / 100)))].sort((a, b) => a - b);
}
// Standaard de laatste afgeronde maand: de laatste maand met transacties vóór de huidige kalendermaand.
function defaultSumMonth(ms) {
  const now = new Date(),
    cur = now.getFullYear() * 100 + now.getMonth() + 1,
    done = ms.filter(m => m < cur);
  return done.length ? done[done.length - 1] : ms[ms.length - 1];
}
const ymName = ym => MONTHS_LONG[(ym % 100) - 1] + " " + Math.floor(ym / 100);
const nextYm = ym => (ym % 100 === 12 ? (Math.floor(ym / 100) + 1) * 100 + 1 : ym + 1);
const e0 = v => eur0.format(v).replace(/ /g, " ");

function summaryPrompt(ym) {
  const Y = Math.floor(ym / 100),
    k = ym % 100,
    nx = nextYm(ym),
    NY = Math.floor(nx / 100),
    nk = nx % 100;
  const { T, cnt, unkN } = totals(Y);
  const monthAll = S.tx.filter(t => Math.floor(t.d / 100) === ym),
    monthTx = monthAll.filter(counted);
  const declM = monthAll.filter(t => catOf(t) === DECL),
    skipN = monthAll.filter(t => catOf(t) === SKIP).length,
    decl = declBalance(ym * 100 + 31);
  const cats = GROUPS.flatMap(g => g.cats.map(c => ({ g, c })));
  const act = (g, c, m) => actual(g, (T[c] || [])[m] || 0);
  // Gemiddelde van de (maximaal) drie maanden ervoor met transacties, over de jaargrens heen.
  const prev = txMonths()
    .filter(m => m < ym)
    .slice(-3);
  const prevAct = (g, c) => {
    if (!prev.length) return null;
    let s = 0;
    for (const m of prev) {
      const PT = totals(Math.floor(m / 100)).T;
      s += actual(g, (PT[c] || [])[m % 100] || 0);
    }
    return s / prev.length;
  };
  const net = monthTx.reduce((s, t) => s + t.a, 0),
    inAll = monthTx.reduce((s, t) => s + Math.max(0, t.a), 0),
    outAll = monthTx.reduce((s, t) => s - Math.min(0, t.a), 0);
  const unkTx = monthTx.filter(t => catOf(t) === UNK),
    unkIn = unkTx.reduce((s, t) => s + Math.max(0, t.a), 0),
    unkOut = unkTx.reduce((s, t) => s - Math.min(0, t.a), 0);
  const uit = GROUPS.filter(g => g.kind === "uit").reduce(
    (s, g) => s + g.cats.reduce((x, c) => x + act(g, c, k), 0),
    0,
  );
  const vs = (w, v) => (Math.abs(v) >= 0.5 ? " (" + w + " " + e0(v) + ")" : " (geen budget)");
  const catName = t => (catOf(t) === UNK ? "zonder categorie" : catOf(t));
  const inc = GROUPS[0].cats.reduce((s, c) => s + act(GROUPS[0], c, k), 0);
  const sp = GROUPS.filter(g => g.kind === "spaar").reduce(
    (s, g) => s + g.cats.reduce((x, c) => x + act(g, c, k), 0),
    0,
  );
  const L = [];
  L.push(
    "Je bent een nuchtere, vriendelijke financiële coach. Hieronder staan de cijfers uit mijn huishoudboekje over " +
      ymName(ym) +
      ". Geef in het Nederlands een beknopt overzicht (maximaal 250 woorden) met deze kopjes:",
    "1. Hoe ging " +
      MONTHS_LONG[k - 1] +
      "? 3 tot 5 punten: inkomsten, uitgaven en sparen tegenover het budget, en wat opvalt tegenover de maanden ervoor.",
    "2. Opvallend: de posten of uitgaven die het meest afwijken, en of dat eenmalig lijkt of structureel.",
    "3. Vooruitblik op " +
      MONTHS_LONG[nk - 1] +
      ": wat er volgens het budget aankomt, waar ik op moet letten en 1 of 2 concrete tips.",
    "Sluit af met één zin als conclusie. Gebruik alleen de gegevens hieronder en verzin niets; zeg het als iets niet uit de gegevens blijkt. Bedragen in euro, afgerond.",
    "",
    "== " + ymName(ym).toUpperCase() + " ==",
    "Alle transacties: bijgeschreven " + e0(inAll) + ", afgeschreven " + e0(outAll),
    "Inkomsten: " + e0(inc) + vs("verwacht", incOf(Y, k)),
    "Uitgaven (ingedeeld, zonder sparen): " + e0(uit) + vs("begroot", uitOf(Y, k)),
    "Gespaard en belegd: " + e0(sp) + vs("begroot", spOf(Y, k)),
    "Over (saldo van de maand): " + e0(net) + vs("verwacht", overOf(Y, k)),
    "Aantal transacties: " + monthTx.length,
    unkN[k]
      ? "Nog zonder categorie: " + unkN[k] + " transacties, bijgeschreven " + e0(unkIn) + ", afgeschreven " + e0(unkOut)
      : "Alle transacties zijn ingedeeld.",
    ...(declM.length || decl.n
      ? [
          "Declaraties (tellen niet mee hierboven): deze maand voorgeschoten " +
            e0(declM.reduce((s, t) => s - Math.min(0, t.a), 0)) +
            ", terugontvangen " +
            e0(declM.reduce((s, t) => s + Math.max(0, t.a), 0)) +
            "; eind van de maand nog terug te krijgen: " +
            e0(decl.open),
        ]
      : []),
    ...(skipN ? [skipN + " transacties tellen bewust niet mee (bijv. overboekingen tussen eigen rekeningen)."] : []),
    "",
    "Per post (werkelijk | budget | verschil, + is gunstig" +
      (prev.length ? " | gemiddeld in de " + prev.length + " maanden ervoor" : "") +
      "):",
  );
  const before = L.length;
  for (const g of GROUPS) {
    const rows = cats.filter(x => x.g === g && (Math.abs(act(g, x.c, k)) >= 0.5 || budgetOf(Y, x.c, k) >= 0.5));
    if (!rows.length) continue;
    L.push(g.name + ":");
    for (const { c } of rows) {
      const a = act(g, c, k),
        b = budgetOf(Y, c, k),
        d = (g.kind === "uit" ? -1 : 1) * (a - b),
        p = prevAct(g, c);
      L.push(
        "- " +
          c +
          ": " +
          e0(a) +
          " | " +
          e0(b) +
          " | " +
          (d > 0.5 ? "+" : "") +
          e0(d) +
          (p != null ? " | " + e0(p) : ""),
      );
    }
  }
  if (L.length === before)
    L.push("(nog geen transacties ingedeeld en geen budget; beoordeel de uitgaven hieronder op naam)");
  // Grootste uitgaven van de maand.
  const big = monthTx
    .filter(t => t.a < 0)
    .sort((a, b) => a.a - b.a)
    .slice(0, 10);
  if (big.length) {
    L.push("", "Grootste uitgaven:");
    for (const t of big) {
      const [name] = partyOf(t);
      L.push(
        "- " +
          (t.d % 100) +
          " " +
          MONTHS[k - 1].toLowerCase() +
          ": " +
          (name || cleanDesc(t.t).slice(0, 40)) +
          " — " +
          e0(-t.a) +
          " (" +
          catName(t) +
          ")",
      );
    }
  }
  // Het jaar tot en met deze maand, alleen maanden met transacties.
  const on = [];
  for (let m = 1; m <= k; m++) if (cnt[m]) on.push(m);
  if (on.length > 1) {
    L.push("", "== " + Y + " TOT EN MET " + MONTHS_LONG[k - 1].toUpperCase() + " (" + on.length + " maanden) ==");
    for (const g of GROUPS) {
      let a = 0,
        b = 0;
      for (const c of g.cats)
        for (const m of on) {
          a += act(g, c, m);
          b += budgetOf(Y, c, m);
        }
      if (Math.abs(a) < 0.5 && b < 0.5) continue;
      const d = (g.kind === "uit" ? -1 : 1) * (a - b);
      L.push(
        "- " + g.name + ": werkelijk " + e0(a) + ", budget " + e0(b) + ", verschil " + (d > 0.5 ? "+" : "") + e0(d),
      );
    }
    const jb = GROUPS.reduce((s, g) => s + g.cats.reduce((x, c) => x + budgetOf(Y, c, 0), 0), 0);
    let over = 0;
    for (let m = 1; m <= 12; m++) over += overOf(Y, m);
    if (jb) L.push("Verwacht over voor heel " + Y + " volgens budget: " + e0(over));
  }
  // Vooruitblik: budget van de volgende maand en terugkerende afschrijvingen van deze maand.
  L.push("", "== VOORUITBLIK " + ymName(nx).toUpperCase() + " ==");
  const nb = cats.filter(({ c }) => budgetOf(NY, c, nk) >= 0.5);
  if (nb.length) {
    L.push(
      "Verwacht: inkomsten " +
        e0(incOf(NY, nk)) +
        ", uitgaven " +
        e0(uitOf(NY, nk)) +
        ", sparen " +
        e0(spOf(NY, nk)) +
        ", over " +
        e0(overOf(NY, nk)),
      "Budget per post:",
    );
    for (const { c } of nb) {
      const now = budgetOf(Y, c, k),
        b = budgetOf(NY, c, nk);
      L.push("- " + c + ": " + e0(b) + (Math.abs(b - now) >= 0.5 ? " (deze maand " + e0(now) + ")" : ""));
    }
  } else L.push("Voor " + ymName(nx) + " is nog geen budget ingevuld.");
  const rec = monthTx.filter(t => /incasso|periodieke/.test(txType(t.t)));
  if (rec.length) {
    L.push("Vaste afschrijvingen deze maand (komen waarschijnlijk terug):");
    for (const t of rec.slice(0, 15))
      L.push("- " + (partyOf(t)[0] || cleanDesc(t.t).slice(0, 40)) + ": " + e0(-t.a) + " (" + catName(t) + ")");
  }
  return L.join("\n");
}

function goSummary() {
  S.tab = "samenvatting";
  S.sum = { ym: 0, msg: "", show: false };
  go();
}
const summaryButton = (cls = "btn") =>
  el("button", { class: cls, id: "summary-btn", onclick: goSummary }, "✨ Maandsamenvatting");

function viewSummary(main) {
  const ms = txMonths();
  S.sum = S.sum || { ym: 0, msg: "", show: false };
  const card = el(
    "div",
    { class: "card ai", id: "sum-card" },
    el(
      "div",
      { class: "aihead" },
      el("span", { class: "aiicon", "aria-hidden": "true" }, "✨"),
      el(
        "div",
        {},
        el("h2", {}, "Maandsamenvatting door AI"),
        el(
          "div",
          { class: "prose" },
          ms.length
            ? "Kies een maand. De app maakt een export met je cijfers en een vraag; een AI-chat zoals Claude of ChatGPT geeft je dan een kort overzicht: hoe ging de maand en waar let je volgende maand op."
            : "Lees eerst je bankexport in; daarna kan een AI-chat je maand samenvatten.",
        ),
      ),
    ),
  );
  main.append(card);
  if (!ms.length) return;
  if (!ms.includes(S.sum.ym)) S.sum.ym = defaultSumMonth(ms);
  const ym = S.sum.ym,
    prompt = summaryPrompt(ym);
  const pick = el(
    "div",
    { class: "yearseg monthseg", role: "group", "aria-label": "Maand" },
    ms.slice(-12).map(m =>
      el(
        "button",
        {
          class: "seg",
          "aria-pressed": m === ym,
          onclick: () => {
            S.sum.ym = m;
            S.sum.msg = "";
            render();
          },
        },
        MONTHS[(m % 100) - 1] +
          (Math.floor(m / 100) !== Math.floor(ms[ms.length - 1] / 100)
            ? " " + String(Math.floor(m / 100)).slice(2)
            : ""),
      ),
    ),
  );
  const step = (n, title, ...body) =>
    el(
      "div",
      { class: "aistep" },
      el("span", { class: "aino" }, n),
      el("div", { class: "aibody" }, el("div", { class: "aititle" }, title), ...body),
    );
  const fileName = "huishoudboek-" + Math.floor(ym / 100) + "-" + String(ym % 100).padStart(2, "0") + ".txt";
  card.append(
    pick,
    S.sum.msg ? el("div", { class: "note info", role: "status" }, S.sum.msg) : null,
    step(
      1,
      "Kopieer de export van " + ymName(ym),
      el(
        "div",
        { class: "tools" },
        el(
          "button",
          {
            class: "btn pri",
            id: "sum-copy",
            onclick: async () => {
              const ok = await copyText(prompt);
              S.sum.msg = ok
                ? "Gekopieerd! Ga nu naar stap 2."
                : "Kopiëren lukte niet; open de export hieronder en kopieer hem zelf.";
              S.sum.show = S.sum.show || !ok;
              render();
            },
          },
          "Export kopiëren",
        ),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              const a = el("a", {
                href: URL.createObjectURL(new Blob([prompt], { type: "text/plain;charset=utf-8" })),
                download: fileName,
              });
              document.body.append(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            },
          },
          "Als bestand",
        ),
        navigator.share
          ? el(
              "button",
              {
                class: "btn",
                onclick: async () => {
                  try {
                    await navigator.share({ text: prompt });
                  } catch (e) {}
                },
              },
              "Delen",
            )
          : null,
        el(
          "button",
          {
            class: "linkbtn",
            onclick: () => {
              S.sum.show = !S.sum.show;
              render();
            },
          },
          S.sum.show ? "Export verbergen" : "Wat wordt gedeeld?",
        ),
      ),
      S.sum.show
        ? el(
            "p",
            { class: "prose" },
            "Totalen per post met budget en vorige maanden, de grootste uitgaven en vaste afschrijvingen (met naam van de winkel of partij), het jaar tot nu toe en het budget van de volgende maand. Rekeningnummers, pasnummers en je naam gaan niet mee.",
          )
        : null,
      S.sum.show
        ? el(
            "textarea",
            {
              class: "txt area",
              id: "sum-text",
              readonly: true,
              rows: 14,
              "aria-label": "Export voor de AI-chat",
              onfocus: e => e.target.select(),
            },
            prompt,
          )
        : null,
    ),
    step(
      2,
      "Plak hem in een nieuw gesprek met een AI-chat",
      el(
        "div",
        { class: "tools" },
        ...AI_CHATS.map(c =>
          el("a", { class: "btn", href: c.url, target: "_blank", rel: "noopener" }, c.name + " openen ↗"),
        ),
      ),
      el(
        "p",
        { class: "prose" },
        "Je krijgt een kort overzicht van " +
          MONTHS_LONG[(ym % 100) - 1] +
          " en een vooruitblik op " +
          MONTHS_LONG[(nextYm(ym) % 100) - 1] +
          ". Tip: deel transacties eerst in (Regels en AI), dan klopt de samenvatting beter.",
      ),
    ),
  );
}
