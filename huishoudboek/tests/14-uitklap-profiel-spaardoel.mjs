// Uitklapbare onderdelen op het overzicht, profielnaam wijzigen en spaardoelen.
import { chromium, LAUNCH, URL_APP, FX, goTab } from "./lib.mjs";
const SP = process.argv[2] || ".";
const b = await chromium.launch(LAUNCH);
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
p.on("pageerror", e => errs.push(e.message));
p.on("dialog", d => d.accept());
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
    { k: "SPAARREKENING", c: "Spaardoelen" },
  ];
  compileRules();
  saveRules();
  S.budgets[2026] = { Boodschappen: { base: 600, m: {} }, Spaardoelen: { base: 100, m: {} } };
  saveBudgets();
  S.year = 2026;
  S.month = 9;
  S.tab = "overzicht";
  go();
});

// 1. Uitklappen
const exp = id => p.locator("#" + id).getAttribute("aria-expanded");
ok(
  "drie knoppen, dicht",
  (await exp("budget-btn")) === "false" &&
    (await exp("compare-btn")) === "false" &&
    (await exp("summary-btn")) === "false",
);
ok("dicht: geen tabellen", (await p.locator(".bgrid").count()) === 0);
await p.click("#budget-btn");
ok(
  "budget open onder de knop",
  (await exp("budget-btn")) === "true" && (await p.locator(".fold.open .bgrid").count()) === 1,
);
ok(
  "overzicht blijft zichtbaar",
  (await p.locator(".card.hero").count()) === 1 && (await p.locator(".cline").count()) > 0,
);
await p.click("#compare-btn");
ok("vergelijking ook open", (await p.locator(".fold.open .bgrid.cmp.diff").count()) === 1);
ok("tab Overzicht actief", (await p.locator("#tabs [aria-selected=true]").getAttribute("data-tab")) === "overzicht");
await p.click("#back");
ok("Terug klapt vergelijking weer in", (await exp("compare-btn")) === "false" && (await exp("budget-btn")) === "true");
await p.click(".fold.open >> text=Klaar");
ok("Klaar klapt budget in", (await exp("budget-btn")) === "false");
await p.click("#summary-btn");
ok("maandsamenvatting uitgeklapt", (await p.locator(".fold.open #sum-card").count()) === 1);
await p.click("#summary-btn");

// 2. Profielnaam wijzigen
await p.click("#profiles .seg.add");
ok("profielpagina", (await p.locator("text=Profiel toevoegen").count()) === 1);
const id = await p.evaluate(() => profile);
await p.click('[aria-label="Naam van Nicky wijzigen"]');
await p.fill("#rename-" + id, "Nick");
await p.click(".uedit >> text=Opslaan");
ok("naam gewijzigd in de kop", (await p.locator("#profiles .seg:not(.add)[aria-pressed=true]").innerText()) === "Nick");
ok("melding", /Nicky heet nu Nick/.test(await p.locator(".note").innerText()));
await p.click('[aria-label="Naam van Nick wijzigen"]');
await p.fill("#rename-" + id, "Heleen");
await p.press("#rename-" + id, "Enter");
ok("dubbele naam geweigerd", /al een gebruiker met de naam Heleen/.test(await p.locator(".note").innerText()));
await p.reload();
ok("naam bewaard", (await p.locator("#profiles .seg:not(.add)[aria-pressed=true]").innerText()) === "Nick");
await goTab(p, "overzicht");
await p.click("#profiles .seg:not(.add)[aria-pressed=true]");
ok("tik op eigen profiel opent beheer", (await p.locator("text=Profiel toevoegen").count()) === 1);

// 3. Spaardoelen
await goTab(p, "vermogen");
ok("tab heet Sparen en vermogen", (await p.locator("#tabs [data-tab=vermogen]").innerText()) === "Sparen en vermogen");
await p.click("#goal-add");
await p.fill("#goal-name", "Vakantie");
await p.click("#goal-save");
ok("zonder doelbedrag geweigerd", /naam en een doelbedrag/.test(await p.locator("#goal-form .note").innerText()));
const now = new Date(),
  in10 = new Date(now.getFullYear(), now.getMonth() + 9, 1),
  ym = in10.getFullYear() + "-" + String(in10.getMonth() + 1).padStart(2, "0");
