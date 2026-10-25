// Back-up naar Claude: op de computer twee downloads (back-up en CSV), vraag gekopieerd en een knop naar Claude;
// op een touchscreen het deelmenu met beide bestanden. De back-up is terug te zetten, de CSV klopt.
import { readFileSync } from "node:fs";
import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
const SP = process.argv[2] || ".";
const b = await chromium.launch(LAUNCH);
let fails = 0;
const ok = (n, c, i = "") => {
  console.log((c ? "PASS " : "FAIL ") + n + (i !== "" ? "  [" + i + "]" : ""));
  if (!c) fails++;
};
const errs = [];
const setup = async p => {
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
      { k: "NETFLIX", c: "Niet meetellen" },
    ];
    compileRules();
    saveRules();
    S.tab = "importeren";
    go();
  });
};

// Computer
const ctx = await b.newContext({
  viewport: { width: 1100, height: 900 },
  acceptDownloads: true,
  permissions: ["clipboard-read", "clipboard-write"],
});
const p = await ctx.newPage();
await setup(p);
ok("knop zichtbaar", (await p.locator("#claude-btn").innerText()).includes("Naar Claude"));
const downloads = [];
p.on("download", d => downloads.push(d));
await p.click("#claude-btn");
await p.waitForSelector("#claude-card .note");
await p.waitForTimeout(300);
const names = downloads.map(d => d.suggestedFilename());
ok(
  "twee bestanden",
  names.length === 2 && /\.json$/.test(names[0]) && /-transacties\.csv$/.test(names[1]),
  names.join(),
);
const json = JSON.parse(readFileSync(await downloads[0].path(), "utf8"));
ok("back-up is terug te zetten", json.app === "huishoudboek" && Object.keys(json.months).length === 9);
const csv = readFileSync(await downloads[1].path(), "utf8")
  .replace(/^﻿/, "")
  .split("\n");
const n = await p.evaluate(() => S.tx.length);
ok(
  "CSV: kop en alle transacties",
  csv[0] === "datum;bedrag;naam;soort;omschrijving;categorie;telt mee" && csv.length === n + 1,
  csv.length,
);
ok(
  "CSV: categorie",
  csv.some(r => /^2026-09-11;-66\.84;Albert Heijn.*;Boodschappen;ja$/.test(r)),
  csv.find(r => r.includes("66.84")),
);
ok(
  "CSV: telt niet mee",
  csv.some(r => r.includes("NETFLIX") && r.endsWith(";Niet meetellen;nee")),
);
ok("CSV: geen rekeningnummers", !csv.some(r => /\bNL\d{2}[A-Z]{4}\d{6,}/.test(r)));
const clip = await p.evaluate(() => navigator.clipboard.readText());
ok("vraag gekopieerd", /Hierbij mijn huishoudboek/.test(clip) && /budgets\[jaar\]/.test(clip));
const note = await p.locator("#claude-card .note").innerText();
ok("uitleg met bestandsnamen", note.includes(names[0]) && /sleep ze/.test(note), note);
ok("knop Claude openen", (await p.locator("#claude-card a[href='https://claude.ai/new']").count()) === 1);
await p.screenshot({ path: SP + "/claude.png", fullPage: true });

// Touchscreen: deelmenu met beide bestanden
const m = await b.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });
const q = await m.newPage();
await q.addInitScript(() => {
  navigator.canShare = () => true;
  navigator.share = async d => {
    window.__shared = { files: d.files.map(f => f.name + ":" + f.size), text: d.text };
  };
});
await setup(q);
await q.click("#claude-btn");
await q.waitForSelector("#claude-card .note");
const shared = await q.evaluate(() => window.__shared);
ok(
  "gedeeld: twee bestanden met tekst",
  shared && shared.files.length === 2 && /Hierbij mijn huishoudboek/.test(shared.text),
  JSON.stringify(shared),
);
ok("melding na delen", /Gedeeld/.test(await q.locator("#claude-card .note").innerText()));
// zonder transacties is de knop uit
await q.evaluate(() => {
  switchProfile(addUser("Leeg"));
  S.tab = "importeren";
  go();
});
ok("knop uit zonder transacties", await q.locator("#claude-btn").isDisabled());
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
