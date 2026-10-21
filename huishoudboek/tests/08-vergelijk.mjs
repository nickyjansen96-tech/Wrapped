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
  "hoofdcategorieën met posten, daaronder inkomsten vs uitgaven",
  JSON.stringify(labels) ===
    JSON.stringify([
      "Inkomsten",
      "Salaris of uitkering",
      "Vaste lasten",
      "Wonen",
      "Energie en water",
      "Verzekeringen",
      "Abonnementen",
      "Variabele uitgaven",
      "Boodschappen",
      "Brandstof, parkeren en OV",
      "Sparen en beleggen",
      "Buffer",
      "Inkomsten",
      "Uitgaven",
      "Sparen",
      "Over",
    ]),
  labels.join(", "),
);
const subKinds = await p.evaluate(() =>
  [...document.querySelectorAll(".bgrid.cmp tr.sub")].map(tr => tr.querySelector("th.kind").textContent),
);
ok("posten tonen alleen het verschil", subKinds.length > 0 && subKinds.every(k => k === "Verschil"), subKinds.join());
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
  D = await rowCells("Vaste lasten", "Verschil");
ok("vaste lasten budget = som posten", B[0] === "1.400", B[0]);
ok("vaste lasten werkelijk jan", Math.abs(num(A[0]) - Math.round(exp.a1)) <= 1, A[0] + " vs " + exp.a1);
ok("vaste lasten verschil jan", Math.abs(num(D[0]) - Math.round(exp.d1)) <= 1, D[0]);
ok("geen opgeteld resultaat meer", (await rowCells("Vaste lasten", "Resultaat")) === null);
ok(
  "verschil feb staat op zichzelf (niet opgeteld)",
  num(D[1]) === num(D[0]) && D.length === 14,
  D.slice(0, 3).join(" ") + " / " + D.length,
);
ok(
  "totaal t/m sep = optelling",
  Math.abs(num(D[12]) - Math.round(exp.dy)) <= 1 && B[12] === "12.600",
  D[12] + " vs " + exp.dy.toFixed(0) + ", budget " + B[12],
);
ok("heel jaar: verwacht budget", B[13] === "16.800" && A[13] === "" && D[13] === "", B[13] + "|" + A[13] + "|" + D[13]);
const heads = await p.locator(".bgrid.cmp").first().locator("thead th.yr").allInnerTexts();
ok("totaalkolommen", heads.join() === "t/m sep,Heel jaar", heads.join());
// De verschillen per post tellen op tot het verschil van de hoofdcategorie.
const subD = [];
for (const c of ["Wonen", "Energie en water", "Verzekeringen", "Abonnementen"])
  subD.push(await rowCells(c, "Verschil"));
ok(
  "posten: één regel met alle maanden en jaar",
  subD.every(r => r && r.length === 14),
  subD.map(r => r?.length).join(),
);
ok(
  "som verschil posten = verschil vaste lasten",
  [0, 12].every(j => Math.abs(subD.reduce((s, r) => s + num(r[j]), 0) - num(D[j])) <= 2),
  subD.map(r => r[0]).join(" ") + " vs " + D[0],
);
await p.screenshot({ path: SP + "/cmp3.png" });
// Kwartaalfilter
await p.click(".qseg >> text=Q2");
const q2 = await p.locator(".bgrid.cmp").first().locator("thead th").allInnerTexts();
ok("Q2: alleen apr–jun en totaal", q2.slice(2).join() === "Apr,Mei,Jun,Q2", q2.join());
const q2B = await rowCells("Vaste lasten", "Budget"),
  q2D = await rowCells("Vaste lasten", "Verschil");
ok(
  "Q2 totaal = som van 3 maanden",
  q2B[3] === "4.200" && num(q2D[3]) === num(q2D[0]) * 3,
  q2B[3] + " " + q2D.join(" "),
);
await p.click(".qseg >> text=Q4");
const q4 = await p.locator(".bgrid.cmp").first().locator("thead th").allInnerTexts();
const q4B = await rowCells("Vaste lasten", "Budget"),
  q4A = await rowCells("Vaste lasten", "Werkelijk");
ok(
  "Q4 zonder transacties: verwacht budget, werkelijk leeg",
  q4.slice(2).join() === "Okt,Nov,Dec,Q4" && q4B[3] === "4.200" && q4A[3] === "·",
  q4.join() + " " + q4B[3] + " " + q4A[3],
);
await p.screenshot({ path: SP + "/cmp-q4.png" });
await p.goBack();
ok("terug: weer Q2", (await p.locator(".qseg [aria-pressed=true]").innerText()) === "Q2");
await p.click(".qseg >> text=Jaar");
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
