/*
 * Alle Prüfungen dieses Repositories — ein Befehl, keine Werkzeuge.
 * ---------------------------------------------------------------------------
 *     node tests/run-all.mjs
 *
 * Jede Testdatei prüft beim Laden und meldet am Schluss ihre Zahl. Sie werden
 * nacheinander geladen, damit die Ausgabe lesbar bleibt und der erste Fehler
 * sofort auffällt. Eine fehlgeschlagene Zusicherung beendet den Lauf mit einem
 * Rückgabewert ungleich null — genau das prüft die CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const dateien = fs.readdirSync(hier)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort();

if (!dateien.length) {
  console.error("Es wurde keine einzige Testdatei gefunden — das ist selbst ein Fehler.");
  process.exit(1);
}

for (const datei of dateien) {
  await import(pathToFileURL(path.join(hier, datei)).href);
}

console.log(`\nAlle Pruefungen bestanden (${dateien.length} Dateien).`);
