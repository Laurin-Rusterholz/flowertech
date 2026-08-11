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
  "pnav", "phead", "pstatus", "pbarFill", "pcount",
  "visionRoom", "vrLead", "visionRoomMount", "vrCarriers",
];

async function seite(daten) {
  const dom = makeDom();
  IDS.forEach((id) => dom.ensure(id));
  ["error", "content", "answered", "area", "pnav", "phead", "tileTest", "tileOffer", "tilePreview",
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

const sichtbar = (dom) => IDS.map((id) => {
  const n = dom.node(id);
  if (!n || n.hidden) return "";
  return String(n.innerHTML || "") + " " + String(n.textContent || "");
}).join(" ");

/* ══ 1. Der Live-Befund selbst ═════════════════════════════════════════════ */
{
  const { dom } = await seite(lehner());
  const kachel = dom.node("tilePreview");

  ok(dom.node("area").hidden === false,
    "der Kundenbereich bleibt zu, obwohl Vorschau, TEST-Übersicht und AGB freigegeben sind");
  ok(kachel.hidden === false,
    "die Website-Vorschau fehlt auf der öffentlichen Kundenadresse — genau der gemeldete Befund");
  ok(/Website-Vorschau/.test(kachel.innerHTML), "die Kachel ist nicht als Website-Vorschau benannt");

  // Die Adresse: im Verweis UND ausgeschrieben zum Lesen und Kopieren.
  ok(kachel.innerHTML.includes('href="' + LEHNER_URL + '"'),
    "die Vorschau verweist nicht auf genau die hinterlegte Adresse");
  ok(dom.node("previewOpen"), "es fehlt der Weg zur Vorschau");
  ok(dom.node("previewUrlText"),
    "die Vorschau-Adresse steht nirgends ausgeschrieben — nur ein Knopf ist keine Adresse");
  ok(dom.node("previewUrlText").innerHTML.includes(LEHNER_URL)
    || String(kachel.innerHTML).includes(">" + LEHNER_URL + "<"),
    "die ausgeschriebene Adresse stimmt nicht");
  ok(/rel="noopener noreferrer"/.test(kachel.innerHTML), "der Verweis gibt Seite und Token weiter");
  ok(/target="_blank"/.test(kachel.innerHTML), "die Vorschau ersetzt diese Seite");

  // Der klare Einstieg für Änderungswünsche.
  ok(dom.node("changeForm"), "es fehlt der Weg für Änderungswünsche");
  ok(dom.node("crSubmit"), "der Knopf für den Änderungswunsch fehlt");
  ok(dom.node("changeIntro"), "der Einstieg für Änderungswünsche ist nicht benannt");
  ok(/geändert werden/.test(kachel.innerHTML), "das Pflichtfeld ist nicht beschriftet");

  // Kein Abhängen vom alten Phase-2-Kundenportal.
  ok(!/kunde\.html/.test(sichtbar(dom)), "die Seite verweist auf das alte Kundenportal");
  ok(!/\?t=/.test(sichtbar(dom)), "es steht ein zweiter Bearer-Link auf der Seite");
}

/* ══ 2. Die freigegebene TEST-Leistungsübersicht ═══════════════════════════ */
{
  const { dom } = await seite(lehner());
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
  const offerNode = dom.node("tileOffer");
  ok(offerNode.hidden === false, "der Offerten-Bereich fehlt ganz");
  ok(/Wird vorbereitet/.test(String(offerNode.innerHTML || "")),
    "ohne versendete Offerte erscheint eine Offerten-Kachel statt eines Wartezustands");
  ok(!/CHF|0\.00|OF-/.test(String(offerNode.innerHTML || "")),
    "der wartende Offerten-Bereich zeigt Zahlen oder eine Nummer");
}

/* ══ 3. Die zentrale Standard-AGB — immer da ═══════════════════════════════ */
{
  const { dom } = await seite(lehner());
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
  ["tileOffer", "tilePreview", "tileAdmin", "tileTerms"].forEach((id) => {
    const node = dom.node(id);
    ok(node.hidden === false, `der Bereich ${id} fehlt statt zu warten`);
    ok(/Wird vorbereitet/.test(String(node.innerHTML || "")),
      `der Bereich ${id} erklärt den Wartezustand nicht`);
    ok(!/https?:\/\//.test(String(node.innerHTML || "")),
      `der wartende Bereich ${id} zeigt eine Adresse`);
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
  ok(/Wird vorbereitet/.test(String(unsicher.dom.node("tilePreview").innerHTML || "")),
    "eine http-Adresse wird als Vorschau gezeigt");
  ok(!/beispiel-lehner/.test(sichtbar(unsicher.dom)), "die unsichere Adresse steht trotzdem da");

  // Die Verwaltung erscheint nie allein.
  const nurAdmin = await seite(lehner({
    tiles: {
      testService: null, offer: null, preview: null, contract: null,
      admin: { label: "Verwaltung", url: "https://admin.lehner.ch/login" }, terms: null,
    },
  }));
  ok(/Wird vorbereitet/.test(String(nurAdmin.dom.node("tileAdmin").innerHTML || "")),
    "die Verwaltung erscheint ohne Vorschau");
  ok(!/admin\.lehner\.ch/.test(sichtbar(nurAdmin.dom)),
    "die Verwaltungsadresse steht da, obwohl die Vorschau fehlt");
}

/* ══ 6b. Das Portal: EINE Adresse, fuenf Bereiche ══════════════════════════ */
{
  /* Der gemeldete Befund: „Vorschau ansehen" oeffnete die separate
     Netlify-Seite, Formular und Website wirkten wie zwei Anwendungen. Jetzt
     bleibt die Kundschaft fuer alles auf dieser einen Adresse. */
  const { dom } = await seite(lehner());
  const nav = String(dom.node("pnav").innerHTML || "");
  ["Fragebogen", "Offerte", "Website-Vorschau", "Verwaltung", "AGB &amp; Kunde"].forEach((label) => {
    ok(nav.includes(label), `die Bereichsleiste nennt „${label}“ nicht`);
  });
  ok(dom.node("phead").hidden === false, "Statuszeile und Fortschritt fehlen");
  ok(String(dom.node("pcount").textContent || "").includes("von 5"),
    "der Fortschritt zaehlt nicht die fuenf Bereiche");
  ok(String(dom.node("pstatus").textContent || "").length > 10, "die Statuszeile ist leer");

  // Die Vorschau steht IM Portal, nicht als nackter Verweis daneben.
  const kachel = String(dom.node("tilePreview").innerHTML || "");
  ok(/id="pvFrame"/.test(kachel), "die Vorschau wird nicht im Portal angezeigt");
  ok(kachel.includes('src="' + LEHNER_URL + '"'), "der Rahmen zeigt nicht die hinterlegte Adresse");
  ok(/id="pvDesktop"/.test(kachel) && /id="pvMobil"/.test(kachel),
    "die Desktop/Mobil-Umschaltung fehlt");
  // Der Verweis nach draussen bleibt — aber als Rueckweg, nicht als Hauptweg.
  ok(/In neuem Tab öffnen/.test(kachel), "der Rueckweg in einen eigenen Tab fehlt");
  ok(!/>Vorschau ansehen</.test(kachel),
    "der alte nackte Verweis „Vorschau ansehen“ steht wieder da");
  // Aenderungswuensche bleiben direkt bei der Vorschau — kein dritter Link.
  ok(dom.node("changeForm"), "die Änderungswünsche stehen nicht bei der Vorschau");
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
  ok(/id="adminFrame"/.test(admin), "die Verwaltung wird nicht im Portal gezeigt");
  ok(admin.includes('src="https://admin.lehner.ch/login"'), "der Rahmen zeigt die falsche Adresse");
  ok(/id="adminFallback"/.test(admin), "der Rueckweg fuer die Verwaltung fehlt");
  ok(/In neuem Tab öffnen/.test(admin), "der Rueckweg ist nicht benannt");
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
  ok(/In neuem Tab öffnen/.test(script), "der Rueckweg ist nicht benannt");
  ok(/safeUrl/.test(script), "die Seite prüft Adressen nicht");
  // Kein Weg an der Prüfung vorbei: Jede ausgegebene Adresse geht durch safeUrl.
  ok(!/href="'\s*\+\s*esc\(tile\.url\)/.test(script),
    "eine Adresse geht ungeprüft in einen Verweis");
}

console.log(`Kundenlink Lehner: ${checks} Prüfungen — Vorschau, TEST-Übersicht und AGB stehen`);
console.log("  auf genau der Adresse, die die Kundschaft kennt: fragebogen.html?e=<token>.");
