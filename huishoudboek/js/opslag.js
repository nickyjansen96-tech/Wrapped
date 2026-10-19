"use strict";
// Gebruikers en opslag in de browser (localStorage), laden en wisselen van gebruiker.
/* ---------- profielen ---------- */
// Gebruikers staan in de lijst hieronder; ieder heeft eigen gegevens onder "hhb:<id>:…". Nicky en Heleen zijn de beginlijst.
const USERS_KEY = "hhb-gebruikers",
  LAST_PROFILE = "hhb-profiel";
let PROFILES = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
    if (Array.isArray(v) && v.length && v.every(u => u && typeof u.id === "string" && typeof u.name === "string"))
      return v;
  } catch (e) {}
  return [
    { id: "nicky", name: "Nicky" },
    { id: "heleen", name: "Heleen" },
  ];
})();
function saveUsers() {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(PROFILES));
  } catch (e) {
    setSave("Gebruikers niet opgeslagen.", true);
  }
}
const nameTaken = (name, exceptId) =>
  PROFILES.some(p => p.id !== exceptId && p.name.trim().toLowerCase() === name.trim().toLowerCase());
function addUser(name) {
  const id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  PROFILES.push({ id, name: name.trim() });
  saveUsers();
  return id;
}
function userKeys(id) {
  const P = "hhb:" + id + ":",
    out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(P)) out.push(k);
    }
  } catch (e) {}
  return out;
}
function deleteUser(id) {
  if (PROFILES.length < 2) return;
  if (id === profile) {
    dropSaves();
  }
  for (const k of userKeys(id)) {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  }
  PROFILES = PROFILES.filter(p => p.id !== id);
  saveUsers();
  if (id === profile) setProfileQuiet(PROFILES[0].id);
}
let profile = (() => {
  try {
    const p = localStorage.getItem(LAST_PROFILE);
    if (PROFILES.some(x => x.id === p)) return p;
  } catch (e) {}
  return PROFILES[0].id;
})();
const profileName = () => PROFILES.find(p => p.id === profile).name;

/* ---------- opslag (lokaal op dit toestel, per profiel) ---------- */
const prefix = () => "hhb:" + profile + ":";
const store = {
  ok: (() => {
    try {
      localStorage.setItem("hhb-probe", "1");
      localStorage.removeItem("hhb-probe");
      return true;
    } catch (e) {
      return false;
    }
  })(),
  get(id) {
    try {
      const v = localStorage.getItem(prefix() + id);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },
  set(id, data) {
    localStorage.setItem(prefix() + id, JSON.stringify(data));
  },
  del(id) {
    try {
      localStorage.removeItem(prefix() + id);
    } catch (e) {}
  },
  keys() {
    const out = [],
      P = prefix();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(P)) out.push(k.slice(P.length));
      }
    } catch (e) {}
    return out;
  },
};
// Gegevens van vóór de profielen (sleutels "hhb:rules", "hhb:tx-…") gaan naar het eerste profiel.
function migrateLegacy() {
  try {
    const old = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("hhb:") && !k.slice(4).includes(":")) old.push(k);
    }
    for (const k of old) {
      const to = "hhb:" + PROFILES[0].id + ":" + k.slice(4);
      if (localStorage.getItem(to) == null) localStorage.setItem(to, localStorage.getItem(k));
      localStorage.removeItem(k);
    }
  } catch (e) {}
}
// Wijzigingen worden kort gebundeld en dan weggeschreven; bij wisselen van profiel of sluiten van de app direct.
const pend = {};
let saveTimer = 0;
function setSave(msg, err) {
  const s = $("#save");
  s.textContent = msg;
  s.classList.toggle("err", !!err);
}
function save(docId, getData) {
  if (!store.ok) return;
  pend[docId] = getData;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSaves, 300);
  setSave("Opslaan…");
}
function flushSaves() {
  clearTimeout(saveTimer);
  const ids = Object.keys(pend);
  if (!ids.length) return;
  try {
    for (const id of ids) {
      store.set(id, pend[id]());
      delete pend[id];
    }
    setSave("Opgeslagen");
  } catch (e) {
    setSave(
      e && e.name === "QuotaExceededError"
        ? "Opslag is vol; maak een back-up en verwijder oude maanden."
        : "Niet opgeslagen. Probeer het opnieuw.",
      true,
    );
  }
}
function dropSaves() {
  clearTimeout(saveTimer);
  for (const id of Object.keys(pend)) delete pend[id];
}
const saveOverrides = () => save("overrides", () => ({ map: S.overrides }));
const saveRules = () => save("rules", () => ({ list: S.rules.map(r => ({ k: r.k, c: r.c })) }));
const saveWealth = () => save("wealth", () => ({ years: S.wealth }));
const saveBudgets = () => save("budgets", () => ({ years: S.budgets }));
const saveMonth = key =>
  save("tx-" + key, () => ({ rows: S.months[key].map(t => ({ i: t.i, d: t.d, a: t.a, t: t.t })) }));
