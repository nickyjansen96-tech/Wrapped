"use strict";
// Opbouw van het scherm: kop, gebruikers, jaar- en maandkeuze, categoriemenu.
/* ---------- weergave ---------- */
function render() {
  for (const b of document.querySelectorAll("#tabs button"))
    b.setAttribute(
      "aria-selected",
      b.dataset.tab === (S.tab === "vergelijk" || S.tab === "samenvatting" ? "overzicht" : S.tab),
    );
  const cur = document.querySelector('#tabs button[aria-selected="true"]');
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
  $("#back").hidden = !(history.state && history.state.n > 0);
  // De budgettabel krijgt de volle schermbreedte, zodat alle maanden ernaast passen.
  for (const w of document.querySelectorAll(".wrap"))
    w.classList.toggle("wide", (S.tab === "overzicht" && !!S.editBudget) || S.tab === "vergelijk");
  renderProfiles();
  renderRail();
  const main = $("#main");
  main.replaceChildren();
  if (!S.ready) {
    main.append(el("div", { class: "empty" }, "Gegevens laden…"));
    return;
  }
  ({
    overzicht: viewOverview,
    vermogen: viewWealth,
    transacties: viewTx,
    regels: viewRules,
    importeren: viewImport,
    gebruikers: viewUsers,
    vergelijk: viewCompare,
    samenvatting: viewSummary,
  })[S.tab](main);
}
function renderProfiles() {
  const box = $("#profiles");
  box.replaceChildren(
    el(
      "div",
      { class: "users" },
      ...PROFILES.map(p =>
        el(
          "button",
          { class: "seg", "aria-pressed": p.id === profile, title: p.name, onclick: () => switchProfile(p.id) },
          p.name,
        ),
      ),
    ),
    el(
      "button",
      {
        class: "seg add",
        "aria-pressed": S.tab === "gebruikers",
        "aria-label": "Gebruikers beheren",
        title: "Gebruikers beheren",
        onclick: () => {
          if (S.tab !== "gebruikers") {
            S.tab = "gebruikers";
            go();
          }
        },
      },
      "+",
    ),
  );
}
// Jaren als knoppen naast elkaar (oudste links), zodat je met één tik wisselt.
function yearSwitch(ys, pick) {
  return el(
    "div",
    { class: "yearseg", role: "group", "aria-label": "Jaar" },
    ys.map(y =>
      el(
        "button",
        {
          class: "seg",
          "aria-pressed": y === S.year,
          onclick: () => {
            if (y !== S.year) pick(y);
          },
        },
        y,
      ),
    ),
  );
}
function renderRail() {
  const rail = $("#rail");
  rail.replaceChildren();
  const ov = S.tab === "overzicht" || S.tab === "vergelijk";
  rail.hidden =
    S.tab === "regels" ||
    S.tab === "samenvatting" ||
    S.tab === "importeren" ||
    S.tab === "gebruikers" ||
    (!ov && !S.tx.length);
  if (rail.hidden) return;
  // Op het overzicht kun je ook jaren zonder transacties kiezen (bijv. volgend jaar), om alvast te begroten.
  const ys = ov ? budgetYears() : years().slice().reverse();
  if (!ys.includes(S.year)) S.year = ov ? years()[0] || new Date().getFullYear() : ys[ys.length - 1];
  rail.append(
    yearSwitch(ys, y => {
      S.year = y;
      S.shown = 50;
      render();
    }),
  );
  if (ov && (S.editBudget || S.tab === "vergelijk")) return;
  if (S.tab === "vermogen") return;
  const { cnt } = totals(S.year);
  rail.append(
    el(
      "button",
      {
        class: "chip",
        "aria-pressed": S.month === 0,
        onclick: () => {
          S.month = 0;
          S.shown = 50;
          render();
        },
      },
      "Heel jaar",
    ),
  );
  MONTHS.forEach((n, i) =>
    rail.append(
      el(
        "button",
        {
          class: "chip" + (cnt[i + 1] ? "" : " off"),
          "aria-pressed": S.month === i + 1,
          onclick: () => {
            S.month = i + 1;
            S.shown = 50;
            render();
          },
        },
        n,
      ),
    ),
  );
}

function catSelect(value, onchange, opts = {}) {
  const s = el("select", {
    class: "cat" + (opts.cls ? " " + opts.cls : ""),
    "aria-label": "Categorie",
    onchange: e => onchange(e.target.value),
  });
  if (opts.auto)
    s.append(
      el("option", { value: "", title: "Automatisch via een regel" }, opts.auto === UNK ? "Kies categorie" : opts.auto),
    );
  for (const g of GROUPS) {
    const og = el("optgroup", { label: g.name });
    for (const c of g.cats) og.append(el("option", { value: c, selected: c === value }, c));
    s.append(og);
  }
  if (opts.auto && !value) s.value = "";
  return s;
}
