"use strict";
// Bankbestanden herkennen en omzetten naar transacties: ABN AMRO (TXT/XLS), ING, Rabobank, bunq, Knab
// en andere CSV-bestanden met kolommen als datum, bedrag, naam en omschrijving.
// Een transactie is { i: id, d: jjjjmmdd, a: bedrag, t: tekst om op te zoeken en regels op toe te passen,
// n: naam tegenpartij (optioneel), p: plaats bij pinbetalingen (optioneel) }.

// CSV of TXT lezen: scheidingsteken (; , of tab) zelf bepalen, velden tussen aanhalingstekens ondersteunen.
function parseDelimited(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || "";
  const count = ch => first.replace(/"[^"]*"/g, "").split(ch).length - 1;
  const sep = ["\t", ";", ","].reduce((best, ch) => (count(ch) > count(best) ? ch : best), "\t");
  if (sep === "\t" && !first.startsWith('"'))
    return text
      .split(/\r?\n/)
      .filter(l => l.trim())
      .map(l => l.split("\t")); // ABN AMRO-TXT: geen aanhalingstekens
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(f => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some(f => f.trim())) rows.push(row);
  return rows;
}

const normHead = s =>
  String(s ?? "")
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
// Mogelijke kolomnamen per gegeven, in volgorde van voorkeur.
const COLS = {
  date: ["transactiedatum", "datum", "boekdatum", "boekingsdatum", "date", "transactiondate", "transaction date"],
  amount: ["transactiebedrag", "bedrag (eur)", "bedrag", "amount", "amount (eur)", "bedrag in euro"],
  sign: ["af bij", "af/bij", "creditdebet", "credit/debet", "debet/credit", "d/c", "debit/credit"],
  name: ["naam / omschrijving", "naam/omschrijving", "naam tegenpartij", "tegenrekeninghouder", "name", "naam"],
  desc: [
    "mededelingen",
    "omschrijving",
    "omschrijving-1",
    "omschrijving-2",
    "omschrijving-3",
    "description",
    "beschrijving",
  ],
  kind: ["mutatiesoort", "betaalwijze", "type betaling", "code", "type"],
  after: ["saldo na mutatie", "saldo na trn", "saldo na transactie", "eindsaldo", "balance", "saldo"],
  before: ["beginsaldo", "startsaldo"],
  iban: ["tegenrekening", "tegenrekening iban/bban", "tegenrekeningnummer", "counterparty", "counterparty account"],
};
const RABO_CODES = {
  bc: "Betaalautomaat",
  ba: "Betaalautomaat",
  ga: "Geldautomaat",
  id: "iDEAL",
  ei: "Incasso",
  ic: "Incasso",
  cb: "Overboeking",
  tb: "Overboeking",
  sb: "Overboeking",
  db: "Diversen",
};

function findHeader(rows) {
  const known = new Set(Object.values(COLS).flat());
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const head = rows[r].map(normHead);
    if (head.filter(h => known.has(h)).length >= 3) return { r, head };
  }
  return null;
}
function bankName(h) {
  const has = x => h.includes(x);
  if (has("af bij") && has("mededelingen")) return "ING";
  if (has("naam tegenpartij") && has("volgnr")) return "Rabobank";
  if (has("creditdebet")) return "Knab";
  if (has("counterparty") && has("interest date")) return "bunq";
  return "";
}

