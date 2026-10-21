"use strict";
// Rondleiding met tooltips bij het eerste gebruik.
/* ---------- rondleiding ---------- */
// Een rondleiding met tooltips voor wie de app voor het eerst opent. Elke stap kan een tabblad openen en wijst een
// onderdeel aan; ontbreekt dat onderdeel, dan staat de uitleg midden in beeld. Bij "?" start hij opnieuw.
const TOUR_KEY = "hhb-rondleiding-gezien";
const TOUR = [
  {
    title: "Welkom bij je Huishoudboek",
    text: "In een paar stappen laten we zien hoe het werkt. Alles wat je invult blijft op dit toestel; er gaat niets naar een server.",
  },
  {
    target: "#profiles",
    title: "Wie ben jij?",
    text: "Kies hier je naam. Iedere gebruiker heeft eigen transacties, budgetten en regels. Met + voeg je gebruikers toe of pas je ze aan.",
  },
  {
    target: "#tabs",
    title: "De onderdelen",
    text: "Met deze tabbladen ga je naar je overzicht en budget, je vermogen, je transacties, je regels en het inlezen van bankbestanden.",
  },
  {
    tab: "importeren",
    target: ".drop .btn.pri",
    title: "1. Lees je bankexport in",
    text: "Download bij je bank je transacties (ABN AMRO, ING, Rabobank, bunq, Knab: Excel, CSV of TXT) en kies dat bestand hier. Je mag overlappende periodes inlezen; dubbele transacties worden overgeslagen.",
  },
  {
    tab: "transacties",
    target: "#tabs [data-tab=transacties]",
    title: "2. Controleer je transacties",
    text: "Hier zie je alles wat je hebt ingelezen, met soort betaling, plaats en omschrijving. Tik op een transactie voor alle details. Kies een categorie, of tik op ＋ Regel zodat vergelijkbare transacties voortaan vanzelf goed gaan.",
  },
  {
    tab: "regels",
    target: "#ai-card",
    title: "3. Laat AI je transacties indelen",
    text: "In het tabblad Regels en AI maakt een AI-chat zoals Claude of ChatGPT regels voor je, in drie stappen: vraag kopiëren, in de chat plakken, antwoord terugplakken. De knop ✨ Laat AI indelen brengt je hier vanaf elk scherm.",
  },
  {
    tab: "overzicht",
    target: "#budget-btn",
    title: "4. Vul je budget in",
    text: "In een tabel met een rij per categorie en een kolom per maand. Bij Elke maand vul je één bedrag in voor het hele jaar.",
  },
  {
    tab: "overzicht",
    target: ".hero",
    title: "5. Zie hoe je ervoor staat",
    text: "Bovenaan staat wat er over is in de gekozen maand of het jaar. Daaronder per categorie wat je uitgaf ten opzichte van je budget; rood betekent erover. Met Vergelijk per maand zie je per post en per maand hoe je op budget zit.",
  },
  {
    tab: "importeren",
    target: "#backup-card",
    title: "Maak af en toe een back-up",
    text: "Je gegevens staan alleen op dit toestel. Met een back-up raak je niets kwijt en kun je overstappen naar een ander toestel.",
  },
  {
    target: "#help",
    title: "Klaar!",
    text: "Begin met het inlezen van je bankexport. Deze rondleiding kun je altijd opnieuw bekijken met de ?-knop.",
  },
];
let tourIdx = -1,
  tourBack = null,
  tourEls = null;
