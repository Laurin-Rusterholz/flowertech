/*
 * Der Live-Befund Lehner — die ganze Kette bis zur echten Renderlogik.
 * ---------------------------------------------------------------------------
 * Der Anlass war ein Widerspruch, den niemand auflösen konnte: In Quantus stand
 * am Projekt Lehner `previewUrl = https://beispiel-lehner.netlify.app/`, die
 * Vorschau-Freigabe war aktiv, und Quantus meldete die Vorschau als sichtbar.
 * Öffnete die Kundschaft die stabile Adresse
 * `https://flowertech.ch/fragebogen.html?e=<token>`, fehlte die Vorschau.
 *
 * Entweder log also die Freigabe — oder diese Seite las beziehungsweise
 * rendere die Daten falsch. Dieser Test klärt die zweite Hälfte der Frage und
 * lässt dazu den Skriptblock von `fragebogen.html` wirklich laufen: mit genau
 * dem Datensatz, den Quantus unter `flowertech/intakeForms/<token>`
 * veröffentlicht.
 *
 * Bewiesen wird — auf genau dieser öffentlichen Kundenadresse:
 *
 *   1. Freigegebene Vorschau + gültige HTTPS-Adresse ⇒ eine sichtbare Kachel
 *      „Website-Vorschau", die AUSGESCHRIEBENE Adresse und ein klarer Einstieg
 *      für Änderungswünsche. Kein Kundenportal, kein zweiter Link.
 *   2. Die freigegebene TEST-Leistungsübersicht steht wirklich da — ohne
 *      Betrag, ohne Status, ausdrücklich als Test.
 *   3. Die zentrale Standard-AGB steht immer da, ohne jede Freigabe.
 *   4. Der Änderungswunsch geht mit demselben Einladungstoken an denselben
 *      Eingang — es entsteht kein zweiter Weg.
 *   5. Eine Testvorschau (manuell hinterlegt, keine bestätigte Claude-Code-
 *      Rückgabe) erscheint vollständig, wird aber als Zwischenstand benannt —
 *      und nie als fertige Fassung ausgegeben.
 *   6. Was NICHT freigegeben ist, existiert auf der Seite nicht.
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

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

const TOKEN = "L".repeat(32);
const IDS = [
  "loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
  "form", "fields", "hp", "submit", "need", "status", "footer",
  "answered", "answeredTitle", "answeredText", "area",
  "tileTest", "tileOffer", "tilePreview", "tileContract", "tileAdmin", "tileTerms",
  // Bereichsleiste und Fortschritt gehoeren seit dem Portal-Umbau dazu.
  // Cockpit: Huelle, Umschalter, Sperrzustand und Aenderungsleiste.
  "ck", "ckViews", "ckProject", "ckMobil", "ckDesktop", "ckReload", "ckWish",
  "ckStage", "ckSide", "ckLock",
  "ckView_website", "ckView_verwaltung", "ckView_offerte", "ckView_agb", "ckView_fragebogen",
  "ckWishes", "crArea", "pvStage", "adminStage",
  "visionRoom", "vrLead", "visionRoomMount", "vrCarriers",
];

async function seite(daten) {
  const dom = makeDom();
  IDS.forEach((id) => dom.ensure(id));
  ["error", "content", "answered", "area", "ck", "ckSide", "ckLock", "tileTest", "tileOffer", "tilePreview",
    "tileContract", "tileAdmin", "tileTerms", "visionRoom"]
    .forEach((id) => { dom.node(id).hidden = true; });
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
    setTimeout: dom.window.setTimeout, clearTimeout() {}, console,
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object,
    fetch: fetchDouble,
  };
  ctx.globalThis = ctx;
  vm.runInContext(script, vm.createContext(ctx));
  await new Promise((r) => setTimeout(r, 0));
  return { dom, posted };
}

const FRAGEN = [
  { key: "name", label: "Ansprechperson", type: "text", role: "contactName", required: true, hint: "", options: [], vision: "" },
  { key: "email", label: "E-Mail", type: "email", role: "contactEmail", required: true, hint: "", options: [], vision: "" },
];

/* Die Adresse aus dem Live-Befund — Zeichen für Zeichen. */
const LEHNER_URL = "https://beispiel-lehner.netlify.app/";

