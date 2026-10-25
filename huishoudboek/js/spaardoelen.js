"use strict";
// Spaardoelen: een naam, doelbedrag, wat je al hebt en eventueel een streefmaand. Koppel je een trefwoord, dan tellen
// overboekingen met dat trefwoord vanaf het aanmaken van het doel mee (geld naar je spaarrekening telt op, opnemen
// telt af). De app rekent uit hoeveel je per maand nog moet sparen om op tijd te zijn.

const today = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};
// Transacties die bij een doel horen: trefwoord in de tekst, op of na de startdatum.
function goalTx(g) {
  if (!g.key.trim()) return [];
  const k = strip(g.key);
  return S.tx.filter(t => t.d >= g.since && (t.s || (t.s = strip(t.t))).includes(k));
}
function goalState(g) {
  const linked = goalTx(g).reduce((s, t) => s - t.a, 0),
    saved = g.start + linked,
    left = Math.max(0, g.target - saved);
  let months = null,
    perMonth = null;
  if (g.date) {
    const now = new Date(),
      [y, m] = g.date.split("-").map(Number);
    months = (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1)) + 1; // de streefmaand telt mee
    perMonth = months > 0 ? left / months : null;
  }
  return { saved, linked, left, pct: g.target > 0 ? Math.min(1, Math.max(0, saved / g.target)) : 0, months, perMonth };
}
const monthLabel = ym => {
  const [y, m] = ym.split("-").map(Number);
  return MONTHS_LONG[m - 1] + " " + y;
};

function goalForm(g) {
  const isNew = !g,
    v = g || { name: "", target: 0, start: 0, date: "", key: "" };
  const inp = (id, label, attrs) =>
    el("label", { class: "gfield" }, el("span", {}, label), el("input", { class: "txt", id, ...attrs }));
  const hits = el("div", { class: "of", id: "goal-hits" }),
    msg = el("div", { class: "note", role: "status", hidden: true });
  const count = () => {
    const key = $("#goal-key").value.trim();
    if (!key) return hits.replaceChildren("Optioneel: dan tellen overboekingen met dit trefwoord vanzelf mee.");
    const n = goalTx({ key, since: g ? g.since : today() }).length;
    hits.replaceChildren(
      g
        ? n + (n === 1 ? " transactie" : " transacties") + " sinds het begin van dit doel."
        : "Telt overboekingen vanaf vandaag; nu al " + goalTx({ key, since: 0 }).length + " in je transacties.",
    );
  };
  const save = () => {
    const name = $("#goal-name").value.trim(),
      target = parseAmount($("#goal-target").value);
    if (!name || !target) {
      msg.hidden = false; // niet opnieuw opbouwen, anders is wat je al typte weg
      msg.textContent = "Vul een naam en een doelbedrag in.";
      return;
    }
    const rec = {
      id: g ? g.id : "g" + Date.now().toString(36),
      name,
      target,
      start: parseAmount($("#goal-start").value),
      since: g ? g.since : today(),
      date: $("#goal-date").value || "",
      key: $("#goal-key").value.trim(),
    };
    if (g) Object.assign(g, rec);
    else S.goals.push(rec);
    saveGoals();
    S.goalEdit = null;
    render();
  };
  const form = el(
    "div",
    { class: "goalform", id: "goal-form" },
    el("h3", {}, isNew ? "Nieuw spaardoel" : "Spaardoel aanpassen"),
    el(
      "div",
      { class: "ggrid" },
      inp("goal-name", "Naam", { value: v.name, placeholder: "Bijv. Vakantie", autocomplete: "off" }),
      inp("goal-target", "Doelbedrag (€)", { value: fmtIn(v.target), inputmode: "decimal", placeholder: "2.000" }),
      inp("goal-start", "Al gespaard (€)", { value: fmtIn(v.start), inputmode: "decimal", placeholder: "0" }),
      inp("goal-date", "Klaar in (optioneel)", { type: "month", value: v.date }),
      inp("goal-key", "Koppelen aan trefwoord (optioneel)", {
        value: v.key,
        placeholder: "Bijv. Spaarrekening Vakantie",
        autocomplete: "off",
        oninput: count,
      }),
    ),
    hits,
    msg,
    el(
      "div",
      { class: "tools" },
      el("button", { class: "btn pri", id: "goal-save", onclick: save }, isNew ? "Toevoegen" : "Opslaan"),
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            S.goalEdit = null;
            render();
          },
        },
        "Annuleren",
      ),
    ),
  );
  setTimeout(count);
  return form;
}

