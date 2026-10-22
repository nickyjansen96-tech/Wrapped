"use strict";
// Tabblad Regels en AI: regels laten maken door een AI-chat en regels beheren.
/* ---------- regels laten maken door een AI-chat (Claude, ChatGPT, …) ---------- */
// De app maakt een vraag met de tegenpartijen zonder categorie; die plak je in een AI-chat naar keuze en het antwoord
// plak je terug. Rekeningnummers, pasnummers en kenmerken worden eerst uit de omschrijvingen gehaald.
function txType(t) {
  const s = t.replace(/\s+/g, " ");
  if (/^BEA\b|Betaalautomaat/.test(s)) return "betaalpas";
  if (/^GEA\b|Geldautomaat/.test(s)) return "geldautomaat";
  if (/^eCom\b/.test(s) || (/Kaartnr:/.test(s) && /Online bankieren/i.test(s))) return "online met betaalpas";
  if (/iDEAL/i.test(s)) return "iDEAL";
  if (/Tikkie/i.test(s)) return "Tikkie";
  if (/SEPA Incasso|\/TRTP\/SEPA Incasso|Incasso/i.test(s)) return "automatische incasso";
  if (/Periodieke overb/i.test(s)) return "periodieke overboeking";
  if (/Overboeking|Overschrijving|Online bankieren|Verzamelbetaling|\/TRTP\/SEPA OVERBOEKING/i.test(s))
    return "overboeking";
  if (/^ABN AMRO|Kosten|Rente|Diversen/i.test(s)) return "bankkosten of rente";
  if (/Kaartnr:/.test(s)) return "betaalpas";
  return "overig";
}
function cleanDesc(t) {
  return t
    .replace(/\/TRTP\/[^/]*|\/IBAN\/[^/]*|\/BIC\/[^/]*|\/EREF\/[^/]*|\/MARF\/[^/]*|\/CSID\/[^/]*/g, " ")
    .replace(/\bKaartnr:\s*[\d* ]+/g, " ")
    .replace(/\b(?:Datum\/Tijd|Valutadatum|Datum):\s*[\d-]+(?:\s[\d:]+)?/g, " ")
    .replace(/\bTijd:\s*[\d:]+/g, " ")
    .replace(/\b(?:Machtiging ID|Incassant ID|Transactie|Term|RRN|Koers|Opslag)\s*:\s*\S+(?:\s+EUR)?/g, " ")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "")
    .replace(/\b(IBAN|BIC|Kenmerk|Machtiging|Incassant|Betalingskenm\.?|ID debiteur|EREF|MARF|CSID)\s*:\s*\S+/gi, " ")
    .replace(/,?PAS\d+/g, " ")
    .replace(/\bNR:\S+/g, " ")
    .replace(/\d{2}\.\d{2}\.\d{2}\/\d{2}[.:]\d{2}/g, " ")
    .replace(/\/(NAME|REMI)\//g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s,/g, ",")
    .trim()
    .slice(0, 160);
}
const nlAmt = v => (v < 0 ? "-" : "") + Math.abs(v).toFixed(2).replace(".", ",");
function aiPrompt(max = 150) {
  const groups = new Map();
  // Filialen samen nemen: "Jumbo 55" en "Jumbo 12" worden één tegenpartij "Jumbo".
  for (const t of S.tx) {
    if (catOf(t) !== UNK) continue;
    const [full] = partyOf(t);
    const name = full.replace(/\s+\d{1,5}$/, "") || full,
      key = strip(name);
    const g = groups.get(key) || { name, type: txType(t.t), n: 0, sum: 0, min: t.d, max: t.d, ex: new Set() };
    g.n++;
    g.sum += t.a;
    g.min = Math.min(g.min, t.d);
    g.max = Math.max(g.max, t.d);
    if (g.ex.size < 3) g.ex.add(cleanDesc(t.t));
    groups.set(key, g);
  }
  const all = [...groups.values()].sort((a, b) => b.n - a.n || Math.abs(b.sum) - Math.abs(a.sum)),
    list = all.slice(0, max);
  if (!list.length) return null;
  const per = g => {
    const f = d => MONTHS[(Math.floor(d / 100) % 100) - 1].toLowerCase() + " " + Math.floor(d / 10000);
    return g.min === g.max || f(g.min) === f(g.max) ? f(g.min) : f(g.min) + "–" + f(g.max);
  };
  const lines = list.map(
    (g, i) =>
      i +
      1 +
      ". " +
      g.name +
      " | " +
      g.type +
      " | " +
      g.n +
      "× | gemiddeld € " +
      nlAmt(g.sum / g.n) +
      " | totaal € " +
      nlAmt(g.sum) +
      " | " +
      per(g) +
      "\n   omschrijving: " +
      [...g.ex].map(e => '"' + e + '"').join(" ; "),
  );
  const cats =
    GROUPS.map(g => "- " + g.name + ": " + g.cats.join(" · ")).join("\n") +
    "\n- Apart (telt niet mee in het overzicht): Declaraties (alleen voor partijen die altijd een declaratie zijn, zoals de terugbetaling van onkosten door mijn werkgever; losse voorgeschoten aankopen markeer ik zelf) · Niet meetellen (bijv. overboekingen tussen mijn eigen betaalrekeningen)";
  const have = S.rules.length
    ? S.rules
        .slice(0, 100)
        .map(r => r.k + " | " + r.c)
        .join("\n")
    : "(nog geen)";
  return [
    "Ik houd een huishoudboekje bij voor mijn Nederlandse bankrekening. Help me regels te maken die mijn transacties automatisch in een categorie zetten.",
    "",
    "Zo werkt een regel: als het trefwoord ergens in de omschrijving van een transactie staat, krijgt die transactie de categorie. Hoofdletters en spaties tellen niet mee; * is een joker (bijv. Albert*Heijn).",
    '- Kies trefwoorden die de partij herkennen, ook bij toekomstige betalingen: laat filiaalnummers, plaatsen, datums en bedragen weg (dus "Albert Heijn", niet "Albert Heijn 1234").',
    '- Maak ze niet zo kort dat ze andere partijen raken (dus niet "AH" of "Shell" als dat ook in andere namen voorkomt).',
    "- Min is geld eruit, plus is geld erin. Overboekingen naar mijn eigen spaarrekening horen bij Buffer of Spaardoelen; terugbetalingen (bijv. Tikkie) bij de categorie van de uitgave.",
    "- Weet je echt niet wat iets is? Sla het dan over en noem het kort onder je antwoord.",
    "",
    "Gebruik alleen deze categorieën, precies zo geschreven:",
    cats,
    "",
    "Regels die ik al heb (trefwoord | categorie):",
    have,
    "",
    "Tegenpartijen zonder categorie" +
      (all.length > max ? " (de " + max + " meest voorkomende van " + all.length + ")" : "") +
      " — naam | soort betaling | aantal | gemiddeld bedrag | totaal | periode, met voorbeelden van de omschrijving:",
    ...lines,
    "",
    "Geef je antwoord als één codeblok met één regel per trefwoord, in deze vorm:",
    "```\nAlbert Heijn | Boodschappen\nNetflix | Abonnementen\n```",
  ].join("\n");
}

