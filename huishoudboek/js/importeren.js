"use strict";
// Tabblad Importeren: bankexport inlezen en back-ups.
/* ---------- importeren ---------- */
function h32(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
const cents = x => Math.floor(x * 100 + 0.5);
function txId(d, a, begin, text) {
  const s = d + "|" + cents(a) + "|" + cents(begin) + "|" + text.replace(/\s+/g, " ").trim();
  return h32(s, 2166136261) + h32(s, 340282366);
}
// Bedrag uit een bestand: "1.234,56" (ABN AMRO), maar ook "1234.56" uit een CSV.
function toNum(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[\s€]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(\.|$)/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  return s === "" ? NaN : Number(s);
}
function toDate(v) {
  if (v instanceof Date) return v.getFullYear() * 10000 + (v.getMonth() + 1) * 100 + v.getDate();
  const m = /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s*$/.exec(String(v)); // 15-01-2026 of 15/01/2026
  if (m) return +m[3] * 10000 + +m[2] * 100 + +m[1];
  const n = parseInt(String(v).replace(/\D/g, ""), 10);
  return n > 19000000 && n < 21000000 ? n : NaN;
}
// TXT-exports zijn niet altijd UTF-8; dan lezen als Windows-1252 zodat é en ë goed blijven.
function decodeText(buf) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (e) {
    return new TextDecoder("windows-1252").decode(buf);
  }
}
async function importFile(file) {
  if (/\.json$/i.test(file.name)) return restoreBackup(file);
  S.importMsg = "Bezig met inlezen…";
  render();
  try {
    const buf = await file.arrayBuffer();
    let rows;
    if (/\.(txt|tab|tsv|csv)$/i.test(file.name)) rows = parseDelimited(decodeText(buf));
    else {
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    }
    const res = parseBankRows(rows),
      parsed = res ? res.txs : [];
    if (!parsed.length) {
      S.importMsg =
        "In " +
        file.name +
        " herkent de app geen transacties. Gebruik de export van je bank: ABN AMRO (Excel of TXT), ING, Rabobank, bunq of Knab (CSV), of een CSV met kolommen voor datum, bedrag en omschrijving.";
      render();
      return;
    }
    const have = new Set(S.tx.map(t => t.i));
    let added = 0,
      dup = 0;
    const touched = new Set();
    for (const t of parsed) {
      if (have.has(t.i)) {
        dup++;
        continue;
      }
      have.add(t.i);
      const s = String(t.d),
        key = s.slice(0, 4) + "-" + s.slice(4, 6);
      (S.months[key] || (S.months[key] = [])).push(t);
      touched.add(key);
      added++;
    }
    indexTx();
    for (const k of touched) saveMonth(k);
    const y0 = S.year;
    pickDefaults();
    if (years().includes(y0) && !added) S.year = y0;
    S.importMsg =
      (res.bank !== "CSV" ? res.bank + "-export herkend. " : "") +
      (added ? nTx(added).replace(/ transactie/, " nieuwe transactie") + " toegevoegd" : "Geen nieuwe transacties") +
      " uit " +
      file.name +
      (dup
        ? "; " +
          dup +
          (dup === 1 ? " stond" : " stonden") +
          " er al in en " +
          (dup === 1 ? "is" : "zijn") +
          " overgeslagen."
        : ".");
    if (added && !store.ok) S.importMsg += " Let op: opslaan is in deze browser niet beschikbaar.";
  } catch (e) {
    S.importMsg = "Het bestand kon niet worden gelezen. Controleer of het een export van de bank is.";
  }
  render();
}

/* ---------- back-up ---------- */
function backupData() {
  return {
    app: "huishoudboek",
    version: 1,
    profile: profileName(),
    exported: new Date().toISOString(),
    rules: S.rules.map(r => ({ k: r.k, c: r.c })),
    overrides: S.overrides,
    budgets: S.budgets,
    wealth: S.wealth,
    goals: S.goals,
    months: Object.fromEntries(Object.entries(S.months).map(([k, rows]) => [k, rows.map(txStore)])),
  };
}
const backupName = ext =>
  "huishoudboek-" +
  (profileName()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "gebruiker") +
  "-" +
  new Date().toISOString().slice(0, 10) +
  ext;
