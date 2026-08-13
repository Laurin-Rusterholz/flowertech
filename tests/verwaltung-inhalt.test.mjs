/*
 * Die Verwaltung zeigt, was HEUTE auf der Website steht.
 * ---------------------------------------------------------------------------
 * Der Befund war: „warum kann ich nicht alles über die verwaltung eingeben und
 * ist noch nicht voreingegeben?" — die Bereiche standen leer da („Noch nichts
 * erfasst"), obwohl die Website voller Inhalte ist. Eine Verwaltung, in der
 * man alles neu abtippen muss, ist keine.
 *
 * Die Website legt beim Bauen eine Abschrift ihrer veroeffentlichten Inhalte
 * ab (`inhalt.json`, Repo projekt-lehner). Diese Datei prueft, dass der
 * Kundenlink sie benutzt — und zwar sicher und ehrlich:
 *
 *   1. Vorbelegung: Katzen, Galerie, Kontakt, Recht und Texte stehen drin.
 *   2. Herkunft: gelesen wird NUR von der Herkunft der freigegebenen Vorschau.
 *   3. Eigenes zuerst: was die Kundschaft getippt hat, ueberschreibt nie
 *      wieder die Abschrift.
 *   4. Ehrlich bei Ausfall: Laedt die Abschrift nicht, sagt die Seite das —
 *      und erfindet keine Inhalte.
 *   5. Zugeschnitten: fremde Daten kommen nur als Text und nur in den
 *      erwarteten Feldern an; `javascript:`-Bildadressen fallen weg.
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

let geprueft = 0;
const ok = (bedingung, text) => { assert.ok(bedingung, text); geprueft++; };

const TOKEN = "e".repeat(30);
const VORSCHAU_URL = "https://beispiel-lehner.netlify.app/";
const HERKUNFT = "https://beispiel-lehner.netlify.app";

const IDS = [
  "loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
  "form", "fields", "hp", "submit", "need", "status", "footer",
  "answered", "answeredTitle", "answeredText", "area",
  "tileTest", "tileOffer", "tilePreview", "tileContract", "tileAdmin", "tileTerms",
  "ck", "ckTop", "ckViews", "ckProject", "ckMobil", "ckDesktop", "ckReload", "ckWish",
  "ckStage", "ckSide", "ckLock", "pvFrame", "pickDlg", "changeForm", "changeIntro",
  "ckView_website", "ckView_verwaltung", "ckView_offerte", "ckView_vertrag",
  "ckView_agb", "ckView_fragebogen",
  "ckWishes", "crArea", "crTitle", "pvStage", "adminStage",
  "kbWork", "kbSeite", "kbNavList",
  "visionRoom", "vrLead", "visionRoomMount", "vrCarriers",
];

/* Die Abschrift, wie build.mjs sie erzeugt — mit genau den Feldern, die die
   Verwaltung anbietet. */
const INHALT = {
  hinweis: "Abschrift der veroeffentlichten Inhalte dieser Website.",
  stand: "2026-08-13T05:00:00.000Z",
  eintraege: [
    {
      name: "Daya – Dayanara Brumag*CH", kurz: "Unsere Älteste.",
      geboren: "17. Oktober 2017", merkmale: "BRI c · Lilac",
      bild: "assets/img/cats/dayanara-800.jpg", text: "Dayanara ist die Älteste.",
    },
    {
      name: "Gigi – Gigi Brumag*CH", kurz: "Die Jüngste.",
      geboren: "2. Mai 2021", merkmale: "BRI a · Blau",
      bild: "assets/img/cats/gigi-800.jpg", text: "Gigi liebt Gesellschaft.",
    },
  ],
  galerie: [{ bild: "assets/img/archiv/archiv-01-800.jpg", name: "Kitten aus einem früheren Wurf" }],
  kontakt: [
    { label: "E-Mail", wert: "info@bkh-brumag.ch" },
    { label: "Telefon", wert: "+41 (0)78 678 40 33" },
    { label: "Adresse", wert: "Familie Lehner, 9035 Grub AR, Schweiz" },
  ],
  recht: [
    { label: "Verantwortlich", wert: "Familie Lehner" },
    { label: "Adresse", wert: "Familie Lehner, 9035 Grub AR, Schweiz" },
    { label: "E-Mail", wert: "info@bkh-brumag.ch" },
  ],
  texte: [
    { label: "Startseite · Überschrift", wert: "Ein Kitten, das ein Leben lang Familie ist" },
    { label: "Startseite · Einleitung", wert: "Unsere Kitten wachsen mitten im Familienalltag auf." },
  ],
};

