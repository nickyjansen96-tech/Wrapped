import { chromium, LAUNCH, URL_APP, FX, goTab } from "./lib.mjs";
const SP = process.argv[2] || ".";
const b = await chromium.launch(LAUNCH);
const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, acceptDownloads: true });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(URL_APP).origin });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push("pageerror: " + e.message));
p.on("console", m => {
  if (m.type() === "error") errs.push("console: " + m.text());
});
let dialogs = [];
p.on("dialog", d => {
  dialogs.push(d.message());
  d.accept();
});
let fails = 0;
const ok = (name, cond, info = "") => {
  console.log((cond ? "PASS " : "FAIL ") + name + (info !== "" ? "  [" + info + "]" : ""));
  if (!cond) fails++;
};
const tab = async t => {
  await goTab(p, t);
  await p.waitForTimeout(60);
};
const S = f => p.evaluate(f);
await p.goto(URL_APP);
await p.evaluate(() => (localStorage.clear(), localStorage.setItem("hhb-rondleiding-gezien", "1")));
await p.reload();

// 1. Lege app: elk tabblad zonder fouten
for (const t of ["overzicht", "vermogen", "transacties", "regels", "importeren"]) {
  await tab(t);
}
await p.click("#profiles .seg.add");
ok("lege app: alle tabbladen openen zonder fouten", errs.length === 0, errs.join("|"));
await tab("overzicht");
await p.click("text=Budget invullen");
ok("lege app: budgettabel opent", (await p.locator(".bgrid").count()) === 1);
await p.fill("#g-0-0", "2000");
await p.press("#g-0-0", "Enter");
ok("lege app: budget invullen zonder transacties", (await p.textContent("#gy-0")).includes("24.000"));
await p.click("text=Klaar");

// 2. Import TXT (Windows-codering met é)
await tab("importeren");
await p.setInputFiles("#file", FX + "/mut-1252.TXT");
await p.waitForSelector(".note.info");
ok(
  "TXT win-1252: 6 transacties",
  (await p.locator(".note.info").innerText()).includes("herkend. 6 nieuwe"),
  await p.locator(".note.info").innerText(),
);
const cafe = await S(() => S.tx.find(t => t.t.includes("Zwaan")).t);
ok("TXT win-1252: é goed gelezen", cafe.includes("Café"), cafe.slice(33, 50));
// zelfde in UTF-8 => allemaal dubbel
await p.setInputFiles("#file", FX + "/mut-utf8.TXT");
await p.waitForTimeout(300);
ok(
  "TXT utf-8 daarna: alles herkend als dubbel",
  (await p.locator(".note.info").innerText()).includes("Geen nieuwe"),
  await p.locator(".note.info").innerText(),
);
await p.setInputFiles("#file", FX + "/mut-nl.xls");
await p.waitForTimeout(400);
ok(
  "XLS (NL-kolommen) na TXT: dubbelen herkend",
  (await p.locator(".note.info").innerText()).includes("Geen nieuwe"),
  await p.locator(".note.info").innerText(),
);
await p.setInputFiles("#file", FX + "/mut-en.xlsx");
await p.waitForTimeout(400);
ok(
  "XLSX (Engelse kolommen, datumcellen): dubbelen herkend",
  (await p.locator(".note.info").innerText()).includes("Geen nieuwe"),
  await p.locator(".note.info").innerText(),
);
await p.setInputFiles("#file", FX + "/mut.csv");
await p.waitForTimeout(300);
const mm = await S(() => S.tx.find(t => t.t.includes("MediaMarkt"))?.a);
ok("CSV met decimaalpunt: bedrag klopt", mm === -1234.56, mm);
ok("totaal 7 transacties", (await S(() => S.tx.length)) === 7);
ok(
  "ingelezen maanden: dec 2025 – jan 2026",
  (await p.locator("details.fold summary").innerText()).includes("dec 2025 – jan 2026"),
);

// 3. Overzicht: Over telt ongecategoriseerd mee
await tab("overzicht");
await p.click("#rail .yearseg >> text=2026");
await p.click('#rail .chip:has-text("Heel jaar")');
const net = await S(() => S.tx.filter(t => Math.floor(t.d / 10000) === 2026).reduce((s, t) => s + t.a, 0));
const big = await p.locator(".hero .big").innerText();
ok(
  "Over = netto van alle transacties (geen regels)",
  big.replace(/\D/g, "") === String(Math.round(Math.abs(net))),
  big + " vs " + net,
);
ok(
  "melding zonder categorie, enkelvoud/meervoud",
  (await p.locator(".note").innerText()).startsWith("4 transacties zonder"),
);

