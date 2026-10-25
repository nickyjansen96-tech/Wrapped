"use strict";
// Vaste indeling, gedeelde toestand en kleine hulpfuncties.
/* ---------- vaste indeling ---------- */
const GROUPS = [
  { name: "Inkomsten", kind: "in", cats: ["Salaris of uitkering", "Toeslagen", "Overige inkomsten"] },
  {
    name: "Vaste lasten",
    kind: "uit",
    cats: [
      "Wonen",
      "Energie en water",
      "Gemeentelijke en waterschapsbelastingen",
      "Verzekeringen",
      "Abonnementen",
      "Vervoer",
      "Kinderopvang en schoolkosten",
      "Aflossingen",
      "Bijdrage vastelastenrekening",
    ],
  },
  {
    name: "Variabele uitgaven",
    kind: "uit",
    cats: [
      "Boodschappen",
      "Brandstof, parkeren en OV",
      "Kleding en schoenen",
      "Persoonlijke verzorging",
      "Uit eten, uitgaan en hobby's",
      "Sport",
      "Cadeaus en donaties",
      "Huisdieren",
    ],
  },
  {
    name: "Reserveringen",
    kind: "uit",
    cats: [
      "Onderhoud huis, tuin en auto",
      "Vervanging inventaris en apparaten",
      "Eigen risico en zorgkosten",
      "Vakantie",
    ],
  },
  { name: "Sparen en beleggen", kind: "spaar", cats: ["Buffer", "Spaardoelen", "Pensioen of beleggingen"] },
];
const UNK = "Onbekend";
const ALLCATS = GROUPS.flatMap(g => g.cats);
const MONTHS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const MONTHS_LONG = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];
const APP_VERSION = "39";
const TABS = [
  "overzicht",
  "vergelijk",
  "samenvatting",
  "vermogen",
  "transacties",
  "regels",
  "importeren",
  "gebruikers",
];

/* ---------- toestand ---------- */
const S = {
  ready: false,
  tx: [],
  months: {},
  rules: [],
  overrides: {},
  budgets: {},
  wealth: {},
  goals: [],
  tab: "overzicht",
  year: null,
  month: 0,
  fCat: "",
  fText: "",
  fUnk: false,
  shown: 50,
  ruleFor: null,
  rFilter: "",
  importMsg: "",
  backupMsg: "",
  claudeMsg: null,
  ai: { text: "", sugg: null, msg: "" },
};
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k.startsWith("aria-")) e.setAttribute(k, String(v));
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
};
// Afgerond op hele euro's; -0 (bijv. van -0,30) wordt gewoon € 0.
const EUR0 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur0 = { format: v => EUR0.format(Math.round(v) || 0) };
const eur2 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const f0 = n => (Math.abs(n) < 0.5 ? "–" : eur0.format(n));
const nTx = n => n + (n === 1 ? " transactie" : " transacties");
// Buiten de overzichten: declaraties (voorgeschoten kosten die je terugkrijgt) en transacties die je niet wilt
// meetellen, zoals overboekingen tussen eigen rekeningen. Ze hebben geen budget en tellen niet mee in Over.
const DECL = "Declaraties",
  SKIP = "Niet meetellen";
const APART = { name: "Apart (telt niet mee)", cats: [DECL, SKIP] };
const CATSET = new Set([...ALLCATS, ...APART.cats]);
