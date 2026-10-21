// Bankbestanden van andere banken: ING, Rabobank en bunq (verzonnen voorbeeldgegevens in fixtures/).
// Controleert herkenning, bedragen en tekens, namen en plaatsen, betaaltypes, dubbele import en opslag.
import { chromium, LAUNCH, URL_APP, FX } from "./lib.mjs";
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

const load = async file => {
  await p.evaluate(() => document.querySelectorAll(".note.info").forEach(n => n.remove()));
  await p.setInputFiles("#file", FX + "/" + file);
  await p.waitForSelector(".note.info");
  return p.locator(".note.info").first().innerText();
};
const info = () =>
  p.evaluate(() =>
    S.tx.map(t => {
      const i = txInfo(t);
      return { d: t.d, a: t.a, n: i.name, type: i.type, place: i.place, time: i.time, desc: i.desc };
    }),
  );

// ING
let msg = await load("ing.csv");
ok("ING herkend", /^ING-export herkend\. 6 nieuwe/.test(msg), msg.split("\n")[0]);
let tx = await info();
const find = re => tx.find(t => re.test(t.n));
ok(
  "ING netto klopt",
  Math.abs(tx.reduce((s, t) => s + t.a, 0) - 1908.1) < 0.005,
  tx.reduce((s, t) => s + t.a, 0),
);
const ah = find(/^Albert Heijn/);
ok(
  "pinbetaling: naam, plaats, type",
  ah?.n === "Albert Heijn 1234" && ah.place === "Utrecht" && ah.a === -23.45 && /betaalpas/.test(ah.type),
  JSON.stringify(ah),
);
const caf = find(/Cafetaria/);
ok(
  "naam zonder plaats blijft heel",
  caf?.n === "Cafetaria De Harmonie" && caf.place === "" && caf.time === "21:05",
  JSON.stringify(caf),
);
const zal = find(/Zalando/);
ok("online kaartbetaling", zal?.type.startsWith("online met betaalpas") && zal.place === "Berlin", JSON.stringify(zal));
const sal = find(/Werkgever/);
ok(
  "overschrijving: bij is positief, omschrijving",
  sal?.a === 3150 && /Salaris september/.test(sal.desc) && sal.type === "overboeking",
  JSON.stringify(sal),
);
const huur = find(/Woningcorporatie/);
ok(
  "incasso",
  huur?.a === -1100 && huur.type === "automatische incasso" && /Huur september/.test(huur.desc),
  JSON.stringify(huur),
);
ok("geldautomaat", find(/Geldmaat/)?.type === "geldautomaat", JSON.stringify(find(/Geldmaat/)));
msg = await load("ing.csv");
ok(
  "ING opnieuw: niets dubbel",
  /6 stonden er al in/.test(msg) && (await p.evaluate(() => S.tx.length)) === 6,
  msg.split("\n")[0],
);

// Regel op naam werkt ook voor ING
const hits = await p.evaluate(() => {
  S.rules = [{ k: "Albert Heijn", c: "Boodschappen" }];
  compileRules();
  return S.tx.filter(t => catOf(t) === "Boodschappen").length;
});
ok("regel op naam werkt", hits === 1, hits);

// Rabobank
msg = await load("rabobank.csv");
ok("Rabobank herkend", /^Rabobank-export herkend\. 3 nieuwe/.test(msg), msg.split("\n")[0]);
tx = await info();
const jumbo = find(/^Jumbo/);
ok("Rabobank pinbetaling", jumbo?.a === -42.1 && /betaalpas/.test(jumbo.type), JSON.stringify(jumbo));
const vries = find(/de Vries/);
ok(
  "Rabobank bijschrijving",
  vries?.a === 1000 && vries.type === "overboeking" && /Terugbetaling vakantie/.test(vries.desc),
  JSON.stringify(vries),
);
ok(
  "Rabobank incasso",
  find(/Streamingdienst/)?.type === "automatische incasso",
  JSON.stringify(find(/Streamingdienst/)),
);

// bunq
msg = await load("bunq.csv");
ok("bunq herkend", /^bunq-export herkend\. 2 nieuwe/.test(msg), msg.split("\n")[0]);
tx = await info();
ok(
  "bunq bedragen en namen",
  find(/Bakkerij/)?.a === -15.5 && find(/Jansen/)?.a === 250 && /Cadeau/.test(find(/Jansen/).desc),
);

// Opslaan en opnieuw laden: naam en plaats blijven bewaard
await p.evaluate(() => flushSaves());
await p.reload();
tx = await info();
ok("na herladen alles er nog", tx.length === 11 && find(/Albert Heijn/)?.place === "Utrecht", tx.length);

// Onbekend bestand geeft een duidelijke melding
await p.evaluate(() => document.querySelectorAll(".note").forEach(n => n.remove()));
await p.setInputFiles("#file", { name: "raar.csv", mimeType: "text/csv", buffer: Buffer.from("a;b\n1;2\n") });
await p.waitForSelector(".note");
const err = await p.locator(".note").first().innerText();
ok("onbekend bestand: uitleg", /ING|Rabobank/.test(err), err.split("\n")[0]);

ok("geen JS-fouten", errs.length === 0, errs.join(" | "));
await b.close();
console.log(fails ? fails + " MISLUKT" : "ALLES OK");
process.exit(fails ? 1 : 0);
