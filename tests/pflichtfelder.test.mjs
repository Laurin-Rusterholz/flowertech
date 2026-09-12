/*
 * Die Pflichtfeldprüfung des Kundenlinks.
 * ---------------------------------------------------------------------------
 * Der Befund (07.09.2026, https://flowertech.ch/fragebogen.html?e=YsJ…):
 * Auf Blatt 2 standen E-Mail (#q_3), Telefon (#q_4) und Adresse (#q_5) leer —
 * die Statusanzeige nannte aber nur die Adresse als fehlend. Wer sich darauf
 * verlässt, schickt einen halben Bogen ab oder sucht die fehlende Angabe an
 * der falschen Stelle.
 *
 * Zwei Wege führten dorthin, beide behoben:
 *
 *   1. Die Prüfung glaubte dem Datensatz statt dem Blatt. Sie rechnete die
 *      Blattzugehörigkeit aus der laufenden Nummer und las `required`/`showIf`
 *      aus den Daten. Wich davon ab, was wirklich auf dem Blatt stand, fiel
 *      ein Pflichtfeld still aus der Meldung.
 *   2. Eine bedingte Frage OHNE Wert (`showIf: {key}` ohne `value`) hiess
 *      „sichtbar, solange die andere Frage leer ist". Die Frage verschwand
 *      also genau dann, wenn die vorhergehende beantwortet war — und war damit
 *      auch aus der Pflichtfeldprüfung verschwunden, obwohl sie auf dem Blatt
 *      stand.
 *
 * Geprüft wird mit dem Fragenkatalog, den Quantus veröffentlicht, und mit
 * wirklich ausgeführter Seitenlogik (Skriptblock gegen ein DOM-Doppel) — auf
 * dem Desktop und auf dem Handy.
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

const TOKEN = "Y".repeat(24);

/* Der Anfang des Standard-Fragebogens, Zeichen für Zeichen wie veröffentlicht.
   Blatt 1 = q_0…q_2, Blatt 2 = q_3…q_5 — genau die Stelle aus dem Befund. */
const f = (key, label, type, required, extra) => Object.assign({
  key, label, type, role: "", required: !!required, hint: "", options: [], vision: "", showIf: null,
}, extra || {});

const KATALOG = [
  f("projekt", "Projekt- / Firmenname", "text", true, { role: "projectTitle" }),
  f("company", "Firma / Organisation", "text", false, { role: "company" }),
  f("name", "Ansprechperson", "text", true, { role: "contactName" }),
  f("email", "E-Mail", "email", true, { role: "contactEmail" }),
  f("phone", "Telefon", "tel", true, { role: "contactPhone" }),
  f("adresse", "Adresse", "text", true, { role: "address" }),
  f("kind", "Was brauchen Sie?", "select", true, { options: ["Website", "Web-Programm", "Web-App"] }),
  f("need", "Ziel: Was soll damit erreicht werden?", "textarea", true, { role: "need" }),
  f("notes", "Sonstiges", "textarea", false),
];

const IDS = [
  "loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
  "form", "fields", "hp", "submit", "need", "status", "footer", "answered", "answeredTitle",
  "answeredText", "area", "tileTest", "tileOffer", "tilePreview", "tileContract", "tileAdmin",
  "tileTerms", "ck", "ckViews", "ckProject", "ckMobil", "ckDesktop", "ckReload", "ckWish",
  "ckStage", "ckSide", "ckLock", "ckView_website", "ckView_verwaltung", "ckView_offerte",
  "ckView_vertrag", "ckView_agb", "ckView_fragebogen", "ckWishes", "crArea", "pvStage",
  "visionRoom", "vrLead", "visionRoomMount", "vrCarriers",
  "bogenZurueck", "bogenWeiter", "bogenStand", "bogenMeta", "bogenNrVr", "vorbelegt",
];

