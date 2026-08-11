/*
 * Die echte FlowerTech-Kopfzeile — im äusseren Dokument, nicht im Rahmen.
 * ---------------------------------------------------------------------------
 * Der Anlass war eine Abnahme in Chrome auf
 * `flowertech.ch/fragebogen.html?e=<token>`: Sichtbar waren die Vorschau, ihr
 * Desktop/Mobil-Paar und die rechte Änderungsleiste — die schmale dunkle
 * Cockpit-Kopfzeile aber nicht. Die Umschalter, die man im Bild sah, gehörten
 * der eingebetteten Beispielseite und zählen nicht: Was in `#pvFrame` steht,
 * ist eine fremde Anwendung.
 *
 * Dieser Test hält deshalb fest, was FlowerTech selbst rendert:
 *
 *   1. Die Kopfzeile steht STATISCH im Dokument — nicht in einem iframe, nicht
 *      erst durch Skript erzeugt, und mit `data-ft`-Marken, an denen man sie in
 *      DevTools und hier eindeutig wiedererkennt.
 *   2. Sie trägt links FlowerTech und den datengetriebenen Namen des Vorhabens,
 *      mittig die fünf Umschalter, rechts Mobil und «Änderungswunsch».
 *   3. Jeder Umschalter ERSETZT die zentrale Ansicht — nie zwei gleichzeitig,
 *      keine Kachelreihe.
 *   4. «Änderungswunsch» führt aus jeder Ansicht zurück auf Website mit
 *      sichtbarer Änderungsleiste und Fokus im Feld.
 *   5. Kopfzeile und Vorschaurahmen widersprechen sich beim Mobil-Schalter nie.
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
const markup = page.slice(0, page.indexOf("<script src="));

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

const TOKEN = "K".repeat(32);
const IDS = [
  "loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
  "form", "fields", "hp", "submit", "need", "status", "footer",
  "answered", "answeredTitle", "answeredText", "area",
  "tileTest", "tileOffer", "tilePreview", "tileContract", "tileAdmin", "tileTerms",
  "ck", "ckTop", "ckViews", "ckProject", "ckMobil", "ckWish", "ckStage", "ckSide", "ckLock",
  "ckView_website", "ckView_verwaltung", "ckView_offerte", "ckView_agb", "ckView_fragebogen",
  "ckWishes", "crArea", "crTitle", "pvStage", "adminStage",
  "visionRoom", "vrLead", "visionRoomMount", "vrCarriers",
];
const ZENTRAL = ["content", "answered", "tilePreview", "tileAdmin", "tileOffer",
  "tileTest", "tileTerms", "tileContract", "ckLock"];

async function seite(daten, leise) {
  const dom = makeDom();
  IDS.forEach((id) => dom.ensure(id));
  /* Der Ausgangszustand kommt aus dem AUSGELIEFERTEN Markup, nicht aus einer
     Liste im Test: Klassen, `hidden` und die `data-ft`-Marken der Kopfzeile
     stehen danach genau so da wie im Browser. Was der Test über die Kopfzeile
     behauptet, behauptet er damit über die echte Seite. */
  dom.register(markup);
  const posted = [];
  const fetchDouble = (url, init) => {
    posted.push({ url, init });
    if (String(url).includes("intakeForms")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(daten) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  };
  dom.window.location.search = "?e=" + TOKEN;
  dom.window.fetch = fetchDouble;
  const echtesGet = dom.document.getElementById;
  dom.document.getElementById = (id) => echtesGet(id) || (/^q_\d+$/.test(id) ? dom.ensure(id, "INPUT") : null);
  const ctx = {
    window: dom.window, document: dom.document, location: dom.window.location,
    setTimeout: dom.window.setTimeout, clearTimeout() {},
    // Der absichtlich stolpernde Bereich in Abschnitt 7 warnt zu Recht — im
    // Testprotokoll saehe die Warnung aber wie ein Fehler aus.
    console: leise ? Object.assign({}, console, { warn() {} }) : console,
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object,
    fetch: fetchDouble,
  };
  ctx.globalThis = ctx;
  vm.runInContext(script, vm.createContext(ctx));
  await new Promise((r) => setTimeout(r, 0));
  return { dom, posted };
}

