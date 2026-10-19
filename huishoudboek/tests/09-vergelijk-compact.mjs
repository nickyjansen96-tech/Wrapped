import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
const SP = process.argv[2] || ".";
const b = await chromium.launch(LAUNCH);
const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
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
  const set = (c, v) => {
    (S.budgets[2026] || (S.budgets[2026] = {}))[c] = { base: v, m: {} };
  };
  set("Salaris of uitkering", 3150);
  set("Wonen", 1100);
  set("Boodschappen", 600);
  set("Buffer", 300);
  saveBudgets();
  flushSaves();
  S.year = 2026;
  S.tab = "vergelijk";
  go();
});
ok(
  "alleen jan–sep zichtbaar",
  (await p.locator(".bgrid.cmp thead th").allInnerTexts()).join(",") ===
    ",,Jan,Feb,Mrt,Apr,Mei,Jun,Jul,Aug,Sep,t/m sep",
  (await p.locator(".bgrid.cmp thead th").allInnerTexts()).join(","),
);
const fits = await p.evaluate(() => {
  const w = document.querySelector(".bgridwrap");
  return w.scrollWidth - w.clientWidth;
});
ok("iPad staand: tabel past zonder zijwaarts schuiven", fits <= 1, fits);
const tbl = await p.evaluate(() => Math.round(document.querySelector(".bgrid.cmp").getBoundingClientRect().height));
ok("tabel compact (hoogte)", tbl < 800, tbl + "px");
await p.screenshot({ path: SP + "/cmp4-ipad.png" });
await p.click("text=Toon ook okt–dec");
ok("toon okt–dec", (await p.locator(".bgrid.cmp thead th").count()) === 15);
await p.click("text=Verberg okt–dec");
ok("verberg weer", (await p.locator(".bgrid.cmp thead th").count()) === 12);
await p.setViewportSize({ width: 1180, height: 820 });
await p.screenshot({ path: SP + "/cmp4-land.png" });
await p.setViewportSize({ width: 375, height: 667 });
await p.screenshot({ path: SP + "/cmp4-phone.png" });
const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("telefoon: pagina niet zijwaarts", ov <= 1, ov);
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