/* Genau die Felder, die Quantus (customerAreaSnapshot) liefert. Nicht mehr:
   Was hier nicht steht, erreicht die Seite auch im Betrieb nicht. */
const VORSCHAU = {
  label: "Website-Vorschau & Änderungswünsche",
  url: LEHNER_URL,
  releasedAt: "2026-08-09T08:00:00.000Z",
  source: "claude-code",
  provisional: false,
  feedback: true,
};

const TESTUEBERSICHT = {
  label: "Leistungsübersicht · TEST",
  test: true, binding: false,
  title: "Website-Neukonzept Lehner",
  costStatus: "Kosten noch offen — keine verbindliche Preisangabe",
  summary: "Startseite, Menü, Kontakt und eine Tischreservation.",
  currentUrl: "https://alt.lehner.ch/",
  previewUrl: LEHNER_URL,
  releasedAt: "2026-08-09T07:00:00.000Z",
  notice: "Unverbindliche Testansicht. Das ist keine Offerte: nichts wurde versendet, "
    + "es besteht keine Preiszusage und es entsteht keine Rechnung.",
};

const AGB = {
  label: "Standard-AGB",
  version: "0.1-test",
  intro: "Diese Bedingungen gelten für alle FlowerTech-Projekte.",
  notice: "Testfassung — rechtlich noch nicht geprüft.",
  sections: [
    { title: "1 Geltungsbereich", body: "Diese AGB gelten für alle Leistungen." },
    { title: "2 Zusammenarbeit", body: "Wir arbeiten in Stufen.\n\nJede Stufe wird freigegeben." },
  ],
};

const lehner = (extra) => Object.assign({
  schema: 1,
  title: "Ihre Angaben",
  intro: "Kurz ein paar Fragen.",
  status: "answered",
  company: { name: "FlowerTech" },
  generation: 1,
  questions: FRAGEN,
  stage: "preview",
  tiles: {
    testService: TESTUEBERSICHT, offer: null, preview: VORSCHAU,
    contract: null, admin: null, terms: AGB,
  },
  updatedAt: "2026-08-10T10:00:00.000Z",
}, extra || {});

const zeige = (dom, key) => { const b = dom.node("ckView_" + key); if (b) b.click(); };
const sichtbar = (dom) => IDS.map((id) => {
  const n = dom.node(id);
  if (!n || n.hidden) return "";
  return String(n.innerHTML || "") + " " + String(n.textContent || "");
}).join(" ");