const URL_LEHNER = "https://beispiel-lehner.netlify.app/";
const daten = (extra) => Object.assign({
  schema: 1,
  title: "Lehner Gartenbau",
  intro: "Kurz ein paar Fragen.",
  status: "answered",
  company: { name: "FlowerTech" },
  generation: 1,
  questions: [
    { key: "name", label: "Ansprechperson", type: "text", role: "contactName", required: true, hint: "", options: [], vision: "" },
  ],
  stage: "preview",
  tiles: {
    testService: {
      label: "Leistungsübersicht · TEST", test: true, binding: false,
      title: "Website-Neukonzept Lehner",
      costStatus: "Kosten noch offen — keine verbindliche Preisangabe",
      summary: "Startseite, Menü, Kontakt.",
      currentUrl: "https://alt.lehner.ch/", previewUrl: URL_LEHNER,
      releasedAt: "2026-08-09T07:00:00.000Z", notice: "Unverbindliche Testansicht.",
    },
    offer: null,
    preview: { label: "Website-Vorschau & Änderungswünsche", url: URL_LEHNER,
      releasedAt: "2026-08-09T08:00:00.000Z", source: "claude-code", provisional: false, feedback: true },
    contract: null,
    admin: { label: "Verwaltung", url: "https://admin.lehner.ch/login" },
    terms: {
      label: "Standard-AGB", version: "0.1-test",
      intro: "Diese Bedingungen gelten für alle FlowerTech-Projekte.",
      notice: "Testfassung — rechtlich noch nicht geprüft.",
      sections: [{ title: "1 Geltungsbereich", body: "Diese AGB gelten für alle Leistungen." }],
    },
  },
  updatedAt: "2026-08-10T10:00:00.000Z",
}, extra || {});

const zentralSichtbar = (dom) => ZENTRAL.filter((id) => dom.node(id) && dom.node(id).hidden === false);
const zeige = (dom, key) => dom.node("ckView_" + key).click();

/* ══ 1. Die Kopfzeile gehört dem äusseren Dokument ═════════════════════════ */
{
  /* Statisch, nicht erst durch Skript: Sie steht im ausgelieferten HTML. Wer
     in Chrome „View Source" drückt, findet sie dort — und zwar ausserhalb
     jedes Rahmens, denn dieses Dokument enthält statisch gar keinen. */
  ok(/<header class="ck-top" id="ckTop" data-ft="cockpit-header">/.test(markup),
    "die Cockpit-Kopfzeile steht nicht statisch im Dokument");
  ok(!/<iframe/i.test(markup),
    "im statischen Dokument steht ein Rahmen — die Kopfzeile wäre nicht mehr eindeutig aussen");
  const kopfAb = markup.indexOf('data-ft="cockpit-header"');
  ok(kopfAb > markup.indexOf('<div class="ck" id="ck"'),
    "die Kopfzeile steht nicht im Cockpit");
  ok(kopfAb < markup.indexOf('<div class="ck-body">'),
    "die Kopfzeile steht nicht ÜBER der zentralen Ansicht");
  ok(kopfAb < markup.indexOf('id="ckStage"'), "die Kopfzeile steht nicht über der Bühne");

  // Die Marken, an denen FlowerTechs eigene Bedienung erkennbar ist.
  ['data-ft="brand"', 'data-ft="views"', 'data-ft="mobil"', 'data-ft="wish"', 'data-ft="project"']
    .forEach((marke) => ok(markup.includes(marke), `in der Kopfzeile fehlt ${marke}`));
  ok(/data-ft="view"/.test(script), "die Umschalter tragen keine FlowerTech-Marke");

  // Sie ist links mit FlowerTech beschriftet und liegt über allem.
  const kopf = markup.slice(kopfAb, markup.indexOf("</header>", kopfAb));
  ok(/<b>FlowerTech<\/b>/.test(kopf), "die Kopfzeile nennt FlowerTech nicht");
  ok(/Änderungswunsch/.test(kopf), "der Knopf «Änderungswunsch» steht nicht in der Kopfzeile");
  ok(/z-index:2/.test(page), "die Kopfzeile kann von der Bühne überdeckt werden");

  /* Und sie ist erst da, wenn es etwas zu bedienen gibt: `display:flex` schlägt
     sonst das `hidden` des Browsers, und über den Daten stünde eine leere
     Kopfzeile ohne Umschalter — genau das Bild, das die Abnahme meldete. */
  ok(/\.ck\[hidden\]\{display:none\}/.test(page),
    "die Cockpit-Hülle erscheint schon vor den Daten");
}