const saveAll = () => {
  saveOverrides();
  saveRules();
  saveWealth();
  saveBudgets();
  for (const k of Object.keys(S.months)) saveMonth(k);
};

function loadDoc(id, v) {
  v = v || {};
  if (id === "rules") S.rules = (v.list || []).map(r => ({ k: String(r.k ?? ""), c: String(r.c ?? ALLCATS[0]) }));
  else if (id === "overrides") S.overrides = Object.assign({}, v.map || {});
  else if (id === "wealth") S.wealth = JSON.parse(JSON.stringify(v.years || {}));
  else if (id === "budgets") S.budgets = JSON.parse(JSON.stringify(v.years || {}));
  else if (id.startsWith("tx-"))
    S.months[id.slice(3)] = (v.rows || [])
      .map(r => ({ i: String(r.i), d: +r.d, a: +r.a, t: String(r.t ?? "") }))
      .filter(r => r.d > 19000101 && r.d < 21001231 && Number.isFinite(r.a)); // kapotte regels (bijv. uit een beschadigde back-up) overslaan
}
function indexTx() {
  S.tx = Object.values(S.months)
    .flat()
    .sort((a, b) => b.d - a.d);
}
function resetData() {
  S.months = {};
  S.rules = [];
  S.overrides = {};
  S.budgets = {};
  S.wealth = {};
  S.tx = [];
  Object.assign(S, {
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
    ai: { text: "", sugg: null, msg: "" },
    editBudget: false,
    showEmpty: false,
    txOpen: null,
    txMsg: "",
  });
}
function loadProfile() {
  resetData();
  if (store.ok) {
    for (const id of store.keys()) loadDoc(id, store.get(id));
  }
  indexTx();
  compileRules();
  pickDefaults();
  document.title = "Huishoudboek · " + profileName();
}
function switchProfile(id) {
  if (id === profile) return;
  flushSaves();
  profile = id;
  try {
    localStorage.setItem(LAST_PROFILE, id);
  } catch (e) {}
  loadProfile();
  if (!S.tx.length) S.tab = "importeren";
  setSave("");
  go();
}
function setProfileQuiet(id) {
  flushSaves();
  profile = id;
  try {
    localStorage.setItem(LAST_PROFILE, id);
  } catch (e) {}
  loadProfile();
  setSave("");
}
function boot() {
  migrateLegacy();
  loadProfile();
  if (!store.ok) setSave("Opslaan is in deze browser niet beschikbaar; wijzigingen blijven niet bewaard.", true);
  try {
    navigator.storage?.persist?.();
  } catch (e) {}
  S.ready = true;
  const h = location.hash.slice(1) === "budgetten" ? "overzicht" : location.hash.slice(1);
  if (TABS.includes(h)) S.tab = h;
  else if (!S.tx.length) S.tab = "importeren";
  const st = history.state;
  if (st && st.profile === profile && (TABS.includes(st.tab) || st.tab === "budgetten")) restoreView(st);
  try {
    history.replaceState(viewState((st && st.n) || 0), "", "#" + S.tab);
  } catch (e) {}
  render();
}
