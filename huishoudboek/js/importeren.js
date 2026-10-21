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
    months: Object.fromEntries(Object.entries(S.months).map(([k, rows]) => [k, rows.map(txStore)])),
  };
}
async function exportBackup() {
  flushSaves();
  const slug =
    profileName()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "gebruiker";
  const name = "huishoudboek-" + slug + "-" + new Date().toISOString().slice(0, 10) + ".json";
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
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  S.backupMsg = "Back-up opgeslagen als " + name + ".";
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
  main.append(
    el(
      "p",
      { class: "prose foot" },
      "Versie " + APP_VERSION + " · ",
      el("button", { class: "linkbtn small", onclick: startTour }, "Rondleiding bekijken"),
    ),
  );
}
