import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
const SP = process.argv[2] || ".",
  W = +process.argv[3] || 820,
  H = +process.argv[4] || 1180,
  tag = process.argv[5] || "ipad";
const b = await chromium.launch(LAUNCH);
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = [];
p.on("pageerror", e => errs.push(e.message));
p.on("console", m => {
  if (m.type() === "error") errs.push(m.text());
});
let fails = 0;
const ok = (n, c, i = "") => {
  console.log((c ? "PASS " : "FAIL ") + n + (i !== "" ? "  [" + i + "]" : ""));
  if (!c) fails++;
};
await p.goto(URL_APP);
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForTimeout(700);
ok("rondleiding start bij eerste keer", await p.locator(".tour-tip").isVisible());
const steps = await p.evaluate(() => TOUR.length);
for (let i = 0; i < steps; i++) {
  await p.waitForTimeout(350);
  const st = await p.evaluate(() => {
    const s = TOUR[tourIdx],
      t = s.target && document.querySelector(s.target),
      tip = document.querySelector(".tour-tip").getBoundingClientRect(),
      spot = document.querySelector(".tour-spot");
    const r = t ? t.getBoundingClientRect() : null;
    const inView = r ? r.top >= 0 && r.bottom <= innerHeight && r.width > 0 : true;
    const tipIn = tip.left >= 0 && tip.right <= innerWidth && tip.top >= 0 && tip.bottom <= innerHeight;
    const overlap = r
      ? !(tip.bottom <= r.top || tip.top >= r.bottom || tip.right <= r.left || tip.left >= r.right)
      : false;
    return {
      title: s.title,
      hasTarget: !!s.target,
      found: !!t,
      inView,
      tipIn,
      overlap,
      spot: !spot.hidden,
      tab: S.tab,
    };
  });
  ok(
    `stap ${i + 1} "${st.title}"`,
    (!st.hasTarget || (st.found && st.inView && st.spot)) && st.tipIn && !st.overlap,
    JSON.stringify(st),
  );
  if ([0, 1, 3, 5, 6, 7].includes(i)) await p.screenshot({ path: `${SP}/tour-${tag}-${i + 1}.png` });
  // klik op achtergrond mag niets doen
  if (i === 2) {
    await p.mouse.click(5, H - 5);
    ok("klik naast tooltip blokkeert app", await p.locator(".tour-tip").isVisible());
  }
  if (i === 3) {
    await p.click("text=Vorige");
    await p.waitForTimeout(300);
    ok("Vorige", (await p.evaluate(() => tourIdx)) === 2);
    await p.click("#tour-next");
    await p.waitForTimeout(200);
  }
  await p.click("#tour-next");
}
ok("rondleiding klaar", (await p.locator(".tour-tip").count()) === 0);
ok("daarna op Importeren (nog geen data)", (await p.evaluate(() => S.tab)) === "importeren");
ok("gezien onthouden", (await p.evaluate(() => localStorage.getItem("hhb-rondleiding-gezien"))) === "1");
await p.reload();
await p.waitForTimeout(600);
ok("niet opnieuw na herladen", (await p.locator(".tour-tip").count()) === 0);
await p.click("#help");
await p.waitForTimeout(300);
ok("?-knop start opnieuw", await p.locator(".tour-tip").isVisible());
await p.keyboard.press("ArrowRight");
await p.waitForTimeout(200);
ok("pijl rechts = volgende", (await p.evaluate(() => tourIdx)) === 1);
await p.keyboard.press("Escape");
ok("Escape sluit", (await p.locator(".tour-tip").count()) === 0);
await p.click("#help");
await p.click("text=Overslaan");
ok("Overslaan sluit", (await p.locator(".tour-tip").count()) === 0);
ok(
  "terug-geschiedenis niet vervuild",
  (await p.evaluate(() => history.state.n)) <= 1,
  await p.evaluate(() => history.state.n),
);
// bestaande gebruiker zonder vlag: geen automatische rondleiding
await p.evaluate(() => {
  localStorage.removeItem("hhb-rondleiding-gezien");
  localStorage.setItem("hhb:nicky:rules", JSON.stringify({ list: [{ k: "x", c: "Wonen" }] }));
});
await p.reload();
await p.waitForTimeout(600);
ok("bestaande gebruiker: geen automatische rondleiding", (await p.locator(".tour-tip").count()) === 0);
ok("geen JS-fouten", errs.length === 0, errs.join("|"));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
