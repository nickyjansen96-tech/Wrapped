"use strict";
// Tabblad Overzicht en budget: hoe sta je ervoor.
/* ---------- overzicht en budget ---------- */
// Twee standen: "bekijken" (hoe sta ik ervoor) en "budget bewerken" (bedragen invullen). Zo staat er nooit alles tegelijk op het scherm.
function ovCtx() {
  const Y = S.year,
    m = S.month,
    { T, unkN, unkSum, cnt } = totals(Y);
  let upto = 0,
    from = 0;
  for (let k = 12; k >= 1; k--)
    if (cnt[k]) {
      upto = k;
      break;
    }
  for (let k = 1; k <= 12; k++)
    if (cnt[k]) {
      from = k;
      break;
    }
  return { Y, m, T, unkN, unkSum, from, upto, ref: budgetRef(Y) };
}
// Budget om mee te vergelijken: de gekozen maand, of bij heel jaar alleen de maanden waarover transacties zijn ingelezen.
function cmpBudget(x, c) {
  if (x.m) return budgetOf(x.Y, c, x.m);
  if (!x.upto) return budgetOf(x.Y, c, 0);
  let s = 0;
  for (let k = x.from; k <= x.upto; k++) s += budgetOf(x.Y, c, k);
  return s;
}
const actOf = (x, grp, c) => actual(grp, (x.T[c] || [])[x.m] || 0);
const groupSum = (grp, fn) => grp.cats.reduce((s, c) => s + fn(c), 0);
const kinds = fn => ({
  inc: groupSum(GROUPS[0], fn),
  uit: groupSum(GROUPS[1], fn) + groupSum(GROUPS[2], fn) + groupSum(GROUPS[3], fn),
  sp: groupSum(GROUPS[4], fn),
});
const anyBudget = Y => ALLCATS.some(c => budgetOf(Y, c, 0) > 0);
function viewOverview(main) {
  if (S.editBudget) viewBudgetEdit(main);
  else viewStatus(main);
}

function viewStatus(main) {
  const x = ovCtx(),
    hasB = anyBudget(x.Y);
  const A = kinds(c => {
      const g = GROUPS.find(g => g.cats.includes(c));
      return actOf(x, g, c);
    }),
    B = kinds(c => cmpBudget(x, c)),
    rest = A.inc - A.uit - A.sp + x.unkSum[x.m];
  const per = S.month ? MONTHS_LONG[S.month - 1] + " " + S.year : String(S.year);
  const stat = (l, v, b) =>
    el(
      "div",
      { class: "stat" },
      el("div", { class: "l" }, l),
      el("div", { class: "v" }, eur0.format(v)),
      el("div", { class: "s" }, hasB ? "van " + eur0.format(b) : " "),
    );
  main.append(
    el(
      "div",
      { class: "card hero" },
      el(
        "div",
        { class: "herotop" },
        el(
          "div",
          {},
          el("div", { class: "l" }, "Over in " + per),
          el("div", { class: "big " + (rest < -0.5 ? "neg" : "pos") }, eur0.format(rest)),
        ),
        el(
          "div",
          { class: "herobtns" },
          el(
            "button",
            {
              class: "btn" + (hasB ? "" : " pri"),
              id: "budget-btn",
              onclick: () => {
                S.editBudget = true;
                render();
                window.scrollTo(0, 0);
              },
            },
            hasB ? "Budget bewerken" : "Budget invullen",
          ),
          hasB ? el("button", { class: "btn", id: "compare-btn", onclick: goCompare }, "Vergelijk per maand") : null,
          S.tx.length ? summaryButton() : null,
        ),
      ),
      el(
        "div",
        { class: "stats" },
        stat("Inkomsten", A.inc, B.inc),
        stat("Uitgaven", A.uit, B.uit),
        stat("Gespaard", A.sp, B.sp),
      ),
    ),
  );
  if (!S.tx.length) {
    main.append(
      el(
        "div",
        { class: "note info" },
        "Nog geen transacties ingelezen.",
        el(
          "button",
          {
            class: "btn sm",
            onclick: () => {
              S.tab = "importeren";
              go();
            },
          },
          "Importeren",
        ),
      ),
    );
    return;
  }
  if (x.unkN[x.m])
    main.append(
      el(
        "div",
        { class: "note" },
        el("span", {}, nTx(x.unkN[x.m]) + " zonder categorie (wel meegeteld in Over)"),
        el(
          "span",
          { class: "tools" },
          aiButton(),
          el(
            "button",
            {
              class: "btn sm",
              onclick: () => {
                S.tab = "transacties";
                S.fUnk = true;
                S.fCat = "";
                S.shown = 50;
                go();
              },
            },
            "Zelf toewijzen",
          ),
        ),
      ),
    );
  let hidden = 0;
  GROUPS.forEach(grp => {
    const rows = [];
    let ga = 0,
      gb = 0;
    for (const c of grp.cats) {
      const a = actOf(x, grp, c),
        b = cmpBudget(x, c);
      ga += a;
      gb += b;
      if (!S.showEmpty && Math.abs(a) < 0.5 && b < 0.5) {
        hidden++;
        continue;
      }
      rows.push(catLine(grp, c, a, b));
    }
    if (!rows.length) return;
    main.append(
      el(
        "section",
        { class: "group" },
        el(
          "div",
          { class: "ghead" },
          el("span", {}, grp.name),
          el(
            "span",
            { class: "num" },
            eur0.format(ga),
            gb ? el("span", { class: "of" }, " van " + eur0.format(gb)) : null,
          ),
        ),
        ...rows,
      ),
    );
  });
  if (hidden || S.showEmpty)
    main.append(
      el(
        "button",
        {
          class: "linkbtn",
          onclick: () => {
            S.showEmpty = !S.showEmpty;
            render();
          },
        },
        S.showEmpty ? "Lege categorieën verbergen" : "Lege categorieën tonen (" + hidden + ")",
      ),
    );
}
function catLine(grp, c, a, b) {
  const over = grp.kind === "uit" && b > 0 && a > b + 0.5,
    p = b > 0 ? Math.max(0, Math.min(1, a / b)) : 0;
  return el(
    "button",
    {
      class: "cline",
      onclick: () => {
        S.tab = "transacties";
        S.fCat = c;
        S.fUnk = false;
        S.shown = 50;
        go();
      },
    },
    el("span", { class: "cn" }, c),
    el(
      "span",
      { class: "cv" },
      el("span", { class: "num" + (over ? " neg" : "") }, f0(a)),
      el("span", { class: "of" }, b > 0 ? "van " + eur0.format(b) : "geen budget"),
    ),
    b > 0
      ? el(
          "span",
          {
            class: "pbar" + (over ? " over" : ""),
            role: "img",
            "aria-label": Math.round((a / b) * 100) + "% van budget",
          },
          el("i", { style: "width:" + p * 100 + "%" }),
        )
      : null,
  );
}