/* ══ 1. Der Live-Befund selbst ═════════════════════════════════════════════ */
{
  const { dom } = await seite(lehner());
  zeige(dom, "website");
  const kachel = dom.node("tilePreview");

  ok(dom.node("area").hidden === false,
    "der Kundenbereich bleibt zu, obwohl Vorschau, TEST-Übersicht und AGB freigegeben sind");
  ok(kachel.hidden === false,
    "die Website-Vorschau fehlt auf der öffentlichen Kundenadresse — genau der gemeldete Befund");
  /* Benannt wird die Ansicht in der Kopfzeile. In der Bühne steht die Website
     selbst — randlos, ohne eigene Überschrift, ohne nachgebaute Adressleiste.
     Beides zusammen las sich in der Abnahme als zwei Anwendungen. */
  ok(!/<h2>/.test(kachel.innerHTML), "über der Vorschau steht eine zweite Überschrift");
  ok(!/ck-shell-bar|ck-addr|ck-dots/.test(kachel.innerHTML),
    "über der Website steht wieder eine nachgebaute Browser-Adressleiste");
  ok(!/Angezeigt wird/.test(kachel.innerHTML), "unter der Website steht wieder eine Adresszeile");

  // Eingebettet wird die Website selbst — die Wurzel des Hosts, nicht eine
  // Präsentationshülle auf einem Unterpfad.
  ok(/src="https:\/\/beispiel-lehner\.netlify\.app\/\?embed=flowertech"/.test(kachel.innerHTML),
    "die Bühne zeigt nicht die blanke Website");

  // Die volle Adresse ist nicht verloren: Sie steht im Rückweg, samt Verweis.
  ok(kachel.innerHTML.includes('href="' + LEHNER_URL + '"'),
    "die Vorschau verweist nicht auf genau die hinterlegte Adresse");
  ok(dom.node("previewOpen"), "es fehlt der Weg zur Vorschau");
  ok(dom.node("previewUrlText"),
    "die Vorschau-Adresse steht nirgends ausgeschrieben — nur ein Knopf ist keine Adresse");
  ok(dom.node("previewUrlText").innerHTML.includes(LEHNER_URL)
    || String(kachel.innerHTML).includes(">" + LEHNER_URL + "<"),
    "die ausgeschriebene Adresse stimmt nicht");
  /* Ob der Rückweg gerade steht, entscheidet erst der Browser (die Wartezeit
     auf `load`) — das ist hier nicht nachstellbar. Geprüft wird deshalb, dass
     er als verborgen ausgeliefert wird. */
  ok(/id="pvFallback" hidden/.test(kachel.innerHTML),
    "der Rückweg steht von Anfang an offen, statt nur bei blockierter Einbettung");
  ok(/rel="noopener noreferrer"/.test(kachel.innerHTML), "der Verweis gibt Seite und Token weiter");
  ok(/target="_blank"/.test(kachel.innerHTML), "die Vorschau ersetzt diese Seite");

  // Der klare Einstieg für Änderungswünsche.
  ok(dom.node("changeForm"), "es fehlt der Weg für Änderungswünsche");
  ok(dom.node("crSubmit"), "der Knopf für den Änderungswunsch fehlt");
  ok(dom.node("changeIntro"), "der Einstieg für Änderungswünsche ist nicht benannt");
  /* Die Aenderungswuensche stehen jetzt in der festen Seitenleiste neben der
     Vorschau — nicht mehr unter ihr in derselben Kachel. */
  ok(/geändert werden/.test(String(dom.node("ckSide").innerHTML || "")),
    "das Pflichtfeld ist nicht beschriftet");
  ok(dom.node("ckSide").hidden === false, "die Änderungsleiste steht nicht neben der Vorschau");
  ok(/id="crArea"/.test(String(dom.node("ckSide").innerHTML || "")),
    "die Kategorie Website/Verwaltung fehlt");

  // Kein Abhängen vom alten Phase-2-Kundenportal.
  ok(!/kunde\.html/.test(sichtbar(dom)), "die Seite verweist auf das alte Kundenportal");
  ok(!/\?t=/.test(sichtbar(dom)), "es steht ein zweiter Bearer-Link auf der Seite");
}

/* ══ 2. Die freigegebene TEST-Leistungsübersicht ═══════════════════════════ */
{
  const { dom } = await seite(lehner());
  zeige(dom, "offerte");
  const kachel = dom.node("tileTest");
  ok(kachel.hidden === false, "die freigegebene TEST-Leistungsübersicht fehlt");
  ok(/Website-Neukonzept Lehner/.test(kachel.innerHTML), "der Titel der Übersicht fehlt");
  ok(/TEST/.test(kachel.innerHTML), "die Übersicht ist nicht als Test gekennzeichnet");
  ok(/unverbindlich/i.test(kachel.innerHTML), "die Unverbindlichkeit steht nicht da");
  ok(/Kosten noch offen/.test(kachel.innerHTML), "der Kostenstand fehlt");
  ok(dom.node("testPreview") && dom.node("testCurrent"),
    "die beiden Adressen der Übersicht fehlen");

  // Eine Test-Übersicht ist keine Offerte: nie ein Betrag, nie eine Null.
  ok(!/CHF/.test(kachel.innerHTML), "auf der Test-Übersicht steht ein Betrag");
  ok(!/0\.00/.test(kachel.innerHTML), "auf der Test-Übersicht steht „0.00“");
  /* Der Offerten-Bereich steht seit dem Portal-Umbau da — aber als erklaerter
     Wartezustand, nicht als Offerte. Entscheidend bleibt: kein Betrag, keine
     Nummer, nichts aus einem Entwurf. */
  zeige(dom, "offerte");
  /* Die Offerte ist eine eigene Ansicht. Ohne Versand steht dort der inline
     erklaerte Sperrzustand — nie eine Offerte, nie eine Zahl, nie eine Nummer.
     Die TEST-Uebersicht gehoert zur selben Ansicht und bleibt sichtbar. */
  zeige(dom, "offerte");
  ok(dom.node("tileOffer").hidden === true, "ohne versendete Offerte erscheint eine Offerten-Kachel");
  const zentral = String(dom.node("tileTest").innerHTML || "") + String(dom.node("ckLock").innerHTML || "");
  ok(!/CHF|0\.00|OF-/.test(zentral), "die Offerten-Ansicht zeigt Zahlen oder eine Nummer");
}

