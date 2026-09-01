// Blisss — Prospect naar Livegang: frontend (geen framework, vanilla JS).

const app = document.getElementById('app');
let procesCache = null; // { fases, stappen } — statische procesdefinitie, één keer opgehaald.

// --- Helpers -----------------------------------------------------------

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDatum(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function vandaagIso() {
  return new Date().toISOString().slice(0, 10);
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fout bij ${method} ${url}`);
  return data;
}

async function laadProces() {
  if (!procesCache) procesCache = await api('GET', '/api/proces');
  return procesCache;
}

function laatstGebruikteNaam() {
  try { return localStorage.getItem('blisss_naam') || ''; } catch { return ''; }
}
function onthoudNaam(naam) {
  try { localStorage.setItem('blisss_naam', naam); } catch { /* negeren */ }
}

// --- Router --------------------------------------------------------------

async function render() {
  const hash = location.hash || '#/';
  document.querySelectorAll('.topnav a').forEach((a) => a.classList.remove('active'));

  try {
    if (hash === '#/proces') {
      document.querySelector('[data-nav="proces"]').classList.add('active');
      await renderProcesReferentie();
    } else if (hash.startsWith('#/traject/')) {
      document.querySelector('[data-nav="trajecten"]').classList.add('active');
      const id = hash.slice('#/traject/'.length);
      await renderTrajectDetail(id);
    } else {
      document.querySelector('[data-nav="trajecten"]').classList.add('active');
      await renderDashboard();
    }
  } catch (err) {
    app.innerHTML = `<div class="empty-state">Er ging iets mis: ${escapeHtml(err.message)}</div>`;
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

// --- Dashboard: overzicht van trajecten ------------------------------------

async function renderDashboard() {
  app.innerHTML = `<div class="empty-state">Bezig met laden…</div>`;
  const [trajecten] = await Promise.all([api('GET', '/api/trajecten'), laadProces()]);

  const actief = trajecten.filter((t) => !t.gearchiveerd);
  const gearchiveerd = trajecten.filter((t) => t.gearchiveerd);

  app.innerHTML = `
    <section class="intro">
      <h1>Prospect naar livegang</h1>
      <p>Het is niet altijd duidelijk wie op welk moment betrokken is binnen een verkoop- of projecttraject.
      Deze procesflow maakt in één oogopslag inzichtelijk welke collega's betrokken zijn, welke activiteiten
      en resultaten bij elke stap horen, en binnen welke termijn acties uitgevoerd moeten worden.</p>
      <p>Maak hieronder een traject aan per prospect of project en vink stappen af zodra ze zijn afgerond.
      Bekijk de volledige <a href="#/proces">procesflow als naslagwerk</a>.</p>
    </section>

    <details class="new-traject" id="new-traject">
      <summary>Nieuw traject starten</summary>
      <form id="form-nieuw-traject">
        <div class="form-grid">
          <div class="field">
            <label for="naam">Naam traject (klant/prospect) *</label>
            <input type="text" id="naam" name="naam" required placeholder="bv. Van Dijk Groothandel" />
          </div>
          <div class="field">
            <label for="klant">Contactpersoon klant</label>
            <input type="text" id="klant" name="klant" placeholder="optioneel" />
          </div>
          <div class="field">
            <label for="salesEigenaar">Sales-eigenaar</label>
            <input type="text" id="salesEigenaar" name="salesEigenaar" placeholder="optioneel" />
          </div>
          <div class="field">
            <label for="startdatum">Startdatum</label>
            <input type="date" id="startdatum" name="startdatum" value="${vandaagIso()}" />
          </div>
        </div>
        <p class="error-text" id="nieuw-traject-error" hidden></p>
        <div class="form-actions">
          <button type="submit" class="primary">Traject aanmaken</button>
        </div>
      </form>
    </details>

    <div class="section-heading"><h2>Actieve trajecten (${actief.length})</h2></div>
    <div class="traject-list" id="lijst-actief"></div>

    ${gearchiveerd.length ? `
      <div class="section-heading"><h2>Gearchiveerd (${gearchiveerd.length})</h2></div>
      <div class="traject-list" id="lijst-archief"></div>
    ` : ''}
  `;

  vulTrajectLijst(document.getElementById('lijst-actief'), actief);
  if (gearchiveerd.length) vulTrajectLijst(document.getElementById('lijst-archief'), gearchiveerd);

  document.getElementById('form-nieuw-traject').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errEl = document.getElementById('nieuw-traject-error');
    errEl.hidden = true;
    const payload = {
      naam: form.naam.value,
      klant: form.klant.value,
      salesEigenaar: form.salesEigenaar.value,
      startdatum: form.startdatum.value ? new Date(form.startdatum.value).toISOString() : undefined,
    };
    try {
      const traject = await api('POST', '/api/trajecten', payload);
      location.hash = `#/traject/${traject.id}`;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

function vulTrajectLijst(container, trajecten) {
  if (trajecten.length === 0) {
    container.innerHTML = `<div class="empty-state">Nog geen trajecten. Start hierboven een nieuw traject.</div>`;
    return;
  }
  container.innerHTML = trajecten.map((t) => `
    <div class="traject-card">
      <div class="traject-card__main">
        <div class="traject-card__title"><a href="#/traject/${t.id}">${escapeHtml(t.naam)}</a></div>
        <div class="traject-card__meta">
          ${t.klant ? `${escapeHtml(t.klant)} · ` : ''}${t.salesEigenaar ? `Sales: ${escapeHtml(t.salesEigenaar)} · ` : ''}
          gestart ${formatDatum(t.startdatum)}
        </div>
      </div>
      <div class="traject-card__progress">
        <div class="progress-bar"><div class="progress-bar__fill" style="width:${t.voortgang.percentage}%"></div></div>
        <div class="progress-label">
          <span>${t.afgerond ? 'Traject afgerond' : (t.huidigeStap ? `Stap ${t.huidigeStap.nummer} — ${escapeHtml(t.huidigeStap.titel)}` : '')}</span>
          <span>${t.voortgang.voltooid}/${t.voortgang.totaal}</span>
        </div>
      </div>
      <div class="traject-card__actions">
        <button class="small ghost" data-archive="${t.id}" data-state="${t.gearchiveerd}">${t.gearchiveerd ? 'Herstellen' : 'Archiveren'}</button>
        <button class="small danger-text" data-delete="${t.id}">Verwijderen</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-archive]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-archive');
      const naarStaat = btn.getAttribute('data-state') !== 'true';
      await api('PATCH', `/api/trajecten/${id}`, { gearchiveerd: naarStaat });
      renderDashboard();
    });
  });
  container.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete');
      if (!confirm('Dit traject definitief verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
      await api('DELETE', `/api/trajecten/${id}`);
      renderDashboard();
    });
  });
}

// --- Traject detail: checklist per fase/stap --------------------------------

async function renderTrajectDetail(id) {
  app.innerHTML = `<div class="empty-state">Bezig met laden…</div>`;
  const [traject, proces] = await Promise.all([api('GET', `/api/trajecten/${id}`), laadProces()]);
  const stapStatusPerNummer = Object.fromEntries(traject.stappen.map((s) => [s.nummer, s]));

  app.innerHTML = `
    <a href="#/" class="back-link">&larr; Terug naar trajecten</a>
    <div class="traject-header">
      <div class="traject-header__top">
        <div>
          <h1>${escapeHtml(traject.naam)}</h1>
          <div class="traject-header__meta">
            ${traject.klant ? `${escapeHtml(traject.klant)} · ` : ''}${traject.salesEigenaar ? `Sales: ${escapeHtml(traject.salesEigenaar)} · ` : ''}
            gestart ${formatDatum(traject.startdatum)}
          </div>
        </div>
        <div class="traject-header__actions">
          <button class="small ghost" id="btn-archiveren">${traject.gearchiveerd ? 'Herstellen' : 'Archiveren'}</button>
          <button class="small danger-text" id="btn-verwijderen">Verwijderen</button>
        </div>
      </div>
      <div class="traject-header__progress">
        <div class="progress-bar"><div class="progress-bar__fill" style="width:${traject.voortgang.percentage}%"></div></div>
        <div class="progress-label">
          <span>${traject.afgerond ? 'Traject volledig afgerond' : (traject.huidigeFase ? `Huidige fase: ${escapeHtml(traject.huidigeFase.titel)}` : '')}</span>
          <span>${traject.voortgang.voltooid}/${traject.voortgang.totaal} stappen (${traject.voortgang.percentage}%)</span>
        </div>
      </div>
    </div>

    ${proces.fases.map((fase) => renderFaseBlock(fase, proces, stapStatusPerNummer, traject.id)).join('')}
  `;

  document.getElementById('btn-archiveren').addEventListener('click', async () => {
    await api('PATCH', `/api/trajecten/${id}`, { gearchiveerd: !traject.gearchiveerd });
    renderTrajectDetail(id);
  });
  document.getElementById('btn-verwijderen').addEventListener('click', async () => {
    if (!confirm('Dit traject definitief verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
    await api('DELETE', `/api/trajecten/${id}`);
    location.hash = '#/';
  });

  bindStapCardEvents(traject.id);
}

function faseVoortgang(fase, stapStatusPerNummer) {
  const voltooid = fase.stappen.filter((n) => stapStatusPerNummer[n]?.voltooid).length;
  return { voltooid, totaal: fase.stappen.length };
}

function renderFaseBlock(fase, proces, stapStatusPerNummer, trajectId) {
  const v = faseVoortgang(fase, stapStatusPerNummer);
  return `
    <div class="fase-block">
      <div class="fase-block__head">
        <h2>${escapeHtml(fase.titel)} <span class="badge badge--fase">${v.voltooid}/${v.totaal}</span></h2>
        <p>${escapeHtml(fase.omschrijving)}</p>
      </div>
      ${fase.stappen.map((nummer) => {
        const stap = proces.stappen.find((s) => s.nummer === nummer);
        return renderStapCard(stap, stapStatusPerNummer[nummer], trajectId);
      }).join('')}
    </div>
  `;
}

function renderStapCard(stap, status, trajectId) {
  const voltooid = Boolean(status?.voltooid);
  const overtijd = Boolean(status?.overtijd);
  const cardClass = voltooid ? 'stap-card--voltooid' : (overtijd ? 'stap-card--overtijd' : '');

  const betrokkenenHtml = stap.betrokkenen?.length ? `
    <div>
      <h4>Betrokkenen</h4>
      <ul>${stap.betrokkenen.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
    </div>` : '';

  const verantwoordelijkhedenHtml = `
    <div>
      <h4>Verantwoordelijkheden</h4>
      <ul>${stap.verantwoordelijkheden.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>
    </div>`;

  const verantwoordelijkhedenSalesHtml = stap.verantwoordelijkhedenSales?.length ? `
    <div>
      <h4>Verantwoordelijkheid sales (periodiek)</h4>
      <ul>${stap.verantwoordelijkhedenSales.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>
    </div>` : '';

  const aanpakHtml = stap.aanpak?.length ? `
    <div>
      <h4>Aanpak</h4>
      <ul>${stap.aanpak.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>
    </div>` : '';

  const outputHtml = stap.output?.length ? `
    <div>
      <h4>Output</h4>
      <ul>${stap.output.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>
    </div>` : '';

  const volgendeStapHtml = stap.volgendeStap ? `
    <div>
      <h4>Volgende stap</h4>
      <p>${escapeHtml(stap.volgendeStap)}</p>
    </div>` : '';

  const linksHtml = stap.links?.length ? `
    <ul class="links-list">${stap.links.map((l) => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a></li>`).join('')}</ul>
  ` : '';

  const normHtml = stap.normTekst ? `
    <div class="norm-line">
      <span>⏱ ${escapeHtml(stap.normTekst)}</span>
      ${status?.deadline && !voltooid ? `<span class="badge ${overtijd ? 'badge--overtijd' : 'badge--eigenaar'}">${overtijd ? 'Over de norm — verwacht was' : 'Verwachte deadline'} ${formatDatum(status.deadline)}</span>` : ''}
    </div>
  ` : '';

  const statusHtml = voltooid ? `
    <div class="status-box status-box--voltooid">
      <div class="status-box__title">✓ Afgevinkt</div>
      <div class="status-box__meta">Door ${escapeHtml(status.voltooidDoor)} op ${formatDatum(status.voltooidOp)}</div>
      ${status.notitie ? `<div class="status-box__note">${escapeHtml(status.notitie)}</div>` : ''}
      <div class="form-actions" style="margin-top:10px;">
        <button class="small ghost" data-heropenen="${stap.nummer}">Heropenen</button>
      </div>
    </div>
  ` : `
    <div class="status-box">
      <form class="afvink-form" data-afvink="${stap.nummer}">
        <div class="field">
          <label>Afgevinkt door *</label>
          <input type="text" name="voltooidDoor" required placeholder="Jouw naam" value="${escapeHtml(laatstGebruikteNaam())}" />
        </div>
        <div class="field">
          <label>Notitie (optioneel)</label>
          <textarea name="notitie" rows="2" placeholder="Bijzonderheden, afwijkingen, besluit…"></textarea>
        </div>
        <p class="error-text" hidden></p>
        <div class="form-actions">
          <button type="submit" class="primary small">Stap afvinken</button>
        </div>
      </form>
    </div>
  `;

  return `
    <div class="stap-card ${cardClass}" data-stap-card="${stap.nummer}" data-open="false">
      <div class="stap-card__head" data-toggle="${stap.nummer}">
        <div class="stap-card__nummer">${stap.nummer}</div>
        <div class="stap-card__titel">${escapeHtml(stap.titel)}</div>
        <div class="stap-card__badges">
          <span class="badge badge--eigenaar">${escapeHtml(stap.eigenaar)}</span>
          ${stap.goNoGo ? `<span class="badge badge--gonogo">Go/no-go</span>` : ''}
          ${voltooid ? `<span class="badge badge--voltooid">Voltooid</span>` : (overtijd ? `<span class="badge badge--overtijd">Over de norm</span>` : `<span class="badge badge--open">Open</span>`)}
        </div>
        <span class="stap-card__chevron">▶</span>
      </div>
      <div class="stap-card__body">
        ${normHtml}
        ${stap.belangrijk ? `<div class="belangrijk-box">⚠ ${escapeHtml(stap.belangrijk)}</div>` : ''}
        <div class="stap-detail-grid">
          ${betrokkenenHtml}
          ${verantwoordelijkhedenHtml}
          ${verantwoordelijkhedenSalesHtml}
          ${aanpakHtml}
          ${outputHtml}
          ${stap.goNoGo ? `<div><h4>Go/no-go</h4><p>${escapeHtml(stap.goNoGo)}</p></div>` : ''}
          ${volgendeStapHtml}
        </div>
        ${linksHtml}
        ${statusHtml}
      </div>
    </div>
  `;
}

function bindStapCardEvents(trajectId) {
  document.querySelectorAll('[data-toggle]').forEach((head) => {
    head.addEventListener('click', () => {
      const card = head.closest('.stap-card');
      const open = card.getAttribute('data-open') === 'true';
      card.setAttribute('data-open', String(!open));
    });
  });

  document.querySelectorAll('[data-afvink]').forEach((form) => {
    form.addEventListener('click', (e) => e.stopPropagation());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nummer = form.getAttribute('data-afvink');
      const errEl = form.querySelector('.error-text');
      errEl.hidden = true;
      const voltooidDoor = form.voltooidDoor.value.trim();
      try {
        await api('PUT', `/api/trajecten/${trajectId}/stappen/${nummer}`, {
          voltooid: true,
          voltooidDoor,
          notitie: form.notitie.value,
        });
        onthoudNaam(voltooidDoor);
        renderTrajectDetail(trajectId);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  });

  document.querySelectorAll('[data-heropenen]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const nummer = btn.getAttribute('data-heropenen');
      if (!confirm('Deze stap heropenen (afvinkstatus wissen)?')) return;
      await api('PUT', `/api/trajecten/${trajectId}/stappen/${nummer}`, { voltooid: false });
      renderTrajectDetail(trajectId);
    });
  });
}

// --- Procesflow als naslagwerk (read-only) ---------------------------------

async function renderProcesReferentie() {
  app.innerHTML = `<div class="empty-state">Bezig met laden…</div>`;
  const proces = await laadProces();

  app.innerHTML = `
    <section class="intro">
      <h1>Procesflow: prospect naar livegang</h1>
      <p>Dit overzicht maakt in één oogopslag inzichtelijk welke collega's in elke stap betrokken zijn, welke
      activiteiten en verantwoordelijkheden daarbij horen, welke resultaten of besluiten nodig zijn om door te
      gaan naar de volgende fase, en binnen welke termijn acties uitgevoerd moeten worden.</p>
      <p>Dit is een levend document. Zie je een verbetering? Denk mee en bespreek het met je teamcoördinator of
      Sales lead, zodat we samen tot een proces komen dat duidelijk, praktisch en effectief is voor iedereen.</p>
    </section>

    ${proces.fases.map((fase) => `
      <div class="fase-block">
        <div class="fase-block__head">
          <h2>${escapeHtml(fase.titel)}</h2>
          <p>${escapeHtml(fase.omschrijving)}</p>
        </div>
        ${fase.stappen.map((nummer) => {
          const stap = proces.stappen.find((s) => s.nummer === nummer);
          return renderStapCard(stap, null, null);
        }).join('')}
      </div>
    `).join('')}
  `;

  // In naslagwerk-modus: kaarten open/dicht klikken, geen afvink-formulieren tonen.
  document.querySelectorAll('.afvink-form').forEach((f) => f.closest('.status-box').remove());
  document.querySelectorAll('[data-toggle]').forEach((head) => {
    head.addEventListener('click', () => {
      const card = head.closest('.stap-card');
      const open = card.getAttribute('data-open') === 'true';
      card.setAttribute('data-open', String(!open));
    });
  });
}
