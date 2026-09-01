// Opslag van trajecten (prospect-/projecttrajecten) in een simpel JSON-bestand
// op schijf. Geen database nodig voor deze schaal.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'trajecten.json');

// Voorkomt race conditions tussen gelijktijdige schrijfacties.
let writeQueue = Promise.resolve();

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, '[]', 'utf-8');
  }
}

export async function readTrajecten() {
  await ensureFile();
  const raw = await fs.readFile(FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTrajecten(trajecten) {
  await fs.writeFile(FILE, JSON.stringify(trajecten, null, 2), 'utf-8');
}

function enqueue(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

export async function getTraject(id) {
  const trajecten = await readTrajecten();
  return trajecten.find((t) => t.id === id) || null;
}

export function createTraject({ naam, klant, salesEigenaar, startdatum }) {
  return enqueue(async () => {
    const trajecten = await readTrajecten();
    const traject = {
      id: randomUUID(),
      naam: naam.trim(),
      klant: (klant || '').trim(),
      salesEigenaar: (salesEigenaar || '').trim(),
      startdatum: startdatum || new Date().toISOString(),
      aangemaaktOp: new Date().toISOString(),
      gearchiveerd: false,
      stappen: {},
    };
    trajecten.unshift(traject);
    await writeTrajecten(trajecten);
    return traject;
  });
}

export function updateTraject(id, patch) {
  return enqueue(async () => {
    const trajecten = await readTrajecten();
    const traject = trajecten.find((t) => t.id === id);
    if (!traject) return null;
    if (typeof patch.naam === 'string') traject.naam = patch.naam.trim();
    if (typeof patch.klant === 'string') traject.klant = patch.klant.trim();
    if (typeof patch.salesEigenaar === 'string') traject.salesEigenaar = patch.salesEigenaar.trim();
    if (typeof patch.gearchiveerd === 'boolean') traject.gearchiveerd = patch.gearchiveerd;
    await writeTrajecten(trajecten);
    return traject;
  });
}

export function deleteTraject(id) {
  return enqueue(async () => {
    const trajecten = await readTrajecten();
    const next = trajecten.filter((t) => t.id !== id);
    await writeTrajecten(next);
    return next.length !== trajecten.length;
  });
}

// Zet de status van één stap binnen een traject (afgetikt, door wie, wanneer,
// eventuele notitie). Ook te gebruiken om een afgetikte stap weer te openen.
export function zetStapStatus(trajectId, stapNummer, { voltooid, voltooidDoor, notitie, voltooidOp }) {
  return enqueue(async () => {
    const trajecten = await readTrajecten();
    const traject = trajecten.find((t) => t.id === trajectId);
    if (!traject) return null;
    const bestaand = traject.stappen[stapNummer] || {};
    traject.stappen[stapNummer] = {
      voltooid: Boolean(voltooid),
      voltooidDoor: voltooid ? (voltooidDoor || '').trim() || bestaand.voltooidDoor || '' : bestaand.voltooidDoor || '',
      voltooidOp: voltooid ? voltooidOp || bestaand.voltooidOp || new Date().toISOString() : null,
      notitie: notitie !== undefined ? notitie.trim() : bestaand.notitie || '',
    };
    await writeTrajecten(trajecten);
    return traject;
  });
}