/* ══ 3. Die zentrale Standard-AGB — immer da ═══════════════════════════════ */
{
  const { dom } = await seite(lehner());
  zeige(dom, "agb");
  const kachel = dom.node("tileTerms");
  ok(kachel.hidden === false, "die zentrale Standard-AGB fehlt auf dem Kundenlink");
  ok(/Standard-AGB/.test(kachel.innerHTML), "die AGB sind nicht benannt");
  ok(/0\.1-test/.test(kachel.innerHTML), "der Versionsstand der AGB fehlt");
  ok(/Geltungsbereich/.test(kachel.innerHTML) && /Zusammenarbeit/.test(kachel.innerHTML),
    "die Abschnitte der AGB fehlen");
  ok(/Testfassung/.test(kachel.innerHTML), "der Hinweis auf die Testfassung fehlt");

  // Sie hängt an keiner Stufe: auch auf einem Link ganz ohne Vorschau.
  const ohne = await seite(lehner({
    stage: "intake",
    tiles: { testService: null, offer: null, preview: null, contract: null, admin: null, terms: AGB },
  }));
  zeige(ohne.dom, "agb");
  ok(ohne.dom.node("tileTerms").hidden === false,
    "ohne Vorschau verschwindet die AGB — sie hängt an keiner Freigabe");
  ok(ohne.dom.node("area").hidden === false, "die AGB allein öffnet den Bereich nicht");
}

/* ══ 4. Der Änderungswunsch geht denselben Weg ═════════════════════════════ */
{
  const { dom, posted } = await seite(lehner());
  const vorher = posted.length;
  dom.node("crTitle").value = "  Anderes Bild auf der Startseite  ";
  dom.node("crDetail").value = "Bitte eine Aussenaufnahme.";
  dom.node("changeForm").fire("submit");
  await new Promise((r) => setTimeout(r, 0));

  ok(posted.length === vorher + 1,
    `es wurden ${posted.length - vorher} Sendungen ausgelöst statt genau einer`);
  const call = posted[posted.length - 1];
  const body = JSON.parse(call.init.body);
  ok(/flowertech-portal/.test(call.url), `der Eingang stimmt nicht: ${call.url}`);
  ok(body.kind === "change", `die falsche Art wurde gesendet: ${body.kind}`);
  ok(body.token === TOKEN, "der Wunsch trägt nicht denselben Einladungstoken");
  ok(body.payload.title === "Anderes Bild auf der Startseite", "der Wunsch kommt ungetrimmt an");
  ok(!JSON.stringify(body).includes("prj_"), "im Wunsch steht eine Projekt-ID");
}

/* ══ 5. Testvorschau bleibt Testvorschau ═══════════════════════════════════ */
{
  // Eine manuell hinterlegte Adresse ist KEINE bestätigte Claude-Code-Rückgabe.
  // Sie erscheint vollständig — aber sie wird nicht als fertige Fassung
  // ausgegeben. Genau so steht der Lehner-Link heute da.
  const manuell = Object.assign({}, VORSCHAU, { source: "manuell", provisional: true });
  const { dom } = await seite(lehner({
    tiles: { testService: TESTUEBERSICHT, offer: null, preview: manuell, contract: null, admin: null, terms: AGB },
  }));
  zeige(dom, "website");
  const kachel = dom.node("tilePreview");
  ok(kachel.hidden === false, "die manuelle Testvorschau verschwindet still");
  ok(/Testvorschau/.test(kachel.innerHTML), "die Testvorschau wird nicht als solche benannt");
  ok(/Zwischenstand/.test(kachel.innerHTML), "der Zwischenstand wird nicht benannt");
  ok(kachel.innerHTML.includes('href="' + LEHNER_URL + '"'),
    "die Adresse fehlt in der Testvorschau");
  ok(dom.node("changeForm"), "auf der Testvorschau fehlt der Weg für Änderungswünsche");

  // Umgekehrt: Die bestätigte Fassung behauptet nichts Vorläufiges.
  const fertig = await seite(lehner());
  ok(!/Testvorschau/.test(fertig.dom.node("tilePreview").innerHTML),
    "eine bestätigte Vorschau wird als Testvorschau ausgegeben");
}

