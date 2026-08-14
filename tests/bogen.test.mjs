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
 *   2. Eine Strecke: drei Fragen je Blatt, ein Weg vor und zurück, gesendet
 *      wird erst am Ende. Alle Felder bleiben dabei im Dokument.
 *   3. Nichts von der Stange: keine Verläufe, keine Schatten, keine runden
 *      Kästen, keine Emoji-Marke auf diesem Blatt.
 *   4. Niemand kommt weiter, ohne dass gesagt wird, was fehlt — und die
 *      Meldung spricht vom Blatt, das vor der Kundschaft liegt.
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
  ok(/Blatt 01 von 03/.test(dom.node("bogenStand").textContent),
    `der Stand stimmt nicht: ${dom.node("bogenStand").textContent}`);
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
  ok(/diesem Blatt/.test(dom.node("need").textContent),
    "die Meldung spricht nicht vom Blatt, das vorne liegt");

  // Ausgefüllt: weiter, zurück, und der Stand zählt mit.
  dom.node("q_0").value = "Gärtnerei Lehner";
  dom.node("q_1").value = "Laurin";
  dom.node("q_2").value = "kontakt@example.ch";
  dom.node("bogenWeiter").click();
  ok(dom.node("blatt_1").hidden === false && dom.node("blatt_0").hidden === true,
    "das zweite Blatt kommt nicht nach vorne");
  ok(/Blatt 02 von 03/.test(dom.node("bogenStand").textContent), "der Stand zählt nicht mit");
  ok(dom.node("bogenZurueck").hidden === false, "es gibt keinen Weg zurück");
  dom.node("bogenZurueck").click();
  ok(dom.node("blatt_0").hidden === false, "zurück führt nicht zum ersten Blatt");

  // Auf dem letzten Blatt tritt „Weiter" ab und das Senden erscheint.
  dom.node("q_3").value = "Website";
  dom.node("bogenWeiter").click();
  dom.node("bogenWeiter").click();
  ok(/Blatt 03 von 03/.test(dom.node("bogenStand").textContent), "das letzte Blatt wird nicht erreicht");
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

/* ══ 4. Nichts von der Stange ═════════════════════════════════════════════ */
{
  const bogen = stil.split('body[data-bogen="1"]').slice(1).join(" ");
  ok(bogen.length > 400, "es gibt gar keine eigene Gestalt für den Bogen");
  ok(!/linear-gradient|radial-gradient/.test(bogen),
    "der Bogen trägt einen Verlauf");
  ok(!/box-shadow:\s*0 \d/.test(bogen), "der Bogen trägt einen schwebenden Schatten");
  ok(/border-radius:0/.test(bogen.replace(/\s/g, "")),
    "der Bogen rundet weiterhin Kästen ab");

  // Keine Emoji-Marke mehr über dem Bogen.
  const kopf = (/<header class="bg-kopf">[\s\S]*?<\/header>/.exec(page) || [""])[0];
  ok(!!kopf, "der Bogen hat keinen eigenen Kopf");
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(kopf), "im Kopf des Bogens steht ein Emoji");
  ok(/id="title"/.test(kopf) && /id="subtitle"/.test(kopf),
    "Titel und Absender stehen nicht im Kopf des Bogens");

  // Die Beschriftungen laufen in Schreibmaschinenschrift, die Fragen im Satz.
  ok(/--mo:ui-monospace/.test(stil.replace(/\s/g, "")),
    "es gibt keine eigene Schreibmaschinenschrift für die Beschriftungen");
  ok(/\.bg-blatt\{[^}]*display:grid/.test(stil.replace(/\s*\n\s*/g, "")),
    "die Blätter stehen nicht im Satzspiegel");
}

console.log(`Bogen: ok (${geprueft} Pruefungen)`);