await p.fill("#goal-target", "2.000");
await p.fill("#goal-start", "500");
await p.fill("#goal-date", ym);
await p.fill("#goal-key", "SPAARREKENING");
ok(
  "telling trefwoord",
  /nu al 9 in je transacties/.test(await p.locator("#goal-hits").innerText()),
  await p.locator("#goal-hits").innerText(),
);
await p.click("#goal-save");
const sp = s => s.replace(/[\u00a0\u202f]/g, " ");
const g = sp(await p.locator('[data-goal="Vakantie"]').innerText());
ok("voortgang", g.includes("€ 500 van € 2.000 · 25%"), g.replace(/\n/g, " | "));
ok("per maand nodig over 10 maanden", g.includes("€ 150 per maand (10 maanden)"), g.replace(/\n/g, " | "));
ok("oude overboekingen tellen niet mee", g.includes("Gekoppeld aan “SPAARREKENING”: +€ 0"), g.replace(/\n/g, " | "));
ok(
  "totaal nodig vs budget",
  /Nodig per maand voor je doelen: € 150 · budget Spaardoelen deze maand € 100 \(te weinig\)/.test(
    sp(await p.locator(".gsum").innerText()),
  ),
  await p.locator(".gsum").innerText(),
);
// een nieuwe overboeking na het aanmaken telt wel mee
const linked = await p.evaluate(() => {
  const d = new Date(),
    n = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  S.tx.push({ i: "sp1", d: n, a: -250, t: "SEPA Overboeking  Naam: SPAARREKENING  Omschrijving: Vakantie" });
  render();
  return goalState(S.goals[0]).saved;
});
ok("nieuwe overboeking telt mee", linked === 750, linked);
await p.evaluate(() => {
  S.tx = S.tx.filter(t => t.i !== "sp1");
  render();
});
// aanpassen
await p.click('[aria-label="Spaardoel Vakantie aanpassen"]');
await p.fill("#goal-start", "2000");
await p.click("#goal-save");
ok("doel gehaald", (await p.locator('[data-goal="Vakantie"]').innerText()).includes("Doel gehaald!"));
await p.screenshot({ path: SP + "/spaardoelen.png", fullPage: true });
// bewaard en in de back-up
await p.evaluate(() => flushSaves());
await p.reload();
ok("spaardoel bewaard", await p.evaluate(() => S.goals.length === 1 && S.goals[0].name === "Vakantie"));
ok("in de back-up", await p.evaluate(() => backupData().goals[0].target === 2000));
await goTab(p, "vermogen");
await p.click('[aria-label="Spaardoel Vakantie verwijderen"]');
ok("verwijderd", (await p.locator('[data-goal="Vakantie"]').count()) === 0);
// telefoon
await p.setViewportSize({ width: 375, height: 667 });
await p.click("#goal-add");
const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("telefoon niet zijwaarts", ov <= 1, ov);
await p.screenshot({ path: SP + "/spaardoel-tel.png" });
await goTab(p, "overzicht");
await p.click("#budget-btn");
const ov2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("telefoon budget uitgeklapt niet zijwaarts", ov2 <= 1, ov2);
await p.screenshot({ path: SP + "/uitklap-tel.png" });
// 4. Menu met de onderdelen
await p.setViewportSize({ width: 820, height: 1180 });
ok(
  "menu dicht, knop toont onderdeel",
  (await p.locator("#tabs").isHidden()) && (await p.locator("#menu-cur").innerText()) === "Overzicht en budget",
);
await p.click("#menu-btn");
ok(
  "menu open met 5 onderdelen",
  (await p.locator("#tabs button:visible").count()) === 5 &&
    (await p.getAttribute("#menu-btn", "aria-expanded")) === "true",
);
await p.keyboard.press("Escape");
ok("Esc sluit", await p.locator("#tabs").isHidden());
await p.click("#menu-btn");
await p.click("h1");
ok("tik ernaast sluit", await p.locator("#tabs").isHidden());
await goTab(p, "transacties");
ok(
  "kiezen sluit en wisselt",
  (await p.locator("#tabs").isHidden()) && (await p.locator("#menu-cur").innerText()) === "Transacties",
);
const mb = await p.locator("#menu-btn").boundingBox(),
  pb = await p.locator("#profiles").boundingBox();
ok("menu naast de profielen", Math.abs(mb.y - pb.y) < 20 && mb.x > pb.x, JSON.stringify([mb, pb]));
await p.click("#menu-btn");
await p.screenshot({ path: SP + "/menu.png" });
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