async function seite(daten, { breite = 1200, visionRoom = false } = {}) {
  const dom = makeDom({ innerWidth: breite });
  IDS.forEach((id) => dom.ensure(id));
  ["error", "content", "answered", "area", "ck", "ckSide", "ckLock", "tileTest", "tileOffer",
    "tilePreview", "tileContract", "tileAdmin", "tileTerms", "visionRoom"]
    .forEach((id) => { dom.node(id).hidden = true; });
  const fetchDouble = (url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url).includes("intakeForms") ? daten : { ok: true }),
  });
  dom.window.location.search = "?e=" + TOKEN;
  dom.window.fetch = fetchDouble;
  /* Der Vision Room ist hier nur so weit da, wie dieser Test ihn braucht: Er
     nimmt die Wertträger entgegen — genau das unterscheidet „uebernommen" von
     „bloss markiert". Ohne ihn steigt setupVisionRoom() vorzeitig aus. */
  if (visionRoom) {
    dom.window.FlowerTechVisionRoom = {
      mount: () => ({ setType() {}, files: () => [], addUploaded: () => 0, sayFiles() {} }),
    };
  }
  const ctx = {
    window: dom.window, document: dom.document, location: dom.window.location,
    setTimeout: dom.window.setTimeout, clearTimeout() {}, console,
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object,
    fetch: fetchDouble,
  };
  ctx.globalThis = ctx;
  vm.runInContext(script, vm.createContext(ctx));
  await new Promise((r) => setTimeout(r, 0));
  return dom;
}

const bogen = (fragen, extra) => Object.assign({
  schema: 1, title: "Ihre Angaben", intro: "Kurz ein paar Fragen.", status: "open",
  company: { name: "FlowerTech" }, questions: fragen,
}, extra || {});

const tippen = (dom, i, wert) => {
  const node = dom.node("q_" + i);
  node.value = wert;
  node.fire("input");
};
const status = (dom) => dom.node("need").textContent;

/* ══ 1. Blatt 2: alle drei leeren Pflichtfelder werden genannt ═════════════
   Desktop und Handy — die Meldung darf nicht von der Fensterbreite abhängen. */
for (const breite of [1200, 390]) {
  const wo = breite === 390 ? "auf dem Handy" : "auf dem Desktop";
  const dom = await seite(bogen(KATALOG), { breite });

  ok(/Schritt 1 von/.test(dom.node("bogenStand").textContent),
    `der Bogen startet ${wo} nicht auf Schritt 1`);

  // Blatt 1 ausfüllen und weiterblättern.
  tippen(dom, 0, "Gartenbau Muster");
  tippen(dom, 2, "Anna Muster");
  dom.node("bogenWeiter").fire("click");
  ok(/Schritt 2 von/.test(dom.node("bogenStand").textContent),
    `der Bogen geht ${wo} nicht auf Schritt 2 weiter`);

  const gemeldet = status(dom);
  ["E-Mail", "Telefon", "Adresse"].forEach((feld) => {
    ok(gemeldet.includes(feld), `die Statusanzeige nennt ${wo} „${feld}" nicht: ${gemeldet}`);
  });

  // Und der Reihe nach: Jede Eingabe nimmt genau ein Feld aus der Meldung.
  tippen(dom, 3, "anna@muster.ch");
  ok(!status(dom).includes("E-Mail") && status(dom).includes("Telefon")
    && status(dom).includes("Adresse"),
    `nach der E-Mail stimmt die Meldung ${wo} nicht: ${status(dom)}`);
  tippen(dom, 4, "079 000 00 00");
  ok(status(dom).includes("Adresse") && !status(dom).includes("Telefon"),
    `nach dem Telefon stimmt die Meldung ${wo} nicht: ${status(dom)}`);
  tippen(dom, 5, "Blumenweg 3, 8000 Zürich");
  ok(/vollständig/.test(status(dom)), `der volle Schritt gilt ${wo} nicht als vollständig: ${status(dom)}`);

  // Solange etwas offen ist, blättert der Knopf nicht weiter — und sagt alles.
  dom.node("bogenWeiter").fire("click");
  ok(/Schritt 3 von/.test(dom.node("bogenStand").textContent),
    `der volle Bogen blättert ${wo} nicht weiter`);
}

