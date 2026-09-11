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
 *   1. Die Lesespalte ist zentriert und 640–860 px breit; mobil 100 %.
 *      (Seit der Angleichung an flowertech.ch am 11.09.2026 begrenzt die
 *      SPALTE die Zeilenlaenge — nicht mehr jedes Feld einzeln. Derselbe
 *      Befund, direkter geloest.)
 *   2. Kein Feld traegt eine eigene, groessere Breite; auf schmalen Geraeten
 *      gehoert ihm die ganze Breite, und der Weg unten stapelt.
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

// ── 1. Die Spalte: zentriert, lesbar breit, mobil voll ──────────────────
/* Seit der Angleichung an flowertech.ch (11.09.2026) gibt es kein „Blatt"
   mehr, auf dem zwei Spalten nebeneinander stehen. Der Bogen ist eine ruhige,
   mittige Lesespalte auf schwarzem Grund — das loest denselben Befund von
   damals direkter: Kein Feld laeuft mehr ueber die Fensterbreite, weil die
   SPALTE begrenzt ist, nicht jedes Feld einzeln. */
const spalte = /body\[data-bogen="1"\] #content\{([^}]*)\}/.exec(flach(style));
ok(spalte, "die Regel für die Spalte fehlt");
const spalteMax = Number((/max-width:(\d+)px/.exec(spalte[1]) || [])[1]);
ok(spalteMax >= 640 && spalteMax <= 860,
  `die Spalte ist ${spalteMax} px breit — erwartet 640–860 px (lesbare Zeile)`);
ok(/margin:0 auto/.test(spalte[1]), "die Spalte ist nicht zentriert");
ok(/background:transparent/.test(spalte[1]),
  "die Spalte liegt auf einer eigenen Fläche — der Grund muss durchgehend schwarz bleiben");
// Die Basisregel: volle Breite — sie gilt ueberall, wo keine engere greift.
ok(/input,textarea,select\{width:100%/.test(flach(style)), "die Felder sind nicht standardmässig 100 % breit");

// ── 2. Kein Feld laeuft ueber die Fensterbreite ─────────────────────────
/* Die Begrenzung sitzt jetzt an der Spalte. Damit das auch so bleibt, darf
   kein Feld eine eigene, groessere Breite bekommen — und auf dem Handy
   gehoert ihm weiterhin die ganze Breite. */
const felder = /body\[data-bogen="1"\] input,body\[data-bogen="1"\] textarea,body\[data-bogen="1"\] select\{([^}]*)\}/
  .exec(flach(style));
ok(felder, "die Feldregel des Bogens fehlt");
ok(/width:100%/.test(felder[1]), "die Felder füllen die Spalte nicht");
ok(/max-width:none/.test(felder[1]),
  "die Felder tragen eine eigene Breitenbegrenzung — die Spalte ist die eine Stelle dafür");
// Und es gibt keinen Desktop-Block mehr, der zwei Spalten aufbaut.
ok(!/grid-template-columns:minmax\(180px/.test(flach(style)),
  "die alte Zweispaltigkeit des Werkblatts steht noch im Stil");
// Mobil bleibt alles voll — und der Weg unten stapelt statt zu quetschen.
const klein = /@media\(max-width:520px\)\{([\s\S]*?)\n  \}/.exec(style);
ok(klein, "es gibt keine Regeln für schmale Geräte");
ok(/\.bg-steuer button\{[^}]*flex:1 1 auto/.test(flach(klein[1])),
  "auf dem Handy stehen die Knöpfe nicht nebeneinander in voller Breite");

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
