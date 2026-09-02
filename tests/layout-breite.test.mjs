/*
 * Lesbare Breite und sichtbarer Upload (fragebogen.html, visionroom.js).
 * ---------------------------------------------------------------------------
 * Der Befund der Live-Abnahme vom 02.09.2026 (Screenshot): Auf einem grossen
 * Bildschirm liefen die Formularfelder fast über die ganze Fensterbreite und
 * waren schlecht lesbar. Und der Upload im Vision Room war nicht zu sehen —
 * er lag im Fuss der Mindmap: auf dem Desktop unter der Falz, mobil bis zur
 * ersten Idee ausgeblendet (`.mm-foot{display:none}` unter 760 px).
 *
 * Nachgemessen in Chromium (1600 × 1000 und 390 × 844):
 *   vorher  Blatt 1240 px, Antwortfeld 966 px, Upload-Block unsichtbar
 *   nachher Blatt 1120 px zentriert, Antwortfeld 736 px, Upload-Block
 *           1048 px breit direkt unter der Art; mobil 354 px breit, sichtbar
 *
 * Bewiesen wird statisch, was diese Masse erzeugt:
 *   1. Das Blatt ist zentriert und hoechstens 1120 px breit; mobil 100 %.
 *   2. Die Antwortspalte ist auf dem Desktop auf 46rem begrenzt — keine
 *      endlos langen Eingabezeilen; unter 860 px gilt weiterhin die volle
 *      Breite.
 *   3. Der Upload-Block steht VOR der Mindmap-Flaeche (direkt unter der
 *      Art), nicht im Fuss — und haengt an keiner Idee und keiner Auswahl.
 *   4. Er benutzt kein <label>, das der Bogen als Frage-Zeile gestalten
 *      wuerde; die Zuordnung laeuft ueber aria-labelledby.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, "fragebogen.html"), "utf8");
const component = fs.readFileSync(path.join(root, "visionroom.js"), "utf8");
const css = fs.readFileSync(path.join(root, "visionroom.css"), "utf8");

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const style = /<style>([\s\S]*?)<\/style>/.exec(page)[1];
const flach = (s) => s.replace(/\s*\n\s*/g, "");

// ── 1. Das Blatt: zentriert, begrenzt, mobil voll ─────────────────────────
const blatt = /body\[data-bogen="1"\] #content\{([^}]*)\}/.exec(flach(style));
ok(blatt, "die Regel für das Blatt fehlt");
const blattMax = Number((/max-width:(\d+)px/.exec(blatt[1]) || [])[1]);
ok(blattMax >= 1050 && blattMax <= 1200, `das Blatt ist ${blattMax} px breit — erwartet 1050–1200 px`);
ok(/margin:0 auto/.test(blatt[1]), "das Blatt ist nicht zentriert");
// Die Basisregel: volle Breite — sie gilt ueberall, wo keine engere greift.
ok(/input,textarea,select\{width:100%/.test(flach(style)), "die Felder sind nicht standardmässig 100 % breit");

// ── 2. Die Antwortspalte: begrenzt nur auf dem Desktop ───────────────────
const desktop = /@media\(min-width:860px\)\{([\s\S]*?)\n  \}/.exec(style);
ok(desktop, "der Desktop-Block der Bogenregeln fehlt");
const antwort = /body\[data-bogen="1"\] select\{[^}]*max-width:(\d+)rem/.exec(flach(desktop[1]));
ok(antwort, "die Antwortspalte ist auf dem Desktop nicht begrenzt");
ok(Number(antwort[1]) >= 36 && Number(antwort[1]) <= 52, `die Antwortspalte ist ${antwort[1]}rem — erwartet 36–52rem`);
ok(/\.hint\{[^}]*max-width:\d+rem/.test(flach(desktop[1])), "der Hinweistext folgt der Antwortspalte nicht");
// Ausserhalb des Desktop-Blocks gibt es KEINE Begrenzung der Felder.
const ohneDesktop = style.replace(desktop[0], "");
ok(!/body\[data-bogen="1"\] (input|textarea|select)[^{]*\{[^}]*max-width/.test(flach(ohneDesktop)),
  "die Felder sind auch auf dem Handy begrenzt — dort gehört ihnen die ganze Breite");

// ── 3. Der Upload-Block steht vor der Mindmap, nicht im Fuss ─────────────
const markup = /function markup\(opts\) \{([\s\S]*?)\n  \}/.exec(component);
ok(markup, "der Aufbau des Bausteins ist nicht auffindbar");
const posFiles = markup[1].indexOf("filesMarkup(o.upload)");
const posCanvas = markup[1].indexOf('class="mm-canvas"');
const posFoot = markup[1].indexOf('class="mm-foot"');
ok(posFiles > 0 && posCanvas > 0 && posFiles < posCanvas, "der Upload-Block steht nicht vor der Mindmap-Fläche");
ok(posFiles < posFoot, "der Upload-Block liegt im Fuss der Mindmap — dort ist er unsichtbar");
ok(/\.mm-files \{[^}]*display: grid/.test(css), "der Block hat keine eigene Gestalt");
ok(/\.mm-files \{[^}]*border-bottom/.test(css), "der Block ist nicht als eigene Zeile abgesetzt");
// Der Fuss wird mobil erst mit einer Idee sichtbar — der Block darf daran nicht haengen.
ok(/\.mm-foot \{ display: none;/.test(css), "vorab: die Fussregel hat sich geändert — Test prüfen");
ok(!/\.mm-files \{[^}]*display: none/.test(css) && !/\.mm-files\[hidden\]/.test(css), "der Upload-Block wird per CSS ausgeblendet");
ok(/@media \(max-width: 760px\) \{\n  \.mm-files \{[^}]*grid-template-columns: 1fr/.test(css),
  "der Block stapelt sich mobil nicht");
ok(/\.mm-files-pick \{[^}]*min-height: 44px/.test(css), "der Auswahlknopf ist mobil nicht fingergross");

// ── 4. Beschriftung ohne <label>, Zuordnung über ARIA ────────────────────
const block = /function filesMarkup\(upload\) \{([\s\S]*?)\n  \}/.exec(component)[1]
  .replace(/\/\*[\s\S]*?\*\//g, "");   // Kommentare erreichen niemanden
ok(!/<label/.test(block), "der Upload-Block benutzt ein <label> — der Bogen gestaltet es als Frage-Zeile");
ok(/id="vrFileLabel"/.test(block) && /aria-labelledby="vrFileLabel"/.test(block), "die Dateiauswahl ist nicht beschriftet");
ok(/aria-describedby="vrFileHint"/.test(block), "der Hinweis ist der Dateiauswahl nicht zugeordnet");
ok(/data-ft="vision-files"/.test(block), "die Marke für die Abnahme fehlt (data-ft=\"vision-files\")");

console.log(`layout-breite: ok (${checks} Pruefungen)`);