// 4. Regels, Claude-voorstellen, regel uit transactie
await tab("regels");
await p.fill("#addrule-k", "WONINGCORP");
await p.click(".addrule button");
ok("regel zonder categorie geweigerd", dialogs.pop()?.includes("Kies eerst"));
await p.locator(".addrule select.cat").selectOption("Wonen");
await p.click(".addrule button");
ok("regel toegevoegd", (await p.locator(".rule").count()) === 1);
await p.click("text=Vraag kopiëren");
const prompt = await S(() => navigator.clipboard.readText());
ok("Claude-vraag zonder IBAN", !/NL00ABNA/.test(prompt) && prompt.includes("WERKGEVER BV"));
await p.fill(
  "#ai-answer",
  'Hier:\n```json\n{"regels":[{"trefwoord":"WERKGEVER","categorie":"salaris of uitkering"},{"trefwoord":"Albert Heijn","categorie":"Boodschapjes"},{"trefwoord":"WONINGCORP","categorie":"Wonen"}]}\n```',
);
await p.click("text=Antwoord inlezen");
ok(
  "3 voorstellen; onbekende cat en bestaande uit",
  (await p.locator(".sugg input[type=checkbox]:checked").count()) === 1,
);
await p.locator(".sugg .rule").nth(1).locator("select").selectOption("Boodschappen");
ok("categorie kiezen vinkt voorstel aan", (await p.locator(".sugg input[type=checkbox]:checked").count()) === 2);
await p.click('.card button.pri:has-text("toevoegen")');
ok(
  "voorstellen toegevoegd",
  (await p.locator(".card .note").innerText()).startsWith("2 regels toegevoegd"),
  await p.locator(".card .note").innerText(),
);
await tab("transacties");
await p.click("#rail .yearseg >> text=2025");
const zw = p.locator('.tx:has-text("Café de Zwaan")');
await zw.locator(".rulebtn").click();
await p.locator(".mk select").selectOption("Uit eten, uitgaan en hobby's");
await p.fill("#newrule-k", "Zwaan");
await p.click(".mk button.pri");
ok("regel vanuit transactie", (await S(() => S.rules[0].k)) === "Zwaan");
ok("2025: alles ingedeeld", (await p.locator("#funk").count()) === 0);
await p.click("#rail .yearseg >> text=2026");
await p.locator('.tx:has-text("MediaMarkt") select').selectOption("Vervanging inventaris en apparaten");
ok("handmatige categorie", (await S(() => Object.values(S.overrides)[0])) === "Vervanging inventaris en apparaten");
await p.fill("#ftext", "huur");
await p.waitForTimeout(400);
ok("zoeken", (await p.locator(".tx").count()) === 1);
await p.fill("#ftext", "");
await p.waitForTimeout(400);

// 5. Budgettabel: elke maand, losse maand, plakken, vorig jaar overnemen
await tab("overzicht");
await p.click("#rail .yearseg >> text=2025");
await p.click("text=Budget invullen");
const I = await S(() => ({
  sal: ALLCATS.indexOf("Salaris of uitkering"),
  won: ALLCATS.indexOf("Wonen"),
  bod: ALLCATS.indexOf("Boodschappen"),
}));
await p.fill("#g-" + I.sal + "-0", "2500");
await p.press("#g-" + I.sal + "-0", "Enter");
await p.fill("#g-" + I.won + "-0", "1100");
await p.press("#g-" + I.won + "-0", "Enter");
await p.fill("#g-" + I.won + "-12", "1200");
await p.press("#g-" + I.won + "-12", "Tab");
ok(
  "budget 2025 wonen jaar",
  (await p.textContent("#gy-" + I.won)).trim() === "13.300",
  await p.textContent("#gy-" + I.won),
);
await p.click("#rail .yearseg >> text=2026");
await p.click("text=Neem 2025 over");
ok("2025 overgenomen naar 2026", (await p.inputValue("#g-" + I.won + "-12")) === "1200");
await p.click("text=Klaar");
await p.click('#rail .chip:has-text("Jan")');
const jan = (await p.locator(".hero .stats").innerText()).replace(/\u00a0/g, " ");
ok(
  "jan 2026: inkomsten 2.500 van 2.500",
  jan.includes("€ 2.500") && jan.includes("van € 2.500"),
  jan.replace(/\n/g, " "),
);
await p.click('.cline:has-text("Wonen")');
ok(
  "categorie → transacties gefilterd",
  (await p.locator("#fcat").inputValue()) === "Wonen" && (await p.locator(".tx").count()) === 1,
);
await p.click("#back");
ok("terug naar overzicht", (await p.locator("#tabs [aria-selected=true]").innerText()).startsWith("Overzicht"));

