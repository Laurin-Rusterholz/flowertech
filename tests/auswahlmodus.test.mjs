/*
 * Elementauswahl in der Vorschau — das Protokoll, nicht nur der Text.
 * ---------------------------------------------------------------------------
 * Im Kundenlink stand „schalten Sie den Wunschmodus ein“, und im Code stand,
 * ein fremder Rahmen lasse sich nicht lesen. Beides zusammen war eine
 * Zusicherung ohne Funktion. Sie gibt es jetzt wirklich: Die eingebettete
 * Website (Repo `projekt-lehner`, `assets/js/wunsch.js`) meldet auf
 * Anforderung, worauf getippt wurde.
 *
 * Geprüft wird hier die FlowerTech-Seite dieses Protokolls — mit einem
 * Rahmen-Doppel, das sich genau so verhält wie die echte Vorschau:
 *
 *   1. Der Umschalter ist da, beschriftet und wechselt seinen Zustand.
 *   2. Einschalten schickt `arm`, Ausschalten `disarm` — an die Herkunft der
 *      Vorschau, nicht an "*".
 *   3. Eine `pick`-Meldung füllt Titel und Details vor, wählt den Bereich
 *      Website und sendet NICHTS.
 *   4. Fremde Herkunft, fremder Absender, fremder Namensraum und falsche Form
 *      werden verworfen.
 *   5. Meldet sich die Vorschau nicht bereit, sagt die Seite das offen, statt
 *      einen Modus zu behaupten.
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

const TOKEN = "A".repeat(32);
const URL_LEHNER = "https://beispiel-lehner.netlify.app/";
const HERKUNFT = "https://beispiel-lehner.netlify.app";
const IDS = [
  "loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
  "form", "fields", "hp", "submit", "need", "status", "footer",
  "answered", "answeredTitle", "answeredText", "area",
  "tileTest", "tileOffer", "tilePreview", "tileContract", "tileAdmin", "tileTerms",
  "ck", "ckTop", "ckViews", "ckProject", "ckMobil", "ckDesktop", "ckReload", "ckWish",
  "ckStage", "ckSide", "ckLock", "ckPick", "pvFrame",
  "ckView_website", "ckView_verwaltung", "ckView_offerte", "ckView_vertrag",
  "ckView_agb", "ckView_fragebogen",
  "ckWishes", "crArea", "crTitle", "crDetail", "crBy", "crHp", "crSubmit", "crStatus",
  "pvStage", "kbWork", "kbSeite", "kbNavList",
  "visionRoom", "vrLead", "visionRoomMount", "vrCarriers",
];

async function seite() {
  const dom = makeDom();
  IDS.forEach((id) => dom.ensure(id));
  ["error", "content", "answered", "area", "ck", "ckSide", "ckLock", "tileTest", "tileOffer",
    "tilePreview", "tileContract", "tileAdmin", "tileTerms", "visionRoom"]
    .forEach((id) => { dom.node(id).hidden = true; });

  /* Der Rahmen antwortet wie die echte Vorschau: Er merkt sich, was er
     bekommt, und an welches Ziel es ging. */
  const gesendet = [];
  const rahmenFenster = {
    postMessage: (nachricht, ziel) => gesendet.push({ nachricht, ziel }),
  };

  const posted = [];
  const fetchDouble = (url, init) => {
    posted.push({ url, init });
    if (String(url).includes("intakeForms")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(daten) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  };

  const zuhoerer = [];
  dom.window.addEventListener = (typ, fn) => { if (typ === "message") zuhoerer.push(fn); };
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

  // In die Verwaltung, dort in „Website & Änderungswünsche“.
  dom.node("ckView_verwaltung").click();
  dom.node("kbNav_wunsch").click();
  const frame = dom.node("kbFrame");
  if (frame) frame.contentWindow = rahmenFenster;
  const melden = (data, extra) => {
    const e = Object.assign({ data, source: rahmenFenster, origin: HERKUNFT }, extra || {});
    zuhoerer.forEach((fn) => fn(e));
  };
  return { dom, gesendet, posted, melden, rahmenFenster };
}

