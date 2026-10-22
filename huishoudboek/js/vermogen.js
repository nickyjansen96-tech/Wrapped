"use strict";
// Tabblad Vermogen: opbouw per maand met grafiek.
/* ---------- vermogen ---------- */
const WSER = [
  { k: "Betaalrekening", c: "var(--s1)" },
  { k: "Buffer", c: "var(--s2)" },
  { k: "Spaardoelen", c: "var(--s3)" },
  { k: "Pensioen of beleggingen", c: "var(--s4)", short: "Beleggingen" },
];
function wealthData(year) {
  const { T, cnt, span } = totals(year);
  const net = Array(13).fill(0);
  for (const t of S.tx) if (Math.floor(t.d / 10000) === year && counted(t)) net[Math.floor(t.d / 100) % 100] += t.a;
  let last = 0;
  for (let m = 12; m >= 1; m--)
    if (cnt[m]) {
      last = m;
      break;
    }
  const start = S.wealth[year] || {};
  const flow = m => WSER.map(s => (s.k === "Betaalrekening" ? net[m] : -((T[s.k] || [])[m] || 0)));
  const rows = [];
  let bal = WSER.map(s => +start[s.k] || 0);
  const begin = bal.reduce((a, b) => a + b, 0);
  for (let m = 1; m <= last; m++) {
    const f = flow(m);
    bal = bal.map((b, i) => b + f[i]);
    rows.push({ m, flow: f, bal: bal.slice(), total: bal.reduce((a, b) => a + b, 0) });
  }
  const inc = GROUPS[0].cats.reduce((s, c) => s + ((T[c] || [])[0] || 0), 0);
  return { rows, begin, last, inc, span };
}
function niceStep(range, n) {
  const raw = range / n,
    p = Math.pow(10, Math.floor(Math.log10(raw))),
    f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
const kfmt = v =>
  Math.abs(v) >= 1000
    ? "€ " + (v / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 }) + "k"
    : "€ " + Math.round(v);
