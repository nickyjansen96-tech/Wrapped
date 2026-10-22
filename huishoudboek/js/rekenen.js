"use strict";
// Berekeningen: jaren, totalen per categorie en maand, budgetten.
function years() {
  return [...new Set(S.tx.map(t => Math.floor(t.d / 10000)))].sort((a, b) => b - a);
}
function pickDefaults() {
  const ys = years();
  if (!ys.length) {
    S.year = new Date().getFullYear();
    S.month = 0;
    return;
  }
  if (!ys.includes(S.year)) S.year = ys[0];
  const cnt = Array(13).fill(0);
  for (const t of S.tx) if (Math.floor(t.d / 10000) === S.year) cnt[Math.floor(t.d / 100) % 100]++;
  let m = 0;
  for (let i = 12; i >= 1; i--)
    if (cnt[i] >= 10) {
      m = i;
      break;
    }
  S.month = m;
}

/* ---------- rekenen ---------- */
// Telt een transactie mee in de overzichten? Niet bij Declaraties en Niet meetellen.
const counted = t => !APART.cats.includes(catOf(t));
// Declaraties tot en met datum `upto` (jjjjmmdd, 0 = alles): voorgeschoten, terugontvangen en wat nog openstaat.
function declBalance(upto = 0) {
  let paid = 0,
    back = 0,
    n = 0;
  for (const t of S.tx)
    if ((!upto || t.d <= upto) && catOf(t) === DECL) {
      n++;
      if (t.a < 0) paid -= t.a;
      else back += t.a;
    }
  return { paid, back, open: paid - back, n };
}
function totals(year) {
  const T = {};
  let unkN = Array(13).fill(0),
    unkSum = Array(13).fill(0),
    min = 0,
    max = 0,
    cnt = Array(13).fill(0);
  for (const t of S.tx) {
    if (Math.floor(t.d / 10000) !== year) continue;
    const m = Math.floor(t.d / 100) % 100,
      c = catOf(t);
    cnt[m]++;
    if (!min || t.d < min) min = t.d;
    if (t.d > max) max = t.d;
    if (APART.cats.includes(c)) continue;
    if (c === UNK) {
      unkN[m]++;
      unkN[0]++;
      unkSum[m] += t.a;
      unkSum[0] += t.a;
      continue;
    }
    const a = T[c] || (T[c] = Array(13).fill(0));
    a[m] += t.a;
    a[0] += t.a;
  }
  const dt = n => Date.UTC(Math.floor(n / 10000), (Math.floor(n / 100) % 100) - 1, n % 100);
  const span = min ? Math.max(1, ((dt(max) - dt(min)) / 864e5 + 1) / 30.4375) : 1;
  return { T, unkN, unkSum, cnt, span };
}
function budgetOf(year, cat, m) {
  const b = (S.budgets[year] || {})[cat];
  if (!b) return 0;
  if (m === 0) {
    let s = 0;
    for (let i = 1; i <= 12; i++) s += budgetOf(year, cat, i);
    return s;
  }
  const o = b.m && b.m[m];
  return o != null ? o : b.base || 0;
}
const actual = (g, v) => (g.kind === "in" ? v : -v);

/* ---------- budgetten voor het hele jaar ---------- */
const parseAmount = v =>
  Math.max(
    0,
    parseFloat(
      String(v)
        .replace(/\s|€/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(",", "."),
    ) || 0,
  );
const fmtIn = v =>
  !v ? "" : Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(2).replace(".", ",");
function budgetYears() {
  const now = new Date().getFullYear(),
    ys = new Set([...years(), now, now + 1, ...Object.keys(S.budgets).map(Number)]);
  return [...ys].filter(Boolean).sort((a, b) => a - b);
}
// Referentie: het gemiddelde per maand in het gekozen jaar, of in het jaar ervoor als het gekozen jaar nog geen transacties heeft.
function budgetRef(year) {
  const has = y => S.tx.some(t => Math.floor(t.d / 10000) === y);
  const ry = has(year) ? year : has(year - 1) ? year - 1 : null;
  if (ry == null) return { year: null, avg: () => 0 };
  const { T, span } = totals(ry);
  return { year: ry, avg: (grp, c) => actual(grp, (T[c] || [])[0] || 0) / span };
}
const roundBudget = v => (v >= 50 ? Math.round(v / 5) * 5 : Math.round(v));
function setMonthBudget(year, cat, m, val) {
  const y = S.budgets[year] || (S.budgets[year] = {});
  const b = y[cat] || (y[cat] = { base: 0, m: {} });
  if (!b.m) b.m = {};
  if (Math.abs(val - (b.base || 0)) < 0.005) delete b.m[m];
  else b.m[m] = val;
  if (!b.base && !Object.keys(b.m).length) delete y[cat];
  saveBudgets();
}
