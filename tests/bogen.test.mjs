/*
 * Der Bogen — eine Drucksache, kein Formular im Rahmen.
 * ---------------------------------------------------------------------------
 * Auftrag war eine radikale Überarbeitung: „darf auf keinen Fall wie eine
 * typische KI-Website aussehen", „der derzeitige FlowerTech-Rahmen gehört
 * nicht dazu und soll entfernt werden".
 *
 * Gestaltung lässt sich nicht prüfen — die ENTSCHEIDUNGEN dahinter schon.
 * Diese Datei hält fest, was den Bogen ausmacht, damit es nicht beiläufig
 * zurückgedreht wird:
 *
 *   1. Der Rahmen tritt ab: Auf dem Bogen ist die Cockpit-Kopfzeile weg —
 *      in jeder anderen Ansicht steht sie unverändert.
 *   2. Eine Strecke: drei Fragen je Schritt, ein Weg vor und zurück,
 *      gesendet wird erst am Ende. Alle Felder bleiben dabei im Dokument.
 *   3. Das Aussehen ist das von flowertech.ch — nicht das eines Amtsformulars.
 *   4. Niemand kommt weiter, ohne dass gesagt wird, was fehlt — und die
 *      Meldung spricht von dem Schritt, der vor der Kundschaft liegt.
 *
 * Zu 3 der zweite Auftrag (11.09.2026): „dieser link sieht richtig kacke aus,
 * eigentlich soll das im styl von flowertech dieses moderne haben". Vorher
 * stand hier ein Werkblatt — graue Papierflaeche, schwarzer kantiger Balken,
 * Schreibmaschinen-Etiketten, „BLATT 01 VON 11". Die frueheren Pruefungen
 * hielten genau das fest (kalter Grauton, keine Rundungen, Monospace); sie
 * sind ersetzt durch die Merkmale der Hauptseite. Gestaltung laesst sich nicht
 * pruefen — dass es DIESELBE Gestaltung ist, sehr wohl: Die Farbwerte werden
 * gegen index.html verglichen.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { makeDom } from "./dom-double.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, "fragebogen.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
const stil = (/<style>([\s\S]*?)<\/style>/.exec(page) || ["", ""])[1];

let geprueft = 0;
const ok = (bedingung, text) => { assert.ok(bedingung, text); geprueft++; };

const TOKEN = "e".repeat(30);
const IDS = [
  "loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
  "form", "fields", "hp", "submit", "need", "status", "footer",
  "answered", "answeredTitle", "answeredText", "area",
  "tileTest", "tileOffer", "tilePreview", "tileContract", "tileAdmin", "tileTerms",
  "ck", "ckTop", "ckViews", "ckProject", "ckMobil", "ckDesktop", "ckReload", "ckWish",
  "ckStage", "ckSide", "ckLock", "pvFrame", "pickDlg", "changeForm", "changeIntro",
  "ckView_website", "ckView_verwaltung", "ckView_offerte", "ckView_vertrag",
  "ckView_agb", "ckView_fragebogen",
  "ckWishes", "crArea", "crTitle", "pvStage", "adminStage", "kbWork", "kbNavList",
  "visionRoom", "vrLead", "visionRoomMount", "vrCarriers", "blatt_vr", "bogenNrVr",
  "bogenZurueck", "bogenWeiter", "bogenStand",
  "bogenFortschritt", "bogenBalken", "bogenSchrittZahl",
];

// Sieben Fragen ergeben drei Blätter zu drei, drei, einer Frage.
const FRAGEN = [
  { key: "firma", label: "Betrieb", type: "text", role: "company", required: true, hint: "", options: [], vision: "" },
  { key: "name", label: "Ansprechperson", type: "text", role: "contactName", required: true, hint: "", options: [], vision: "" },
  { key: "email", label: "E-Mail", type: "email", role: "contactEmail", required: true, hint: "", options: [], vision: "" },
  { key: "art", label: "Art des Vorhabens", type: "select", role: "", required: true, hint: "", options: ["Website", "Web-App"], vision: "" },
  { key: "seiten", label: "Seiten", type: "textarea", role: "", required: false, hint: "", options: [], vision: "" },
  { key: "termin", label: "Wunschtermin", type: "date", role: "", required: false, hint: "", options: [], vision: "" },
  { key: "budget", label: "Rahmen", type: "text", role: "", required: false, hint: "", options: [], vision: "" },
];

const daten = (extra) => Object.assign({
  schema: 1, title: "Ihr Vorhaben", intro: "Kurz ein paar Fragen.",
  status: "open", company: { name: "FlowerTech" }, generation: 1,
  questions: FRAGEN, stage: "intake",
  tiles: { offer: null, preview: null, admin: null },
  updatedAt: "2026-08-14T06:00:00.000Z",
}, extra || {});

const VORSCHAU = {
  label: "Website-Vorschau", url: "https://beispiel-lehner.netlify.app/",
  releasedAt: "2026-08-13T08:00:00.000Z", feedback: true,
};

async function seite(d) {
  const dom = makeDom();
  IDS.forEach((id) => dom.ensure(id));
  ["error", "content", "answered", "area", "ck", "ckSide", "ckLock", "tileOffer", "tilePreview",
   "tileAdmin", "tileTerms", "tileTest", "tileContract", "visionRoom", "blatt_vr"]
    .forEach((id) => { dom.node(id).hidden = true; });
  const fetchDouble = (url) => {
    if (String(url).includes("intakeForms")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(d) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  };
  dom.window.location.search = "?e=" + TOKEN;
  dom.window.fetch = fetchDouble;
  const echtesGet = dom.document.getElementById;
  dom.document.getElementById = (id) => echtesGet(id) || (/^q_\d+$/.test(id) ? dom.ensure(id, "INPUT") : null);
  const ctx = {
    window: dom.window, document: dom.document, location: dom.window.location,
    setTimeout: dom.window.setTimeout, clearTimeout() {}, console,
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object,
    fetch: fetchDouble,
  };
  ctx.globalThis = ctx;
  vm.runInContext(script, vm.createContext(ctx));
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
  return { dom };
}

/* ══ 1. Der Rahmen tritt ab — aber nur hier ═══════════════════════════════ */
{
  const { dom } = await seite(daten());
  ok(dom.document.body.getAttribute("data-bogen") === "1",
    "der Bogen bekommt die Seite nicht für sich");

  // Die Regel, die den Rahmen wirklich wegnimmt, steht im Stil.
  const weg = /body\[data-bogen="1"\][^{]*\.ck-top[^{]*\{[^}]*display:none/.test(
    stil.replace(/\s*\n\s*/g, ""));
  ok(weg, "die Kopfzeile des Cockpits bleibt auf dem Bogen stehen");

  // In jeder anderen Ansicht bleibt der Rahmen unangetastet.
  const mit = await seite(daten({
    stage: "preview", tiles: { offer: null, preview: VORSCHAU, admin: null },
  }));
  mit.dom.node("ckView_website").click();
  ok(mit.dom.document.body.getAttribute("data-bogen") === null,
    "auch die Website-Ansicht verliert den Rahmen");
  mit.dom.node("ckView_fragebogen").click();
  ok(mit.dom.document.body.getAttribute("data-bogen") === "1",
    "der Fragebogen im Cockpit bekommt die Seite nicht für sich");
}

/* ══ 2. Eine Strecke aus Blättern ═════════════════════════════════════════ */
{
  const { dom } = await seite(daten());
  ok(!!dom.node("blatt_0") && !!dom.node("blatt_1") && !!dom.node("blatt_2"),
    "die Fragen stehen nicht als Blätter");
  ok(dom.node("blatt_0").hidden === false && dom.node("blatt_1").hidden === true,
    "es steht nicht genau ein Blatt vorne");
  ok(/Schritt 1 von 3/.test(dom.node("bogenStand").textContent),
    `der Stand stimmt nicht: ${dom.node("bogenStand").textContent}`);
  // Und derselbe Stand steht sichtbar als Balken oben.
  ok(dom.node("bogenFortschritt").hidden === false, "der Fortschritt wird nicht gezeigt");
  ok(/1 \/ 3/.test(dom.node("bogenSchrittZahl").textContent),
    `die Schrittzahl stimmt nicht: ${dom.node("bogenSchrittZahl").textContent}`);
  ok(/^3[0-9]%$/.test(String(dom.node("bogenBalken").style.width || "")),
    `der Balken steht nicht bei einem Drittel: ${dom.node("bogenBalken").style.width}`);
  ok(dom.node("bogenZurueck").hidden === true, "auf dem ersten Blatt steht ein Zurück");
  ok(dom.node("bogenWeiter").hidden === false, "es gibt keinen Weg weiter");
  ok(dom.node("submit").hidden === true,
    "gesendet werden kann schon vom ersten Blatt aus");

  /* Alle Felder bleiben im Dokument — ein verborgenes Blatt darf keine
     Eingabe verlieren. */
  ok(!!dom.node("q_6"), "die Felder späterer Blätter fehlen im Dokument");

  // Ohne Pflichtangabe kein Weiterkommen — und es wird gesagt, was fehlt.
  dom.node("bogenWeiter").click();
  ok(dom.node("blatt_0").hidden === false, "die Strecke lässt ohne Pflichtangabe weiter");
  ok(/Betrieb/.test(dom.node("need").textContent),
    `es wird nicht gesagt, was fehlt: ${dom.node("need").textContent}`);
  ok(/diesem Schritt|Hier fehl/.test(dom.node("need").textContent),
    "die Meldung spricht nicht von dem Schritt, der vorne liegt");

  // Ausgefüllt: weiter, zurück, und der Stand zählt mit.
  dom.node("q_0").value = "Gärtnerei Lehner";
  dom.node("q_1").value = "Laurin";
  dom.node("q_2").value = "kontakt@example.ch";
  dom.node("bogenWeiter").click();
  ok(dom.node("blatt_1").hidden === false && dom.node("blatt_0").hidden === true,
    "das zweite Blatt kommt nicht nach vorne");
  ok(/Schritt 2 von 3/.test(dom.node("bogenStand").textContent), "der Stand zählt nicht mit");
  ok(/2 \/ 3/.test(dom.node("bogenSchrittZahl").textContent), "der Balken zählt nicht mit");
  ok(dom.node("bogenZurueck").hidden === false, "es gibt keinen Weg zurück");
  dom.node("bogenZurueck").click();
  ok(dom.node("blatt_0").hidden === false, "zurück führt nicht zum ersten Blatt");

  // Auf dem letzten Blatt tritt „Weiter" ab und das Senden erscheint.
  dom.node("q_3").value = "Website";
  dom.node("bogenWeiter").click();
  dom.node("bogenWeiter").click();
  ok(/Schritt 3 von 3/.test(dom.node("bogenStand").textContent), "der letzte Schritt wird nicht erreicht");
  ok(String(dom.node("bogenBalken").style.width) === "100%",
    `der Balken ist am Ende nicht voll: ${dom.node("bogenBalken").style.width}`);
  ok(dom.node("bogenWeiter").hidden === true, "auf dem letzten Blatt steht noch ein Weiter");
  ok(dom.node("submit").hidden === false, "auf dem letzten Blatt fehlt das Senden");
  ok(dom.node("submit").getAttribute("aria-disabled") === "false",
    "vollständig ausgefüllt bleibt das Senden gesperrt");
}

/* ══ 3. Wer eine Pflichtangabe vergisst, sieht sie ════════════════════════ */
{
  const { dom } = await seite(daten());
  dom.node("q_0").value = "Gärtnerei Lehner";
  dom.node("q_1").value = "Laurin";
  dom.node("q_2").value = "kontakt@example.ch";
  dom.node("bogenWeiter").click();      // Blatt 2 — dort fehlt die Auswahl
  dom.node("q_3").value = "Website";
  dom.node("bogenWeiter").click();      // Blatt 3
  dom.node("q_3").value = "";           // die Pflicht wieder entleeren
  dom.node("form").fire("submit", { preventDefault() {} });
  ok(dom.node("blatt_1").hidden === false,
    "das Senden springt nicht zu dem Blatt, auf dem die Angabe fehlt");
}

/* ══ 3b. Das Eintragsfeld muss zu SEHEN sein ══════════════════════════════
   Ein durchsichtiges Feld ist kein Feld. Frueher schlug eine Regel auf
   `aria-invalid="true"` die Flaechenfarbe — genau die Zeilen, in die man
   schreiben soll, sahen aus wie die Beschriftung daneben. Das darf auch im
   dunklen Kleid nicht wiederkommen. */
{
  const eng = stil.replace(/\s*\n\s*/g, "");
  const feld = /body\[data-bogen="1"\] input,[^{]*\{([^}]*)\}/.exec(eng);
  ok(!!feld && /background:var\(--bg1\)/.test(feld[1]),
    "die Eintragsfläche hat keine eigene Farbe — man sieht nicht, wo geschrieben wird");
  ok(!!feld && /border:1px solid var\(--li\)/.test(feld[1]),
    "das Eingabefeld hat keinen sichtbaren Rand");
  const invalid = /body\[data-bogen="1"\] \[aria-invalid="true"\]\{([^}]*)\}/.exec(eng);
  ok(!invalid || !/background:/.test(invalid[1]),
    "eine offene Pflichtangabe verliert ihre Eintragsfläche");
  // Der Fokus ist sichtbar — und zwar am Feld, nicht nur am Rahmen darum.
  ok(/input:focus-visible[^{]*\{[^}]*outline:2px solid var\(--lime\)/.test(eng),
    "ein Feld im Fokus ist nicht erkennbar — Tastaturbedienung wird zum Raten");
  ok(/label:focus-within\{[^}]*border-color:var\(--lime\)/.test(eng),
    "die Zeile, in der gearbeitet wird, hebt sich nicht ab");
}

/* ══ 4. Es ist DASSELBE FlowerTech wie auf der Hauptseite ═════════════════
   Auftrag (11.09.2026): „eigentlich soll das im styl von flowertech dieses
   moderne haben" — identische Markenfarben, Typo und Logo, keine neue Site.
   Geprueft wird deshalb gegen index.html, nicht gegen einen Geschmack. */
{
  const haupt = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const bogen = stil.split('body[data-bogen="1"]').slice(1).join(" ");
  ok(bogen.length > 400, "es gibt gar keine eigene Gestalt für den Bogen");

  // 4a) Die Farbwerte stammen aus der Hauptseite — Wert für Wert.
  const wert = (quelle, name) => {
    const t = new RegExp("--" + name + ":\\s*(#[0-9a-f]{3,6})", "i").exec(quelle);
    return t ? t[1].toLowerCase() : null;
  };
  ["lime", "pink", "cyan", "violet"].forEach((n) => {
    const dort = wert(haupt, n);
    const hier = wert(stil, n);
    ok(!!dort && dort === hier,
      `die Marke „${n}“ weicht von flowertech.ch ab: ${hier} statt ${dort}`);
  });
  ok(/--bg0:#000/.test(stil.replace(/\s/g, "")),
    "der Bogen steht nicht auf der schwarzen Fläche der Hauptseite");
  // Kein Papierton mehr — der Grundton der alten Fassung ist fort.
  ok(!/--pa:#/.test(stil), "der graue Papierton steht weiterhin im Stil");

  // 4b) Die Blüte ist dieselbe: sechs Blätter, sechs Farben, weisser Kern.
  const kopf = (/<header class="bg-kopf">[\s\S]*?<\/header>/.exec(page) || [""])[0];
  ok(!!kopf, "der Bogen hat keinen eigenen Kopf");
  ok(/<svg[\s\S]*?<\/svg>/.test(kopf), "im Kopf steht keine Blüte");
  const bluete = (/<svg[\s\S]*?<\/svg>/.exec(kopf) || [""])[0];
  const petalPfad = "M50 47 C38.5 39 37.5 17 50 6 C62.5 17 61.5 39 50 47 Z";
  ok(haupt.includes(petalPfad) && bluete.includes(petalPfad),
    "die Blüte hat nicht dieselbe Form wie auf flowertech.ch");
  ["#c8ff2e", "#25d5ff", "#3765ff", "#a06bff", "#ff3ea5", "#ff7a1a"].forEach((f) => {
    ok(bluete.includes(f), `der Blüte fehlt die Markenfarbe ${f}`);
  });
  ok(/rotate\(300 50 50\)/.test(bluete), "die Blüte hat nicht alle sechs Blätter");
  ok(/aria-hidden="true"/.test(bluete), "die Blüte wird vorgelesen, obwohl sie nur schmückt");
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(kopf), "im Kopf des Bogens steht ein Emoji statt der Marke");
  ok(/id="title"/.test(kopf) && /id="subtitle"/.test(kopf),
    "Titel und Absender stehen nicht im Kopf des Bogens");

  // 4c) Die Amtsformular-Merkmale sind weg.
  ok(!/--mo:ui-monospace/.test(stil.replace(/\s/g, "")),
    "die Beschriftungen laufen weiterhin in Schreibmaschinenschrift");
  // Kommentare erreichen niemanden und duerfen die alte Sprache erklaeren —
  // geprueft wird, was WIRKLICH auf dem Schirm landet.
  const lieferbar = page.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  ok(!/Blatt \d| BLATT /.test(lieferbar),
    "irgendwo steht noch „Blatt …“ — der Weg zählt Schritte");
  const eng = bogen.replace(/\s*\n\s*/g, "");
  ok(/\.bg-nr\{display:none\}/.test(eng), "die Blattköpfe stehen noch über den Fragen");
  // Weiche Flächen und runde Knöpfe wie auf der Hauptseite.
  ok(/label\{[^}]*border-radius:18px/.test(eng), "die Felder sind weiterhin kantig");
  ok(/\.bg-steuer button\{[^}]*border-radius:100px/.test(eng),
    "die Knöpfe sind keine Pillen wie auf flowertech.ch");
  const hauptKnopf = /^\s*\.bttn\s*\{([^}]*)\}/m.exec(haupt);
  ok(!!hauptKnopf && /background:\s*#fff/.test(hauptKnopf[1])
    && /border-radius:\s*100px/.test(hauptKnopf[1]),
    `der Knopf der Hauptseite sieht anders aus als angenommen: ${hauptKnopf && hauptKnopf[1]}`);
  const hauptHover = /^\s*\.bttn:hover\s*\{([^}]*)\}/m.exec(haupt);
  ok(!!hauptHover && /background:\s*var\(--lime\)/.test(hauptHover[1]),
    "der Knopf der Hauptseite wird beim Überfahren nicht limette");
  ok(/\.bg-steuer button\{[^}]*background:#fff/.test(eng),
    "der Knopf ist nicht weiss wie auf der Hauptseite");
  ok(/\.bg-steuer button:hover\{[^}]*background:var\(--lime\)/.test(eng),
    "der Knopf wird beim Überfahren nicht limette wie auf der Hauptseite");

  // 4d) Keine toten Ränder: der Inhalt steht in einer lesbaren Spalte auf
  //     durchgehend schwarzem Grund — kein Blatt, das irgendwo aufhört.
  const inhalt = /#content\{([^}]*)\}/.exec(eng);
  ok(!!inhalt && /background:transparent/.test(inhalt[1]),
    "der Bogen liegt weiterhin auf einer eigenen hellen Fläche");
  ok(!!inhalt && /border-left|border-right/.test(inhalt[1]) === false,
    "der Bogen hat weiterhin Blattränder");
  ok(!!inhalt && /max-width:760px/.test(inhalt[1]), "die Spalte hat keine lesbare Breite");

  // 4e) Wer keine Bewegung will, bekommt keine.
  ok(/@media\(prefers-reduced-motion:reduce\)/.test(stil.replace(/\s/g, "")),
    "es gibt keine Rücksicht auf prefers-reduced-motion");
  const ruhe = /@media\(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n  \}/
    .exec(stil.replace(/\s*\n\s*/g, "\n  ")) || [];
  ok(/transition:none/.test(String(ruhe[1] || stil)), "die Übergänge lassen sich nicht abschalten");
}

