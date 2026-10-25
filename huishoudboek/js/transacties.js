"use strict";
// Tabblad Transacties: lijst, details en regels maken vanuit een transactie.
// Alles wat er uit de bankomschrijving te halen is, voor de transactielijst en het detailpaneel.
const WD = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const titleCase = s => s.toLowerCase().replace(/(^|[\s\-'(])\p{L}/gu, m => m.toUpperCase());
function txInfo(t) {
  const raw = t.t,
    s = raw.replace(/\s+/g, " ").trim(),
    [name, desc] = partyOf(t);
  const f = re => {
    const m = re.exec(raw);
    return m ? m[1].trim() : "";
  };
  const iban = f(/\/IBAN\/([^/]+)/) || f(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]+)/);
  const kenmerk = f(/\/EREF\/([^/]+)/) || f(/Kenmerk:\s*(.+?)(?:\s{2,}|$)/);
  let time = (/\bTijd: (\d{2}:\d{2})/.exec(raw) || [])[1] || "",
    place = t.p || "";
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
// Snelknoppen in de details: als declaratie markeren of niet meetellen, en weer terug.
function apartTools(t) {
  const c = catOf(t),
    own = S.overrides[t.i];
  const set = v => {
    if (v) S.overrides[t.i] = v;
    else delete S.overrides[t.i];
    saveOverrides();
    render();
  };
  const btn = (label, v, id) => el("button", { class: "btn sm", id, onclick: () => set(v) }, label);
  return el(
    "div",
    { class: "tools apart" },
    APART.cats.includes(c)
      ? own === c
        ? btn(c === DECL ? "Geen declaratie" : "Weer meetellen", "", "apart-undo")
        : el("span", { class: "of" }, "Via een regel op " + c.toLowerCase() + " gezet.")
      : [btn("Declaratie", DECL, "apart-decl"), btn("Niet meetellen", SKIP, "apart-skip")],
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
    { class: "tx" + (open ? " open" : "") + (counted(t) ? "" : " apart") },
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
  if (open) row.append(txDetails(t, info), apartTools(t));
  if (S.ruleFor === t.i) row.append(ruleForm(t, info));
  return row;
}
// Sorteren van de transactielijst. Bij gelijke waarde staat de nieuwste bovenaan.
const TX_SORTS = [
  ["new", "Nieuwste"],
  ["old", "Oudste"],
  ["out", "Grootste uitgave"],
  ["in", "Grootste bijschrijving"],
  ["name", "Naam A–Z"],
  ["cat", "Categorie"],
];
const CAT_ORDER = new Map([...ALLCATS, ...APART.cats, UNK].map((c, i) => [c, i]));
function sortTx(list, how) {
  const byDate = (a, b) => b.d - a.d;
  if (how === "old") return list.slice().sort((a, b) => a.d - b.d);
  if (how === "out") return list.slice().sort((a, b) => a.a - b.a || byDate(a, b));
  if (how === "in") return list.slice().sort((a, b) => b.a - a.a || byDate(a, b));
  if (how === "name" || how === "cat") {
    const key = new Map(
      list.map(t => [t, how === "name" ? txInfo(t).name.toLowerCase() : (CAT_ORDER.get(catOf(t)) ?? 999)]),
    );
    const cmp =
      how === "name" ? (a, b) => key.get(a).localeCompare(key.get(b), "nl") : (a, b) => key.get(a) - key.get(b);
    return list.slice().sort((a, b) => cmp(a, b) || byDate(a, b));
  }
  return list.slice().sort(byDate);
}
// Eén knop "Sorteren: …" die een lijstje uitklapt; de gekozen optie heeft een vinkje.
function sortMenu() {
  if (sortMenu.cleanup) sortMenu.cleanup();
  const cur = S.txSort || "new",
    open = !!S.sortOpen;
  const close = () => {
    S.sortOpen = false;
    render();
  };
  const list = el(
    "div",
    { class: "sortlist", id: "sort-list", role: "menu", hidden: !open },
    TX_SORTS.map(([k, label]) =>
      el(
        "button",
        {
          role: "menuitemradio",
          "aria-checked": k === cur,
          "data-sort": k,
          onclick: () => {
            S.sortOpen = false;
            if (k === cur) return render();
            S.txSort = k;
            S.shown = 50;
            goKeep();
          },
        },
        el("span", { class: "tick", "aria-hidden": "true" }, k === cur ? "✓" : ""),
        label,
      ),
    ),
  );
  if (open)
    setTimeout(() => {
      // Dicht bij een tik ernaast of Esc; bij de volgende weergave worden deze luisteraars weer opgeruimd.
      const off = e => {
        if (!e.target.closest || !e.target.closest(".sortmenu")) close();
      };
      const esc = e => {
        if (e.key === "Escape") {
          close();
          $("#sort-btn")?.focus();
        }
      };
      document.addEventListener("click", off, true);
      document.addEventListener("keydown", esc, true);
      sortMenu.cleanup = () => {
        document.removeEventListener("click", off, true);
        document.removeEventListener("keydown", esc, true);
        sortMenu.cleanup = null;
      };
      // Past de lijst rechts niet in beeld, dan klapt hij naar links uit (rechts uitgelijnd met de knop).
      if (list.getBoundingClientRect().right > document.documentElement.clientWidth - 8) {
        list.style.left = "auto";
        list.style.right = "0";
      }
      list.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    });
  return el(
    "div",
    { class: "sortmenu" },
    el(
      "button",
      {
        class: "sortbtn",
        id: "sort-btn",
        "aria-haspopup": "true",
        "aria-expanded": open,
        "aria-controls": "sort-list",
        onclick: () => {
          S.sortOpen = !open;
          render();
        },
      },
      el("span", { class: "of" }, "Sorteren: "),
      TX_SORTS.find(([k]) => k === cur)[1],
      el("span", { class: "chev", "aria-hidden": "true" }, " ▾"),
    ),
    list,
  );
}
function viewTx(main) {
  const m = S.month,
    q = strip(S.fText);
  const inPeriod = S.tx.filter(t => Math.floor(t.d / 10000) === S.year && (!m || Math.floor(t.d / 100) % 100 === m));
  const unkCount = inPeriod.filter(t => catOf(t) === UNK).length;
  const list0 = inPeriod.filter(
    t =>
      (!S.fUnk || catOf(t) === UNK) &&
      (!S.fCat ||
        (S.fCat.startsWith("grp:")
          ? GROUPS.find(g => "grp:" + g.name === S.fCat)?.cats.includes(catOf(t))
          : catOf(t) === S.fCat)) &&
      (!q || (t.s || (t.s = strip(t.t))).includes(q)),
  );
  const list = sortTx(list0, S.txSort);
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
    el(
      "optgroup",
      { label: APART.name },
      APART.cats.map(c => el("option", { value: c, selected: c === S.fCat }, c)),
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
      sortMenu(),
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
