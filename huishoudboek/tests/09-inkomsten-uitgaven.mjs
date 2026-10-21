// Budget vs werkelijk: alle maanden zichtbaar, en onderaan inkomsten vs uitgaven per maand (nagerekend).
// Daarnaast de samenvatting onder de budgettabel (Budget bewerken).
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
const num = s =>
  Number(
    s
      .replace(/−/g, "-")
      .replace(/\./g, "")
      .replace(/[^\d+-]/g, ""),
  );
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
  saveBudgets();
  flushSaves();
  S.year = 2026;
  S.tab = "vergelijk";
  go();
});
const heads = await p.locator(".bgrid.cmp").first().locator("thead th").allInnerTexts();
ok(
  "alle maanden jan–dec zichtbaar",
  heads.slice(2, 14).join(",") === "Jan,Feb,Mrt,Apr,Mei,Jun,Jul,Aug,Sep,Okt,Nov,Dec",
  heads.join(","),
);
ok("geen knop meer om maanden te verbergen", (await p.locator("text=Toon ook").count()) === 0);
ok(
  "tabel inkomsten vs uitgaven aanwezig",
  (await p.locator(".ivu h2").innerText()) === "Inkomsten vs uitgaven per maand",
);
const row = async (cat, kind) =>
  p.evaluate(
    ([cat, kind]) => {
      let cur = "";
      for (const tr of document.querySelectorAll(".ivu tbody tr")) {
        const c = tr.querySelector("th.cat");
        if (c) cur = c.textContent;
        if (cur === cat && tr.querySelector("th.kind").textContent === kind)
          return [...tr.querySelectorAll("td.c")].map(td => td.textContent);
      }
      return null;
    },
    [cat, kind],
  );
const exp = await p.evaluate(() => {
  const net = k => S.tx.filter(t => Math.floor(t.d / 100) % 100 === k).reduce((s, t) => s + t.a, 0);
  const inc = k =>
    S.tx.filter(t => Math.floor(t.d / 100) % 100 === k && /WERKGEVER/.test(t.t)).reduce((s, t) => s + t.a, 0);
  const sp = k =>
    -S.tx.filter(t => Math.floor(t.d / 100) % 100 === k && /SPAARREKENING/.test(t.t)).reduce((s, t) => s + t.a, 0);
  return { inc1: inc(1), sp1: sp(1), uit1: inc(1) - net(1) - sp(1), net1: net(1) };
});
const iv = await row("Inkomsten", "Verwacht"),
  iw = await row("Inkomsten", "Werkelijk"),
  ub = await row("Uitgaven", "Begroot"),
  uw = await row("Uitgaven", "Werkelijk"),
  sb = await row("Sparen", "Begroot"),
  sw = await row("Sparen", "Werkelijk"),
  ov = await row("Over", "Verwacht"),
  ow = await row("Over", "Werkelijk");
ok("inkomsten verwacht per maand (ook okt–dec)", iv[0] === "3.150" && iv[11] === "3.150", iv[0] + " … " + iv[11]);
ok("inkomsten werkelijk jan", num(iw[0]) === Math.round(exp.inc1), iw[0]);
ok("uitgaven begroot = 1100+600", ub[0] === "1.700", ub[0]);
ok(
  "uitgaven werkelijk jan (zonder sparen)",
  Math.abs(num(uw[0]) - Math.round(exp.uit1)) <= 1,
  uw[0] + " vs " + exp.uit1,
);
ok(
  "sparen apart: begroot 300, werkelijk jan",
  sb[0] === "300" && num(sw[0]) === Math.round(exp.sp1),
  sb[0] + " / " + sw[0],
);
ok("over verwacht = 3150 − 2000", ov[0] === "1.150", ov[0]);
ok("heel jaar: verwacht over 12 × 1.150", ov[13] === "13.800" && ow[13] === "", ov[13] + "|" + ow[13]);
ok("over werkelijk jan", Math.abs(num(ow[0]) - Math.round(exp.net1)) <= 1, ow[0]);
ok("okt: werkelijk nog leeg (·)", iw[9] === "·" && uw[9] === "·" && sw[9] === "·" && ow[9] === "·");
ok(
  "jaarkolom t/m sep",
  (await p.locator(".ivu thead th.yr").first().innerText()) === "t/m sep" && ov[12] === "10.350",
  ov[12],
);
await p.screenshot({ path: SP + "/vergelijk-ivu.png", fullPage: true });
// samenvatting onder de budgettabel
await p.evaluate(() => {
  S.tab = "overzicht";
  S.editBudget = true;
  go();
});
const foot = await p.evaluate(() =>
  [...document.querySelectorAll(".bgrid tfoot tr")].map(tr =>
    [tr.querySelector("th").textContent, tr.querySelectorAll("td")[1].textContent].join(": ").replace(/\u00a0/g, " "),
  ),
);
ok(
  "budgettabel: inkomsten, uitgaven, sparen apart, over",
  foot.join(" | ") === "Inkomsten (verwacht): € 3.150 | Uitgaven: € 1.700 | Sparen: € 300 | Over: € 1.150",
  foot.join(" | "),
);
const I = await p.evaluate(() => ALLCATS.indexOf("Boodschappen"));
await p.fill("#g-" + I + "-3", "1000");
await p.press("#g-" + I + "-3", "Tab");
const mar = await p.evaluate(() =>
  ["inc", "uit", "sp", "ov"].map(id => document.getElementById(id + "-3").textContent),
);
ok(
  "samenvatting werkt live bij (mrt)",
  mar[1].includes("2.100") && mar[2].includes("300") && mar[3].includes("750"),
  mar.join(" | "),
);
await p.screenshot({ path: SP + "/budget-samenvatting.png" });
for (const [w, h] of [
  [375, 667],
  [1180, 820],
]) {
  await p.setViewportSize({ width: w, height: h });
  await p.evaluate(() => {
    S.tab = "vergelijk";
    go();
  });
  const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("pagina niet zijwaarts " + w, o <= 1, o);
}
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
