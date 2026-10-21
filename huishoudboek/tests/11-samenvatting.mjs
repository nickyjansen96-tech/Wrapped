// Maandsamenvatting door AI: knop vindbaar, maand kiezen, export met cijfers die kloppen en zonder rekeningnummers.
import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
const SP = process.argv[2] || ".";
const b = await chromium.launch(LAUNCH);
const ctx = await b.newContext({
  viewport: { width: 820, height: 1180 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const p = await ctx.newPage();
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
    { k: "WONINGCORP", c: "Wonen" },
    { k: "WERKGEVER", c: "Salaris of uitkering" },
    { k: "SPAARREKENING", c: "Buffer" },
  ];
  compileRules();
  saveRules();
  const set = (c, v) => ((S.budgets[2026] || (S.budgets[2026] = {}))[c] = { base: v, m: {} });
  set("Salaris of uitkering", 3150);
  set("Wonen", 1100);
  set("Boodschappen", 600);
  set("Buffer", 300);
  S.budgets[2026]["Boodschappen"].m[10] = 750;
  saveBudgets();
  flushSaves();
  S.year = 2026;
  S.tab = "overzicht";
  go();
});
ok("knop op overzicht", (await p.locator("#summary-btn").count()) === 1);
await p.click("#summary-btn");
ok("pagina geopend", (await p.locator("#sum-card h2").innerText()) === "Maandsamenvatting door AI");
ok("tab Overzicht blijft actief", (await p.locator("#tabs [aria-selected=true]").innerText()).startsWith("Overzicht"));
const months = await p.locator(".monthseg .seg").allInnerTexts();
const sel = await p.locator(".monthseg [aria-pressed=true]").innerText();
ok("maanden met transacties als knoppen", months.length >= 2, months.join());
ok("standaard de laatste maand", sel === months[months.length - 1], sel);
await p.click(".monthseg .seg >> text=Sep");
await p.click("text=Wat wordt gedeeld?");
const txt = await p.locator("#sum-text").inputValue();
const exp = await p.evaluate(() => {
  const m = S.tx.filter(t => Math.floor(t.d / 100) === 202609);
  const net = m.reduce((s, t) => s + t.a, 0);
  return { net: eur0.format(net).replace(/ /g, " "), n: m.length };
});
ok("vraag met kopjes terugblik en vooruitblik", /Hoe ging september\?/.test(txt) && /Vooruitblik op oktober/.test(txt));
ok("maandtotaal over klopt", txt.includes("Over (saldo van de maand): " + exp.net), exp.net);
ok("aantal transacties", txt.includes("Aantal transacties: " + exp.n), exp.n);
ok("per post met budget", /- Wonen: .*\| € 1\.100 \|/.test(txt), (txt.match(/- Wonen:.*/) || [""])[0]);
ok("vergelijking met vorige maanden", /gemiddeld in de 3 maanden ervoor/.test(txt));
ok("jaar tot nu toe", /== 2026 TOT EN MET SEPTEMBER/.test(txt));
ok("vooruitblik met aangepast budget oktober", /- Boodschappen: € 750 \(deze maand € 600\)/.test(txt));
ok("grootste uitgaven", /Grootste uitgaven:/.test(txt));
ok("geen rekeningnummers", !/\b[A-Z]{2}\d{2}[A-Z]{4}\d{6,}/.test(txt) && !/IBAN/.test(txt));
await p.click("#sum-copy");
await p.waitForSelector("#sum-card .note.info");
const clip = await p.evaluate(() => navigator.clipboard.readText());
ok("gekopieerd naar klembord", clip === txt, clip.length + " vs " + txt.length);
const dl = p.waitForEvent("download");
await p.click("text=Als bestand");
ok("als bestand", (await dl).suggestedFilename() === "huishoudboek-2026-09.txt");
ok("links naar Claude en ChatGPT", (await p.locator("#sum-card a[href*='claude.ai']").count()) === 1);
await p.screenshot({ path: SP + "/samenvatting.png", fullPage: true });
await p.click("#back");
ok("terug naar overzicht", (await p.locator("#summary-btn").count()) === 1);
// ook vanaf budget vs werkelijk
await p.click("#compare-btn");
ok("knop op vergelijkpagina", (await p.locator("#summary-btn").count()) === 1);
// telefoon: niets zijwaarts
await p.click("#summary-btn");
await p.setViewportSize({ width: 375, height: 667 });
const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("telefoon niet zijwaarts", ov <= 1, ov);
await p.screenshot({ path: SP + "/samenvatting-phone.png" });
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
