const state = {
  suggestionTimer: null,
};

const els = {
  form: document.getElementById('add-form'),
  input: document.getElementById('symbol-input'),
  suggestions: document.getElementById('suggestions'),
  addError: document.getElementById('add-error'),
  portfolioBody: document.getElementById('portfolio-body'),
  lastUpdated: document.getElementById('last-updated'),
  calendarList: document.getElementById('calendar-list'),
};

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fout bij ${path}`);
  return data;
}

function fmtNumber(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  return v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(change, pct) {
  if (change === undefined || change === null) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${fmtNumber(change)} (${sign}${fmtNumber(pct)}%)`;
}

function formatDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || 'Onbekend';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function renderPortfolio(quotes) {
  if (!quotes.length) {
    els.portfolioBody.innerHTML =
      '<tr class="empty-row"><td colspan="6">Nog geen aandelen toegevoegd.</td></tr>';
    return;
  }

  els.portfolioBody.innerHTML = quotes
    .map((q) => {
      if (q.error) {
        return `<tr>
          <td><strong>${q.symbol}</strong></td>
          <td>${q.name || ''}</td>
          <td colspan="3" class="error">Kon koers niet ophalen</td>
          <td><button class="remove-btn" data-symbol="${q.symbol}" title="Verwijderen">✕</button></td>
        </tr>`;
      }
      const changeClass = (q.change ?? 0) > 0 ? 'up' : (q.change ?? 0) < 0 ? 'down' : '';
      return `<tr>
        <td><strong>${q.symbol}</strong></td>
        <td>${q.name || ''}</td>
        <td>${fmtNumber(q.price)}</td>
        <td class="${changeClass}">${fmtChange(q.change, q.changePercent)}</td>
        <td class="muted">${fmtNumber(q.low)} – ${fmtNumber(q.high)}</td>
        <td><button class="remove-btn" data-symbol="${q.symbol}" title="Verwijderen">✕</button></td>
      </tr>`;
    })
    .join('');

  els.portfolioBody.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => removeStock(btn.dataset.symbol));
  });
}

function renderCalendar(events) {
  if (!events.length) {
    els.calendarList.innerHTML =
      '<p class="muted">Geen geplande gebeurtenissen gevonden voor je aandelen.</p>';
    return;
  }

  const groups = {};
  for (const e of events) {
    const key = e.date || 'Onbekend';
    (groups[key] ||= []).push(e);
  }
  const days = Object.keys(groups).sort();

  els.calendarList.innerHTML = days
    .map((day) => {
      const items = groups[day]
        .map(
          (e) => `
        <li class="event event-${e.type}">
          <span class="event-symbol">${e.symbol}</span>
          <span class="event-title">${e.title}</span>
          ${e.detail ? `<span class="event-detail">${e.detail}</span>` : ''}
        </li>`
        )
        .join('');
      return `<div class="calendar-day">
        <div class="calendar-date">${formatDate(day)}</div>
        <ul class="event-list">${items}</ul>
      </div>`;
    })
    .join('');
}

async function loadQuotes() {
  try {
    const quotes = await api('/api/quotes');
    renderPortfolio(quotes);
    els.lastUpdated.textContent = `bijgewerkt om ${new Date().toLocaleTimeString('nl-NL')}`;
  } catch (err) {
    els.lastUpdated.textContent = `fout: ${err.message}`;
  }
}

async function loadCalendar() {
  try {
    const events = await api('/api/calendar');
    renderCalendar(events);
  } catch (err) {
    els.calendarList.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function refreshAll() {
  await Promise.all([loadQuotes(), loadCalendar()]);
}

async function removeStock(symbol) {
  await api(`/api/stocks/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
  await refreshAll();
}

els.form.addEventListener('submit', async (evt) => {
  evt.preventDefault();
  els.addError.classList.add('hidden');
  const symbol = els.input.value.trim().toUpperCase();
  if (!symbol) return;
  try {
    await api('/api/stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    });
    els.input.value = '';
    els.suggestions.classList.add('hidden');
    await refreshAll();
  } catch (err) {
    els.addError.textContent = err.message;
    els.addError.classList.remove('hidden');
  }
});

els.input.addEventListener('input', () => {
  clearTimeout(state.suggestionTimer);
  const q = els.input.value.trim();
  if (!q) {
    els.suggestions.classList.add('hidden');
    return;
  }
  state.suggestionTimer = setTimeout(async () => {
    try {
      const results = await api(`/api/search?q=${encodeURIComponent(q)}`);
      if (!results.length) {
        els.suggestions.classList.add('hidden');
        return;
      }
      els.suggestions.innerHTML = results
        .map((r) => `<li data-symbol="${r.symbol}">${r.symbol} <span class="muted">${r.description || ''}</span></li>`)
        .join('');
      els.suggestions.classList.remove('hidden');
      els.suggestions.querySelectorAll('li').forEach((li) => {
        li.addEventListener('click', () => {
          els.input.value = li.dataset.symbol;
          els.suggestions.classList.add('hidden');
          els.input.focus();
        });
      });
    } catch {
      els.suggestions.classList.add('hidden');
    }
  }, 250);
});

document.addEventListener('click', (evt) => {
  if (!els.suggestions.contains(evt.target) && evt.target !== els.input) {
    els.suggestions.classList.add('hidden');
  }
});

refreshAll();
setInterval(loadQuotes, 20_000);
setInterval(loadCalendar, 5 * 60_000);
