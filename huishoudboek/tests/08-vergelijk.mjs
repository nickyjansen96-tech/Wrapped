import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
const SP = process.argv[2] || ".";
const b = await chromium.launch(LAUNCH);
const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
const errs = [];
p.on("pageerror", e => errs.push(e.message));
let fails = 0;
const ok = (n, c, i = "") => {
  console.log((c ? "PASS " : "FAIL ") + n + (i !== "" ? "  [" + i + "]" : ""));
  if (!c) fails++;
};
await p.goto(URL_APP);
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("hhb-rondleiding-gezien", "1");
});
await p.reload();
await p.setInputFiles("#file", FX + "/mut4.txt");
await p.waitForSelector(".note.info");
await p.evaluate(() => {
  S.rules = [
    { k: "Albert Heijn", c: "Boodschappen" },
    { k: "Jumbo", c: "Boodschappen" },
    { k: "WONINGCORP", c: "Wonen" },
    { k: "VATTENFALL", c: "Energie en water" },
    { k: "ZILVEREN", c: "Verzekeringen" },
    { k: "NETFLIX", c: "Abonnementen" },
    { k: "WERKGEVER", c: "Salaris of uitkering" },
    { k: "SPAARREKENING", c: "Buffer" },
    { k: "Shell", c: "Brandstof, parkeren en OV" },
  ];
  compileRules();
  saveRules();
  const set = (c, v) => {
    (S.budgets[2026] || (S.budgets[2026] = {}))[c] = { base: v, m: {} };
  };
  set("Salaris of uitkering", 3150);
  set("Wonen", 1100);
  set("Energie en water", 150);
  set("Verzekeringen", 150);
  set("Boodschappen", 600);
  set("Buffer", 300);
  set("Brandstof, parkeren en OV", 150);
  saveBudgets();
  flushSaves();
});
await p.click("#tabs [data-tab=overzicht]");
await p.click("#rail .yearseg >> text=2026");
await p.click("#compare-btn");
const labels = await p.evaluate(() =>
  [...document.querySelectorAll(".bgrid.cmp tbody th.cat")].map(e => e.textContent),
);
ok(
  "alleen hoofdcategorieën, daaronder inkomsten vs uitgaven",
  JSON.stringify(labels) ===
    JSON.stringify([
      "Inkomsten",
      "Vaste lasten",
      "Variabele uitgaven",
      "Sparen en beleggen",
      "Inkomsten",
      "Uitgaven en sparen",
      "Over",
    ]),
  labels.join(", "),
);
ok("geen losse posten zoals Wonen", !labels.includes("Wonen"));
const rowCells = async (cat, kind) =>
  p.evaluate(
    ([cat, kind]) => {
      let cur = "";
      for (const tr of document.querySelectorAll(".bgrid.cmp tbody tr")) {
        const c = tr.querySelector("th.cat");
        if (c) cur = c.textContent;
        const k = tr.querySelector("th.kind");
        if (cur === cat && k && k.textContent === kind)
          return [...tr.querySelectorAll("td.c")].map(td => td.textContent);
      }
      return null;
    },
    [cat, kind],
  );
const num = s =>
  Number(
    s
      .replace(/−/g, "-")
      .replace(/\./g, "")
      .replace(/[^\d+-]/g, ""),
  );
const exp = await p.evaluate(() => {
  const { T } = totals(2026);
  const g = ["Wonen", "Energie en water", "Verzekeringen", "Abonnementen"];
  const a = k => -g.reduce((s, c) => s + ((T[c] || [])[k] || 0), 0);
  return { b: 1400, a1: a(1), d1: 1400 - a(1), ay: a(0), dy: 1400 * 9 - a(0) };
});
const B = await rowCells("Vaste lasten", "Budget"),
  A = await rowCells("Vaste lasten", "Werkelijk"),
  D = await rowCells("Vaste lasten", "Verschil"),
  R = await rowCells("Vaste lasten", "Resultaat");
ok("vaste lasten budget = som posten", B[0] === "1.400", B[0]);
ok("vaste lasten werkelijk jan", Math.abs(num(A[0]) - Math.round(exp.a1)) <= 1, A[0] + " vs " + exp.a1);
ok("vaste lasten verschil jan", Math.abs(num(D[0]) - Math.round(exp.d1)) <= 1, D[0]);
ok(
  "vaste lasten jaar resultaat",
  Math.abs(num(R[R.length - 1]) - Math.round(exp.dy)) <= 1,
  R[R.length - 1] + " vs " + exp.dy.toFixed(0),
);
await p.screenshot({ path: SP + "/cmp3.png" });
await p.evaluate(() => {
  let cur = "";
  for (const tr of document.querySelectorAll(".bgrid.cmp tbody tr")) {
    const c = tr.querySelector("th.cat");
    if (c) cur = c.textContent;
    const k = tr.querySelector("th.kind");
    if (cur === "Vaste lasten" && k.textContent === "Werkelijk") {
      tr.querySelector("td.c button").click();
      return;
    }
  }
});
const n = await p.locator(".tx").count();
const sel = await p.locator("#fcat").inputValue();
ok("klik → transacties alle vaste lasten jan", sel === "grp:Vaste lasten" && n === 4, sel + " / " + n);
ok('filter toont "Alle vaste lasten"', (await p.locator("#fcat option:checked").innerText()) === "Alle vaste lasten");
await p.setViewportSize({ width: 375, height: 667 });
await p.click("#back");
await p.waitForTimeout(100);
const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("telefoon niet zijwaarts", ov <= 1, ov);
await p.screenshot({ path: SP + "/cmp3-phone.png" });
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