const daten = {
  schema: 1, title: "Lehner Gartenbau", intro: "Kurz ein paar Fragen.",
  status: "answered", company: { name: "FlowerTech" }, generation: 1,
  questions: [{ key: "name", label: "Ansprechperson", type: "text", role: "contactName",
    required: true, hint: "", options: [], vision: "" }],
  stage: "preview",
  tiles: {
    testService: { label: "Übersicht", test: true, binding: false, title: "Website Lehner",
      costStatus: "Kosten noch offen", summary: "Startseite, Katzen, Kontakt.",
      currentUrl: "https://alt.lehner.ch/", previewUrl: URL_LEHNER,
      releasedAt: "2026-08-09T07:00:00.000Z", notice: "" },
    offer: null,
    preview: { label: "Website-Vorschau", url: URL_LEHNER, releasedAt: "2026-08-09T08:00:00.000Z",
      source: "claude-code", provisional: false, feedback: true },
    contract: null,
    admin: { label: "Verwaltung", url: "https://admin.lehner.ch/login" },
    terms: { label: "Standard-AGB", version: "0.1-test", intro: "", notice: "",
      sections: [{ title: "1 Geltungsbereich", body: "Gilt für alle Leistungen." }] },
  },
  updatedAt: "2026-08-10T10:00:00.000Z",
};

const AUSWAHL = {
  ns: "flowertech-wunsch", type: "pick",
  section: "ueber-uns", sectionTitle: "Über uns",
  label: "Familie Lehner", tag: "p",
  url: "https://beispiel-lehner.netlify.app/ueber-uns.html", lang: "de",
};

/* ══ 1. Der Umschalter ist da und sagt, was er tut ═════════════════════════ */
{
  const { dom } = await seite();
  const knopf = dom.node("pickToggle");
  ok(!!knopf, "der Umschalter für die Elementauswahl fehlt");
  ok(knopf.getAttribute("aria-pressed") === "false", "der Umschalter startet eingeschaltet");
  const arbeit = String(dom.node("kbWork").innerHTML || "");
  ok(/Element auswählen/.test(arbeit), "der Umschalter ist nicht beschriftet");
  ok(/id="pickText"/.test(arbeit), "es fehlt die Erklärung zum Auswahlmodus");
  ok(/normal durch Ihre Seiten klicken/.test(arbeit),
    "es steht nicht da, dass die Vorschau ausgeschaltet normal bedienbar bleibt");
}

/* ══ 2. Ein- und Ausschalten spricht mit dem Rahmen ════════════════════════ */
{
  const { dom, gesendet } = await seite();
  dom.node("pickToggle").click();
  ok(dom.node("pickToggle").getAttribute("aria-pressed") === "true",
    "der Umschalter merkt sich das Einschalten nicht");
  ok(dom.node("pickToggle").textContent === "Auswahlmodus aktiv",
    `die Beschriftung bleibt stehen: ${dom.node("pickToggle").textContent}`);
  const arm = gesendet[gesendet.length - 1];
  ok(arm && arm.nachricht.type === "arm", "es wird kein „arm“ geschickt");
  ok(arm.nachricht.ns === "flowertech-wunsch", "der Namensraum stimmt nicht");
  /* Nicht an "*": Die Nachricht geht ausschliesslich an die Herkunft der
     Vorschau. */
  ok(arm.ziel === HERKUNFT, `das Ziel ist ${arm.ziel} statt der Herkunft der Vorschau`);

  dom.node("pickToggle").click();
  ok(dom.node("pickToggle").getAttribute("aria-pressed") === "false", "es lässt sich nicht ausschalten");
  const aus = gesendet[gesendet.length - 1];
  ok(aus.nachricht.type === "disarm", "es wird kein „disarm“ geschickt");
  ok(aus.ziel === HERKUNFT, "auch das Ausschalten geht nicht an die Herkunft");
}

