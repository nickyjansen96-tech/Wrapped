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
    scroll: 0,
  };
}
function restoreView(st) {
  Object.assign(S, {
    tab: st.tab === "budgetten" ? "overzicht" : st.tab,
    fCat: st.fCat || "",
    fUnk: !!st.fUnk,
    fText: st.fText || "",
    shown: 50,
    ruleFor: null,
  });
  if (st.year != null) S.year = st.year;
  if (st.month != null) S.month = st.month;
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
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]");
  if (b && b.dataset.tab !== S.tab) {
    S.tab = b.dataset.tab;
    go();
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
