// Opslag van de eigen portfolio in een simpel JSON-bestand op schijf.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'portfolio.json');

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

export async function readPortfolio() {
  await ensureFile();
  const raw = await fs.readFile(FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePortfolio(stocks) {
  await fs.writeFile(FILE, JSON.stringify(stocks, null, 2), 'utf-8');
}

function enqueue(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

export function addStock(stock) {
  return enqueue(async () => {
    const stocks = await readPortfolio();
    if (stocks.some((s) => s.symbol === stock.symbol)) {
      return stocks; // al aanwezig
    }
    stocks.push(stock);
    await writePortfolio(stocks);
    return stocks;
  });
}

export function removeStock(symbol) {
  return enqueue(async () => {
    const stocks = await readPortfolio();
    const next = stocks.filter((s) => s.symbol !== symbol);
    await writePortfolio(next);
    return next;
  });
}
