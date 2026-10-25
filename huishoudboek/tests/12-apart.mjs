// Declaraties en "Niet meetellen": markeren vanuit de details, buiten de overzichten, openstaand bedrag, filter,
// regels, AI-categorie, maandsamenvatting en bewaren.
import { chromium, LAUNCH, URL_APP, FX, goTab } from "./lib.mjs";
const SP = process.argv[2] || ".";
const b = await chromium.launch(LAUNCH);
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
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
      .replace(",", ".")
      .replace(/[^\d.+-]/g, ""),
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
  ];
  compileRules();
  saveRules();
  S.budgets[2026] = { Boodschappen: { base: 600, m: {} } };
  saveBudgets();
  S.year = 2026;
  S.month = 9;
  S.tab = "overzicht";
  go();
});
const over = async () => num(await p.locator(".card.hero .big").innerText());
const boodschappen = () => p.evaluate(() => -(totals(2026).T["Boodschappen"] || [])[9]);
const over0 = await over(),
  bs0 = await boodschappen();
ok("nog geen kaart zonder declaraties", (await p.locator("#apart-card").count()) === 0);

// Albert Heijn € 66,84 op 11 sep als declaratie markeren via de details
await goTab(p, "transacties");
const ah = p.locator(".tx").filter({ hasText: "66,84" });
await ah.locator(".txmain").click();
ok(
  "knoppen in de details",
  (await p.locator("#apart-decl").count()) === 1 && (await p.locator("#apart-skip").count()) === 1,
);
await p.click("#apart-decl");
ok("categorie is Declaraties", (await ah.locator("select.cat").inputValue()) === "Declaraties");
ok("rij gedimd", (await ah.getAttribute("class")).includes("apart"));
ok("terugknop", (await p.locator("#apart-undo").innerText()) === "Geen declaratie");

await goTab(p, "overzicht");
ok("Over stijgt: uitgave telt niet mee", Math.abs((await over()) - over0 - 67) <= 1, over0 + " → " + (await over()));
ok("Boodschappen zonder de declaratie", Math.abs(bs0 - (await boodschappen()) - 66.84) < 0.01);
const card = await p.locator("#apart-card").innerText();
ok("kaart: nog terug te krijgen", /66,84/.test(card) && /nog terug te krijgen/.test(card), card.replace(/\n/g, " | "));

// Terugbetaling (hier: een bijschrijving) ook als declaratie: openstaand wordt kleiner
const open = await p.evaluate(() => {
  S.tx.push({
    i: "terug1",
    d: 20260925,
    a: 66.84,
    t: "SEPA Overboeking  Naam: WERKGEVER BV  Omschrijving: Declaratie",
  });
  S.overrides["terug1"] = DECL;
  render();
  return declBalance().open;
});
ok("na terugbetaling niets meer open", Math.abs(open) < 0.005, open);
ok("kaart: alles terugontvangen", /alles terugontvangen/.test(await p.locator("#apart-card").innerText()));
ok("terugbetaling telt niet als inkomen", Math.abs((await over()) - over0 - 67) <= 1, await over());
await p.evaluate(() => {
  S.tx = S.tx.filter(t => t.i !== "terug1");
  delete S.overrides["terug1"];
  saveOverrides();
  render();
});

// Niet meetellen: Netflix
await goTab(p, "transacties");
const nf = p.locator(".tx").filter({ hasText: "NETFLIX" });
await nf.locator(".txmain").click();
await p.click("#apart-skip");
ok("Netflix telt niet mee", (await nf.locator("select.cat").inputValue()) === "Niet meetellen");
await goTab(p, "overzicht");
ok("Over zonder Netflix", Math.abs((await over()) - over0 - 67 - 14) <= 1, await over());
ok("regel: 1 telt niet mee", /1 transactie telt niet mee/.test(await p.locator("#apart-card").innerText()));
await p.click("#decl-btn");
ok(
  "Bekijk → filter declaraties",
  (await p.locator("#fcat").inputValue()) === "Declaraties" && (await p.locator(".tx").count()) === 1,
);
await p.selectOption("#fcat", "Niet meetellen");
const nfMain = p.locator(".tx").filter({ hasText: "NETFLIX" }).locator(".txmain");
if ((await nfMain.getAttribute("aria-expanded")) !== "true") await nfMain.click();
await p.click("#apart-undo");
await goTab(p, "overzicht");
await p.evaluate(() => {
  S.month = 9; // "Bekijk" toonde het hele jaar
  render();
});
ok(
  "weer meetellen",
  Math.abs((await over()) - over0 - 67) <= 1 && !/telt niet mee/.test(await p.locator("#apart-card").innerText()),
);

// Vergelijkpagina en vermogen gebruiken dezelfde cijfers
const cmpOver = await p.evaluate(() => {
  S.tab = "vergelijk";
  go();
  let v = null;
  for (const tr of document.querySelectorAll(".ivu tbody tr"))
    if (tr.querySelector("th.kind")?.textContent === "Werkelijk" && tr.classList.contains("over"))
      v = tr.querySelectorAll("td.c")[8].textContent;
  return v;
});
ok(
  "vergelijk: Over sep zonder declaratie",
  Math.abs(
    num(cmpOver) -
      (await p.evaluate(() => {
        let s = 0;
        for (const t of S.tx) if (Math.floor(t.d / 100) === 202609 && counted(t)) s += t.a;
        return Math.round(s);
      })),
  ) <= 1,
  cmpOver,
);
ok("budgettabel kent geen rij Declaraties", await p.evaluate(() => !ALLCATS.includes(DECL)));

// Regel en AI-antwoord met de nieuwe categorieën
const rule = await p.evaluate(() => {
  S.rules.push({ k: "Bol.com", c: "Declaraties" });
  compileRules();
  return S.tx.filter(t => catOf(t) === DECL).length;
});
ok("regel op Declaraties werkt", rule > 1, rule);
ok(
  "AI-antwoord met Niet meetellen herkend",
  await p.evaluate(() => matchCat("niet meetellen") === SKIP && matchCat("declaratie") === DECL),
);
ok("AI-vraag noemt de aparte categorieën", await p.evaluate(() => /Apart \(telt niet mee/.test(aiPrompt() || "")));

// Maandsamenvatting
const sum = await p.evaluate(() => summaryPrompt(202609));
ok(
  "samenvatting noemt declaraties apart",
  /Declaraties \(tellen niet mee hierboven\)/.test(sum),
  (sum.match(/Declaraties.*/) || [""])[0],
);
ok(
  "samenvatting: declaratie niet bij grootste uitgaven",
  !/66,84|€ 67 \(Declaraties\)/.test(sum.split("Grootste uitgaven:")[1] || ""),
);

// Bewaard na herladen
await p.evaluate(() => {
  S.rules.pop();
  compileRules();
  saveRules();
  flushSaves();
});
await p.reload();
ok("na herladen nog declaratie", await p.evaluate(() => S.tx.filter(t => catOf(t) === DECL).length === 1));
await p.evaluate(() => {
  S.year = 2026;
  S.month = 9;
  S.tab = "overzicht";
  go();
});
await p.screenshot({ path: SP + "/apart.png" });
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
