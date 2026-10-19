// Gedeelde instellingen voor de browsertests. Zie tests/README.md.
import { fileURLToPath } from "node:url";
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
export const chromium = pw.chromium || pw.default.chromium;
export const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
export const URL_APP = process.env.APP_URL || "http://localhost:3123/huishoudboek/";
export const FX = fileURLToPath(new URL("./fixtures", import.meta.url));