// 6. Vermogen
await tab("vermogen");
await p.click('summary:has-text("Beginstand")');
await p.fill("#start-0", "1.000");
await p.press("#start-0", "Enter");
await p.waitForTimeout(100);
ok("vermogen met beginstand", (await p.locator(".hero .big").innerText()).length > 2 && errs.length === 0);

// 7. Back-up maken en terugzetten, oude back-up met ongeldige categorie
await tab("importeren");
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("text=Back-up maken")]);
ok(
  "back-up bestandsnaam met naam",
  /^huishoudboek-nicky-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()),
  dl.suggestedFilename(),
);
await dl.saveAs(SP + "/bk-nicky.json");
// nieuwe gebruiker, oude back-up met ongeldige categorie
await p.click("#profiles .seg.add");
await p.fill("#newuser", "Jan-Willem Ö");
await p.press("#newuser", "Enter");
await p.waitForTimeout(200);
await p.setInputFiles("#bfile", FX + "/oud.json");
await p.waitForTimeout(300);
await tab("overzicht");
await p.click("#rail .yearseg >> text=2026");
await p.click('#rail .chip:has-text("Heel jaar")');
ok(
  "ongeldige categorie telt als zonder categorie",
  (await p.locator(".note").innerText()).startsWith("1 transactie zonder"),
  await p.locator(".note").innerText(),
);
ok("Over klopt met ongeldige categorie", (await p.locator(".hero .big").innerText()).replace(/\D/g, "") === "1400");
await tab("importeren");
const [dl2] = await Promise.all([p.waitForEvent("download"), p.click("text=Back-up maken")]);
ok(
  "back-up naam zonder rare tekens",
  dl2.suggestedFilename().startsWith("huishoudboek-jan-willem-o-"),
  dl2.suggestedFilename(),
);
// terugzetten Nicky-back-up in deze gebruiker: waarschuwing
dialogs = [];
await p.setInputFiles("#bfile", SP + "/bk-nicky.json");
await p.waitForTimeout(300);
ok(
  "waarschuwing back-up van andere gebruiker",
  dialogs.some(d => d.includes("back-up is van Nicky")),
);
ok("teruggezet", (await p.locator(".card .note").innerText()).includes("7 transacties"));

// 8. Gebruikers: actieve verwijderen
await p.click("#profiles .seg.add");
await p.click('[aria-label="Gebruiker Jan-Willem Ö verwijderen"]');
await p.waitForTimeout(150);
ok(
  "actieve gebruiker verwijderd, terug naar Nicky",
  (await p.locator("#profiles .seg:not(.add)[aria-pressed=true]").innerText()) === "Nicky",
);
ok(
  "geen data van verwijderde gebruiker",
  (await S(() => Object.keys(localStorage).filter(k => k.startsWith("hhb:u")).length)) === 0,
);
await tab("transacties");
ok("Nicky intact", (await S(() => S.tx.length)) === 7 && (await S(() => S.rules.length)) === 4);

// 9. Herladen, offline
await p.reload();
await p.waitForTimeout(500);
ok("na herladen gegevens er nog", (await S(() => S.tx.length)) === 7);
await ctx.setOffline(true);
await p.reload();
ok("offline opent de app", (await p.locator("#tabs").count()) === 1 && (await S(() => S.tx.length)) === 7);
await ctx.setOffline(false);

// 10. Telefoonbreedte: alle schermen
await p.setViewportSize({ width: 375, height: 812 });
for (const t of ["overzicht", "vermogen", "transacties", "regels", "importeren"]) {
  await tab(t);
  const ov = await S(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("telefoon " + t + ": geen horizontaal scrollen", ov <= 1, ov);
  await p.screenshot({ path: SP + "/ph-" + t + ".png", fullPage: false });
}
await tab("overzicht");
await p.click("text=Budget bewerken");
const ov2 = await S(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("telefoon budgettabel: pagina scrolt niet zijwaarts", ov2 <= 1, ov2);
await p.screenshot({ path: SP + "/ph-grid.png" });
ok("geen JS-fouten", errs.length === 0, errs.join(" | "));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