// Naam van een pinbetaling opschonen: "CCV*KANTOORBOEKHANDEL JAC NLD" → naam en plaats apart, hoofdletters netjes.
const SMALL_WORDS = /^(de|het|der|den|van|la|le|el|the|of|at|and|en|&)$/i;
function cleanParty(name, isCard) {
  let n = String(name || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(CCV|BCK|BNG|SUMUP|ZETTLE|MOLLIE|SP)\s*\*\s*/i, "")
    .replace(/^SP\s+/, "")
    .replace(/^(?=\S*\d)(?=\S*[A-Z])[A-Z0-9]{6,}\s+(?=\S)/, "") // betaalreferentie vooraan (NLOVP457…, NL0050)
    .replace(/^www\./i, "")
    .replace(/(\S)\s+www\.\S+(\s+[A-Z]{3})?$/i, "$1$2"); // "NAKD.COM WWW.NAKD.COM SWE"
  let place = "";
  if (isCard) {
    n = n.replace(/\s+[A-Z]{3}$/, ""); // landcode (NLD, DEU, IDN …)
    const m = /^(.*\S)\s+([A-Za-z][A-Za-z'-]{3,})$/.exec(n); // afgekapte plaatsen (NIJ, JAC) overslaan
    const before = m ? m[1].split(" ").pop() : "";
    if (m && /[A-Z]/.test(m[2][0]) && m[1].length >= 3 && !SMALL_WORDS.test(before)) {
      place = titleCase(m[2]);
      n = m[1];
      if (n.toUpperCase().endsWith(" " + m[2].toUpperCase())) n = n.slice(0, -m[2].length - 1); // "BREDA BREDA"
    }
  }
  if (n.length > 3 && n === n.toUpperCase() && /[A-Z]/.test(n))
    n = titleCase(n)
      .replace(/\b[^\saeiouy\d\W]{2,3}\b/gi, w => w.toUpperCase()) // initialen (NSJ) blijven hoofdletters
      .replace(/\.[A-Z]{2,}\b/g, w => w.toLowerCase()); // domeinen: Greetz.nl
  return { name: n, place };
}

// Korte omschrijving voor in de lijst: het deel na "Omschrijving:", anders de mededeling zonder technische gegevens.
const DESC_END =
  /\s(?:IBAN|BIC|Kenmerk|Datum\/Tijd|Valutadatum|Machtiging ID|Incassant ID|Overige partij|Doorlopende incasso)\b/;
function shortDesc(desc) {
  const m = /Omschrijving:\s*(.*)/.exec(desc);
  if (m) return m[1].split(DESC_END)[0].trim().slice(0, 120);
  if (/Kaartnr:/.test(desc)) return "";
  return desc
    .split(DESC_END)[0]
    .replace(/\s+[A-Z]\d{6,}\b/, "")
    .trim()
    .slice(0, 120);
}

// ABN AMRO: precies zoals eerder, zodat al ingelezen transacties hetzelfde id houden.
function abnRows(rows, ci, start) {
  const out = [];
  for (let r = start; r < rows.length; r++) {
    const R = rows[r];
    if (!R || R.length < 4) continue;
    const d = toDate(R[ci.d]),
      a = toNum(R[ci.a]),
      b = ci.b >= 0 ? toNum(R[ci.b]) : 0,
      t = String(R[ci.t] ?? "");
    if (isNaN(d) || isNaN(a)) continue;
    out.push({ i: txId(d, a, isNaN(b) ? 0 : b, t), d, a, t });
  }
  return out;
}

// Geeft { bank, txs } terug, of null als het bestand niet herkend wordt.
function parseBankRows(rows) {
  if (!rows.length) return null;
  const hdr = findHeader(rows);
  const h = hdr ? hdr.head : [];
  if (h.includes("transactiedatum") && h.includes("transactiebedrag"))
    return {
      bank: "ABN AMRO",
      txs: abnRows(
        rows,
        {
          d: h.indexOf("transactiedatum"),
          b: h.indexOf("beginsaldo"),
          a: h.indexOf("transactiebedrag"),
          t: h.indexOf("omschrijving"),
        },
        hdr.r + 1,
      ),
    };
  if (h.includes("transactiondate") && h.includes("amount") && h.includes("startsaldo"))
    return {
      bank: "ABN AMRO",
      txs: abnRows(
        rows,
        {
          d: h.indexOf("transactiondate"),
          b: h.indexOf("startsaldo"),
          a: h.indexOf("amount"),
          t: h.indexOf("description"),
        },
        hdr.r + 1,
      ),
    };
  if (!hdr) {
    // ABN AMRO-TXT zonder kop: rekening, munt, datum, beginsaldo, eindsaldo, rentedatum, bedrag, omschrijving
    if (rows[0].length >= 8 && !isNaN(toDate(rows[0][2])))
      return {
        bank: "ABN AMRO",
        txs: abnRows(rows, isNaN(toDate(rows[0][3])) ? { d: 2, b: 3, a: 6, t: 7 } : { d: 2, b: 4, a: 6, t: 7 }, 0),
      };
    return null;
  }
  const col = key => {
    for (const name of COLS[key]) {
      const i = h.indexOf(name);
      if (i >= 0) return i;
    }
    return -1;
  };
  const ci = {
    date: col("date"),
    amount: col("amount"),
    sign: col("sign"),
    name: col("name"),
    kind: col("kind"),
    after: col("after"),
    before: col("before"),
    iban: col("iban"),
    desc: COLS.desc.map(n => h.indexOf(n)).filter(i => i >= 0 && i !== col("name")),
  };
  if (ci.date < 0 || ci.amount < 0) return null;
  const bank = bankName(h);
  const txs = [];
  for (let r = hdr.r + 1; r < rows.length; r++) {
    const R = rows[r],
      get = i => (i >= 0 && R[i] != null ? String(R[i]).trim() : "");
    const d = toDate(R[ci.date]);
    let a = toNum(R[ci.amount]);
    if (isNaN(d) || isNaN(a)) continue;
    const sign = get(ci.sign).toLowerCase();
    if (/^(af|d|debet|debit)$/.test(sign)) a = -Math.abs(a);
    else if (/^(bij|c|credit)$/.test(sign)) a = Math.abs(a);
    let kind = get(ci.kind);
    if (bank === "Rabobank") kind = RABO_CODES[kind.toLowerCase()] || kind;
    if (/^[A-Z]{2}$/.test(kind) && bank !== "Rabobank") kind = ""; // losse ING-codes (GT, BA …) zeggen weinig
    const desc = ci.desc.map(get).filter(Boolean).join(" "),
      iban = get(ci.iban);
    const isCard = /betaalautomaat|geldautomaat|^bc$|^ba$|^gm$/i.test(kind) || /Kaartnr:/.test(desc);
    const rawName = /^notprovided$/i.test(get(ci.name)) ? "" : get(ci.name);
    const party = cleanParty(rawName || shortDesc(desc).slice(0, 40), isCard);
    const t = [get(ci.name), kind, desc, iban && !desc.includes(iban) ? "IBAN: " + iban : ""]
      .filter(Boolean)
      .join("  ");
    const after = toNum(get(ci.after)),
      before = toNum(get(ci.before)),
      b = !isNaN(before) ? before : !isNaN(after) ? after - a : 0;
    const tx = { i: txId(d, a, b, t), d, a, t };
    if (party.name) tx.n = party.name;
    if (party.place) tx.p = party.place;
    const o = shortDesc(desc);
    if (o && o !== party.name) tx.o = o;
    txs.push(tx);
  }
  return { bank: bank || "CSV", txs };
}
