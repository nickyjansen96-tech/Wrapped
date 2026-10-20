"use strict";
// Transacties indelen: regels toepassen en tegenpartij uit de omschrijving halen.
/* ---------- categoriseren ---------- */
const strip = s => String(s).replace(/\s+/g, "").toLowerCase();
let compiled = [];
function compileOne(r) {
  const k = strip(r.k);
  return k.includes("*")
    ? {
        re: new RegExp(
          k
            .split("*")
            .map(p => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
            .join(".*"),
        ),
        c: r.c,
        r,
      }
    : { k, c: r.c, r };
}
const matches = (c, t) => {
  const s = t.s || (t.s = strip(t.t));
  return c.re ? c.re.test(s) : s.includes(c.k);
};
function compileRules() {
  compiled = S.rules.filter(r => r.k && r.k.trim() && CATSET.has(r.c)).map(compileOne);
  for (const t of S.tx) t.auto = undefined;
}
function autoCat(t) {
  if (t.auto !== undefined) return t.auto;
  const s = t.s || (t.s = strip(t.t));
  t.hit = null;
  for (const c of compiled) {
    if (c.re ? c.re.test(s) : s.includes(c.k)) {
      t.hit = c.r;
      return (t.auto = c.c);
    }
  }
  return (t.auto = UNK);
}
const catOf = t => {
  const o = S.overrides[t.i];
  return o && CATSET.has(o) ? o : autoCat(t);
};
// Naam en korte omschrijving van de tegenpartij; bij ING, Rabobank enz. staan die apart opgeslagen.
const partyOf = t => (t.n ? [t.n, t.o || ""] : who(t.t));
function who(d) {
  let m = /\/NAME\/([^/]*)/.exec(d) || /Naam: (.*?)(\s{2,}|Omschrijving|$)/.exec(d);
  if (m) {
    const o = /(?:Omschrijving: |\/REMI\/)(.*?)(?:\s{2,}|\/|Kenmerk:|$)/.exec(d);
    return [m[1].trim(), o ? o[1].trim() : ""];
  }
  if (/^(BEA|GEA|eCom)/.test(d)) {
    const rest = d.slice(33);
    const i = rest.indexOf(",PAS");
    return [(i > 0 ? rest.slice(0, i) : rest.slice(0, 30)).trim(), ""];
  }
  return [d.replace(/\s+/g, " ").slice(0, 40), ""];
}