/* ══ 2. Der Weiter-Knopf nennt ebenfalls ALLES, was offen ist ══════════════ */
{
  const dom = await seite(bogen(KATALOG));
  tippen(dom, 0, "Gartenbau Muster");
  tippen(dom, 2, "Anna Muster");
  dom.node("bogenWeiter").fire("click");     // auf Blatt 2
  dom.node("bogenWeiter").fire("click");     // Versuch mit leerem Blatt 2
  ok(/Schritt 2 von/.test(dom.node("bogenStand").textContent),
    "der Bogen blättert über offene Pflichtfelder hinweg");
  const gemeldet = status(dom);
  ["E-Mail", "Telefon", "Adresse"].forEach((feld) => {
    ok(gemeldet.includes(feld), `der Weiter-Knopf verschweigt „${feld}": ${gemeldet}`);
  });
}

/* ══ 3. Eine halbe Bedingung versteckt kein Pflichtfeld mehr ═══════════════
   Genau die Konstellation, die zur einzeiligen Meldung führte: Telefon und
   E-Mail hängen an einer Bedingung ohne Wert. Sobald Blatt 1 ausgefüllt war,
   galten sie als „unsichtbar" — und fielen aus der Prüfung. */
{
  const kaputt = KATALOG.map((q) => (
    q.key === "email" || q.key === "phone"
      ? Object.assign({}, q, { showIf: { key: "projekt", value: "" } })
      : q));
  const dom = await seite(bogen(kaputt));
  tippen(dom, 0, "Gartenbau Muster");
  tippen(dom, 2, "Anna Muster");
  dom.node("bogenWeiter").fire("click");
  const gemeldet = status(dom);
  ["E-Mail", "Telefon", "Adresse"].forEach((feld) => {
    ok(gemeldet.includes(feld),
      `eine Bedingung ohne Wert lässt „${feld}" aus der Meldung fallen: ${gemeldet}`);
  });
}

/* ══ 4. Eine ECHTE Bedingung wirkt weiterhin ═══════════════════════════════
   Was nicht auf dem Blatt steht, wird auch nicht verlangt — sonst wäre die
   Korrektur eine Überkorrektur. */
{
  // Ein Blatt, damit die Meldung den ganzen Bogen zeigt.
  const dom = await seite(bogen([
    f("kind", "Was brauchen Sie?", "select", true, { options: ["Website", "Web-App"] }),
    f("domain-name", "Domainname", "text", true, { showIf: { key: "kind", value: "Website" } }),
    f("notes", "Sonstiges", "textarea", false),
  ]));
  const domainNode = dom.node("q_1");
  ok(domainNode, "die bedingte Frage wurde gar nicht erzeugt");
  ok(domainNode.closest("label").hidden, "die unerfüllte Bedingung blendet die Frage nicht aus");
  ok(!status(dom).includes("Domainname"),
    `eine ausgeblendete Frage wird als fehlend gemeldet: ${status(dom)}`);

  // Erfüllt: die Frage erscheint — und wird ab jetzt verlangt.
  tippen(dom, 0, "Website");
  ok(!domainNode.closest("label").hidden, "die erfüllte Bedingung zeigt die Frage nicht");
  ok(status(dom).includes("Domainname"),
    `die eingeblendete Pflichtfrage wird nicht verlangt: ${status(dom)}`);

  // Und zurück: Wer die Auswahl wieder ändert, wird nicht nach etwas gefragt,
  // das nicht mehr dasteht.
  tippen(dom, 0, "Web-App");
  ok(domainNode.closest("label").hidden && !status(dom).includes("Domainname"),
    `die Frage bleibt nach dem Wechsel in der Meldung: ${status(dom)}`);
}

