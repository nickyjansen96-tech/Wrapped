import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FASES, STAPPEN, STAP_DOOR_NUMMER, STAP_VOLGORDE, verwachteDeadline } from './proces.js';
import {
  readTrajecten,
  getTraject,
  createTraject,
  updateTraject,
  deleteTraject,
  zetStapStatus,
} from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Procesdefinitie (statisch, read-only) ----------------------------------

app.get('/api/proces', (_req, res) => {
  res.json({ fases: FASES, stappen: STAPPEN });
});

// --- Verrijking: voortgang, deadlines en status per stap berekenen ---------

function verrijkTraject(traject) {
  let ankerDatum = traject.startdatum;
  let aantalVoltooid = 0;
  const stappenMetStatus = STAP_VOLGORDE.map((nummer) => {
    const stap = STAP_DOOR_NUMMER[nummer];
    const status = traject.stappen[nummer] || { voltooid: false, voltooidDoor: '', voltooidOp: null, notitie: '' };
    const deadline = verwachteDeadline(stap, ankerDatum);
    const overtijd = !status.voltooid && deadline && new Date() > new Date(deadline);
    if (status.voltooid) {
      aantalVoltooid += 1;
      ankerDatum = status.voltooidOp || ankerDatum;
    }
    return {
      nummer,
      titel: stap.titel,
      eigenaar: stap.eigenaar,
      ...status,
      deadline,
      overtijd: Boolean(overtijd),
    };
  });

  const huidigeStap = stappenMetStatus.find((s) => !s.voltooid) || null;
  const huidigeFase = huidigeStap
    ? FASES.find((f) => f.stappen.includes(huidigeStap.nummer))
    : FASES[FASES.length - 1];

  return {
    ...traject,
    voortgang: {
      voltooid: aantalVoltooid,
      totaal: STAP_VOLGORDE.length,
      percentage: Math.round((aantalVoltooid / STAP_VOLGORDE.length) * 100),
    },
    huidigeStap: huidigeStap ? { nummer: huidigeStap.nummer, titel: huidigeStap.titel } : null,
    huidigeFase: huidigeFase ? { id: huidigeFase.id, titel: huidigeFase.titel } : null,
    afgerond: aantalVoltooid === STAP_VOLGORDE.length,
    stappen: stappenMetStatus,
  };
}

// --- Trajecten ---------------------------------------------------------------

app.get('/api/trajecten', async (_req, res) => {
  const trajecten = await readTrajecten();
  res.json(trajecten.map(verrijkTraject));
});

app.post('/api/trajecten', async (req, res) => {
  const naam = (req.body?.naam || '').toString().trim();
  if (!naam) {
    return res.status(400).json({ error: 'Naam van het traject (klant/prospect) is verplicht.' });
  }
  const traject = await createTraject({
    naam,
    klant: req.body?.klant,
    salesEigenaar: req.body?.salesEigenaar,
    startdatum: req.body?.startdatum,
  });
  res.status(201).json(verrijkTraject(traject));
});

app.get('/api/trajecten/:id', async (req, res) => {
  const traject = await getTraject(req.params.id);
  if (!traject) return res.status(404).json({ error: 'Traject niet gevonden.' });
  res.json(verrijkTraject(traject));
});

app.patch('/api/trajecten/:id', async (req, res) => {
  const traject = await updateTraject(req.params.id, req.body || {});
  if (!traject) return res.status(404).json({ error: 'Traject niet gevonden.' });
  res.json(verrijkTraject(traject));
});

app.delete('/api/trajecten/:id', async (req, res) => {
  const verwijderd = await deleteTraject(req.params.id);
  if (!verwijderd) return res.status(404).json({ error: 'Traject niet gevonden.' });
  res.status(204).end();
});

// --- Status van een individuele stap -----------------------------------------

app.put('/api/trajecten/:id/stappen/:nummer', async (req, res) => {
  const { id, nummer } = req.params;
  if (!STAP_DOOR_NUMMER[nummer]) {
    return res.status(400).json({ error: `Onbekende stap: ${nummer}` });
  }
  const voltooid = Boolean(req.body?.voltooid);
  if (voltooid && !(req.body?.voltooidDoor || '').toString().trim()) {
    return res.status(400).json({ error: 'Naam van de verantwoordelijke die aftikt is verplicht.' });
  }
  const traject = await zetStapStatus(id, nummer, {
    voltooid,
    voltooidDoor: req.body?.voltooidDoor,
    notitie: req.body?.notitie,
    voltooidOp: req.body?.voltooidOp,
  });
  if (!traject) return res.status(404).json({ error: 'Traject niet gevonden.' });
  res.json(verrijkTraject(traject));
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Niet gevonden.' }));

app.listen(PORT, () => {
  console.log(`Blisss onboarding-app draait op http://localhost:${PORT}`);
});