function startTour() {
  if (tourIdx >= 0) return;
  tourBack = S.tab;
  tourIdx = 0;
  const shade = el("div", { class: "tour-shade", "aria-hidden": "true" }),
    spot = el("div", { class: "tour-spot", "aria-hidden": "true" });
  const tip = el("div", {
    class: "tour-tip",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "tour-title",
    "aria-describedby": "tour-text",
  });
  document.body.append(shade, spot, tip);
  tourEls = { shade, spot, tip };
  addEventListener("resize", placeTour);
  addEventListener("scroll", placeTour, true);
  document.addEventListener("keydown", tourKey, true);
  showTourStep();
}
function endTour() {
  if (tourIdx < 0) return;
  tourIdx = -1;
  for (const e of Object.values(tourEls)) e.remove();
  tourEls = null;
  removeEventListener("resize", placeTour);
  removeEventListener("scroll", placeTour, true);
  document.removeEventListener("keydown", tourKey, true);
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch (e) {}
  const back = S.tx.length ? tourBack : "importeren";
  if (back && S.tab !== back) {
    S.tab = back;
    tourNav();
  }
  $("#help")?.focus();
}
// Wisselt van tabblad zonder extra stappen in de terug-geschiedenis.
function tourNav() {
  try {
    history.replaceState({ ...(history.state || viewState(0)), tab: S.tab }, "", "#" + S.tab);
  } catch (e) {}
  render();
}
function tourKey(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    endTour();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    tourStep(1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    tourStep(-1);
  } else if (e.key === "Tab") {
    const f = [...tourEls.tip.querySelectorAll("button")];
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
}
function tourStep(d) {
  const n = tourIdx + d;
  if (n < 0) return;
  if (n >= TOUR.length) {
    endTour();
    return;
  }
  tourIdx = n;
  showTourStep();
}
function showTourStep() {
  const st = TOUR[tourIdx],
    last = tourIdx === TOUR.length - 1;
  if (st.tab && S.tab !== st.tab) {
    S.tab = st.tab;
    if (st.tab === "overzicht") S.editBudget = false;
    tourNav();
  }
  const t = st.target && document.querySelector(st.target);
  if (t) t.scrollIntoView({ block: "center", inline: "nearest" });
  const { tip } = tourEls;
  tip.replaceChildren(
    el("div", { class: "tour-count" }, tourIdx + 1 + " van " + TOUR.length),
    el("h2", { id: "tour-title" }, st.title),
    el("p", { id: "tour-text" }, st.text),
    el(
      "div",
      { class: "tour-btns" },
      last ? el("span") : el("button", { class: "linkbtn", onclick: endTour }, "Overslaan"),
      el(
        "span",
        { class: "tour-nav" },
        tourIdx ? el("button", { class: "btn", onclick: () => tourStep(-1) }, "Vorige") : null,
        el(
          "button",
          { class: "btn pri", id: "tour-next", onclick: () => tourStep(1) },
          last ? "Aan de slag" : tourIdx ? "Volgende" : "Rondleiding starten",
        ),
      ),
    ),
  );
  placeTour();
  $("#tour-next").focus({ preventScroll: true });
}
function placeTour() {
  if (tourIdx < 0) return;
  const st = TOUR[tourIdx],
    { spot, tip, shade } = tourEls,
    t = st.target && document.querySelector(st.target);
  const vw = innerWidth,
    vh = innerHeight,
    pad = 6,
    gap = 12,
    tw = Math.min(360, vw - 32);
  tip.style.width = tw + "px";
  const r = t && t.getClientRects().length ? t.getBoundingClientRect() : null;
  if (!r) {
    spot.hidden = true;
    shade.hidden = false;
    tip.classList.add("center");
    tip.style.left = Math.round((vw - tw) / 2) + "px";
    tip.style.top = Math.round(Math.max(16, (vh - tip.offsetHeight) / 2)) + "px";
    return;
  }
  shade.hidden = true;
  spot.hidden = false;
  tip.classList.remove("center");
  Object.assign(spot.style, {
    left: r.left - pad + "px",
    top: r.top - pad + "px",
    width: r.width + pad * 2 + "px",
    height: r.height + pad * 2 + "px",
  });
  const th = tip.offsetHeight,
    below = r.bottom + pad + gap + th <= vh - 8,
    top = below ? r.bottom + pad + gap : Math.max(8, r.top - pad - gap - th);
  const left = Math.min(vw - tw - 16, Math.max(16, r.left + r.width / 2 - tw / 2));
  tip.style.top = Math.round(top) + "px";
  tip.style.left = Math.round(left) + "px";
  tip.dataset.side = below ? "below" : "above";
  tip.style.setProperty("--arrow", Math.round(Math.min(tw - 24, Math.max(24, r.left + r.width / 2 - left))) + "px");
}