/* ══ 5. Die Mechanik ist unangetastet ═════════════════════════════════════
   Das war Gestaltung — Fragen, Ids, Pflichtangaben, Vorbelegung, Upload und
   Versandweg durften sich dabei NICHT ändern. */
{
  ok(/id="q_" \+ i|"q_" \+ i/.test(script), "die Frage-Ids werden anders gebildet");
  ok(/aria-required="true"/.test(script), "die Pflichtkennzeichnung ist verschwunden");
  ok(/id="visionRoomMount"/.test(page), "der Vision Room hat keinen Platz mehr");
  ok(/FlowerTechVisionRoom/.test(script), "der Vision Room ist nicht mehr derselbe Baustein");
  ok(/id="vrCarriers"/.test(page), "die Trägerfelder des Vision Rooms fehlen");
  ok(/var FORM_BASE = "https:\/\/jupidu-36804-default-rtdb/.test(script),
    "der Weg zum veröffentlichten Fragebogen wurde verändert");
  ok(/var PORTAL_ENDPOINT = "https:\/\/management-xo2-pro\.netlify\.app/.test(script),
    "der Versandweg wurde verändert");
  ok(/var UPLOAD_ENDPOINT = "https:\/\/management-xo2-pro\.netlify\.app/.test(script),
    "der Weg für Dateien wurde verändert");
  ok(/id="hp"/.test(page), "die Spamfalle ist verschwunden");
}

console.log(`Bogen: ok (${geprueft} Pruefungen)`);