function downloadBlob(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function exportBackup() {
  flushSaves();
  const name = backupName(".json");
  const blob = new Blob([JSON.stringify(backupData())], { type: "application/json" });
  try {
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer:coarse)").matches) {
      await navigator.share({ files: [file], title: "Huishoudboek back-up " + profileName() });
      S.backupMsg = "Back-up gedeeld.";
      render();
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  downloadBlob(blob, name);
  S.backupMsg = "Back-up opgeslagen als " + name + ".";
  render();
}
// Back-up naar Claude: de back-up (om terug te zetten) en een leesbaar overzicht van alle transacties met categorie
// (CSV), met een vraag erbij. Een web-app kan niet zelf in je Claude-account schrijven: op iPad en telefoon deel je de
// bestanden met de Claude-app, op de computer worden ze gedownload en sleep je ze in een gesprek op claude.ai.
function claudeCsv() {
  const q = v => (/[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const date = d =>
    Math.floor(d / 10000) +
    "-" +
    String(Math.floor(d / 100) % 100).padStart(2, "0") +
    "-" +
    String(d % 100).padStart(2, "0");
  const rows = S.tx
    .slice()
    .sort((a, b) => a.d - b.d)
    .map(t => {
      const [name, desc] = partyOf(t);
      return [
        date(t.d),
        t.a.toFixed(2),
        name,
        txType(t.t),
        (desc || cleanDesc(t.t)).replace(/\s+/g, " ").trim(),
        catOf(t),
        counted(t) ? "ja" : "nee",
      ]
        .map(v => q(String(v)))
        .join(";");
    });
  return ["datum;bedrag;naam;soort;omschrijving;categorie;telt mee", ...rows].join("\n");
}
const claudeText = () =>
  "Hierbij mijn huishoudboek (profiel " +
  profileName() +
  "): een back-up (JSON, om later terug te zetten in de app) en al mijn transacties met categorie (CSV). " +
  "In de CSV: per transactie datum, bedrag (min = uitgave), naam, soort betaling, omschrijving, categorie en of hij meetelt " +
  "(declaraties en 'Niet meetellen' tellen niet mee in mijn overzichten). Budgetten staan in de JSON onder budgets[jaar][categorie]: " +
  "base is het bedrag per maand, m bevat afwijkende maanden. Vat kort samen hoe ik ervoor sta; daarna stel ik je vragen.";
async function backupToClaude() {
  flushSaves();
  const json = new File([JSON.stringify(backupData())], backupName(".json"), { type: "application/json" }),
    csv = new File(["\ufeff" + claudeCsv()], backupName("-transacties.csv"), { type: "text/csv" }),
    text = claudeText();
  try {
    if (navigator.canShare && navigator.canShare({ files: [json, csv] }) && matchMedia("(pointer:coarse)").matches) {
      await navigator.share({ files: [json, csv], text, title: "Huishoudboek " + profileName() });
      S.claudeMsg = { text: "Gedeeld. Kies je de Claude-app, dan staan de bestanden in een nieuw gesprek." };
      render();
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  downloadBlob(json, json.name);
  downloadBlob(csv, csv.name);
  const copied = await copyText(text);
  S.claudeMsg = {
    text:
      "Twee bestanden gedownload: " +
      json.name +
      " en " +
      csv.name +
      ". Open Claude, sleep ze in een nieuw gesprek" +
      (copied ? " en plak de vraag (staat al gekopieerd)." : " en typ je vraag."),
    link: true,
  };
  render();
}
async function restoreBackup(file) {
  let v;
  try {
    v = JSON.parse(await file.text());
  } catch (e) {
    S.backupMsg = "Dit is geen geldige back-up.";
    render();
    return;
  }
  if (!v || typeof v !== "object" || !v.months || typeof v.months !== "object") {
    S.backupMsg = "Dit bestand is geen Huishoudboek-back-up.";
    render();
    return;
  }
  const n = Object.values(v.months).reduce((s, r) => s + (Array.isArray(r) ? r.length : 0), 0);
  const from = v.profile && v.profile !== profileName() ? " Let op: deze back-up is van " + v.profile + "." : "";
  if (
    (S.tx.length || from) &&
    !confirm(
      "De gegevens van " +
        profileName() +
        " (" +
        S.tx.length +
        " transacties) worden vervangen door de back-up (" +
        n +
        " transacties)." +
        from +
        " Doorgaan?",
    )
  )
    return;
  dropSaves();
  for (const id of store.keys()) store.del(id);
  resetData();
  loadDoc("rules", { list: v.rules || [] });
  loadDoc("overrides", { map: v.overrides || {} });
  loadDoc("budgets", { years: v.budgets || {} });
  loadDoc("wealth", { years: v.wealth || {} });
  loadDoc("goals", { list: v.goals || [] });
  for (const [k, rows] of Object.entries(v.months))
    if (/^\d{4}-\d{2}$/.test(k) && Array.isArray(rows)) loadDoc("tx-" + k, { rows });
  indexTx();
  compileRules();
  pickDefaults();
  saveAll();
  S.backupMsg =
    "Back-up teruggezet in " + profileName() + ": " + S.tx.length + " transacties en " + S.rules.length + " regels.";
  render();
}

function viewImport(main) {
  const inp = el("input", {
    type: "file",
    id: "file",
    accept: ".xls,.xlsx,.csv,.txt,.tab",
    hidden: true,
    onchange: e => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = "";
    },
  });
  const drop = el(
    "div",
    {
      class: "drop",
      ondragover: e => {
        e.preventDefault();
        drop.classList.add("over");
      },
      ondragleave: () => drop.classList.remove("over"),
      ondrop: e => {
        e.preventDefault();
        drop.classList.remove("over");
        if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]);
      },
    },
    el("h2", {}, "Bankexport inlezen"),
    el(
      "div",
      { class: "prose" },
      "ABN AMRO, ING, Rabobank, bunq, Knab of een andere CSV. Dubbele transacties worden overgeslagen.",
    ),
    el("button", { class: "btn pri", onclick: () => inp.click() }, "Bestand kiezen"),
    inp,
  );
  main.append(drop);
  if (S.importMsg) {
    const u = S.tx.filter(t => catOf(t) === UNK).length;
    main.append(
      el(
        "div",
        { class: "note info", role: "status" },
        el(
          "span",
          {},
          S.importMsg + (u ? " " + nTx(u) + (u === 1 ? " heeft" : " hebben") + " nog geen categorie." : ""),
        ),
        S.tx.length
          ? el(
              "span",
              { class: "tools" },
              u ? aiButton() : null,
              el(
                "button",
                {
                  class: "btn sm",
                  onclick: () => {
                    S.tab = "overzicht";
                    go();
                  },
                },
                "Naar overzicht",
              ),
            )
          : null,
      ),
    );
  }
  const binp = el("input", {
    type: "file",
    id: "bfile",
    accept: ".json,application/json",
    hidden: true,
    onchange: e => {
      if (e.target.files[0]) restoreBackup(e.target.files[0]);
      e.target.value = "";
    },
  });
  main.append(
    el(
      "div",
      { class: "card", id: "backup-card" },
      el("h2", {}, "Back-up van " + profileName()),
      el("p", { class: "prose" }, "Je gegevens staan alleen op dit toestel. Maak af en toe een back-up."),
      el(
        "div",
        { class: "tools" },
        el(
          "button",
          { class: "btn", disabled: !S.tx.length && !S.rules.length, onclick: exportBackup },
          "Back-up maken",
        ),
        el("button", { class: "btn", onclick: () => binp.click() }, "Terugzetten"),
        binp,
      ),
      S.backupMsg ? el("div", { class: "note info", role: "status" }, S.backupMsg) : null,
    ),
    el(
      "div",
      { class: "card", id: "claude-card" },
      el("h2", {}, "Back-up naar Claude"),
      el(
        "p",
        { class: "prose" },
        "Stuur je back-up en een overzicht van al je transacties met categorie naar Claude, om vragen over je geldzaken te stellen. " +
          "Let op: de back-up bevat al je transacties, ook rekeningnummers in de omschrijving.",
      ),
      el(
        "div",
        { class: "tools" },
        el(
          "button",
          { class: "btn pri", id: "claude-btn", disabled: !S.tx.length, onclick: backupToClaude },
          "✨ Naar Claude",
        ),
      ),
      S.claudeMsg
        ? el(
            "div",
            { class: "note info", role: "status" },
            el("span", {}, S.claudeMsg.text),
            S.claudeMsg.link
              ? el(
                  "a",
                  { class: "btn sm", href: "https://claude.ai/new", target: "_blank", rel: "noopener" },
                  "Claude openen ↗",
                )
              : null,
          )
        : null,
    ),
  );
  const keys = Object.keys(S.months)
    .filter(k => S.months[k].length)
    .sort()
    .reverse();
  if (keys.length) {
    const lab = k => MONTHS[+k.slice(5) - 1].toLowerCase() + " " + k.slice(0, 4);
    main.append(
      el(
        "details",
        { class: "group fold" },
        el(
          "summary",
          {},
          "Ingelezen",
          el(
            "span",
            { class: "of" },
            keys.length === 1 ? lab(keys[0]) : lab(keys[keys.length - 1]) + " – " + lab(keys[0]),
          ),
        ),
        ...keys.map(k =>
          el(
            "div",
            { class: "frow" },
            el("span", {}, MONTHS_LONG[+k.slice(5) - 1] + " " + k.slice(0, 4)),
            el("span", { class: "num muted" }, S.months[k].length),
          ),
        ),
      ),
    );
  }
}