/* ══ 5. Die Vorbelegung nimmt die Felder aus der Meldung ═══════════════════
   Was Quantus mitschickt (prefill.values), steht im Feld — und gilt damit als
   beantwortet. Unbekanntes bleibt offen und wird auch so genannt. */
{
  const dom = await seite(bogen(KATALOG, {
    prefill: { version: 1, values: {
      name: "Jule Dal", company: "FlowerTech", email: "juledal19@gmail.com", kind: "Website",
    } },
  }));
  ok(dom.node("q_3").value === "juledal19@gmail.com", "die vorbelegte E-Mail steht nicht im Feld");
  ok(dom.node("q_2").value === "Jule Dal", "die vorbelegte Ansprechperson steht nicht im Feld");
  ok(dom.node("q_4").value === "" && dom.node("q_5").value === "",
    "Telefon oder Adresse werden erfunden");

  tippen(dom, 0, "Gartenbau Muster");
  dom.node("bogenWeiter").fire("click");
  const gemeldet = status(dom);
  ok(!gemeldet.includes("E-Mail"), `die vorbelegte E-Mail wird als fehlend gemeldet: ${gemeldet}`);
  ok(gemeldet.includes("Telefon") && gemeldet.includes("Adresse"),
    `die wirklich offenen Felder fehlen in der Meldung: ${gemeldet}`);
}

/* ══ 6. Am Ende zählt der ganze Bogen ══════════════════════════════════════ */
{
  const dom = await seite(bogen(KATALOG.slice(0, 3)));   // genau ein Blatt
  const gemeldet = status(dom);
  ok(gemeldet.includes("Projekt- / Firmenname") && gemeldet.includes("Ansprechperson"),
    `auf dem letzten Blatt fehlt etwas in der Meldung: ${gemeldet}`);
  ok(dom.node("submit").getAttribute("aria-disabled") === "true",
    "der unvollständige Bogen lässt sich absenden");
  ok(dom.node("q_0").getAttribute("aria-invalid") === "true",
    "das leere Pflichtfeld ist nicht als fehlerhaft ausgezeichnet");

  tippen(dom, 0, "Gartenbau Muster");
  tippen(dom, 2, "Anna Muster");
  ok(/senden/.test(status(dom)), `der volle Bogen gilt nicht als sendebereit: ${status(dom)}`);
  ok(dom.node("submit").getAttribute("aria-disabled") === "false",
    "der vollständige Bogen lässt sich nicht absenden");
  ok(dom.node("q_0").getAttribute("aria-invalid") === "false",
    "das ausgefüllte Pflichtfeld bleibt als fehlerhaft ausgezeichnet");
}

/* ══ Befund 12.09.2026: drei leere Felder, nur eines gemeldet ══════════════
   Live standen auf Schritt 2 E-Mail, Telefon und Adresse leer; die Zeile
   darunter nannte nur „Adresse". Nachgestellt mit anonymisiertem Fixture:
   Die PRUEFUNG war richtig — in diesem veroeffentlichten Bogen sind E-Mail
   und Telefon nicht verlangt, ihre Beschriftung sagt „freiwillig", und
   verlangt ist allein die Adresse. Unvollstaendig war die AUSKUNFT: sie
   schwieg zu den beiden sichtbaren leeren Feldern und liess offen, warum sie
   nicht vorkommen. Jetzt nennt sie beides. */