/* ══ 6. Ohne Freigabe existiert nichts ═════════════════════════════════════ */
{
  const { dom } = await seite(lehner({
    stage: "intake",
    tiles: { testService: null, offer: null, preview: null, contract: null, admin: null, terms: null },
  }));
  /* Ohne Freigabe gibt es keinen INHALT — aber sehr wohl den erklaerten
     Bereich. Genau das war der Befund: Wer nicht sieht, dass es eine Vorschau
     ueberhaupt geben wird, haelt Formular und Website fuer zwei Anwendungen. */
  [["offerte", "tileOffer"], ["website", "tilePreview"], ["verwaltung", "tileAdmin"]].forEach(([key, id]) => {
    zeige(dom, key);
    ok(dom.node(id).hidden === true, `der Bereich ${id} steht ohne Freigabe da`);
    const lock = dom.node("ckLock");
    ok(lock.hidden === false, `die Ansicht ${key} zeigt keinen Sperrzustand`);
    ok(/wird vorbereitet/i.test(String(lock.innerHTML || "")),
      `die Ansicht ${key} erklärt den Sperrzustand nicht`);
    ok(!/https?:\/\//.test(String(lock.innerHTML || "")),
      `der Sperrzustand von ${key} zeigt eine Adresse`);
  });
  // Was gar kein eigener Bereich ist, bleibt weg.
  ["tileTest", "tileContract"].forEach((id) => {
    ok(dom.node(id).hidden === true, `die Kachel ${id} steht ohne Freigabe da`);
    ok(String(dom.node(id).innerHTML || "") === "", `die Kachel ${id} ist ein leerer Platzhalter`);
  });
  ok(dom.node("area").hidden === false, "die Bereiche fehlen ganz");

  // Eine unsichere Adresse wird nie verlinkt — auch nicht mit Freigabe.
  const unsicher = await seite(lehner({
    tiles: {
      testService: null, offer: null,
      preview: Object.assign({}, VORSCHAU, { url: "http://beispiel-lehner.netlify.app/" }),
      contract: null, admin: null, terms: null,
    },
  }));
  zeige(unsicher.dom, "website");
  ok(unsicher.dom.node("tilePreview").hidden === true, "eine http-Adresse wird als Vorschau gezeigt");
  ok(/wird vorbereitet/i.test(String(unsicher.dom.node("ckLock").innerHTML || "")),
    "statt der unsicheren Adresse fehlt der Sperrzustand");
  ok(!/beispiel-lehner/.test(sichtbar(unsicher.dom)), "die unsichere Adresse steht trotzdem da");

  // Die Verwaltung erscheint nie allein.
  const nurAdmin = await seite(lehner({
    tiles: {
      testService: null, offer: null, preview: null, contract: null,
      admin: { label: "Verwaltung", url: "https://admin.lehner.ch/login" }, terms: null,
    },
  }));
  zeige(nurAdmin.dom, "verwaltung");
  ok(nurAdmin.dom.node("tileAdmin").hidden === true, "die Verwaltung erscheint ohne Vorschau");
  ok(/wird vorbereitet/i.test(String(nurAdmin.dom.node("ckLock").innerHTML || "")),
    "die gesperrte Verwaltung erklärt sich nicht");
  ok(!/admin\.lehner\.ch/.test(sichtbar(nurAdmin.dom)),
    "die Verwaltungsadresse steht da, obwohl die Vorschau fehlt");
}

