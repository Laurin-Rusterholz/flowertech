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
import { versteckt, passt, beschreibe, trotzHiddenSichtbar, el as cssEl } from "./css-sichtbarkeit.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, "fragebogen.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
const markup = page.slice(0, page.indexOf("<script src="));
const css = /<style>([\s\S]*?)<\/style>/.exec(page)[1];
/* Die Baumarke, die die Seite selbst setzt — die Abnahme liest sie in Chrome
   als `document.documentElement.dataset.ftCockpit`. */
const BAUMARKE = /var CK_BUILD = "([^"]+)"/.exec(script)[1];

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

const TOKEN = "K".repeat(32);
const IDS = [
  "loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
  "form", "fields", "hp", "submit", "need", "status", "footer",
  "answered", "answeredTitle", "answeredText", "area",
  "tileTest", "tileOffer", "tilePreview", "tileContract", "tileAdmin", "tileTerms",
  "ck", "ckTop", "ckViews", "ckProject", "ckMobil", "ckWish", "ckStage", "ckSide", "ckLock",
  "ckView_website", "ckView_verwaltung", "ckView_offerte", "ckView_vertrag",
  "ckView_agb", "ckView_fragebogen",
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

/* ══ 1b. Sie steht nicht nur da — sie ist zu sehen ═════════════════════════ */
{
  /* Der gemeldete Befund: `[data-ft="cockpit-header"]` existierte genau einmal,
     enthielt alle fünf Umschalter — und war in Chrome unsichtbar
     (`isVisible() === false`). Schuld war eine einzige Regel:
     `body.ck-on header{display:none}`, gedacht für den Seitenkopf, wirksam für
     JEDEN <header> — und die Kopfzeile des Cockpits IST einer.

     Deshalb wird hier der ganze Pfad gelesen, so wie ihn der Browser liest:
     html › body.ck-on › .wrap › #ck › header#ckTop. Ein verstecktes Elternteil
     zählt genauso wie ein verstecktes Element. */
  const pfad = [
    cssEl("html", "", [], { "data-ft-cockpit": BAUMARKE }),
    cssEl("body", "", ["ck-on"]),
    cssEl("div", "", ["wrap"]),
    // Zur Laufzeit ist `hidden` entfernt — genau der Zustand, den die Abnahme sah.
    cssEl("div", "ck", ["ck"]),
    cssEl("header", "ckTop", ["ck-top"], { "data-ft": "cockpit-header" }),
  ];
  const gruende = versteckt(css, pfad);
  ok(!gruende.length,
    "die Kopfzeile ist im Betrieb unsichtbar: " + gruende.join(" · "));

  // Dasselbe für alles, was in ihr bedient wird.
  [
    cssEl("nav", "ckViews", ["ck-views"], { "data-ft": "views" }),
    cssEl("div", "", ["ck-brand"], { "data-ft": "brand" }),
    cssEl("div", "", ["ck-right"]),
  ].forEach((kind) => {
    const tief = pfad.concat([kind]);
    const g = versteckt(css, tief);
    ok(!g.length, `${beschreibe(kind)} in der Kopfzeile ist unsichtbar: ${g.join(" · ")}`);
    // Und der Umschalter darin.
    const knopf = cssEl("button", "ckView_website", [], { "data-ft": "view", "aria-selected": "true" });
    if (kind.id === "ckViews") {
      const gg = versteckt(css, tief.concat([knopf]));
      ok(!gg.length, `der Umschalter Website ist unsichtbar: ${gg.join(" · ")}`);
    }
  });

  /* Kein Vorfahre trägt im Betrieb ein `hidden`: `#ck` wird geöffnet, `.wrap`
     und <body> tragen gar keines. */
  ok(!/<div class="wrap"[^>]*\shidden/.test(markup) && !/<body[^>]*\shidden/.test(markup),
    "ein Vorfahre der Kopfzeile ist im Markup versteckt");
  ok(/ck\.hidden = false;/.test(script), "das Cockpit wird nie geöffnet");

  /* Ein echter Layoutzustand: Die Kopfzeile hat eine eigene Höhe, liegt als
     erstes Kind über der Bühne und wird nicht überdeckt. */
  ok(/\.ck-top\{[^}]*height:52px/.test(css.replace(/\s*\n\s*/g, "")),
    "die Kopfzeile hat keine eigene Höhe");
  ok(/\.ck\{[^}]*display:flex[^}]*flex-direction:column/.test(css.replace(/\s*\n\s*/g, "")),
    "das Cockpit stapelt Kopfzeile und Bühne nicht untereinander");
  ok(/\.ck-top\{[^}]*z-index:2/.test(css.replace(/\s*\n\s*/g, "")),
    "die Kopfzeile liegt nicht über der Bühne");

  /* Die Gegenprobe — sonst wäre der Test nur ein Ja-Sager: Der SEITENKOPF wird
     im Cockpit sehr wohl ausgeblendet, und zwar über seine eigene Klasse. */
  const seitenkopf = [
    cssEl("html"), cssEl("body", "", ["ck-on"]), cssEl("div", "", ["wrap"]),
    cssEl("header", "", ["page-head"]),
  ];
  ok(versteckt(css, seitenkopf).length,
    "der alte Seitenkopf steht im Cockpit weiterhin da");
  ok(!/body\.ck-on header\s*\{/.test(css),
    "der Seitenkopf wird wieder über den Elementtyp ausgeblendet — das trifft auch das Cockpit");
  ok(!passt("body.ck-on .page-head", pfad),
    "die Regel für den Seitenkopf trifft die Kopfzeile des Cockpits");

  /* Dasselbe Mass für das, was unter der Kopfzeile steht: die zentrale
     Vorschau und die rechte Leiste in der Startansicht. */
  const koerper = pfad.slice(0, 4).concat([cssEl("div", "", ["ck-body"])]);
  const buehne = koerper.concat([cssEl("div", "ckStage", ["ck-stage"])]);
  const vorschau = buehne.concat([
    cssEl("section", "area"),
    cssEl("article", "tilePreview", ["card", "tile"]),
  ]);
  ok(!versteckt(css, vorschau).length,
    "die zentrale Vorschau ist unsichtbar: " + versteckt(css, vorschau).join(" · "));
  const leiste = koerper.concat([cssEl("aside", "ckSide", ["ck-side"])]);
  ok(!versteckt(css, leiste).length,
    "die rechte Änderungsleiste ist unsichtbar: " + versteckt(css, leiste).join(" · "));

  /* Und die Gegenprobe nach unten: Was `hidden` trägt, ist auch wirklich weg —
     sonst stünde die Formularwand wieder unter der Vorschau.

     Geprüft wird das in BEIDEN Zuständen der Bühne. In der Website-Ansicht
     trägt sie `data-rahmen="1"`, und genau dort schlug eine Regel für die
     randlose Kachel (`… .tile{display:flex}`, Spezifität 0,3,0) das
     `.ck [hidden]{display:none}` (0,2,0): Im Website-Tab standen darauf die
     Leistungsübersicht, die Kosten und die externen Verweise neben der
     Website. Eine Regel, die es GIBT, ist eben nicht dieselbe wie eine, die
     GEWINNT. */
  [{}, { "data-rahmen": "1", "data-ansicht": "website" }].forEach((zustand) => {
    const stufe = koerper.concat([cssEl("div", "ckStage", ["ck-stage"], zustand)]);
    const wie = zustand["data-rahmen"] ? "in der Website-Ansicht" : "in einer gelesenen Ansicht";
    const bogen = stufe.concat([cssEl("section", "content", [], { hidden: "" })]);
    ok(versteckt(css, bogen).length, `ein Bereich mit \`hidden\` bleibt ${wie} sichtbar`);
    ["tileAdmin", "tileOffer", "tileTest", "tileTerms", "tileContract"].forEach((id) => {
      const kachel = stufe.concat([
        cssEl("section", "area"),
        cssEl("article", id, ["card", "tile"], { hidden: "" }),
      ]);
      const zurueck = trotzHiddenSichtbar(css, kachel);
      ok(!zurueck, `${id} steht ${wie} trotz \`hidden\` da — zurückgeholt von ${zurueck}`);
    });
    // Die tragende Kachel dagegen ist sichtbar und füllt in der Website-Ansicht.
    const vorne = stufe.concat([
      cssEl("section", "area"),
      cssEl("article", "tilePreview", ["card", "tile"]),
    ]);
    ok(!versteckt(css, vorne).length, `die Vorschau ist ${wie} unsichtbar`);
  });
}

/* ══ 2. Was die Kopfzeile im Betrieb trägt ═════════════════════════════════ */
{
  const { dom } = await seite(daten());
  ok(dom.node("ck").hidden === false, "das Cockpit bleibt zu");
  ok(dom.documentElement.getAttribute("data-ft-cockpit") === BAUMARKE,
    "am Dokument fehlt die Baumarke — die Abnahme kann die Fassung nicht prüfen");

  // Links: FlowerTech und der Name des Vorhabens, aus den Daten.
  ok(dom.node("ckProject").textContent === "Lehner Gartenbau",
    `der Projektname stimmt nicht: ${dom.node("ckProject").textContent}`);

  // Mitte: fünf eindeutige Umschalter, jeder als FlowerTech-Element erkennbar.
  const nav = String(dom.node("ckViews").innerHTML || "");
  [["website", "Website"], ["verwaltung", "Verwaltung"], ["offerte", "Offerte"],
    ["vertrag", "Vertrag"], ["agb", "AGB &amp; Kunde"], ["fragebogen", "Fragebogen"]]
    .forEach(([key, label]) => {
    ok(nav.includes('id="ckView_' + key + '"'), `der Umschalter ${key} fehlt`);
    ok(nav.includes(label), `der Umschalter ${key} ist nicht mit „${label}“ beschriftet`);
    ok(dom.node("ckView_" + key).getAttribute("data-ft") === "view",
      `der Umschalter ${key} ist nicht als FlowerTech-Element erkennbar`);
    ok(dom.node("ckView_" + key).getAttribute("data-ansicht") === key,
      `der Umschalter ${key} nennt seine Ansicht nicht`);
  });
  ok((nav.match(/data-ft="view"/g) || []).length === 6,
    "die Kopfzeile trägt nicht genau sechs Umschalter");
  /* Der Vertrag steht zwischen Offerte und AGB — die Reihenfolge ist die
     Reihenfolge des Vorgangs, nicht die des Zufalls. */
  ok(nav.indexOf('ckView_offerte') < nav.indexOf('ckView_vertrag')
    && nav.indexOf('ckView_vertrag') < nav.indexOf('ckView_agb'),
    "der Vertrag steht nicht zwischen Offerte und AGB & Kunde");

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
    vertrag: "tileContract", agb: "tileTerms", fragebogen: "answered",
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

/* ══ 3b. Im Website-Tab steht die Website — und sonst nichts ═══════════════ */
{
  /* Der Live-Befund: Bei ausgewähltem Tab „Website" stand oben die
     „Leistungsübersicht · TEST" samt Kostenhinweis und den externen Verweisen
     „Vorschlag ansehen" / „Bestehende Website"; die eingebettete Website lag
     darunter. Was zentral sichtbar ist, wird deshalb hier Zeichen für Zeichen
     durchgesehen. */
  const { dom } = await seite(daten());
  const sichtbarerText = () => zentralSichtbar(dom)
    .map((id) => String(dom.node(id).innerHTML || "") + " " + String(dom.node(id).textContent || ""))
    .join(" ");

  zeige(dom, "website");
  const zentral = zentralSichtbar(dom);
  ok(zentral.join() === "tilePreview",
    `im Website-Tab steht zentral auch: ${zentral.filter((i) => i !== "tilePreview").join(", ")}`);

  const text = sichtbarerText();
  ["Leistungsübersicht", "TEST", "Vorschlag ansehen", "Bestehende Website",
    "Kosten noch offen", "Website-Neukonzept"].forEach((wort) => {
    ok(!text.includes(wort), `im Website-Tab steht „${wort}“`);
  });
  // Kein externes Ziel als Verweis: Der Rückweg wird verborgen ausgeliefert.
  ok(!/<a [^>]*href="https?:/.test(String(dom.node("tilePreview").innerHTML || "")
    .replace(/<div class="pv-fallback"[\s\S]*$/, "")),
    "im Website-Tab steht ein externer Verweis über der Website");

  // Genau EINE Rahmenstufe — kein vorgelagerter Artikel, kein zweiter Rahmen.
  const kachel = String(dom.node("tilePreview").innerHTML || "");
  ok((kachel.match(/id="pvStage"/g) || []).length === 1, "es steht nicht genau eine Rahmenstufe da");
  ok((kachel.match(/<iframe/g) || []).length === 1, "es steht nicht genau ein Rahmen da");
  ok(/^(<div class="pv-stage")/.test(kachel.trim()),
    "vor dem Rahmen steht noch etwas anderes");

  /* Der Leistungsumfang steht in der Offerte — dort und nur dort, und in der
     Sprache der Kundschaft: „Offerte in Vorbereitung", Kosten offen, und
     ausdrücklich keine Preiszusage. Kein „TEST", keine Testansicht. */
  zeige(dom, "offerte");
  ok(zentralSichtbar(dom).join() === "tileTest",
    "der Kostenstand steht nicht allein in der Offerte");
  const offerte = sichtbarerText();
  ok(/Offerte in Vorbereitung/.test(offerte), "die Offerte sagt nicht, woran sie ist");
  ok(/Website-Neukonzept Lehner/.test(offerte), "die Offerte nennt das Vorhaben nicht");
  ok(/Leistungsumfang/.test(offerte) && /Startseite/.test(offerte),
    "der Leistungsumfang fehlt in der Offerte");
  ok(/Kosten noch offen/.test(offerte), "der Kostenstand fehlt");
  ok(/keine verbindliche Preiszusage/.test(offerte), "die Unverbindlichkeit steht nicht da");
  ok(/entsteht keine Rechnung/.test(offerte), "es steht nicht da, dass keine Rechnung entsteht");
  ok(/Standard-AGB/.test(offerte), "die Offerte verweist nicht auf die Standard-AGB");
  ["TEST", "Testansicht", "Vorschlag ansehen", "Bestehende Website", "CHF"].forEach((wort) => {
    ok(!offerte.includes(wort), `in der Offerte steht „${wort}“`);
  });
  ok(!/<a [^>]*href="https?:/.test(String(dom.node("tileTest").innerHTML || "")),
    "die Offerte führt aus dem Kundenlink hinaus");
}

/* ══ 3c. Die Verwaltung liegt IM Kundenlink ════════════════════════════════ */
{
  /* Vorher stand hier „öffnet sich in einem eigenen Tab … lässt sich deshalb
     nicht einbetten" samt Verweis nach draussen. Das war ein zweiter Ort — der
     eine Kundenlink hörte dort auf. Jetzt zeigt FlowerTech die Verwaltung
     selbst, im gleichen Bild, mit dem direkten Weg zum Änderungswunsch. */
  const { dom } = await seite(daten());
  zeige(dom, "verwaltung");
  const admin = String(dom.node("tileAdmin").innerHTML || "");

  ok(zentralSichtbar(dom).join() === "tileAdmin",
    "in der Verwaltung steht zentral noch etwas anderes");
  ok(!/<a\s/.test(admin), "die Verwaltung enthält einen Verweis");
  ok(!/https?:\/\//.test(admin), "die Verwaltung zeigt eine Adresse");
  ["Verwaltung öffnen", "in einem eigenen Tab", "nicht in diese Ansicht einbetten",
    "Anmeldebereich", "admin.lehner.ch", "Login", "anmelden"].forEach((wort) => {
    ok(!admin.includes(wort), `in der Verwaltung steht „${wort}“`);
  });
  ok(/Sie bleiben auf dieser Seite/.test(admin), "die Verwaltung sagt nicht, wo man ist");

  // Die Bereiche kommen aus dem Leistungsumfang des Projekts.
  ok(/id="adminAreas"/.test(admin), "die Verwaltung zeigt keine Bereiche");
  ["Startseite", "Menü", "Kontakt"].forEach((name) => {
    ok(admin.includes(name), `der Bereich „${name}“ fehlt in der Verwaltung`);
  });
  // Und sie behauptet nicht, schon mit den Inhalten verbunden zu sein.
  ok(/noch nicht mit Ihren eigenen Inhalten/.test(admin),
    "die Verwaltung behauptet, bereits mit den Inhalten verbunden zu sein");

  /* Aus einem Bereich heraus einen Wunsch anlegen: dieselbe Leiste, Kategorie
     „Verwaltung", Bereich schon im Feld — und nichts wird dabei gesendet. */
  const { dom: d2, posted } = await seite(daten());
  zeige(d2, "verwaltung");
  const vorher = posted.length;
  let fokus = false;
  d2.node("crTitle").focus = () => { fokus = true; };
  d2.node("admWish0").click();
  ok(d2.node("ckSide").hidden === false, "der Wunsch aus der Verwaltung öffnet keine Leiste");
  ok(d2.node("crArea").value === "Verwaltung", "der Wunsch landet nicht im Bereich Verwaltung");
  ok(/^Startseite: /.test(String(d2.node("crTitle").value || "")),
    `der Bereich steht nicht im Feld: ${d2.node("crTitle").value}`);
  ok(fokus, "der Fokus landet nicht im Feld");
  ok(posted.length === vorher, "aus der Verwaltung heraus wurde etwas gesendet");
}

/* ══ 3d. Der Vertrag — ein Entwurf, der sich als solcher zeigt ═════════════ */
{
  const { dom } = await seite(daten());
  zeige(dom, "vertrag");
  const vertrag = String(dom.node("tileContract").innerHTML || "");
  ok(zentralSichtbar(dom).join() === "tileContract", "der Vertrag steht nicht allein");
  ok(/Projektvertrag/.test(vertrag), "die Ansicht ist nicht als Projektvertrag benannt");
  ok(/Entwurf – noch nicht freigegeben/.test(vertrag), "der Entwurfsstatus fehlt");
  ok(/keine Vereinbarung/.test(vertrag) && /begründet keine Verpflichtung/.test(vertrag),
    "der Entwurf grenzt sich nicht von einer Vereinbarung ab");
  ok(/Lehner Gartenbau/.test(vertrag), "der Vertrag nennt das Projekt nicht");
  ok(/Parteien/.test(vertrag) && /noch offen/.test(vertrag),
    "die Parteien und die fehlenden Angaben stehen nicht da");
  ok(/Leistungsumfang/.test(vertrag) && /Startseite/.test(vertrag),
    "der Leistungsumfang fehlt im Vertrag");
  ok(/Standard-AGB/.test(vertrag) && /0\.1-test/.test(vertrag),
    "der Vertrag nennt die Fassung der Standard-AGB nicht");
  // Keine vorgetäuschte Zustimmung: nichts zu unterschreiben, nichts zu bestätigen.
  ["Unterschrift", "unterschreiben", "Zustimmung", "zustimmen", "akzeptieren",
    "verbindlich vereinbart", "rechtsgültig"].forEach((wort) => {
    ok(!vertrag.includes(wort), `im Vertragsentwurf steht „${wort}“`);
  });
  ok(!/<input|<textarea|type="checkbox"/.test(vertrag),
    "der Vertragsentwurf lässt sich ausfüllen");
}

/* ══ 3e. Die Änderungsleiste steht nur, wo geändert wird ═══════════════════ */
{
  const { dom } = await seite(daten());
  [["website", "Website"], ["verwaltung", "Verwaltung"]].forEach(([key, bereich]) => {
    zeige(dom, key);
    ok(dom.node("ckSide").hidden === false, `in «${key}» fehlt die Änderungsleiste`);
    ok(dom.node("crArea").value === bereich,
      `in «${key}» ist der Bereich „${dom.node("crArea").value}“ vorgewählt statt „${bereich}“`);
  });
  ["offerte", "vertrag", "agb", "fragebogen"].forEach((key) => {
    zeige(dom, key);
    ok(dom.node("ckSide").hidden === true, `in «${key}» steht die Änderungsleiste`);
  });
}

/* ══ 3f. Die Website bleibt benutzbar ══════════════════════════════════════ */
{
  /* Eine Vorschau, in der sich nicht klicken lässt, ist ein Bildschirmfoto.
     Der Rahmen muss Navigation, Knöpfe und Seitenwechsel zulassen — und
     zugleich diese Seite hier nicht ersetzen können. */
  ok(/sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/.test(script),
    "der Rahmen lässt die Website nicht benutzen");
  // Geprüft werden die Schranken selbst, nicht der Fliesstext daneben.
  const schranken = (script.match(/sandbox="[^"]*"/g) || []).join(" ");
  ["allow-top-navigation", "allow-popups-to-escape-sandbox", "allow-modals"]
    .forEach((flagge) => {
      ok(!schranken.includes(flagge), `der Rahmen darf zu viel: ${flagge}`);
    });
  const { dom } = await seite(daten());
  const kachel = String(dom.node("tilePreview").innerHTML || "");
  ok(kachel.includes('src="https://beispiel-lehner.netlify.app/?embed=flowertech"'),
    "die Website-Bühne zeigt nicht die vereinbarte Vorschau");
  ok(!/vorschau/i.test(kachel.replace(/Vorschau/g, "")),
    "die Bühne weicht auf einen Vorschau-Unterpfad aus");
  // Nichts liegt über dem Rahmen, was Klicks abfangen könnte.
  ok(!/position:absolute|position:fixed/.test(
    (/\.pv-stage\{[^}]*\}/.exec(css) || [""])[0] + (/\.pv-frame\{[^}]*\}/.exec(css) || [""])[0]),
    "über der Website liegt eine Schicht, die Klicks abfängt");
  ok(!/pointer-events\s*:\s*none/.test(css), "eine Regel schaltet Klicks ab");
}

/* ══ 4. «Änderungswunsch» führt aus jeder Ansicht zum Ziel ═════════════════ */
{
  for (const start of ["verwaltung", "offerte", "vertrag", "agb", "fragebogen"]) {
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
  /* Desktop/Mobil steht NUR in der Kopfzeile. Das zweite Paar am Rahmen ist
     weg — zwei Schalter für dieselbe Sache waren Teil der Doppelung. */
  const kachel = String(dom.node("tilePreview").innerHTML || "");
  ok(!/id="pvDesktop"|id="pvMobil"/.test(kachel),
    "am Rahmen steht wieder ein eigenes Desktop/Mobil-Paar");

  const stand = () => [
    dom.node("ckDesktop").getAttribute("aria-pressed"),
    dom.node("ckMobil").getAttribute("aria-pressed"),
    dom.node("pvStage").getAttribute("data-view"),
  ].join("|");

  ok(stand() === "true|false|desktop", `Ausgangsstand: ${stand()}`);
  dom.node("ckMobil").click();
  ok(stand() === "false|true|mobil", `nach Mobil: ${stand()}`);
  dom.node("ckDesktop").click();
  ok(stand() === "true|false|desktop", `nach Desktop: ${stand()}`);

  /* «Neu laden» lädt genau die eingerahmte Ansicht neu — und räumt dabei
     einen stehengebliebenen Rückweg weg. */
  dom.node("pvFallback").hidden = false;
  const vorher = dom.node("pvFrame").getAttribute("src");
  dom.node("ckReload").click();
  ok(String(dom.node("pvFrame").src || dom.node("pvFrame").getAttribute("src")) === vorher,
    "«Neu laden» verändert die Adresse der Vorschau");
  ok(dom.node("pvFallback").hidden === true, "«Neu laden» lässt den Rückweg stehen");

  /* Breite und Neuladen gehören zur eingerahmten Ansicht — in einer gelesenen
     Ansicht wären sie Knöpfe ohne Gegenstand. */
  zeige(dom, "agb");
  ["ckDesktop", "ckMobil", "ckReload"].forEach((id) => {
    ok(dom.node(id).hidden === true, `${id} steht auch in einer gelesenen Ansicht`);
  });
  zeige(dom, "website");
  ["ckDesktop", "ckMobil", "ckReload"].forEach((id) => {
    ok(dom.node(id).hidden === false, `${id} fehlt in der Website-Ansicht`);
  });
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
