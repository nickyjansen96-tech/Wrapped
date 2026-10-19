import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
const SP = process.argv[2] || ".";
const b = await chromium.launch(LAUNCH);
const ctx = await b.newContext({ viewport: { width: 820, height: 1180 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(URL_APP).origin });
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
await p.setInputFiles("#file", FX + "/mut-1252.TXT");
await p.waitForSelector(".note.info");
await p.setInputFiles("#file", FX + "/mut4.txt");
await p.waitForTimeout(300);
await p.click("#tabs button[data-tab=regels]");
ok("titel", (await p.locator("#ai-card h2").innerText()) === "Transacties laten indelen door AI");
ok(
  "knoppen Claude en ChatGPT",
  (await p.locator('#ai-card a:has-text("Claude openen")').getAttribute("href")) === "https://claude.ai/new" &&
    (await p.locator('#ai-card a:has-text("ChatGPT")').count()) === 1,
);
await p.click("text=Vraag kopiëren");
const q = await p.evaluate(() => navigator.clipboard.readText());
ok(
  "vraag bevat omschrijving",
  /WONINGCORP \| automatische incasso[^\n]*\n   omschrijving: "SEPA Incasso[^"]*Omschrijving: Huur/.test(q),
);
ok(
  "vraag bevat soort betaling, aantal, gemiddelde, periode",
  /\d+\. Albert Heijn \| betaalpas \| \d+× \| gemiddeld € -\d+,\d\d \| totaal € -[\d,]+ \| jan 2026–sep 2026/.test(q),
  q.match(/\d+\. Albert Heijn[^\n]*/)?.[0],
);
ok("geen IBAN in vraag", !/NL\d\d[A-Z]{4}\d+/.test(q));
ok("geen pasnummer of NR: in vraag", !/PAS\d+|NR:/.test(q));
ok("geen tijdstempel in vraag", !/\d\d\.\d\d\.\d\d\/\d\d/.test(q));
ok("vraagt om trefwoord | categorie", q.includes("Albert Heijn | Boodschappen"));
ok("é behouden", q.includes("Café de Zwaan"));
console.log(
  "--- voorbeeld uit de vraag ---\n" +
    q
      .split("\n")
      .filter(l => /^\d+\. |omschrijving:/.test(l))
      .slice(0, 6)
      .join("\n") +
    "\n---",
);
// antwoord via klembord plakken (zoals een ChatGPT-antwoord)
await p.evaluate(
  t => navigator.clipboard.writeText(t),
  "Natuurlijk! Hier zijn de regels:\n\n| Trefwoord | Categorie |\n|---|---|\n| Albert Heijn | Boodschappen |\n| Kruidvat | Persoonlijke verzorging |\n| WONINGCORP | Woonlasten |\n| Café de Zwaan | Uit eten, uitgaan en hobby’s |\n",
);
await p.click("text=Plakken en inlezen");
await p.waitForTimeout(200);
ok("4 voorstellen", (await p.locator(".sugg .rule").count()) === 4);
ok(
  "3 aangevinkt, 1 kies zelf",
  (await p.locator(".sugg input[type=checkbox]:checked").count()) === 3 &&
    (await p.locator("#ai-card .prose").last().innerText()).includes("bij 1 moet je zelf"),
);
ok(
  "hobby’s met gekrulde quote herkend",
  (await p.locator(".sugg .rule").nth(3).locator("select").inputValue()) === "Uit eten, uitgaan en hobby's",
);
await p.locator(".sugg .rule").nth(2).locator("select").selectOption("Wonen");
ok("categorie kiezen vinkt aan", (await p.locator(".sugg input[type=checkbox]:checked").count()) === 4);
await p.click('#ai-card button.pri:has-text("toevoegen")');
const msg = await p.locator("#ai-card .note").innerText();
ok("regels toegevoegd", msg.startsWith("4 regels toegevoegd"), msg);
ok(
  "onzin-antwoord geeft duidelijke melding",
  await (async () => {
    await p.click("text=Vraag kopiëren");
    await p.fill("#ai-answer", "Sorry, ik kan je daar niet mee helpen.");
    await p.click("text=Antwoord inlezen");
    return (await p.locator("#ai-card .note").innerText()).startsWith("Hierin vond de app geen regels");
  })(),
);
await p.setViewportSize({ width: 375, height: 812 });
await p.click("text=Wat wordt gedeeld?");
await p.screenshot({ path: SP + "/ai-phone.png", fullPage: true });
await p.setViewportSize({ width: 820, height: 1180 });
await p.click("text=Vraag verbergen");
await p.screenshot({ path: SP + "/ai-ipad.png" });
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