function goalRow(g) {
  const st = goalState(g);
  if (S.goalEdit === g.id) return goalForm(g);
  const lines = [eur0.format(st.saved) + " van " + eur0.format(g.target) + " · " + Math.round(st.pct * 100) + "%"];
  if (st.left < 0.5) lines.push("Doel gehaald!");
  else if (g.date)
    lines.push(
      st.months > 0
        ? "Nog " +
            eur0.format(st.left) +
            " vóór " +
            monthLabel(g.date) +
            ": " +
            eur0.format(st.perMonth) +
            " per maand (" +
            st.months +
            (st.months === 1 ? " maand)" : " maanden)")
        : "Streefmaand " + monthLabel(g.date) + " is voorbij; nog " + eur0.format(st.left) + " te gaan",
    );
  else lines.push("Nog " + eur0.format(st.left) + " te gaan");
  if (g.key) lines.push("Gekoppeld aan “" + g.key + "”: " + (st.linked >= 0 ? "+" : "") + eur0.format(st.linked));
  return el(
    "div",
    { class: "goal" + (st.left < 0.5 ? " done" : ""), "data-goal": g.name },
    el(
      "div",
      { class: "gtop" },
      el("b", {}, g.name),
      el(
        "span",
        { class: "acts" },
        el(
          "button",
          {
            class: "linkbtn",
            "aria-label": "Spaardoel " + g.name + " aanpassen",
            onclick: () => {
              S.goalEdit = g.id;
              render();
            },
          },
          "Aanpassen",
        ),
        el(
          "button",
          {
            class: "icon",
            title: "Verwijderen",
            "aria-label": "Spaardoel " + g.name + " verwijderen",
            onclick: () => {
              if (!confirm("Spaardoel " + g.name + " verwijderen?")) return;
              S.goals = S.goals.filter(x => x !== g);
              saveGoals();
              render();
            },
          },
          "×",
        ),
      ),
    ),
    el("div", { class: "pbar" }, el("i", { style: "width:" + Math.round(st.pct * 100) + "%" })),
    ...lines.map((l, i) => el("div", { class: i ? "of" : "gnum" }, l)),
  );
}

function goalsCard() {
  const Y = new Date().getFullYear(),
    m = new Date().getMonth() + 1;
  const need = S.goals.reduce((s, g) => s + (goalState(g).perMonth || 0), 0),
    budget = budgetOf(Y, "Spaardoelen", m);
  const card = el(
    "div",
    { class: "card", id: "goals-card" },
    el(
      "div",
      { class: "herotop" },
      el(
        "div",
        {},
        el("h2", {}, "Spaardoelen"),
        el(
          "div",
          { class: "prose" },
          S.goals.length
            ? "Wat je al hebt, wat er nog bij moet en hoeveel per maand."
            : "Spaar je ergens voor, zoals een vakantie of een nieuwe auto? Zet het hier als doel.",
        ),
      ),
      S.goalEdit === "new"
        ? null
        : el(
            "button",
            {
              class: "btn sm pri",
              id: "goal-add",
              onclick: () => {
                S.goalEdit = "new";
                render();
              },
            },
            "＋ Spaardoel",
          ),
    ),
  );
  if (S.goalEdit === "new") card.append(goalForm(null));
  for (const g of S.goals) card.append(goalRow(g));
  if (need >= 0.5)
    card.append(
      el(
        "div",
        { class: "gsum" },
        "Nodig per maand voor je doelen: ",
        el("b", {}, eur0.format(need)),
        budget >= 0.5
          ? " · budget Spaardoelen deze maand " + eur0.format(budget) + (budget + 0.5 < need ? " (te weinig)" : "")
          : " · nog geen budget voor Spaardoelen",
      ),
    );
  return card;
}
