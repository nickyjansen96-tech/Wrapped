import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
import { ANSWERS } from "./fixtures/ai-antwoorden.mjs";
const fn = "parseAI";
let fails = 0;
const b = await chromium.launch(LAUNCH);
const p = await b.newPage();
await p.goto(URL_APP);
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("hhb-rondleiding-gezien", "1");
});
await p.reload();
for (const [name, txt] of Object.entries(ANSWERS)) {
  const r = await p.evaluate(
    ([t, fn]) => {
      const out = window[fn](t);
      return out ? out.map(x => x.k + " → " + (x.badCat ? "?" : x.c)) : null;
    },
    [txt, fn],
  );
  const good = r && r.length >= 2 && r.filter(x => !x.endsWith("?")).length >= 2;
  const one = Object.keys(ANSWERS).indexOf(name) === 3;
  const pass = good || (one && r && r.length === 1);
  if (!pass) fails++;
  console.log((pass ? "PASS " : "FAIL ") + name.padEnd(36) + JSON.stringify(r));
}
console.log(fails ? fails + " FAILED" : "ALL PASSED");
process.exitCode = fails ? 1 : 0;
await b.close();