function svg(tag, attrs, ...kids) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
function wealthChart(D) {
  const W = 720,
    H = 300,
    L = 52,
    R = 14,
    Tp = 22,
    B = 26,
    pw = W - L - R,
    ph = H - Tp - B;
  let hi = 0,
    lo = 0;
  for (const r of D.rows) {
    let p = 0,
      n = 0;
    r.bal.forEach(v => {
      if (v >= 0) p += v;
      else n += v;
    });
    hi = Math.max(hi, p);
    lo = Math.min(lo, n);
  }
  if (hi - lo < 1) hi = 1000;
  const step = niceStep(hi - lo, 4);
  hi = Math.ceil(hi / step) * step;
  lo = Math.floor(lo / step) * step;
  const y = v => Tp + ph * (1 - (v - lo) / (hi - lo)),
    slot = pw / 12,
    bw = Math.min(34, slot * 0.62);
  const root = svg("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "Vermogen per maand, gestapeld per onderdeel. De tabel hieronder bevat dezelfde cijfers.",
  });
  for (let v = lo; v <= hi + 1e-6; v += step) {
    root.append(svg("line", { class: Math.abs(v) < 1e-6 ? "zero" : "grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    const t = svg("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" });
    t.textContent = kfmt(v);
    root.append(t);
  }
  MONTHS.forEach((n, i) => {
    const t = svg("text", { x: L + slot * (i + 0.5), y: H - 8, "text-anchor": "middle" });
    t.textContent = n;
    root.append(t);
  });
  const wrap = el("div", { class: "chart" });
  const tip = el("div", { class: "tip", hidden: true });
  const show = (r, hit) => {
    tip.replaceChildren(
      el("b", {}, MONTHS_LONG[r.m - 1] + " " + S.year),
      ...WSER.map((s, i) =>
        el(
          "div",
          {},
          el("span", {}, el("i", { style: "background:" + s.c }), s.short || s.k),
          el("span", {}, eur0.format(r.bal[i])),
        ),
      ).reverse(),
      el("div", { class: "t" }, el("span", {}, "Totaal"), el("span", {}, eur0.format(r.total))),
    );
    tip.hidden = false;
    const cx = ((L + slot * (r.m - 0.5)) / W) * wrap.clientWidth,
      tw = tip.offsetWidth;
    tip.style.left =
      Math.max(0, Math.min(wrap.clientWidth - tw, cx > wrap.clientWidth / 2 ? cx - tw - 14 : cx + 14)) + "px";
    tip.style.top = "8px";
    root.querySelectorAll(".hit.on").forEach(h => h.classList.remove("on"));
    hit.classList.add("on");
  };
  const hide = () => {
    tip.hidden = true;
    root.querySelectorAll(".hit.on").forEach(h => h.classList.remove("on"));
  };
  for (const r of D.rows) {
    const x = L + slot * (r.m - 0.5) - bw / 2;
    let up = 0,
      dn = 0;
    const topIdx = r.bal.reduce((a, v, i) => (v > 0.5 ? i : a), -1);
    r.bal.forEach((v, i) => {
      if (Math.abs(v) < 0.5) return;
      let y0, y1;
      if (v > 0) {
        y0 = y(up);
        up += v;
        y1 = y(up);
      } else {
        y0 = y(dn);
        dn += v;
        y1 = y(dn);
      }
      const top = Math.min(y0, y1),
        h = Math.max(1, Math.abs(y1 - y0) - 2),
        rr = i === topIdx ? Math.min(4, h) : 0;
      const d = rr
        ? `M${x},${top + h}V${top + rr}a${rr},${rr} 0 0 1 ${rr},${-rr}H${x + bw - rr}a${rr},${rr} 0 0 1 ${rr},${rr}V${top + h}Z`
        : `M${x},${top + h}V${top}H${x + bw}V${top + h}Z`;
      root.append(svg("path", { d, fill: WSER[i].c }));
    });
    if (r.m === D.last) {
      const t = svg("text", { class: "tot", x: x + bw / 2, y: y(up) - 7, "text-anchor": "middle" });
      t.textContent = eur0.format(r.total);
      root.append(t);
    }
    const hit = svg("rect", {
      class: "hit",
      x: L + slot * (r.m - 1),
      y: Tp - 10,
      width: slot,
      height: ph + 10,
      rx: 6,
      tabindex: 0,
      "aria-label": MONTHS_LONG[r.m - 1] + ": totaal " + eur0.format(r.total),
    });
    hit.addEventListener("pointerenter", () => show(r, hit));
    hit.addEventListener("focus", () => show(r, hit));
    hit.addEventListener("click", () => show(r, hit));
    hit.addEventListener("blur", hide);
    root.append(hit);
  }
  root.addEventListener("pointerleave", hide);
  wrap.append(root, tip);
  return wrap;
}
function viewWealth(main) {
  if (!S.tx.length) {
    main.append(el("div", { class: "empty" }, "Nog geen transacties. Lees eerst je bankexport in bij Importeren."));
    return;
  }
  const D = wealthData(S.year);
  if (!D.rows.length) {
    main.append(el("div", { class: "empty" }, "Geen transacties in " + S.year + "."));
    return;
  }
  const end = D.rows[D.rows.length - 1],
    built = end.total - D.begin,
    saved = D.rows.reduce((s, r) => s + r.flow[1] + r.flow[2] + r.flow[3], 0);
  const stat = (l, v, cls, sub) =>
    el(
      "div",
      { class: "stat" },
      el("div", { class: "l" }, l),
      el("div", { class: "v " + (cls || "") }, v),
      sub ? el("div", { class: "s" }, sub) : null,
    );
  main.append(
    el(
      "div",
      { class: "card hero" },
      el("div", { class: "l" }, "Vermogen eind " + MONTHS_LONG[end.m - 1]),
      el("div", { class: "big" }, eur0.format(end.total)),
      el(
        "div",
        { class: "stats" },
        stat("Opgebouwd in " + S.year, (built > 0 ? "+" : "") + eur0.format(built), built < 0 ? "neg" : "pos"),
        stat("Per maand", eur0.format(built / D.span)),
        stat("Spaarquote", D.inc > 0 ? Math.round((saved / D.inc) * 100) + "%" : "–"),
      ),
    ),
  );
  main.append(
    el(
      "div",
      { class: "card" },
      el(
        "div",
        { class: "legend" },
        WSER.slice()
          .reverse()
          .map(s => el("span", {}, el("i", { style: "background:" + s.c }), s.short || s.k)),
      ),
      wealthChart(D),
    ),
  );
  const tw = el("div", { class: "tablewrap" });
  tw.append(
    el(
      "div",
      { class: "row head w5" },
      el("span", {}, ""),
      ...WSER.map(s => el("span", { class: "h" }, s.short || s.k)),
      el("span", { class: "h" }, "Stand"),
    ),
  );
  for (const r of D.rows)
    tw.append(
      el(
        "div",
        { class: "row w5" },
        el("span", { class: "name" }, MONTHS_LONG[r.m - 1]),
        ...r.flow.map(v =>
          el(
            "span",
            { class: "num " + (v < -0.5 ? "neg" : "") },
            Math.abs(v) < 0.5 ? "–" : (v > 0 ? "+" : "") + eur0.format(v),
          ),
        ),
        el("span", { class: "num" }, eur0.format(r.total)),
      ),
    );
  main.append(el("details", { class: "group fold" }, el("summary", {}, "Per maand"), tw));
  const st = S.wealth[S.year] || {};
  main.append(
    el(
      "details",
      { class: "group fold" },
      el(
        "summary",
        {},
        "Beginstand 1 januari " + S.year,
        el("span", { class: "of" }, D.begin ? eur0.format(D.begin) : "niet ingevuld"),
      ),
      el(
        "div",
        { class: "foldbody" },
        el(
          "p",
          { class: "prose" },
          "Wat stond er op 1 januari op je rekeningen? Dan toont de grafiek je hele vermogen, niet alleen de opbouw van dit jaar.",
        ),
        el(
          "div",
          { class: "starts" },
          WSER.map((s, i) =>
            el(
              "label",
              {},
              s.short || s.k,
              el("input", {
                id: "start-" + i,
                type: "text",
                inputmode: "decimal",
                placeholder: "0",
                value: st[s.k] ? String(st[s.k]).replace(".", ",") : "",
                onchange: e => {
                  (S.wealth[S.year] || (S.wealth[S.year] = {}))[s.k] = parseAmount(e.target.value);
                  saveWealth();
                  render();
                },
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