const KATALOG_GEMISCHT = KATALOG.map((q) => (
  q.key === "email" || q.key === "phone" ? Object.assign({}, q, { required: false }) : q));
{
  const dom = await seite(bogen(KATALOG_GEMISCHT));
  tippen(dom, 0, "Beispielprojekt");
  tippen(dom, 2, "Beispielperson");
  dom.node("bogenWeiter").fire("click");
  ok(/Schritt 2 von/.test(dom.node("bogenStand").textContent), "der Bogen geht nicht auf Schritt 2");

  // Vorbedingung: alle drei stehen leer und sichtbar auf demselben Blatt.
  [3, 4, 5].forEach((i) => {
    ok(dom.node("q_" + i).value === "", `q_${i} ist nicht leer`);
  });
  const gemeldet = status(dom);
  ok(/Noch offen in diesem Schritt: Adresse\./.test(gemeldet),
    `verlangt ist allein die Adresse — gemeldet wird: ${gemeldet}`);
  ok(/Freiwillig und noch leer:/.test(gemeldet) && /E-Mail/.test(gemeldet) && /Telefon/.test(gemeldet),
    `die beiden freiwilligen leeren Felder werden nicht benannt: ${gemeldet}`);

  /* Die Beschriftung sagt dasselbe wie die Zeile — sonst waere es wieder eine
     Diskrepanz. Gelesen wird das ausgelieferte Markup des Blattes (das
     DOM-Doppel fuehrt keinen Text ueber Knoten hinweg zusammen): vor jedem
     Feld steht seine Auszeichnung. */
  const markup = dom.node("fields").innerHTML;
  const auszeichnung = (i) => {
    const stelle = markup.indexOf('id="q_' + i + '"');
    const vorher = markup.slice(Math.max(0, stelle - 260), stelle);
    return /· Pflichtfeld/.test(vorher) ? "pflicht" : /· freiwillig/.test(vorher) ? "freiwillig" : "ohne";
  };
  ok(auszeichnung(3) === "freiwillig", `E-Mail ist als "${auszeichnung(3)}" beschriftet`);
  ok(auszeichnung(4) === "freiwillig", `Telefon ist als "${auszeichnung(4)}" beschriftet`);
  ok(auszeichnung(5) === "pflicht", `Adresse ist als "${auszeichnung(5)}" beschriftet`);

  // Teilweise gefuellt: was dasteht, verschwindet aus beiden Listen.
  tippen(dom, 3, "kontakt@example.com");
  ok(!/E-Mail/.test(status(dom)) && /Telefon/.test(status(dom)) && /Adresse/.test(status(dom)),
    `nach der E-Mail stimmt die Meldung nicht: ${status(dom)}`);
  tippen(dom, 4, "000 000 00 00");
  ok(!/Freiwillig und noch leer/.test(status(dom)) && /Adresse/.test(status(dom)),
    `nach dem Telefon bleibt ein freiwilliger Hinweis stehen: ${status(dom)}`);
  tippen(dom, 5, "Beispielweg 1, 0000 Beispielstadt");
  ok(/vollständig/.test(status(dom)), `der volle Schritt gilt nicht als vollständig: ${status(dom)}`);

  // Der Weiter-Knopf sagt dasselbe.
  const dom2 = await seite(bogen(KATALOG_GEMISCHT));
  tippen(dom2, 0, "Beispielprojekt");
  tippen(dom2, 2, "Beispielperson");
  dom2.node("bogenWeiter").fire("click");
  dom2.node("bogenWeiter").fire("click");
  ok(/Hier fehlt noch: Adresse\./.test(status(dom2)) && /Freiwillig und noch leer:/.test(status(dom2)),
    `der Weiter-Knopf meldet es anders als die Zeile: ${status(dom2)}`);
}
{
  // Gegenprobe: sind alle drei verlangt, aendert sich nichts an der Meldung —
  // und es steht KEIN freiwilliger Nachsatz da.
  const dom = await seite(bogen(KATALOG));
  tippen(dom, 0, "Beispielprojekt");
  tippen(dom, 2, "Beispielperson");
  dom.node("bogenWeiter").fire("click");
  const gemeldet = status(dom);
  ["E-Mail", "Telefon", "Adresse"].forEach((feld) => {
    ok(gemeldet.includes(feld), `die Meldung nennt „${feld}" nicht: ${gemeldet}`);
  });
  ok(!/Freiwillig und noch leer/.test(gemeldet), `ein freiwilliger Nachsatz ohne freiwillige Felder: ${gemeldet}`);
}

