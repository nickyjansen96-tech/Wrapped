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
  [...document.querySelectorAll(".bgrid.cmp.diff tbody th.cat")].map(e => e.textContent),
);
ok(
  "per blok: kop, posten en totaal",
  JSON.stringify(labels) ===
    JSON.stringify([
      "Inkomsten",
      "Salaris of uitkering",
      "Inkomsten totaal",
      "Vaste lasten",
      "Wonen",
      "Energie en water",
      "Verzekeringen",
      "Abonnementen",
      "Vaste lasten totaal",
      "Variabele uitgaven",
      "Boodschappen",
      "Brandstof, parkeren en OV",
      "Variabele uitgaven totaal",
      "Sparen en beleggen",
      "Buffer",
      "Sparen en beleggen totaal",
    ]),
  labels.join(", "),
);
ok("alleen verschillen, geen budget- of werkelijk-regels", (await p.locator(".bgrid.cmp.diff th.kind").count()) === 0);
// Cellen van een regel in de bovenste tabel.
const rowCells = label =>
  p.evaluate(label => {
    for (const tr of document.querySelectorAll(".bgrid.cmp.diff tbody tr"))
      if (tr.querySelector("th.cat")?.textContent === label)
        return [...tr.querySelectorAll("td.c")].map(td => td.textContent);
    return null;
  }, label);
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
  return { d1: 1400 - a(1), dy: 1400 * 9 - a(0) };
});
const D = await rowCells("Vaste lasten totaal");
ok("vaste lasten totaal verschil jan", Math.abs(num(D[0]) - Math.round(exp.d1)) <= 1, D[0]);
ok(
  "verschil feb staat op zichzelf (niet opgeteld)",
  num(D[1]) === num(D[0]) && D.length === 13,
  D.slice(0, 3).join(" ") + " / " + D.length,
);
ok("totaal t/m sep = optelling", Math.abs(num(D[12]) - Math.round(exp.dy)) <= 1, D[12] + " vs " + exp.dy.toFixed(0));
const heads = await p.locator(".bgrid.cmp.diff thead th.yr").allInnerTexts();
ok("één totaalkolom", heads.join() === "t/m sep", heads.join());
ok("kop zonder bedragen", (await rowCells("Vaste lasten")).join("") === "");
// De verschillen per post tellen op tot het totaal van de hoofdcategorie.
const subD = [];
for (const c of ["Wonen", "Energie en water", "Verzekeringen", "Abonnementen"]) subD.push(await rowCells(c));
ok(
  "som verschil posten = totaal vaste lasten",
  [0, 12].every(j => Math.abs(subD.reduce((s, r) => s + num(r[j]), 0) - num(D[j])) <= 2),
  subD.map(r => r[0]).join(" ") + " vs " + D[0],
);
ok(
  "heel jaar met verwacht budget staat in de tabel eronder",
  (await p.locator(".ivu thead th.full").innerText()) === "Heel jaar",
);
await p.screenshot({ path: SP + "/cmp3.png" });
// Kwartaalfilter
await p.click(".qseg >> text=Q2");
const q2 = await p.locator(".bgrid.cmp.diff thead th").allInnerTexts();
ok("Q2: alleen apr–jun en totaal", q2.slice(1).join() === "Apr,Mei,Jun,Q2", q2.join());
const q2D = await rowCells("Vaste lasten totaal");
ok("Q2 totaal = som van 3 maanden", num(q2D[3]) === num(q2D[0]) * 3, q2D.join(" "));
await p.click(".qseg >> text=Q4");
const q4D = await rowCells("Vaste lasten totaal");
ok(
  "Q4 zonder transacties: leeg (·)",
  q4D.slice(0, 3).every(v => v === "·"),
  q4D.join(" "),
);
await p.screenshot({ path: SP + "/cmp-q4.png" });
await p.goBack();
ok("terug: weer Q2", (await p.locator(".qseg [aria-pressed=true]").innerText()) === "Q2");
await p.click(".qseg >> text=Jaar");
await p.evaluate(() => {
  for (const tr of document.querySelectorAll(".bgrid.cmp.diff tbody tr"))
    if (tr.querySelector("th.cat").textContent === "Vaste lasten totaal")
      return tr.querySelector("td.c button").click();
});
const n = await p.locator(".tx").count();
const sel = await p.locator("#fcat").inputValue();
ok("klik totaal → transacties alle vaste lasten jan", sel === "grp:Vaste lasten" && n === 4, sel + " / " + n);
ok('filter toont "Alle vaste lasten"', (await p.locator("#fcat option:checked").innerText()) === "Alle vaste lasten");
await p.click("#back");
await p.evaluate(() => {
  for (const tr of document.querySelectorAll(".bgrid.cmp.diff tbody tr"))
    if (tr.querySelector("th.cat").textContent === "Wonen") return tr.querySelector("td.c button").click();
});
ok("klik post → transacties van die post", (await p.locator("#fcat").inputValue()) === "Wonen");
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