// Leest het antwoord van een AI-chat. Werkt met de gevraagde vorm (trefwoord | categorie), maar ook met JSON (ook met
// kleine fouten), tabellen en lijstjes met pijlen, en met categorieën die net iets anders gespeld zijn.
const normCat = s =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const CATNORM = new Map([...CATSET].map(c => [normCat(c), c]));
function matchCat(s) {
  const n = normCat(s);
  if (!n) return null;
  if (CATNORM.has(n)) return CATNORM.get(n);
  const hits = [...CATSET].filter(c => {
    const m = normCat(c);
    return m.startsWith(n) || n.startsWith(m) || (n.length >= 5 && m.includes(n));
  });
  return hits.length === 1 ? hits[0] : null;
}
function aiPairs(text) {
  const t = String(text)
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’‚′]/g, "'")
    .replace(/\r/g, "");
  const tryJson = src => {
    const i = src.search(/[[{]/);
    if (i < 0) return null;
    const j = Math.max(src.lastIndexOf("}"), src.lastIndexOf("]"));
    if (j < i) return null;
    try {
      return JSON.parse(src.slice(i, j + 1).replace(/,\s*([}\]])/g, "$1"));
    } catch (e) {
      return null;
    }
  };
  const fromJson = v => {
    const out = [];
    const walk = x => {
      if (Array.isArray(x)) {
        for (const y of x) {
          if (Array.isArray(y) && y.length >= 2 && typeof y[0] === "string") out.push([y[0], String(y[1])]);
          else if (y && typeof y === "object") {
            const k = y.trefwoord ?? y.keyword ?? y.k ?? y.zoekterm ?? y.term;
            const c = y.categorie ?? y.category ?? y.c;
            if (k != null && c != null) out.push([String(k), String(c)]);
            else walk(y);
          }
        }
        return;
      }
      if (x && typeof x === "object")
        for (const [k, v] of Object.entries(x)) {
          if (/^(regels|rules|items|data)$/i.test(k)) {
            walk(v);
            continue;
          }
          if (Array.isArray(v) && v.every(e => typeof e === "string") && matchCat(k)) {
            for (const e of v) out.push([e, k]);
          } else if (typeof v === "string") out.push(matchCat(v) || !matchCat(k) ? [k, v] : [v, k]);
          else walk(v);
        }
    };
    walk(v);
    return out;
  };
  const blocks = [...t.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)].map(m => m[1]);
  for (const src of [...blocks, t]) {
    const v = tryJson(src);
    if (v) {
      const r = fromJson(v);
      if (r.length) return r;
    }
  }
  const out = [];
  for (const src of blocks.length ? blocks : [t]) {
    for (let line of src.split("\n")) {
      line = line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/`|\*\*/g, "")
        .trim();
      if (!line) continue;
      if (/^\|?\s*:?-{2,}/.test(line)) continue;
      let parts = line.includes("|") ? line.replace(/^\||\|$/g, "").split("|") : line.split(/\s*(?:→|->|=>|\t|;)\s*/),
        loose = false;
      if (parts.length < 2) {
        const m = /^(.+?):\s+(.+)$/.exec(line);
        if (m) {
          parts = [m[1], m[2]];
          loose = true;
        }
      }
      parts = parts.map(x => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      if (parts.length < 2) continue;
      if (/^(trefwoord|keyword|zoekterm)$/i.test(parts[0]) && /^(categorie|category)$/i.test(parts[1])) continue;
      if (loose && !blocks.length && !matchCat(parts[parts.length - 1])) continue; // "x: y" in lopende tekst alleen met een echte categorie
      out.push([parts[0], parts[parts.length - 1]]);
    }
  }
  return out;
}
function parseAI(text) {
  const pairs = aiPairs(text);
  if (!pairs.length) return null;
  const have = new Set(S.rules.map(r => strip(r.k))),
    seen = new Set(),
    out = [];
  for (const [k0, c0] of pairs) {
    const k = k0.trim(),
      c = matchCat(c0),
      sk = strip(k);
    if (sk.length < 2 || seen.has(sk)) continue;
    seen.add(sk);
    out.push({ k, c: c || ALLCATS[0], ok: !!c && !have.has(sk), known: have.has(sk), badCat: !c, raw: c0 });
  }
  return out.length ? out : null;
}
function suggestionHits(sg) {
  const c = compileOne(sg);
  let n = 0;
  for (const t of S.tx) if (catOf(t) === UNK && matches(c, t)) n++;
  return n;
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {}
  try {
    const ta = el("textarea", { style: "position:fixed;opacity:0" }, text);
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}
function readAnswer(text) {
  const r = parseAI(text);
  if (!r) {
    S.ai.msg =
      "Hierin vond de app geen regels. Kopieer het hele antwoord van de AI-chat, of vraag om een codeblok met één regel per trefwoord: trefwoord | categorie.";
  } else {
    for (const x of r) x.hits = suggestionHits(x);
    S.ai.sugg = r;
    S.ai.msg = "";
  }
  render();
}
const AI_CHATS = [
  { name: "Claude", url: "https://claude.ai/new" },
  { name: "ChatGPT", url: "https://chatgpt.com/" },
];
// Knop die vanaf elk scherm naar "Laat AI indelen" gaat.
function goAI() {
  S.tab = "regels";
  S.ai.msg = "";
  go();
}
const aiButton = (label = "Laat AI indelen", cls = "btn sm pri") =>
  el("button", { class: cls, onclick: goAI }, "✨ " + label);
function viewAI(main) {
  const unk = S.tx.filter(t => catOf(t) === UNK).length,
    prompt = unk ? aiPrompt() : null,
    sg = S.ai.sugg;
  const card = el(
    "div",
    { class: "card ai", id: "ai-card" },
    el(
      "div",
      { class: "aihead" },
      el("span", { class: "aiicon", "aria-hidden": "true" }, "✨"),
      el(
        "div",
        {},
        el("h2", {}, "Transacties laten indelen door AI"),
        el(
          "div",
          { class: "prose" },
          !S.tx.length
            ? "Lees eerst je bankexport in; daarna kan een AI-chat zoals Claude of ChatGPT regels voor je maken."
            : unk
              ? nTx(unk) +
                (unk === 1 ? " heeft" : " hebben") +
                " nog geen categorie. Een AI-chat zoals Claude of ChatGPT maakt er regels voor, in drie stappen."
              : "Alle transacties hebben een categorie. Lees je nieuwe transacties in; daarna kun je hier weer regels laten maken.",
        ),
      ),
    ),
  );
  if (S.ai.msg) card.append(el("div", { class: "note info", role: "status" }, S.ai.msg));
  if (prompt && !sg) {
    const step = (n, title, ...body) =>
      el(
        "div",
        { class: "aistep" },
        el("span", { class: "aino" }, n),
        el("div", { class: "aibody" }, el("div", { class: "aititle" }, title), ...body),
      );
    card.append(
      step(
        1,
        "Kopieer de vraag",
        el(
          "div",
          { class: "tools" },
          el(
            "button",
            {
              class: "btn pri",
              onclick: async () => {
                const ok = await copyText(prompt);
                S.ai.msg = ok
                  ? "Gekopieerd! Ga nu naar stap 2."
                  : "Kopiëren lukte niet; selecteer de vraag hieronder en kopieer hem zelf.";
                S.ai.showPrompt = !ok;
                render();
              },
            },
            "Vraag kopiëren",
          ),
          navigator.share
            ? el(
                "button",
                {
                  class: "btn",
                  onclick: async () => {
                    try {
                      await navigator.share({ text: prompt });
                    } catch (e) {}
                  },
                },
                "Delen",
              )
            : null,
          el(
            "button",
            {
              class: "linkbtn",
              onclick: () => {
                S.ai.showPrompt = !S.ai.showPrompt;
                render();
              },
            },
            S.ai.showPrompt ? "Vraag verbergen" : "Wat wordt gedeeld?",
          ),
        ),
        S.ai.showPrompt
          ? el(
              "p",
              { class: "prose" },
              "Per tegenpartij: naam, soort betaling, aantal, bedragen, periode en voorbeelden van de omschrijving. Rekeningnummers, pasnummers en kenmerken worden weggelaten.",
            )
          : null,
        S.ai.showPrompt
          ? el(
              "textarea",
              {
                class: "txt area",
                readonly: true,
                rows: 10,
                "aria-label": "Vraag voor de AI-chat",
                onfocus: e => e.target.select(),
              },
              prompt,
            )
          : null,
      ),
      step(
        2,
        "Plak hem in een nieuw gesprek met een AI-chat en kopieer het antwoord",
        el(
          "div",
          { class: "tools" },
          ...AI_CHATS.map(c =>
            el("a", { class: "btn", href: c.url, target: "_blank", rel: "noopener" }, c.name + " openen ↗"),
          ),
        ),
      ),
      step(
        3,
        "Plak het antwoord hier",
        el(
          "textarea",
          {
            class: "txt area",
            id: "ai-answer",
            rows: 3,
            placeholder: "Plak hier het antwoord van de AI-chat",
            "aria-label": "Antwoord van de AI-chat",
            oninput: e => {
              S.ai.text = e.target.value;
            },
          },
          S.ai.text,
        ),
        el(
          "div",
          { class: "tools" },
          navigator.clipboard && navigator.clipboard.readText
            ? el(
                "button",
                {
                  class: "btn pri",
                  onclick: async () => {
                    try {
                      const t = await navigator.clipboard.readText();
                      if (t) {
                        S.ai.text = t;
                        readAnswer(t);
                        return;
                      }
                    } catch (e) {}
                    S.ai.msg = "Plakken lukte niet; houd het vak ingedrukt, kies Plakken en tik op Antwoord inlezen.";
                    render();
                  },
                },
                "Plakken en inlezen",
              )
            : null,
          el("button", { class: "btn", onclick: () => readAnswer(S.ai.text) }, "Antwoord inlezen"),
        ),
      ),
    );
  }
  if (sg) {
    const sec = el("section", { class: "group sugg" });
    for (const x of sg) {
      sec.append(
        el(
          "div",
          { class: "rule" },
          el(
            "label",
            { class: "pick" },
            el("input", {
              type: "checkbox",
              checked: x.ok,
              "aria-label": "Regel gebruiken",
              onchange: e => {
                x.ok = e.target.checked;
                render();
              },
            }),
            el("input", {
              class: "txt",
              value: x.k,
              "aria-label": "Trefwoord",
              onchange: e => {
                x.k = e.target.value;
                x.hits = suggestionHits(x);
                render();
              },
            }),
          ),
          catSelect(
            x.badCat ? "" : x.c,
            v => {
              x.c = v;
              if (x.badCat) {
                x.badCat = false;
                x.ok = !x.known;
              }
              render();
            },
            x.badCat ? { auto: UNK } : {},
          ),
          el(
            "span",
            {
              class: "num muted",
              title: x.known
                ? "Bestaat al"
                : x.badCat
                  ? "Onbekende categorie: " + x.raw
                  : "Aantal transacties zonder categorie dat deze regel raakt",
            },
            x.known ? "bestaat" : x.badCat ? "?" : x.hits + "×",
          ),
        ),
      );
    }
    const n = sg.filter(x => x.ok && x.k.trim() && !x.badCat).length,
      bad = sg.filter(x => x.badCat).length;
    card.append(
      el(
        "div",
        { class: "prose" },
        sg.length +
          (sg.length === 1 ? " voorstel" : " voorstellen") +
          (bad ? "; bij " + bad + " moet je zelf een categorie kiezen." : ". Vink uit wat je niet wilt."),
      ),
      sec,
      el(
        "div",
        { class: "tools" },
        el(
          "button",
          {
            class: "btn pri",
            disabled: !n,
            onclick: () => {
              const add = sg.filter(x => x.ok && x.k.trim() && !x.badCat).map(x => ({ k: x.k.trim(), c: x.c }));
              const before = S.tx.filter(t => catOf(t) === UNK).length;
              S.rules.push(...add);
              compileRules();
              saveRules();
              const after = S.tx.filter(t => catOf(t) === UNK).length;
              S.ai = {
                text: "",
                sugg: null,
                msg:
                  add.length +
                  (add.length === 1 ? " regel" : " regels") +
                  " toegevoegd; " +
                  nTx(before - after) +
                  " ingedeeld" +
                  (after ? ", " + after + " nog niet. Herhaal de stappen voor de rest." : "."),
              };
              render();
            },
          },
          n + (n === 1 ? " regel" : " regels") + " toevoegen",
        ),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              S.ai = { text: "", sugg: null, msg: "" };
              render();
            },
          },
          "Annuleren",
        ),
      ),
    );
  }
  main.append(card);
}

function viewRules(main) {
  viewAI(main);
  for (const t of S.tx) autoCat(t);
  const hits = new Map();
  for (const t of S.tx) if (t.hit) hits.set(t.hit, (hits.get(t.hit) || 0) + 1);
  let nc = "";
  const nk = el("input", { class: "txt grow", id: "addrule-k", placeholder: "Trefwoord, bijv. Albert Heijn" });
  const add = () => {
    const k = nk.value.trim();
    if (!k) return;
    if (!nc) {
      alert("Kies eerst een categorie.");
      return;
    }
    S.rules.unshift({ k, c: nc });
    compileRules();
    saveRules();
    render();
  };
  nk.addEventListener("keydown", e => {
    if (e.key === "Enter") add();
  });
  main.append(
    el(
      "div",
      { class: "addrule" },
      nk,
      catSelect(
        nc,
        v => {
          nc = v;
        },
        { auto: UNK },
      ),
      el("button", { class: "btn pri", onclick: add }, "Toevoegen"),
    ),
  );
  if (S.rules.length > 15 || S.rFilter)
    main.append(
      el(
        "div",
        { class: "tools field" },
        el("input", {
          id: "rfilter",
          class: "grow",
          type: "search",
          placeholder: "Zoek in " + S.rules.length + " regels",
          value: S.rFilter,
          oninput: e => {
            S.rFilter = e.target.value;
            clearTimeout(viewRules.t);
            viewRules.t = setTimeout(() => {
              render();
              const i = $("#rfilter");
              i.focus();
              i.setSelectionRange(i.value.length, i.value.length);
            }, 250);
          },
        }),
      ),
    );
  const q = S.rFilter.toLowerCase();
  const sec = el("section", { class: "group" });
  if (S.rules.length)
    sec.append(
      el(
        "div",
        { class: "ghead" },
        el("span", {}, S.rules.length + (S.rules.length === 1 ? " regel" : " regels")),
        el("span", { class: "of" }, "bovenste regel gaat voor"),
      ),
    );
  S.rules.forEach((r, idx) => {
    if (q && !(r.k.toLowerCase().includes(q) || r.c.toLowerCase().includes(q))) return;
    sec.append(
      el(
        "div",
        { class: "rule" },
        el("input", {
          class: "txt",
          value: r.k,
          "aria-label": "Trefwoord",
          onchange: e => {
            r.k = e.target.value;
            compileRules();
            saveRules();
            render();
          },
        }),
        catSelect(r.c, v => {
          r.c = v;
          compileRules();
          saveRules();
          render();
        }),
        el("span", { class: "num muted", title: "Aantal transacties dat deze regel raakt" }, (hits.get(r) || 0) + "×"),
        el(
          "span",
          { class: "acts" },
          idx > 0
            ? el(
                "button",
                {
                  class: "icon",
                  title: "Naar boven (voorrang)",
                  "aria-label": "Regel naar boven",
                  onclick: () => {
                    S.rules.splice(idx, 1);
                    S.rules.unshift(r);
                    compileRules();
                    saveRules();
                    render();
                  },
                },
                "↑",
              )
            : el("span", { class: "icon-sp" }),
          el(
            "button",
            {
              class: "icon",
              title: "Verwijderen",
              "aria-label": "Regel verwijderen",
              onclick: () => {
                S.rules.splice(idx, 1);
                compileRules();
                saveRules();
                render();
              },
            },
            "×",
          ),
        ),
      ),
    );
  });
  if (!S.rules.length) sec.append(el("div", { class: "empty" }, "Nog geen regels."));
  else if (sec.children.length === 1) sec.append(el("div", { class: "empty" }, "Geen regels gevonden."));
  main.append(sec);
}
