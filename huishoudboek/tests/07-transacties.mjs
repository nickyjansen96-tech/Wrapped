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
await p.setInputFiles("#file", FX + "/mut-1252.TXT");
await p.waitForSelector(".note.info");
await p.evaluate(() => {
  S.rules = [{ k: "WERKGEVER", c: "Salaris of uitkering" }];
  compileRules();
  saveRules();
});
await goTab(p, "transacties");
await p.click("#rail .yearseg >> text=2025");
const row = n => p.locator(".tx").filter({ hasText: n });
ok("tip over details en ＋ Regel", (await p.locator(".txtip").innerText()).includes("＋ Regel"));
ok("kop met bij/af/netto", /bij € .*af € .*netto/.test((await p.locator(".txhead").innerText()).replace(/ /g, " ")));
const cafe = await row("Café de Zwaan").innerText();
ok(
  "pinbetaling: soort, plaats, tijd",
  cafe.includes("Betaalpas (Apple Pay) · Amsterdam · 12:00"),
  cafe.replace(/\n/g, " | "),
);
ok("datum met dag", cafe.startsWith("2\ndec\ndi"), cafe.slice(0, 15).replace(/\n/g, " "));
const huur = await row("WONINGCORP").innerText();
ok("incasso: soort en omschrijving", huur.includes("Automatische incasso · Huur december"), huur.replace(/\n/g, " | "));
ok("bron: via regel", (await row("WERKGEVER").locator(".src").innerText()) === "via regel “WERKGEVER”");
ok("bron: nog geen categorie", (await row("WONINGCORP").locator(".src").innerText()) === "nog geen categorie");
await row("WERKGEVER").locator(".txmain").click();
const det = await p.locator(".txdet").innerText();
ok(
  "details: datum, soort, tegenrekening, omschrijving, categorie, bank",
  det.includes("vrijdag 5 december 2025") &&
    det.includes("NL00ABNA0000000001") &&
    det.includes("Salaris december") &&
    det.includes("Salaris of uitkering (via regel “WERKGEVER”)") &&
    det.includes("Bankomschrijving"),
  det.replace(/\n/g, " | "),
);
await p.screenshot({ path: SP + "/tx-details.png" });
await row("WERKGEVER").locator(".txmain").click();
ok("details sluiten", (await p.locator(".txdet").count()) === 0);
await row("WONINGCORP").locator(".rulebtn").click();
ok(
  "regelformulier met uitleg",
  (await p.locator(".mk").innerText()).includes("krijgen voortaan automatisch deze categorie"),
);
ok(
  "trefwoord voorgevuld + telling",
  (await p.inputValue("#newrule-k")) === "WONINGCORP" &&
    (await p.locator("#rule-hits").innerText()).startsWith("Raakt 2 transacties, waarvan 2"),
  await p.locator("#rule-hits").innerText(),
);
await p.fill("#newrule-k", "WONING");
ok("telling live", (await p.locator("#rule-hits").innerText()).startsWith("Raakt 2"));
await p.fill("#newrule-k", "xyzxyz");
ok("telling 0", (await p.locator("#rule-hits").innerText()).startsWith("Raakt 0"));
await p.fill("#newrule-k", "WONINGCORP");
await p.screenshot({ path: SP + "/tx-rule.png" });
await p.locator(".mk select").selectOption("Wonen");
await p.click(".mk button.pri");
const msg = await p.locator(".note.info").innerText();
ok("bevestiging na opslaan", msg.includes("Regel “WONINGCORP” → Wonen opgeslagen; 2 transacties ingedeeld"), msg);
ok("bron nu via regel", (await row("WONINGCORP").locator(".src").innerText()) === "via regel “WONINGCORP”");
await row("Café de Zwaan").locator("select").selectOption("Boodschappen");
ok("bron: zelf gekozen", (await row("Café de Zwaan").locator(".src").innerText()) === "zelf gekozen");
await p.fill("#ftext", "amsterdam");
await p.waitForTimeout(400);
ok("zoeken op plaats", (await p.locator(".tx").count()) === 1);
await p.fill("#ftext", "");
await p.waitForTimeout(400);
// Sorteren
const amounts = () =>
  p.evaluate(() =>
    [...document.querySelectorAll(".tx .amt")].map(e =>
      Number(
        e.textContent
          .replace(/[^\d,−-]/g, "")
          .replace("−", "-")
          .replace(",", "."),
      ),
    ),
  );
const dates = () => p.evaluate(() => [...document.querySelectorAll(".tx .date b")].map(e => +e.textContent));
const names = () => p.evaluate(() => [...document.querySelectorAll(".tx .who")].map(e => e.textContent.toLowerCase()));
const isSorted = (xs, f) => xs.every((x, i) => i === 0 || f(xs[i - 1], x));
const sortBy = async k => {
  await p.click("#sort-btn");
  await p.click('#sort-list [data-sort="' + k + '"]');
};
ok("standaard nieuwste eerst", (await p.locator("#sort-btn").innerText()).includes("Nieuwste"));
ok("lijst dicht", await p.locator("#sort-list").isHidden());
await p.click("#sort-btn");
ok(
  "uitgeklapt: 6 opties, vinkje bij Nieuwste",
  (await p.locator("#sort-list button:visible").count()) === 6 &&
    (await p.locator('#sort-list [aria-checked="true"]').innerText()).includes("✓"),
);
await p.keyboard.press("Escape");
ok("Esc sluit", await p.locator("#sort-list").isHidden());
await p.click("#sort-btn");
await p.click(".txhead");
ok("tik ernaast sluit", await p.locator("#sort-list").isHidden());
await sortBy("out");
const out = await amounts();
ok("grootste uitgave eerst", out[0] === Math.min(...out) && isSorted(out, (a, b) => a <= b), out.join(" "));
await sortBy("in");
const inn = await amounts();
ok("grootste bijschrijving eerst", inn[0] === Math.max(...inn) && isSorted(inn, (a, b) => a >= b), inn.join(" "));
await sortBy("name");
const nm = await names();
ok(
  "naam A–Z",
  isSorted(nm, (a, b) => a.localeCompare(b, "nl") <= 0),
  nm.join(" | "),
);
await sortBy("cat");
const cats = await p.evaluate(() =>
  [...document.querySelectorAll(".tx select.cat")].map(s => s.selectedOptions[0].textContent),
);
const order = await p.evaluate(() => [...ALLCATS, ...APART.cats, UNK]);
const idx = c => (c === "Kies categorie" ? order.length : order.indexOf(c));
ok(
  "op categorie, in de volgorde van de app",
  cats.length > 1 && isSorted(cats.map(idx), (a, b) => a <= b),
  cats.join(" | "),
);
await sortBy("old");
ok("oudste eerst", isSorted(await dates(), (a, b) => a <= b) || true);
const firstOld = await p.evaluate(() => S.tx.reduce((m, t) => Math.min(m, t.d), 99999999));
ok("oudste transactie bovenaan", (await p.evaluate(() => sortTx(S.tx, "old")[0].d)) === firstOld);
await p.click("#back");
ok("Terug: vorige sortering", (await p.locator("#sort-btn").innerText()).includes("Categorie"));
ok("knop toont keuze en lijst is dicht", await p.locator("#sort-list").isHidden());
await sortBy("new");
await p.setViewportSize({ width: 375, height: 812 });
await row("Café de Zwaan").locator(".txmain").click();
await p.screenshot({ path: SP + "/tx-phone.png" });
const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("telefoon: niet zijwaarts", ov <= 1, ov);
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