/* ══ 3. Eine Auswahl füllt den Wunsch vor — und sendet nichts ══════════════ */
{
  const { dom, melden, posted } = await seite();
  const vorher = posted.length;
  dom.node("pickToggle").click();
  melden(AUSWAHL);

  ok(dom.node("ckSide").hidden === false, "die Änderungsleiste bleibt zu");
  ok(dom.node("crArea").value === "Website",
    `der Bereich ist „${dom.node("crArea").value}“ statt „Website“`);
  ok(dom.node("crTitle").value === "Website – Über uns",
    `der Titel ist nicht vorbereitet: ${dom.node("crTitle").value}`);
  const detail = String(dom.node("crDetail").value || "");
  ok(/Abschnitt: Über uns \(#ueber-uns\)/.test(detail), `der Abschnitt fehlt: ${detail}`);
  ok(/Angetippt: Familie Lehner/.test(detail), "das angetippte Element fehlt");
  ok(/Seite: https:\/\/beispiel-lehner\.netlify\.app\/ueber-uns\.html/.test(detail),
    "die Seite fehlt in den Details");
  ok(posted.length === vorher, "die Auswahl allein hat schon etwas gesendet");
  ok(/Stelle übernommen/.test(String(dom.node("pickText").textContent || "")),
    "die Übernahme wird nicht bestätigt");
}

/* ══ 4. Was nicht stimmt, wird verworfen ═══════════════════════════════════ */
{
  const leerTitel = (dom) => { dom.node("crTitle").value = ""; };
  const faelle = [
    ["fremder Namensraum", Object.assign({}, AUSWAHL, { ns: "irgendwas" }), {}],
    ["fremde Herkunft", AUSWAHL, { origin: "https://boese.example" }],
    ["fremder Absender", AUSWAHL, { source: { postMessage() {} } }],
    ["keine Nachricht", null, {}],
    ["Zeichenkette statt Objekt", "pick", {}],
  ];
  for (const [name, data, extra] of faelle) {
    const { dom, melden } = await seite();
    dom.node("pickToggle").click();
    leerTitel(dom);
    melden(data, extra);
    ok(String(dom.node("crTitle").value || "") === "",
      `eine Nachricht mit ${name} wurde angenommen`);
  }
  // Und eine Auswahl ohne Angaben führt zu keinem leeren Titel.
  const { dom, melden } = await seite();
  dom.node("pickToggle").click();
  melden({ ns: "flowertech-wunsch", type: "pick" });
  ok(/^Website – /.test(String(dom.node("crTitle").value || "")),
    "eine Auswahl ohne Angaben ergibt keinen brauchbaren Titel");
}

/* ══ 5. Ohne Gegenstelle wird nichts behauptet ═════════════════════════════ */
{
  /* Das Zeitfenster läuft im Doppel sofort ab. Bleibt die Bereitmeldung aus,
     muss die Seite genau das sagen — und nicht so tun, als ginge es. */
  const { dom } = await seite();
  dom.node("pickToggle").click();
  ok(/noch nicht verbunden/.test(String(dom.node("pickText").textContent || "")),
    "ohne Gegenstelle behauptet die Seite trotzdem einen Auswahlmodus");
  ok(dom.node("pickToggle").getAttribute("data-art") === "fehlt",
    "der fehlende Anschluss wird nicht als solcher gekennzeichnet");

  // Meldet sich die Vorschau danach doch, gilt der Modus wieder.
  const zweit = await seite();
  zweit.melden({ ns: "flowertech-wunsch", type: "ready", url: URL_LEHNER });
  zweit.dom.node("pickToggle").click();
  ok(!/noch nicht verbunden/.test(String(zweit.dom.node("pickText").textContent || "")),
    "eine verbundene Vorschau wird trotzdem als unverbunden gemeldet");
  const arm = zweit.gesendet[zweit.gesendet.length - 1];
  ok(arm.nachricht.type === "arm", "die verbundene Vorschau wird nicht scharfgeschaltet");
}

/* ══ 5b. Die Vorschau bekommt Platz ═══════════════════════════════════════ */
{
  /* Der Befund aus der Abnahme: ein kleines Fenster inmitten schwarzer Fläche.
     Die Vorschau hatte einen festen Deckel (560 px) und stand in einer
     gepolsterten Karte, die nur so hoch war wie ihr Inhalt. */
  const { dom } = await seite();
  ok(dom.node("kbWork").getAttribute("data-voll") === "1",
    "die Vorschau-Ansicht füllt die Arbeitsfläche nicht");
  dom.node("kbNav_seo").click();
  ok(!dom.node("kbWork").getAttribute("data-voll"),
    "eine gelesene Ansicht wird auf volle Höhe gezwungen");

  const css = /<style>([\s\S]*?)<\/style>/.exec(page)[1];
  ok(!/\.kb-vorschau-gross\{[^}]*height:min\(/.test(css.replace(/\s*\n\s*/g, "")),
    "die Vorschau hat wieder einen festen Deckel");
  ok(/\.kb-vorschau-gross\{[^}]*flex:1 1 auto/.test(css.replace(/\s*\n\s*/g, "")),
    "die Vorschau füllt die verbleibende Höhe nicht");
  ok(/#tileAdmin\{[^}]*height:100%/.test(css.replace(/\s*\n\s*/g, "")),
    "das Kunden-Backend füllt die Bühne nicht");
}

/* ══ 5c. Auch im Tab „Website" — dort schaut man zuerst hin ═══════════════ */
{
  /* Der Befund: „ich kann noch immer keine Elemente auswählen". Der Schalter
     lag ausschliesslich in der Verwaltung; im Tab Website, wo die Vorschau
     zuerst steht, gab es gar keinen. Jetzt trägt ihn die Kopfzeile. */
  const { dom, gesendet } = await seite();
  dom.node("ckView_website").click();
  const knopf = dom.node("ckPick");
  ok(!!knopf, "in der Kopfzeile fehlt der Schalter für die Elementauswahl");
  ok(knopf.hidden === false, "der Schalter fehlt im Tab Website");
  ok(/id="ckPick"[^>]*>Element auswählen</.test(page),
    "der Schalter in der Kopfzeile ist nicht beschriftet");

  // Er spricht mit der grossen Vorschau des Website-Tabs.
  const rahmen = dom.node("pvFrame");
  const fenster = { postMessage: (n, z) => gesendet.push({ nachricht: n, ziel: z }) };
  if (rahmen) rahmen.contentWindow = fenster;
  const vorher = gesendet.length;
  knopf.click();
  ok(knopf.getAttribute("aria-pressed") === "true", "der Schalter merkt sich nichts");
  ok(knopf.textContent === "Auswahlmodus aktiv",
    `die Beschriftung wechselt nicht: ${knopf.textContent}`);
  const arm = gesendet[gesendet.length - 1];
  ok(gesendet.length > vorher && arm.nachricht.type === "arm",
    "im Tab Website wird die Vorschau nicht scharfgeschaltet");
  ok(arm.ziel === HERKUNFT, `das Ziel ist ${arm.ziel} statt der Herkunft der Vorschau`);

  // In einer Ansicht ohne Vorschau verschwindet er — und schaltet sich ab.
  dom.node("ckView_agb").click();
  ok(dom.node("ckPick").hidden === true, "der Schalter steht auch ohne Vorschau da");
  ok(dom.node("ckPick").getAttribute("aria-pressed") === "false",
    "der Auswahlmodus bleibt in einer Ansicht ohne Vorschau aktiv");
}

/* ══ 6. Statisch: die Vorschau bleibt bedienbar ════════════════════════════ */
{
  ok(/sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/.test(script),
    "die Vorschau lässt sich nicht bedienen");
  const schranken = (script.match(/sandbox="[^"]*"/g) || []).join(" ");
  ok(!/allow-top-navigation/.test(schranken), "die Vorschau darf die Seite ersetzen");
  // Kein Overlay über der Vorschau, das Klicks abfängt.
  ok(!/pointer-events\s*:\s*none/.test(page), "eine Regel schaltet Klicks ab");
  ok(!/position:absolute[^}]*z-index/.test((/\.pv-stage\{[^}]*\}/.exec(page) || [""])[0]),
    "über der Vorschau liegt eine Schicht");
  // Und die Seite behauptet nirgends mehr, ein fremder Rahmen sei unlesbar.
  ok(!/kann diese Seite nicht lesen/.test(script),
    "im Code steht noch, die Auswahl sei unmöglich");
}

console.log(`Auswahlmodus: ok (${checks} Pruefungen)`);