/* ══ Befund 12.09.2026, bestaetigt am Original-Link ════════════════════════
   Auf Schritt 2 standen E-Mail, Telefon und Adresse leer, ALLE DREI sichtbar
   als „· Pflichtfeld" beschriftet — gemeldet wurde nur die Adresse.

   Ursache: Die Blattpruefung fragte die MARKE (`q.vision`) statt den ORT.
   Traegt eine Frage die Vision-Marke, hat der Vision Room sie aber nicht
   uebernommen — Baustein nicht geladen, Raum nicht aufgebaut, Marke aus einem
   alten Fragebogen —, dann bleibt das Feld auf seinem Blatt stehen: sichtbar,
   verlangt, leer. Uebersprungen wurde es trotzdem.

   Dieses DOM-Doppel hat KEIN window.FlowerTechVisionRoom — genau die Lage, in
   der setupVisionRoom() vorzeitig aussteigt und nichts verschiebt. */
const KATALOG_MARKE = KATALOG.map((q) => (
  q.key === "email" ? Object.assign({}, q, { vision: "idea" })
    : q.key === "phone" ? Object.assign({}, q, { vision: "features" }) : q));
{
  const dom = await seite(bogen(KATALOG_MARKE));
  tippen(dom, 0, "Beispielprojekt");
  tippen(dom, 2, "Beispielperson");
  dom.node("bogenWeiter").fire("click");
  ok(/Schritt 2 von/.test(dom.node("bogenStand").textContent), "der Bogen geht nicht auf Schritt 2");

  // Vorbedingung: der Vision Room hat nichts uebernommen, die Felder stehen da.
  ok(dom.node("vrCarriers").children.length === 0,
    "Vorbedingung verfehlt: der Vision Room hat die Felder doch uebernommen");
  [3, 4, 5].forEach((i) => ok(dom.node("q_" + i).value === "", `q_${i} ist nicht leer`));

  const gemeldet = status(dom);
  ["E-Mail", "Telefon", "Adresse"].forEach((feld) => {
    ok(gemeldet.includes(feld),
      `ein sichtbares, verlangtes, leeres Feld fehlt in der Meldung („${feld}"): ${gemeldet}`);
  });
  ok(dom.node("submit").getAttribute("aria-disabled") === "true",
    "der Bogen gilt trotz offener Pflichtangaben als sendbereit");

  // Der Weiter-Knopf haelt ebenfalls an — und nennt dieselben Felder.
  dom.node("bogenWeiter").fire("click");
  ok(/Schritt 2 von/.test(dom.node("bogenStand").textContent),
    "der Weiter-Knopf blaettert ueber offene Pflichtangaben hinweg");
  ["E-Mail", "Telefon", "Adresse"].forEach((feld) => {
    ok(status(dom).includes(feld), `der Weiter-Knopf nennt „${feld}" nicht: ${status(dom)}`);
  });

  // Und ausgefuellt verschwinden sie der Reihe nach — wie jedes andere Feld.
  tippen(dom, 3, "kontakt@example.com");
  tippen(dom, 4, "000 000 00 00");
  tippen(dom, 5, "Beispielweg 1, 0000 Beispielstadt");
  ok(/vollständig/.test(status(dom)), `der volle Schritt gilt nicht als vollständig: ${status(dom)}`);
}
{
  /* Gegenrichtung: Hat der Vision Room die Felder WIRKLICH uebernommen, dann
     gehoeren sie ihm — und nicht mehr auf dieses Blatt. */
  const dom = await seite(bogen(KATALOG_MARKE), { visionRoom: true });
  tippen(dom, 0, "Beispielprojekt");
  tippen(dom, 2, "Beispielperson");
  dom.node("bogenWeiter").fire("click");
  ok(dom.node("vrCarriers").children.length === 2,
    `der Vision Room hat ${dom.node("vrCarriers").children.length} Felder uebernommen statt zwei`);
  const gemeldet = status(dom);
  ok(/Adresse/.test(gemeldet) && !/E-Mail/.test(gemeldet) && !/Telefon/.test(gemeldet),
    `uebernommene Felder werden auf dem Blatt gemeldet: ${gemeldet}`);
}

console.log(`pflichtfelder: ok (${checks} Pruefungen)`);