/* ══ 6b. Das Portal: EINE Adresse, fuenf Bereiche ══════════════════════════ */
{
  /* Der gemeldete Befund: „Vorschau ansehen" oeffnete die separate
     Netlify-Seite, Formular und Website wirkten wie zwei Anwendungen. Jetzt
     bleibt die Kundschaft fuer alles auf dieser einen Adresse. */
  const { dom } = await seite(lehner());
  const nav = String(dom.node("ckViews").innerHTML || "");
  ["Website", "Verwaltung", "Offerte", "AGB &amp; Kunde", "Fragebogen"].forEach((label) => {
    ok(nav.includes(label), `die Kopfzeile nennt „${label}“ nicht`);
  });
  // Projektname links in der schmalen Kopfzeile.
  ok(String(dom.node("ckProject").textContent || "").length > 2, "der Projektname fehlt in der Kopfzeile");
  // Mit freigegebener Vorschau ist „Website" die Startansicht.
  ok(dom.node("ckView_website").getAttribute("aria-selected") === "true",
    "die Startansicht ist nicht die Website");

  /* Und zwar OHNE einen einzigen Klick: zentral steht die Vorschau, rechts die
     Aenderungsleiste — sonst nichts. Genau das war der Befund, den diese
     Fassung ablöst: eine Kachelreihe oben und darunter eine gestapelte Wand aus
     Fragebogen, Notiz und allen Bereichen gleichzeitig. */
  const zentral = ["content", "answered", "tilePreview", "tileAdmin", "tileOffer",
    "tileTest", "tileTerms", "tileContract", "ckLock"]
    .filter((id) => dom.node(id).hidden === false);
  ok(zentral.join() === "tilePreview",
    `neben der Vorschau steht zentral noch: ${zentral.filter((i) => i !== "tilePreview").join(", ")}`);
  ok(dom.node("ckSide").hidden === false, "die Änderungsleiste steht nicht von Anfang an da");

  /* Der Fragebogen ist nur noch eine Ansicht — er wird geholt, nicht
     untergeschoben. Danach ist die Vorschau weg, nicht beides zugleich. */
  zeige(dom, "fragebogen");
  ok(dom.node("answered").hidden === false, "der Fragebogen-Bereich lässt sich nicht öffnen");
  ok(dom.node("tilePreview").hidden === true, "die Vorschau bleibt unter dem Fragebogen stehen");
  ok(dom.node("ckSide").hidden === true, "die Änderungsleiste steht auch über dem Fragebogen");
  zeige(dom, "website");
  ok(dom.node("answered").hidden === true && dom.node("tilePreview").hidden === false,
    "der Rückweg zur Website lässt den Fragebogen stehen");

  // Die Vorschau steht IM Portal, nicht als nackter Verweis daneben.
  const kachel = String(dom.node("tilePreview").innerHTML || "");
  ok(/id="pvFrame"/.test(kachel), "die Vorschau wird nicht im Portal angezeigt");
  ok(kachel.includes('src="' + LEHNER_URL + "?embed=flowertech" + '"'),
    "der Rahmen zeigt nicht die Website selbst");
  ok(!!dom.node("ckMobil") && !!dom.node("ckDesktop") && !!dom.node("ckReload"),
    "Desktop/Mobil und «Neu laden» fehlen in der Kopfzeile");
  ok(!/ck-shell|pv-bar|pv-note/.test(kachel),
    "um die Website steht wieder ein zweiter Fensterrahmen");
  // Der Verweis nach draussen bleibt — aber im Rueckweg, nicht als Hauptweg.
  ok(/Vorschau in neuem Tab öffnen/.test(kachel), "der Rueckweg in einen eigenen Tab fehlt");
  ok(!/>Vorschau ansehen</.test(kachel),
    "der alte nackte Verweis „Vorschau ansehen“ steht wieder da");
  // Aenderungswuensche bleiben direkt neben der Vorschau — kein dritter Link.
  ok(dom.node("changeForm"), "die Änderungswünsche stehen nicht bei der Vorschau");
  // Die Kopfzeile traegt die vier Ansichten.
  const kopf = String(dom.node("ckViews").innerHTML || "");
  ["Website", "Verwaltung", "Offerte", "AGB &amp; Kunde"].forEach((l) => {
    ok(kopf.includes(l), `die Kopfzeile nennt „${l}“ nicht`);
  });
  ok(!!dom.node("ckWish"), "der Knopf „Änderungswunsch“ fehlt");
  ok(!/kunde\.html/.test(sichtbar(dom)) && !/\?t=/.test(sichtbar(dom)),
    "es entsteht ein zweiter Kundenlink");
}