const FRAGEN = [
  { key: "name", label: "Ansprechperson", type: "text", role: "contactName", required: true, hint: "", options: [], vision: "" },
];

const DATEN = {
  schema: 1, title: "Ihre Angaben", intro: "Kurz ein paar Fragen.",
  status: "open", company: { name: "FlowerTech" }, generation: 2,
  questions: FRAGEN, stage: "preview",
  updatedAt: "2026-08-12T10:00:00.000Z",
  tiles: {
    preview: { label: "Website-Vorschau", url: VORSCHAU_URL, releasedAt: "2026-08-12T08:00:00.000Z", feedback: true },
    admin: { label: "Verwaltung", url: "https://admin.example.ch/", note: "Pflege." },
    offer: null, terms: null, contract: null, testService: null,
  },
};

/* Die Seite laufen lassen. `inhaltAntwort` entscheidet, was die Abschrift
   liefert — vorhanden, kaputt oder gar nicht. */
async function seite({ inhaltAntwort = () => ({ ok: true, json: () => Promise.resolve(INHALT) }) } = {}) {
  const dom = makeDom();
  IDS.forEach((id) => dom.ensure(id));
  ["error", "content", "answered", "area", "ck", "ckSide", "ckLock",
   "tileOffer", "tilePreview", "tileAdmin", "tileTerms", "tileTest", "tileContract", "visionRoom"]
    .forEach((id) => { dom.node(id).hidden = true; });

  const geholt = [];
  const gespeichert = {};
  const fetchDouble = (url, init) => {
    geholt.push({ url: String(url), init: init || {} });
    if (String(url).includes("inhalt.json")) return Promise.resolve(inhaltAntwort());
    if (String(url).includes("intakeForms")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(DATEN) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  };

  dom.window.location.search = "?e=" + TOKEN;
  dom.window.fetch = fetchDouble;
  dom.window.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(gespeichert, k) ? gespeichert[k] : null),
    setItem: (k, v) => { gespeichert[k] = String(v); },
  };
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
  // Der Datensatz und danach die Abschrift — beide kommen als Zusage zurück.
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  return { dom, geholt, gespeichert };
}

const verwaltung = (dom) => {
  dom.node("ckView_verwaltung").click();
  return String(dom.node("kbWork").innerHTML || "");
};
const bereich = (dom, id) => {
  dom.node("ckView_verwaltung").click();
  const knopf = dom.node("kbNav_" + id);
  if (knopf) knopf.click();
  return String(dom.node("kbWork").innerHTML || "");
};

/* ══ 1. Gelesen wird nur von der Herkunft der freigegebenen Vorschau ═══════ */
{
  const { dom, geholt } = await seite();
  verwaltung(dom);
  const ruf = geholt.filter((g) => g.url.includes("inhalt.json"));
  ok(ruf.length >= 1, "die Inhalte der Website werden gar nicht geholt");
  ok(ruf[0].url === HERKUNFT + "/inhalt.json",
    `geholt wird ${ruf[0].url} statt ${HERKUNFT}/inhalt.json`);
  ok(ruf[0].init.credentials === "omit", "die Abfrage schickt Zugangsdaten mit");
  ok(ruf.length === 1, `die Abschrift wird ${ruf.length}-mal geholt statt einmal`);
  // Und der Token steht nirgends in dieser Abfrage.
  ok(!ruf[0].url.includes(TOKEN), "der Einladungs-Token steht in der Adresse der Abfrage");
}

/* ══ 2. Katzen stehen da — vorbelegt, nicht „noch nichts erfasst" ══════════ */
{
  const { dom } = await seite();
  const html = bereich(dom, "eintraege");
  ok(!/Noch nichts erfasst/.test(html), "die Katzen stehen weiterhin leer da");
  ok(/Dayanara Brumag/.test(html) && /Gigi Brumag/.test(html),
    "die Katzen der Website fehlen in der Verwaltung");
  ok(/17\. Oktober 2017/.test(html), "das Geburtsdatum ist nicht vorbelegt");
  ok(/BRI c · Lilac/.test(html), "Farbe und Merkmale sind nicht vorbelegt");
  ok(/beispiel-lehner\.netlify\.app\/assets\/img\/cats\/dayanara-800\.jpg/.test(html),
    "die Bildadresse wird nicht auf die Website bezogen");
  // Und es steht dabei, woher das kommt.
  ok(/So steht es heute auf Ihrer Website/.test(html),
    "es steht nicht dabei, dass das der heutige Stand der Website ist");
}

