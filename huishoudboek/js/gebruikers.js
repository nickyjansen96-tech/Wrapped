"use strict";
// Profielen (gebruikers) toevoegen, een andere naam geven en verwijderen.
/* ---------- gebruikers ---------- */
function viewUsers(main) {
  const nin = el("input", {
    class: "txt grow",
    id: "newuser",
    placeholder: "Naam",
    autocomplete: "off",
    "aria-label": "Naam nieuwe gebruiker",
  });
  const add = () => {
    const n = nin.value.trim();
    if (!n) return;
    if (nameTaken(n)) {
      S.userMsg = "Er is al een gebruiker met de naam " + n + ".";
      render();
      return;
    }
    const id = addUser(n);
    S.userMsg = "";
    switchProfile(id);
  };
  nin.addEventListener("keydown", e => {
    if (e.key === "Enter") add();
  });
  main.append(
    el(
      "div",
      { class: "card" },
      el("h2", {}, "Profiel toevoegen"),
      el("p", { class: "prose" }, "Iedere gebruiker heeft eigen transacties, regels, budgetten en vermogen."),
      el("div", { class: "addrule" }, nin, el("button", { class: "btn pri", onclick: add }, "Toevoegen")),
    ),
  );
  if (S.userMsg) main.append(el("div", { class: "note", role: "status" }, S.userMsg));
  const sec = el(
    "section",
    { class: "group" },
    el(
      "div",
      { class: "ghead" },
      el("span", {}, PROFILES.length + (PROFILES.length === 1 ? " profiel" : " profielen")),
      el("span", { class: "of" }, "op dit toestel"),
    ),
  );
  for (const p of PROFILES) {
    const cur = p.id === profile,
      n = userKeys(p.id).filter(k => k.includes(":tx-")).length;
    const rename = v => {
      v = v.trim();
      if (!v || nameTaken(v, p.id)) {
        S.userMsg = v ? "Er is al een gebruiker met de naam " + v + "." : "Een naam mag niet leeg zijn.";
        render();
        return;
      }
      const old = p.name;
      p.name = v;
      saveUsers();
      S.userMsg = old === v ? "" : old + " heet nu " + v + ".";
      S.editUser = null;
      if (cur) document.title = "Huishoudboek · " + v;
      render();
    };
    let name;
    if (S.editUser === p.id) {
      const inp = el("input", {
        class: "txt",
        id: "rename-" + p.id,
        value: p.name,
        autocomplete: "off",
        "aria-label": "Nieuwe naam voor " + p.name,
        onkeydown: e => {
          if (e.key === "Enter") rename(e.target.value);
          if (e.key === "Escape") {
            S.editUser = null;
            render();
          }
        },
      });
      setTimeout(() => inp.focus());
      name = el(
        "span",
        { class: "uedit" },
        inp,
        el("button", { class: "btn sm pri", onclick: () => rename(inp.value) }, "Opslaan"),
        el(
          "button",
          {
            class: "btn sm",
            onclick: () => {
              S.editUser = null;
              render();
            },
          },
          "Annuleren",
        ),
      );
    } else
      name = el(
        "span",
        { class: "uname" },
        el("b", {}, p.name),
        el(
          "button",
          {
            class: "linkbtn",
            "aria-label": "Naam van " + p.name + " wijzigen",
            onclick: () => {
              S.editUser = p.id;
              S.userMsg = "";
              render();
            },
          },
          "✎ Naam wijzigen",
        ),
      );
    sec.append(
      el(
        "div",
        { class: "urow" },
        name,
        el(
          "span",
          { class: "of" },
          cur ? "actief" : n ? n + (n === 1 ? " maand" : " maanden") + " ingelezen" : "nog leeg",
        ),
        el(
          "span",
          { class: "acts" },
          cur
            ? el("span", { class: "icon-sp" })
            : el(
                "button",
                {
                  class: "btn sm",
                  onclick: () => {
                    S.userMsg = "";
                    S.tab = "overzicht";
                    switchProfile(p.id);
                  },
                },
                "Openen",
              ),
          PROFILES.length > 1
            ? el(
                "button",
                {
                  class: "icon",
                  title: "Verwijderen",
                  "aria-label": "Gebruiker " + p.name + " verwijderen",
                  onclick: () => {
                    if (
                      !confirm(
                        "Gebruiker " +
                          p.name +
                          " en al diens gegevens van dit toestel verwijderen? Maak eerst een back-up als je die nog wilt bewaren.",
                      )
                    )
                      return;
                    deleteUser(p.id);
                    S.userMsg = p.name + " is verwijderd.";
                    render();
                  },
                },
                "×",
              )
            : null,
        ),
      ),
    );
  }
  main.append(sec);
}
