import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
const SP = process.argv[2] || ".";
const sizes = [
  [320, 568, "klein"],
  [375, 667, "iphone-se"],
  [414, 896, "iphone"],
  [667, 375, "tel-liggend"],
  [768, 1024, "ipad-mini"],
  [820, 1180, "ipad"],
  [1024, 768, "ipad-liggend-oud"],
  [1180, 820, "ipad-liggend"],
  [1440, 900, "desktop"],
];
const screens = [
  "overzicht",
  "budget",
  "vergelijk",
  "vermogen",
  "transacties",
  "regels",
  "importeren",
  "gebruikers",
  "rondleiding",
];
const b = await chromium.launch(LAUNCH);
const ctx = await b.newContext({ hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push(e.message));
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
    { k: "WERKGEVER", c: "Salaris of uitkering" },
    { k: "SPAARREKENING", c: "Buffer" },
    { k: "Gemeentelijke", c: "Gemeentelijke en waterschapsbelastingen" },
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
  set("Gemeentelijke en waterschapsbelastingen", 80);
  saveBudgets();
  addUser("Jan-Willem van den Bergh");
  flushSaves();
});
const problems = {};
const add = (k, v) => {
  (problems[k] || (problems[k] = [])).push(v);
};
for (const [w, h, name] of sizes) {
  await p.setViewportSize({ width: w, height: h });
  for (const sc of screens) {
    await p.evaluate(sc => {
      if (tourIdx >= 0) endTour();
      S.editBudget = sc === "budget";
      S.tab = sc === "budget" || sc === "rondleiding" ? "overzicht" : sc;
      S.month = 0;
      S.year = 2026;
      render();
      window.scrollTo(0, 0);
    }, sc);
    if (sc === "rondleiding") {
      await p.evaluate(() => {
        startTour();
        tourStep(3);
      });
      await p.waitForTimeout(350);
    }
    await p.waitForTimeout(80);
    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth,
        out = [];
      const hscroll = document.documentElement.scrollWidth - vw;
      const scrollers = [".users", ".bgridwrap", ".rail", "nav.tabs", ".profiles", ".tablewrap", ".yearseg"];
      const inScroller = e => scrollers.some(s => e.closest(s));
      for (const e of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || e.closest("[hidden]")) continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (!inScroller(e) && (r.right > vw + 1 || r.left < -1) && !e.closest(".tour-spot"))
          out.push(
            "buiten beeld: " +
              (e.id ? "#" + e.id : e.className || e.tagName) +
              " " +
              Math.round(r.left) +
              ".." +
              Math.round(r.right),
          );
        // tekst die over de rand van zijn eigen vak loopt
        if (
          e.children.length === 0 &&
          e.textContent.trim() &&
          e.scrollWidth > e.clientWidth + 2 &&
          cs.overflow !== "hidden" &&
          !["INPUT", "SELECT", "TEXTAREA", "OPTION"].includes(e.tagName) &&
          !/-webkit-box/.test(cs.display) &&
          !inScroller(e)
        )
          out.push('tekst loopt uit vak: "' + e.textContent.trim().slice(0, 30) + '"');
      }
      // knoppen kleiner dan 24px (ruim onder de vingermaat)
      const small = [...document.querySelectorAll("button,select,input:not([type=checkbox]):not([type=file]),a")]
        .filter(e => {
          const r = e.getBoundingClientRect();
          return (
            r.width &&
            r.height &&
            getComputedStyle(e).visibility !== "hidden" &&
            !e.closest("[hidden]") &&
            (r.height < 32 || r.width < 24)
          );
        })
        .map(
          e =>
            (e.getAttribute("aria-label") || e.textContent || e.className).trim().slice(0, 20) +
            " " +
            Math.round(e.getBoundingClientRect().width) +
            "x" +
            Math.round(e.getBoundingClientRect().height),
        );
      const plus = document.querySelector("#profiles .seg.add").getBoundingClientRect();
      const plusOk = plus.right <= vw && plus.left >= 0;
      const coarse = matchMedia("(pointer:coarse)").matches;
      return { plusOk, coarse, hscroll, out: [...new Set(out)].slice(0, 6), small: [...new Set(small)].slice(0, 6) };
    });
    const key = name + " (" + w + "x" + h + ") " + sc;
    if (!r.plusOk) add(key, "+ knop niet in beeld");
    if (!r.coarse) add(key, "geen aanraakscherm-emulatie");
    if (r.hscroll > 1) add(key, "pagina scrolt zijwaarts: " + r.hscroll + "px");
    for (const o of r.out) add(key, o);
    for (const s of r.small) add(key, "klein tikdoel: " + s);
    if (["klein", "tel-liggend", "ipad", "desktop"].includes(name))
      await p.screenshot({ path: `${SP}/rs-${name}-${sc}.png` });
  }
}
for (const [k, v] of Object.entries(problems)) console.log(k + "\n   - " + v.join("\n   - "));
const bad = Object.keys(problems).length || errs.length;
console.log(
  bad ? "FAILED: " + Object.keys(problems).length + " schermen met problemen, JS-fouten: " + errs.length : "ALL PASSED",
);
process.exitCode = bad ? 1 : 0;
await b.close();