/* ══ 3. Kontakt, Impressum und Texte ebenso ═══════════════════════════════ */
{
  const { dom } = await seite();
  const kontakt = bereich(dom, "kontakt");
  ok(/info@bkh-brumag\.ch/.test(kontakt), "die E-Mail der Website fehlt im Kontakt");
  ok(/\+41 \(0\)78 678 40 33/.test(kontakt), "die Telefonnummer fehlt im Kontakt");

  const recht = bereich(dom, "recht");
  ok(/Familie Lehner/.test(recht), "die Pflichtangaben sind nicht vorbelegt");

  const texte = bereich(dom, "texte");
  ok(/2 Stellen Ihrer Website/.test(texte),
    "der Texte-Bereich sagt nicht, wie viele Stellen es gibt");
  dom.node("kbTexteAn").click();
  const offen = String(dom.node("kbWork").innerHTML || "");
  ok(/Startseite · Überschrift/.test(offen), "die Textstellen der Website fehlen");
  ok(/Ein Kitten, das ein Leben lang Familie ist/.test(offen),
    "der heutige Text der Startseite steht nicht im Feld");
}

/* ══ 4. Was die Kundschaft tippt, gilt — die Abschrift überschreibt nie ════ */
{
  const { dom, gespeichert } = await seite();
  gespeichert["ft-verwaltung-" + TOKEN + "-kontakt"] = JSON.stringify({ 0: "neu@lehner.ch" });
  const kontakt = bereich(dom, "kontakt");
  ok(/neu@lehner\.ch/.test(kontakt), "die eigene Eingabe verschwindet");
  ok(!/value="info@bkh-brumag\.ch"/.test(kontakt),
    "die Abschrift überschreibt die eigene Eingabe");
}

/* ══ 5. Ohne Abschrift: ehrlich, nicht erfunden ═══════════════════════════ */
{
  const fehler = await seite({ inhaltAntwort: () => ({ ok: false, json: () => Promise.resolve({}) }) });
  const html = bereich(fehler.dom, "eintraege");
  ok(/liessen sich nicht laden/.test(html),
    "der Ausfall der Abschrift wird verschwiegen");
  ok(!/So steht es heute auf Ihrer Website/.test(html),
    "die Seite behauptet trotzdem, das sei der Stand der Website");
  ok(/Noch nichts erfasst/.test(html), "ohne Abschrift wird etwas erfunden");
  ok(!/Dayanara/.test(html), "es steht ein Inhalt da, den niemand geliefert hat");

  // Eine leere Abschrift zählt genauso wenig wie gar keine.
  const leer = await seite({
    inhaltAntwort: () => ({ ok: true, json: () => Promise.resolve({ eintraege: [], galerie: [], kontakt: [], recht: [], texte: [] }) }),
  });
  ok(/liessen sich nicht laden/.test(bereich(leer.dom, "eintraege")),
    "eine leere Abschrift wird als Stand der Website ausgegeben");
}

/* ══ 6. Fremde Daten werden zugeschnitten ═════════════════════════════════ */
{
  const boese = await seite({
    inhaltAntwort: () => ({
      ok: true,
      json: () => Promise.resolve({
        eintraege: [{
          name: "<script>alert(1)</script>Katze",
          bild: "javascript:alert(1)",
          heimlich: "sollte nicht ankommen",
          text: "ok",
        }],
        galerie: [{ bild: "http://unverschluesselt.example/bild.jpg", name: "x" }],
        kontakt: [{ label: "E-Mail", wert: "a@b.ch" }],
        recht: [], texte: [],
      }),
    }),
  });
  const html = bereich(boese.dom, "eintraege");
  ok(!/<script>alert/.test(html), "fremdes Markup landet ungefiltert in der Seite");
  ok(!/javascript:/.test(html), "eine javascript:-Adresse wird als Bild übernommen");
  ok(!/sollte nicht ankommen/.test(html), "unbekannte Felder werden mitgeschleppt");
  const galerie = bereich(boese.dom, "galerie");
  /* Eine unverschlüsselte Adresse wird nicht verlinkt, sondern als Pfad an die
     Herkunft der Vorschau gehängt — nie als http:// übernommen. */
  ok(!/"http:\/\//.test(galerie), "eine unverschlüsselte Bildadresse wird übernommen");
}

console.log(`Verwaltung mit Inhalten: ok (${geprueft} Pruefungen)`);