/* ══ 6c. Verwaltung als eigener Bereich ════════════════════════════════════ */
{
  const { dom } = await seite(lehner({
    tiles: {
      testService: null, offer: null,
      preview: VORSCHAU, contract: null,
      admin: { label: "Verwaltung", url: "https://admin.lehner.ch/login" }, terms: null,
    },
  }));
  const admin = String(dom.node("tileAdmin").innerHTML || "");
  ok(/<h2>Verwaltung<\/h2>/.test(admin), "die Verwaltung ist kein eigener Bereich");
  /* Die live erreichbare Verwaltung bringt eine eigene Kopfzeile und eine
     eigene Bedienung mit. Eingebettet stuenden zwei Navigationen uebereinander
     — genau die Doppelung, die diese Fassung ablöst. Deshalb: eine eigene,
     benannte FlowerTech-Ansicht mit EINEM klaren Weg nach draussen. */
  ok(!/<iframe/.test(admin), "die Verwaltung wird als zweites Cockpit eingebettet");
  ok(/id="adminOpen"/.test(admin), "es fehlt der Weg in die Verwaltung");
  ok(admin.includes('href="https://admin.lehner.ch/login"'), "der Weg zeigt auf die falsche Adresse");
  ok(/rel="noopener noreferrer"/.test(admin) && /target="_blank"/.test(admin),
    "die Verwaltung ersetzt diese Seite oder gibt sie weiter");
  ok(/Verwaltung öffnen/.test(admin), "der Weg in die Verwaltung ist nicht benannt");
  ok(/lässt sich deshalb nicht in diese Ansicht einbetten/.test(admin),
    "es wird nicht erklärt, warum die Verwaltung nicht hier steht");
}

/* ══ 6d. Die AGB bleiben unveraenderlich ═══════════════════════════════════ */
{
  const { dom } = await seite(lehner());
  const agb = String(dom.node("tileTerms").innerHTML || "");
  ok(/0\.1-test/.test(agb), "der Versionsstand der AGB fehlt");
  // Nichts Bearbeitbares: keine Eingaben, kein Absenden, kein contenteditable.
  ok(!/<input|<textarea|contenteditable|<button/.test(agb),
    "die AGB lassen sich auf der Kundenseite bearbeiten");
}

/* ══ 7. Statisch: was die Seite gar nicht erst können darf ═════════════════ */
{
  /* Die Vorschau wird jetzt EINGEBETTET — ein nackter Verweis nach draussen
     liess Formular und Website wie zwei Anwendungen wirken. Die
     Sicherheitsabsicht der frueheren Regel bleibt, sie wandert nur von
     "gar nicht einbetten" auf "nur streng eingesperrt einbetten": */
  ok(/id="pvFrame"/.test(script), "die Vorschau wird nicht im Portal gezeigt");
  // Eingesperrt: keine Formulare, keine Popups, keine Top-Navigation.
  ok(/sandbox="allow-scripts allow-same-origin"/.test(script),
    "der Vorschau-Rahmen ist nicht eingesperrt");
  ok(!/allow-top-navigation|allow-forms|allow-popups|allow-modals/.test(script),
    "der Vorschau-Rahmen darf zu viel");
  // Kein Verweiser nach draussen.
  ok(/referrerpolicy="no-referrer"/.test(script), "der Rahmen gibt den Token weiter");
  // Und der sichtbare Rueckweg, falls die Einbettung blockiert ist.
  ok(/id="pvFallback"/.test(script), "es fehlt der Rueckweg bei blockierter Einbettung");
  ok(/Vorschau in neuem Tab öffnen/.test(script), "der Rueckweg ist nicht benannt");
  ok(/safeUrl/.test(script), "die Seite prüft Adressen nicht");
  /* Was in den Rahmen geht, geht durch `einbettUrl` — und das gibt nur die
     Wurzel eines HTTPS-Hosts heraus. Eine Praesentationshuelle auf einem
     Unterpfad kann so gar nicht erst eingebettet werden. */
  ok(/function einbettUrl/.test(script), "die Einbettadresse wird nicht eigens gebildet");
  ok(/src="' \+ esc\(einbettUrl\(url\)\)/.test(script),
    "der Rahmen bekommt eine Adresse an der Regel vorbei");
  ok(/embed=" \+ EMBED_MARKE/.test(script), "die Einbett-Absprache fehlt");
  // Kein Weg an der Prüfung vorbei: Jede ausgegebene Adresse geht durch safeUrl.
  ok(!/href="'\s*\+\s*esc\(tile\.url\)/.test(script),
    "eine Adresse geht ungeprüft in einen Verweis");
}

console.log(`Kundenlink Lehner: ${checks} Prüfungen — Vorschau, TEST-Übersicht und AGB stehen`);
console.log("  auf genau der Adresse, die die Kundschaft kennt: fragebogen.html?e=<token>.");
