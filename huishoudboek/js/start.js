"use strict";
// Navigatie (terug-knop, tabbladen) en het starten van de app. Laatste script.
/* ---------- navigatie en terug ---------- */
// Elke paginawissel komt in de browsergeschiedenis, zodat Terug (knop of veeggebaar) naar de vorige pagina gaat,
// inclusief profiel, gekozen periode, filters en scrollpositie.
function viewState(n) {
  return {
    n,
    profile,
    tab: S.tab,
    year: S.year,
    month: S.month,
    fCat: S.fCat,
    fUnk: S.fUnk,
    fText: S.fText,
    cmpQ: S.cmpQ || 0,
    txSort: S.txSort || "new",
    editBudget: !!S.editBudget,
    foldCmp: !!S.foldCmp,
    foldSum: !!S.foldSum,
    scroll: 0,
  };
}
function restoreView(st) {
  Object.assign(S, {
    tab: st.tab === "budgetten" ? "overzicht" : st.tab,
    fCat: st.fCat || "",
    fUnk: !!st.fUnk,
    fText: st.fText || "",
    cmpQ: st.cmpQ || 0,
    txSort: st.txSort || "new",
    editBudget: !!st.editBudget,
    foldCmp: !!st.foldCmp,
    foldSum: !!st.foldSum,
    shown: 50,
    ruleFor: null,
  });
  if (st.year != null) S.year = st.year;
  if (st.month != null) S.month = st.month;
}
// Zelfde pagina, andere stand (uitklappen, kwartaal): wel in de geschiedenis, maar blijf op dezelfde plek staan.
function goKeep() {
  try {
    const prev = history.state || viewState(0);
    history.replaceState({ ...prev, scroll: window.scrollY }, "");
    history.pushState(viewState((prev.n || 0) + 1), "", "#" + S.tab);
  } catch (e) {}
  render();
}
function go() {
  try {
    const prev = history.state || viewState(0);
    history.replaceState({ ...prev, scroll: window.scrollY }, "");
    history.pushState(viewState((prev.n || 0) + 1), "", "#" + S.tab);
  } catch (e) {}
  render();
  window.scrollTo(0, 0);
}
addEventListener("popstate", e => {
  const st = e.state;
  if (!st || !(TABS.includes(st.tab) || st.tab === "budgetten")) {
    const h = location.hash.slice(1);
    if (TABS.includes(h)) {
      S.tab = h;
      render();
    }
    return;
  }
  if (st.profile && st.profile !== profile && PROFILES.some(p => p.id === st.profile)) setProfileQuiet(st.profile);
  restoreView(st);
  render();
  window.scrollTo(0, st.scroll || 0);
});
$("#back").addEventListener("click", () => history.back());
$("#help").addEventListener("click", startTour);
// Menu met de onderdelen, rechtsboven naast de profielen: openklappen, kiezen, en dicht bij een tik ernaast of Esc.
function setMenu(open) {
  $("#tabs").hidden = !open;
  $("#menu-btn").setAttribute("aria-expanded", String(open));
  if (open) {
    // Rechts uitlijnen met de knop; past dat niet (knop staat links na omslaan van de kop), dan links.
    const t = $("#tabs");
    t.style.left = t.style.right = "";
    if (t.getBoundingClientRect().left < 8) {
      t.style.left = "0";
      t.style.right = "auto";
    }
  }
  if (open) ($('#tabs button[aria-selected="true"]') || $("#tabs button")).focus({ preventScroll: true });
}
$("#menu-btn").addEventListener("click", () => setMenu($("#tabs").hidden));
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  setMenu(false);
  if (b.dataset.tab !== S.tab) {
    S.tab = b.dataset.tab;
    go();
  }
});
document.addEventListener("click", e => {
  if (!$("#tabs").hidden && !e.target.closest(".menu")) setMenu(false);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#tabs").hidden) {
    setMenu(false);
    $("#menu-btn").focus();
  }
});
addEventListener("pagehide", flushSaves);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flushSaves();
});
if ("serviceWorker" in navigator && location.protocol !== "file:")
  navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .then(r => r.update())
    .catch(() => {});
boot();
// Eerste keer: rondleiding starten (niet als er al gegevens zijn van vóór deze versie).
try {
  if (!localStorage.getItem(TOUR_KEY)) {
    if (S.tx.length || S.rules.length) localStorage.setItem(TOUR_KEY, "1");
    else setTimeout(startTour, 300);
  }
} catch (e) {}