/* ══ 2. Was die Kopfzeile im Betrieb trägt ═════════════════════════════════ */
{
  const { dom } = await seite(daten());
  ok(dom.node("ck").hidden === false, "das Cockpit bleibt zu");
  ok(dom.documentElement.getAttribute("data-ft-cockpit"),
    "am Dokument fehlt die Baumarke — die Abnahme kann die Fassung nicht prüfen");

  // Links: FlowerTech und der Name des Vorhabens, aus den Daten.
  ok(dom.node("ckProject").textContent === "Lehner Gartenbau",
    `der Projektname stimmt nicht: ${dom.node("ckProject").textContent}`);

  // Mitte: fünf eindeutige Umschalter, jeder als FlowerTech-Element erkennbar.
  const nav = String(dom.node("ckViews").innerHTML || "");
  [["website", "Website"], ["verwaltung", "Verwaltung"], ["offerte", "Offerte"],
    ["agb", "AGB &amp; Kunde"], ["fragebogen", "Fragebogen"]].forEach(([key, label]) => {
    ok(nav.includes('id="ckView_' + key + '"'), `der Umschalter ${key} fehlt`);
    ok(nav.includes(label), `der Umschalter ${key} ist nicht mit „${label}“ beschriftet`);
    ok(dom.node("ckView_" + key).getAttribute("data-ft") === "view",
      `der Umschalter ${key} ist nicht als FlowerTech-Element erkennbar`);
    ok(dom.node("ckView_" + key).getAttribute("data-ansicht") === key,
      `der Umschalter ${key} nennt seine Ansicht nicht`);
  });
  ok((nav.match(/data-ft="view"/g) || []).length === 5,
    "die Kopfzeile trägt nicht genau fünf Umschalter");

  // Rechts: Mobil und ein unmissverständlicher «Änderungswunsch».
  ok(dom.node("ckMobil").getAttribute("data-ft") === "mobil", "die Mobil-Umschaltung fehlt");
  ok(dom.node("ckWish").getAttribute("data-ft") === "wish", "der Änderungswunsch-Knopf fehlt");

  // Website ist die Startansicht — bei fK-Lehner steht eine Vorschau bereit.
  ok(dom.node("ckView_website").getAttribute("aria-selected") === "true",
    "die Startansicht ist nicht die Website");
  ok(zentralSichtbar(dom).join() === "tilePreview",
    `zentral steht nicht nur die Vorschau: ${zentralSichtbar(dom).join(", ")}`);
  ok(dom.node("ckSide").hidden === false, "die Änderungsleiste fehlt neben der Vorschau");

  /* Die Kopfzeile ist FlowerTechs eigene: Ihre Umschalter stecken NICHT in der
     Vorschau. Was dort an Reitern zu sehen ist, gehört der fremden Seite. */
  const kachel = String(dom.node("tilePreview").innerHTML || "");
  ok(!/data-ft="view"/.test(kachel), "die Umschalter stecken in der Vorschau statt in der Kopfzeile");
  ok(/id="pvFrame"/.test(kachel), "die Vorschau wird nicht eingebettet gezeigt");
}

/* ══ 3. Jeder Umschalter ersetzt die Mitte ═════════════════════════════════ */
{
  const { dom } = await seite(daten());
  const erwartet = {
    website: "tilePreview", verwaltung: "tileAdmin", offerte: "tileTest",
    agb: "tileTerms", fragebogen: "answered",
  };
  Object.keys(erwartet).forEach((key) => {
    zeige(dom, key);
    const zentral = zentralSichtbar(dom);
    ok(zentral.length === 1,
      `in «${key}» stehen ${zentral.length} Bereiche zentral: ${zentral.join(", ")}`);
    ok(zentral[0] === erwartet[key],
      `«${key}» zeigt ${zentral[0]} statt ${erwartet[key]}`);
    ok(dom.node("ckView_" + key).getAttribute("aria-selected") === "true",
      `«${key}» ist nach dem Klick nicht als aktiv markiert`);
    const andere = Object.keys(erwartet).filter((k) => k !== key)
      .filter((k) => dom.node("ckView_" + k).getAttribute("aria-selected") === "true");
    ok(!andere.length, `neben «${key}» ist auch «${andere.join(", ")}» aktiv`);
  });
}

