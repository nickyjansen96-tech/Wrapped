"use strict";
// Tabblad Transacties: lijst, details en regels maken vanuit een transactie.
// Alles wat er uit de bankomschrijving te halen is, voor de transactielijst en het detailpaneel.
const WD = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const titleCase = s => s.toLowerCase().replace(/(^|[\s\-'(])\p{L}/gu, m => m.toUpperCase());
function txInfo(t) {
  const raw = t.t,
    s = raw.replace(/\s+/g, " ").trim(),
    [name, desc] = who(raw);
  const f = re => {
    const m = re.exec(raw);
    return m ? m[1].trim() : "";
  };
  const iban = f(/\/IBAN\/([^/]+)/) || f(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]+)/);
  const kenmerk = f(/\/EREF\/([^/]+)/) || f(/Kenmerk:\s*(.+?)(?:\s{2,}|$)/);
  let time = "",
    place = "";
  const m = /\d{2}\.\d{2}\.\d{2}\/(\d{2})[.:](\d{2})\s*(.*)$/.exec(s);
  if (m) {
    time = m[1] + ":" + m[2];
    place = titleCase(m[3].replace(/,?\s*Land:.*$/i, "").trim());
  }
  let type = txType(raw);
  if (/Apple Pay/i.test(raw)) type += " (Apple Pay)";
  else if (/Google Pay/i.test(raw)) type += " (Google Pay)";
  const y = Math.floor(t.d / 10000),
    mo = Math.floor(t.d / 100) % 100,
    d = t.d % 100,
    wd = new Date(y, mo - 1, d).getDay();
  return { name, desc, iban, kenmerk, time, place, type, full: s, wd, d, mo, y };
}
function catSource(t) {
  if (S.overrides[t.i] && CATSET.has(S.overrides[t.i])) return "zelf gekozen";
  const a = autoCat(t);
  return a === UNK ? "nog geen categorie" : "via regel “" + t.hit.k + "”";
}
function ruleForm(t, info) {
  let rc = catOf(t) === UNK ? "" : catOf(t);
  const cnt = el("div", { class: "of", id: "rule-hits" });
  const kin = el("input", {
    class: "txt",
    id: "newrule-k",
    value: info.name.replace(/\s+\d{1,5}$/, ""),
    "aria-label": "Trefwoord",
    autocomplete: "off",
  });
  const upd = () => {
    const k = kin.value.trim();
    if (strip(k).length < 2) {
      cnt.textContent = "";
      return;
    }
    const c = compileOne({ k, c: "" });
    let n = 0,
      u = 0;
    for (const x of S.tx)
      if (matches(c, x)) {
        n++;
        if (catOf(x) === UNK) u++;
      }
    cnt.textContent = "Raakt " + nTx(n) + (u ? ", waarvan " + u + " nu zonder categorie" : "") + ".";
  };
  kin.addEventListener("input", upd);
  upd();
  const save = () => {
    const k = kin.value.trim();
    if (!k) return;
    if (!rc) {
      alert("Kies eerst een categorie.");
      return;
    }
    const before = S.tx.filter(x => catOf(x) === UNK).length;
    S.rules.unshift({ k, c: rc });
    compileRules();
    saveRules();
    S.txMsg =
      "Regel “" +
      k +
      "” → " +
      rc +
      " opgeslagen; " +
      nTx(before - S.tx.filter(x => catOf(x) === UNK).length) +
      " ingedeeld.";
    S.ruleFor = null;
    render();
  };
  kin.addEventListener("keydown", e => {
    if (e.key === "Enter") save();
  });
  return el(
    "div",
    { class: "mk" },
    el("div", { class: "mkhead" }, "Regel maken"),
    el(
      "p",
      { class: "prose" },
      "Alle transacties waarvan de omschrijving dit woord bevat, krijgen voortaan automatisch deze categorie, ook transacties die je later inleest.",
    ),
    el(
      "div",
      { class: "mkrow" },
      el("label", {}, "Als de omschrijving bevat", kin),
      el(
        "label",
        {},
        "dan categorie",
        catSelect(
          rc,
          v => {
            rc = v;
          },
          { auto: UNK },
        ),
      ),
    ),
    cnt,
    el(
      "div",
      { class: "mkbtns" },
      el(
        "button",
        {
          class: "btn sm",
          onclick: () => {
            S.ruleFor = null;
            render();
          },
        },
        "Annuleren",
      ),
      el("button", { class: "btn sm pri", onclick: save }, "Regel opslaan"),
    ),
  );
}
function txDetails(t, info) {
  const row = (k, v) => (v ? [el("dt", {}, k), el("dd", {}, v)] : []);
  return el(
    "dl",
    { class: "txdet" },
    ...row(
      "Datum",
      WD[info.wd] +
        " " +
        info.d +
        " " +
        MONTHS_LONG[info.mo - 1] +
        " " +
        info.y +
        (info.time ? " om " + info.time : ""),
    ),
    ...row("Soort", info.type.charAt(0).toUpperCase() + info.type.slice(1)),
    ...row("Plaats", info.place),
    ...row("Tegenrekening", info.iban),
    ...row("Omschrijving", info.desc),
    ...row("Kenmerk", info.kenmerk),
    ...row("Categorie", catOf(t) === UNK ? "Nog geen categorie" : catOf(t) + " (" + catSource(t) + ")"),
    el("dt", {}, "Bankomschrijving"),
    el("dd", { class: "raw" }, info.full),
  );
}
function txRow(t) {
  const info = txInfo(t),
    auto = autoCat(t),
    man = S.overrides[t.i] && CATSET.has(S.overrides[t.i]) ? S.overrides[t.i] : "",
    open = S.txOpen === t.i;
  const sel = catSelect(
    man,
    v => {
      if (v) S.overrides[t.i] = v;
      else delete S.overrides[t.i];
      saveOverrides();
      render();
    },
    { auto, cls: man ? "man" : auto === UNK ? "unk" : "" },
  );
  const sub = [
    info.type.charAt(0).toUpperCase() + info.type.slice(1),
    info.place,
    info.time,
    info.place ? "" : info.desc,
  ]
    .filter(Boolean)
    .join(" · ");
  const row = el(
    "div",
    { class: "tx" + (open ? " open" : "") },
    el(
      "button",
      {
        class: "txmain",
        "aria-expanded": open,
        title: "Details tonen",
        onclick: () => {
          S.txOpen = open ? null : t.i;
          render();
        },
      },
      el(
        "span",
        { class: "date" },
        el("b", {}, String(info.d)),
        el("span", {}, MONTHS[info.mo - 1].toLowerCase()),
        el("span", { class: "wd" }, WD[info.wd].slice(0, 2)),
      ),
      el("span", { class: "txt" }, el("span", { class: "who" }, info.name), el("span", { class: "det" }, sub)),
      el("span", { class: "num amt " + (t.a < 0 ? "" : "pos") }, eur2.format(t.a)),
    ),
    el("div", { class: "txcat" }, sel, el("span", { class: "src" }, catSource(t))),
    el(
      "button",
      {
        class: "rulebtn",
        "aria-expanded": S.ruleFor === t.i,
        "aria-label": "Regel maken voor " + info.name,
        title: "Regel maken: vergelijkbare transacties krijgen voortaan automatisch deze categorie",
        onclick: () => {
          S.ruleFor = S.ruleFor === t.i ? null : t.i;
          render();
        },
      },
      "＋ Regel",
    ),
  );
  if (open) row.append(txDetails(t, info));
  if (S.ruleFor === t.i) row.append(ruleForm(t, info));
  return row;
}
function viewTx(main) {
  const m = S.month,
    q = strip(S.fText);
  const inPeriod = S.tx.filter(t => Math.floor(t.d / 10000) === S.year && (!m || Math.floor(t.d / 100) % 100 === m));
  const unkCount = inPeriod.filter(t => catOf(t) === UNK).length;
  const list = inPeriod.filter(
    t =>
      (!S.fUnk || catOf(t) === UNK) &&
      (!S.fCat ||
        (S.fCat.startsWith("grp:")
          ? GROUPS.find(g => "grp:" + g.name === S.fCat)?.cats.includes(catOf(t))
          : catOf(t) === S.fCat)) &&
      (!q || (t.s || (t.s = strip(t.t))).includes(q)),
  );
  const fsel = el(
    "select",
    {
      id: "fcat",
      "aria-label": "Filter op categorie",
      onchange: e => {
        S.fCat = e.target.value;
        S.shown = 50;
        render();
      },
    },
    el("option", { value: "" }, "Alle categorieën"),
    GROUPS.map(g =>
      el(
        "optgroup",
        { label: g.name },
        el("option", { value: "grp:" + g.name, selected: S.fCat === "grp:" + g.name }, "Alle " + g.name.toLowerCase()),
        g.cats.map(c => el("option", { value: c, selected: c === S.fCat }, c)),
      ),
    ),
  );
  main.append(
    el(
      "div",
      { class: "tools field" },
      el("input", {
        id: "ftext",
        class: "grow",
        type: "search",
        placeholder: "Zoek op naam, plaats of omschrijving",
        value: S.fText,
        oninput: e => {
          S.fText = e.target.value;
          S.shown = 50;
          clearTimeout(viewTx.t);
          viewTx.t = setTimeout(() => {
            render();
            const i = $("#ftext");
            i.focus();
            i.setSelectionRange(i.value.length, i.value.length);
          }, 250);
        },
      }),
      fsel,
      unkCount || S.fUnk
        ? el(
            "button",
            {
              class: "chip toggle",
              id: "funk",
              "aria-pressed": S.fUnk,
              onclick: () => {
                S.fUnk = !S.fUnk;
                S.shown = 50;
                render();
              },
            },
            "Zonder categorie (" + unkCount + ")",
          )
        : null,
    ),
  );
  if (S.txMsg) {
    main.append(
      el(
        "div",
        { class: "note info", role: "status" },
        el("span", {}, S.txMsg),
        el(
          "button",
          {
            class: "btn sm",
            onclick: () => {
              S.txMsg = "";
              render();
            },
          },
          "OK",
        ),
      ),
    );
  }
  const allUnk = S.tx.filter(t => catOf(t) === UNK).length;
  if (allUnk)
    main.append(
      el(
        "div",
        { class: "note" },
        el(
          "span",
          {},
          "In totaal " +
            nTx(allUnk) +
            " zonder categorie. Laat een AI-chat zoals Claude of ChatGPT regels maken, of kies hieronder zelf.",
        ),
        aiButton(),
      ),
    );
  const sum = list.reduce((s, t) => s + t.a, 0),
    uit = list.filter(t => t.a < 0).reduce((s, t) => s + t.a, 0),
    bij = list.filter(t => t.a > 0).reduce((s, t) => s + t.a, 0);
  if (!list.length) {
    main.append(el("div", { class: "empty" }, "Geen transacties voor deze selectie."));
    return;
  }
  const sec = el("section", { class: "group" });
  sec.append(
    el(
      "div",
      { class: "ghead txhead" },
      el("span", {}, nTx(list.length)),
      el(
        "span",
        { class: "num" },
        el("span", { class: "of" }, "bij " + eur0.format(bij) + " · af " + eur0.format(-uit) + " · netto "),
        eur2.format(sum),
      ),
    ),
    el(
      "p",
      { class: "prose txtip" },
      "Tik op een transactie voor alle details. Met ",
      el("b", {}, "＋ Regel"),
      " krijgen vergelijkbare transacties voortaan vanzelf dezelfde categorie.",
    ),
  );
  for (const t of list.slice(0, S.shown)) sec.append(txRow(t));
  main.append(sec);
  if (list.length > S.shown)
    main.append(
      el(
        "button",
        {
          class: "linkbtn",
          onclick: () => {
            S.shown += 200;
            render();
          },
        },
        "Meer tonen (" + (list.length - S.shown) + ")",
      ),
    );
}
