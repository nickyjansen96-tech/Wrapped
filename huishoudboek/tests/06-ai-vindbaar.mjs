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
await p.goto(URL_APP);
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("hhb-rondleiding-gezien", "1");
});
await p.reload();
ok("tabblad heet Regels en AI", (await p.locator("#tabs [data-tab=regels]").innerText()) === "Regels en AI");
await goTab(p, "regels");
ok("zonder data: AI-blok legt uit", (await p.locator("#ai-card").innerText()).includes("Lees eerst je bankexport in"));
await goTab(p, "importeren");
await p.setInputFiles("#file", FX + "/mut4.txt");
await p.waitForSelector(".note.info");
const imp = await p.locator(".note.info").innerText();
ok(
  "na import: aantal zonder categorie + AI-knop",
  imp.includes("180 transacties hebben nog geen categorie") && imp.includes("Laat AI indelen"),
  imp.replace(/\n/g, " "),
);
await p.screenshot({ path: SP + "/ai-entry-import.png" });
await p.click(".note.info >> text=Laat AI indelen");
ok(
  "knop na import → AI-blok",
  (await p.locator("#ai-card").isVisible()) &&
    (await p.locator("#tabs [aria-selected=true]").innerText()) === "Regels en AI",
);
ok("drie stappen zichtbaar", (await p.locator(".aistep").count()) === 3);
await p.screenshot({ path: SP + "/ai-steps.png" });
await p.click("#back");
await p.click("text=Naar overzicht");
ok("overzicht: AI-knop bij melding", await p.locator(".note >> text=Laat AI indelen").isVisible());
await p.screenshot({ path: SP + "/ai-entry-ov.png" });
await p.click(".note >> text=Laat AI indelen");
ok("overzicht → AI-blok", await p.locator("#ai-card").isVisible());
await goTab(p, "transacties");
ok("transacties: AI-banner", await p.locator(".note >> text=Laat AI indelen").isVisible());
await p.click(".note >> text=Laat AI indelen");
ok("transacties → AI-blok", await p.locator("#ai-card").isVisible());
await p.setViewportSize({ width: 375, height: 812 });
await p.screenshot({ path: SP + "/ai-steps-phone.png", fullPage: true });
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