/* ══ 4. «Änderungswunsch» führt aus jeder Ansicht zum Ziel ═════════════════ */
{
  for (const start of ["verwaltung", "offerte", "agb", "fragebogen"]) {
    const { dom } = await seite(daten());
    zeige(dom, start);
    let fokus = false;
    dom.node("crTitle").focus = () => { fokus = true; };
    dom.node("ckWish").click();
    ok(dom.node("ckView_website").getAttribute("aria-selected") === "true",
      `aus «${start}» führt der Änderungswunsch nicht zur Website`);
    ok(dom.node("ckSide").hidden === false,
      `aus «${start}» bleibt die Änderungsleiste zu`);
    ok(fokus, `aus «${start}» landet der Fokus nicht im Feld`);
    ok(zentralSichtbar(dom).join() === "tilePreview",
      `aus «${start}» steht zentral nicht die Vorschau`);
  }
}

/* ══ 5. Ein Mobil-Schalter, zwei Anzeigen — nie widersprüchlich ════════════ */
{
  const { dom } = await seite(daten());
  const stand = () => [
    dom.node("ckMobil").getAttribute("aria-pressed"),
    dom.node("pvStage").getAttribute("data-view"),
    dom.node("pvDesktop") ? dom.node("pvDesktop").getAttribute("aria-pressed") : null,
    dom.node("pvMobil") ? dom.node("pvMobil").getAttribute("aria-pressed") : null,
  ].join("|");

  dom.node("ckMobil").click();
  ok(stand() === "true|mobil|false|true", `nach Mobil aus der Kopfzeile: ${stand()}`);
  dom.node("pvDesktop").click();
  ok(stand() === "false|desktop|true|false", `nach Desktop am Rahmen: ${stand()}`);
  dom.node("pvMobil").click();
  ok(stand() === "true|mobil|false|true", `nach Mobil am Rahmen: ${stand()}`);
}

/* ══ 6. Der Name kommt aus den Daten — erfunden wird keiner ════════════════ */
{
  // Der Vorgabetitel des Fragebogens benennt kein Vorhaben: dann greift der
  // Titel der Leistungsübersicht.
  const a = await seite(daten({ title: "Ihre Angaben" }));
  ok(a.dom.node("ckProject").textContent === "Website-Neukonzept Lehner",
    `Ersatzname falsch: ${a.dom.node("ckProject").textContent}`);

  // Gibt es gar nichts, bleibt die Zeile leer — statt eines erfundenen Namens.
  const b = await seite(daten({
    title: "Ihre Angaben",
    tiles: { testService: null, offer: null, preview: null, contract: null, admin: null, terms: null },
  }));
  ok(b.dom.node("ckProject").textContent === "", "die Seite erfindet einen Projektnamen");
  // Die Kopfzeile steht trotzdem — mit dem Fragebogen als Startansicht.
  ok(b.dom.node("ck").hidden === false, "ohne Freigaben verschwindet die Kopfzeile");
  ok(b.dom.node("ckView_fragebogen").getAttribute("aria-selected") === "true",
    "ohne Vorschau ist der Fragebogen nicht die Startansicht");
}

/* ══ 7. Ein stolpernder Bereich nimmt die Kopfzeile nicht mit ══════════════ */
{
  /* Der Aufbau der Bereiche läuft VOR dem Cockpit. Stolpert einer über eine
     unerwartete Form in den Daten, darf das nicht die ganze Seite kosten —
     sonst steht die Vorschau da und die Kopfzeile fehlt. Genau dieses Bild
     meldete die Abnahme. */
  const kaputt = daten();
  kaputt.tiles.terms = { label: "Standard-AGB", version: "0.1-test", sections: {
    get length() { throw new Error("unerwartete Form"); },
  } };
  const { dom } = await seite(kaputt, true);
  ok(dom.node("ck").hidden === false, "ein stolpernder Bereich nimmt das ganze Cockpit mit");
  ok(dom.node("ckView_website").getAttribute("aria-selected") === "true",
    "nach einem stolpernden Bereich fehlt die Startansicht");
  ok(dom.node("tilePreview").hidden === false, "die Vorschau fehlt");
  zeige(dom, "agb");
  ok(dom.node("tileTerms").hidden === true && dom.node("ckLock").hidden === false,
    "der stolpernde Bereich zeigt keinen erklärten Sperrzustand");
}

console.log(`Cockpit-Kopfzeile: ok (${checks} Pruefungen)`);
