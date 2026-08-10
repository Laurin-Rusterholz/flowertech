/*
 * Vision Room — EIN Baustein für beide Seiten.
 * ---------------------------------------------------------------------------
 * Der Befund, den dieser Test festhält: Der Vision Room gab es zweimal. Auf
 * flowertech.ch die Mindmap mit gewichteter Wissensbasis, Art-Wahl, Ziehen und
 * Umbenennen — im öffentlichen Fragebogen eine vereinfachte Chip-Fassung mit
 * einer viel kürzeren eigenen Vorschlagsliste. Zwei Oberflächen für dieselbe
 * Sache driften auseinander, und die Kundschaft sah je nach Weg etwas anderes.
 *
 * Jetzt gibt es visionroom.js und visionroom.css — und sonst nichts. Bewiesen
 * wird:
 *
 *   1. Beide Seiten laden denselben Baustein und tragen keine eigene Fassung.
 *   2. Die Pflicht steht sichtbar im Zentrum UND beim Knopf; die Auszeichnung
 *      für Vorlese-Software stimmt (das bleibt aus dem früheren Test).
 *   3. Die Wissensbasis wirkt: Vorschläge entstehen aus der Idee, nicht aus
 *      einer festen Liste.
 *   4. Der Anfrage-Modus sendet eine ANFRAGE — kein Projekt, kein Mail-Entwurf.
 *      Wer eine Einladung hat (?e=), wird in den Fragebogen geschickt.
 *   5. Der Fragebogen-Modus hat keinen eigenen Versand: kein Senden-Knopf,
 *      kein E-Mail-Feld, kein fetch. Er meldet seine Werte nur nach aussen.
 *
 * Die Logik wird wirklich ausgeführt: visionroom.js läuft gegen ein DOM-Doppel.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { makeDom } from "./dom-double.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fragebogen = fs.readFileSync(path.join(root, "fragebogen.html"), "utf8");
const source = fs.readFileSync(path.join(root, "visionroom.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "visionroom.css"), "utf8");

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

/* ── 1. Ein Baustein, zwei Seiten ─────────────────────────────────────────── */
[["index.html", page], ["fragebogen.html", fragebogen]].forEach(([name, html]) => {
  ok(/<script src="\/visionroom\.js"><\/script>/.test(html),
    `${name} lädt den gemeinsamen Vision Room nicht`);
  ok(/<link rel="stylesheet" href="\/visionroom\.css">/.test(html),
    `${name} lädt die gemeinsame Gestalt nicht`);
  ok(/FlowerTechVisionRoom/.test(html), `${name} setzt den Baustein nicht ein`);
  ok(/id="visionRoomMount"/.test(html), `${name} hat keinen Platz für den Vision Room`);
});

// Keine Zweitfassung mehr: weder Wissensbasis noch Aufbau stehen in den Seiten.
[["index.html", page], ["fragebogen.html", fragebogen]].forEach(([name, html]) => {
  const markup = html.replace(/<style>[\s\S]*?<\/style>/g, "");
  ok(!/VISION_SUGGESTIONS|vr-chip/.test(html), `${name} trägt weiterhin eine eigene Vorschlagsliste`);
  ok(!/const KB = \[/.test(html), `${name} trägt eine zweite Wissensbasis`);
  ok(!/<div class="mm[ "]/.test(markup), `${name} baut die Mindmap selbst statt sie zu benutzen`);
  ok(!/\.mnode\s*\{|\.mm-core\s*\{/.test(html), `${name} trägt eine zweite Gestalt der Mindmap`);
});

// Der Fragebogen bleibt derselbe eine Versandweg.
ok((fragebogen.match(/fetch\(/g) || []).length === 2,
  "der Fragebogen hat nicht mehr genau zwei fetch-Aufrufe (laden, senden)");
ok(!/fetch\(/.test(source.split("if (!intake) {")[0]),
  "der Baustein sendet ausserhalb des Anfrage-Modus");

/* ── 2. Der Aufbau: Pflicht sichtbar, ARIA vollständig ────────────────────── */
const dom0 = makeDom();
const sandbox0 = {
  window: dom0.window, document: dom0.document, location: dom0.window.location,
  setTimeout: dom0.window.setTimeout, clearTimeout() {}, console, URLSearchParams,
};
sandbox0.globalThis = sandbox0;
vm.runInContext(source, vm.createContext(sandbox0));
const VR = dom0.window.FlowerTechVisionRoom;
ok(VR && typeof VR.mount === "function" && typeof VR.markup === "function",
  "der Baustein stellt weder markup() noch mount() bereit");

const markup = VR.markup({ mode: "inquiry" });
ok(/id="vrIdeaHelp"/.test(markup), "im Zentrum steht keine Pflicht-Hilfe");
ok(/Beschreiben Sie kurz Ihre Idee, damit Sie senden können\./.test(markup),
  "die konkrete Pflicht-Hilfe fehlt im Ideenfeld");
ok(/Eine App, mit der Familien Aufgaben und Termine gemeinsam organisieren\./.test(markup),
  "das Beispiel fehlt");
ok(/Zum Beispiel:/.test(markup), "das Beispiel ist nicht als Beispiel gekennzeichnet");
ok(/<p class="mm-need" id="vrIdeaHelp">/.test(markup),
  "die Hilfe ist kein eigenständiges Element, sondern nur ein Platzhalter");

const ideaTag = /<input id="vrIdea"[\s\S]*?>/.exec(markup)[0];
ok(/aria-required="true"/.test(ideaTag), "das Ideenfeld ist nicht als Pflichtfeld ausgezeichnet");
ok(/aria-describedby="vrIdeaHelp"/.test(ideaTag), "die Hilfe ist dem Feld nicht zugeordnet");
ok(/aria-invalid="true"/.test(ideaTag), "der leere Anfangszustand ist nicht als unvollständig markiert");
ok(/aria-label="Ihre Idee \(Pflichtfeld\)"/.test(ideaTag),
  "die Beschriftung für Vorlese-Software nennt die Pflicht nicht");
ok(/Ihre Idee · Pflichtfeld/.test(markup), "die sichtbare Beschriftung nennt die Pflicht nicht");

const needTag = /<p class="mm-need-send"[\s\S]*?>/.exec(markup)[0];
ok(/aria-live="polite"/.test(needTag), "der Hinweis beim Knopf wird nicht vorgelesen");
ok(/role="status"/.test(needTag), "der Hinweis beim Knopf ist keine Statusmeldung");
ok(/aria-describedby="vrNeed"/.test(markup), "der Knopf verweist nicht auf den Hinweis");
ok(/aria-live="polite"/.test(/<div class="mm-sum"[\s\S]*?>/.exec(markup)[0]),
  "die Zusammenfassung wird nicht vorgelesen");
ok(/aria-pressed/.test(source), "die gewählten Funktionen sind nicht als gedrückt ausgezeichnet");

// Mobil bedienbar: eigene Schritte, eigener Knopf für die Vorschläge.
["mm-mobile-step", "mm-suggest", "mm-more", "mm-idea-step", "mm-feature-step"].forEach((cls) => {
  ok(markup.includes(cls), `die mobile Führung „${cls}“ fehlt im Aufbau`);
});
ok(/min-height: 4[2-9]px|min-height: 5\dpx/.test(styles), "die Touch-Ziele sind nicht vergrössert");
ok(/@media \(prefers-reduced-motion: reduce\)/.test(styles),
  "die Gestalt kennt keine Rücksicht auf reduzierte Bewegung");

// Im Fragebogen-Modus gibt es keinen eigenen Versand.
const intakeMarkup = VR.markup({ mode: "intake" });
ok(!/id="vrSend"/.test(intakeMarkup), "der Fragebogen-Modus hat einen eigenen Senden-Knopf");
ok(!/id="vrMail"/.test(intakeMarkup), "der Fragebogen-Modus fragt die E-Mail ein zweites Mal");
ok(/data-mode="intake"/.test(intakeMarkup), "der Modus steht nicht am Baustein");
ok(/id="vrIdea"/.test(intakeMarkup) && /id="mmNodes"/.test(intakeMarkup),
  "der Fragebogen-Modus lässt Zentrum oder Mindmap weg");

/* ── 3. Laufzeit: Anfrage-Modus ───────────────────────────────────────────── */
function boot({ search = "", innerWidth = 1200 } = {}) {
  const dom = makeDom({ innerWidth });
  const posted = [];
  const sandbox = {
    window: dom.window,
    document: dom.document,
    setTimeout: dom.window.setTimeout,
    clearTimeout() {},
    console,
    URLSearchParams,
    location: dom.window.location,
    fetch: (url, init) => {
      posted.push({ url, init });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    },
  };
  sandbox.globalThis = sandbox;
  dom.window.location.search = search;
  dom.window.fetch = sandbox.fetch;
  dom.window.URLSearchParams = URLSearchParams;
  vm.runInContext(source, vm.createContext(sandbox));
  return { dom, posted, VR: dom.window.FlowerTechVisionRoom };
}

{
  const { dom, posted, VR: vr } = boot();
  const mount = dom.ensure("visionRoomMount");
  const api = vr.mount(mount, { mode: "inquiry" });
  ok(api, "der Baustein liess sich nicht einsetzen");

  const idea = dom.node("vrIdea"), send = dom.node("vrSend"), need = dom.node("vrNeed");
  ok(send.getAttribute("aria-disabled") === "true", "der Senden-Knopf ist im Leerzustand frei");
  ok(/Idee beschreiben/.test(need.textContent), `der Hinweis nennt den nächsten Schritt nicht: ${need.textContent}`);

  // Erst die Art, dann die Idee — genau wie auf der Seite.
  dom.types.find((b) => b.dataset.t === "Web-Programm").fire("click");
  idea.value = "Ein Programm für die Buchhaltung im Treuhandbüro";
  idea.fire("input");

  // Die Vorschläge entstehen aus der Idee, nicht aus einer festen Liste.
  const labels = dom.node("mmNodes").children.map((n) => n.children[0].textContent);
  ok(labels.some((l) => /MwSt|Belege|Bankabgleich/.test(l)),
    `die Wissensbasis wirkt nicht: ${labels.join(", ")}`);
  ok(labels.some((l) => /Offline weiterarbeiten|Benutzer & Rechte/.test(l)),
    "die Grundvorschläge der gewählten Art fehlen");
  ok(dom.node("mmType").textContent === "Web-Programm", "die gewählte Art steht nicht im Zentrum");

  // Eine Funktion wählen: Zähler und Zusammenfassung ziehen mit.
  // Am Schreibtisch schaltet das kleine Zeichen am Rand — die Karte selbst
  // gehört dort dem Ziehen und dem Umbenennen.
  dom.node("mmNodes").children[0].children[1].fire("click");
  ok(dom.node("mmBadge").textContent === 1, "der Zähler der Auswahl stimmt nicht");
  ok(/Funktionen angehängt/.test(dom.node("vrSum").innerHTML), "die Auswahl wird nicht zusammengefasst");
  ok(api.state().features.length === 1, "die Auswahl kommt nach aussen nicht an");

  // Ohne E-Mail bleibt der Knopf zu — mit E-Mail geht er auf.
  ok(send.getAttribute("aria-disabled") === "true", "ohne E-Mail lässt sich senden");
  ok(/E-Mail/.test(need.textContent), "der Hinweis verlangt die E-Mail nicht");
  dom.node("vrMail").value = "anna@beiz.ch";
  dom.node("vrMail").fire("input");
  ok(send.getAttribute("aria-disabled") === "false", "mit vollständigen Angaben bleibt der Knopf zu");

  // Senden erzeugt eine ANFRAGE — kein Projekt, kein Mail-Entwurf.
  send.fire("click");
  ok(posted.length === 1, `es wurden ${posted.length} Sendungen ausgelöst statt genau einer`);
  const body = JSON.parse(posted[0].init.body);
  ok(/flowertech-portal/.test(posted[0].url), `der Eingang stimmt nicht: ${posted[0].url}`);
  ok(body.kind === "inquiry", `es wird kein Anfrage-Eingang benutzt: ${body.kind}`);
  ok(body.source === "vision-room", "die Herkunft fehlt");
  ok(body.payload.idea.includes("Buchhaltung"), "die Idee fehlt im Versand");
  ok(body.payload.features.length === 1, "die gewählten Funktionen fehlen im Versand");
  ok(/^ft_/.test(body.idempotencyKey), "der Idempotenz-Schlüssel fehlt");
  ok(!/mailto:/.test(source), "der Baustein bietet einen Mail-Entwurf als Ausweg an");
}

/* ── 4. Mit Einladung: kein zweiter Eingang, sondern der Fragebogen ───────── */
{
  const token = "e".repeat(30);
  const { dom, posted, VR: vr } = boot({ search: "?e=" + token });
  vr.mount(dom.ensure("visionRoomMount"), { mode: "inquiry" });
  dom.types.find((b) => b.dataset.t === "Website").fire("click");
  dom.node("vrIdea").value = "Eine Seite für die Beiz";
  dom.node("vrIdea").fire("input");
  dom.node("vrMail").value = "anna@beiz.ch";
  dom.node("vrMail").fire("input");
  dom.node("vrSend").fire("click");

  ok(posted.length === 0, "mit Einladung wird trotzdem eine zweite Anfrage gesendet");
  ok(dom.window.location.href.includes("/fragebogen.html?e=" + token),
    `mit Einladung wird nicht in den Fragebogen geführt: ${dom.window.location.href}`);
}

/* ── 5. Fragebogen-Modus: meldet nur, sendet nie ──────────────────────────── */
{
  const { dom, posted, VR: vr } = boot({ innerWidth: 400 });
  const gemeldet = [];
  const api = vr.mount(dom.ensure("visionRoomMount"), {
    mode: "intake",
    initial: { type: "Website", idea: "Speisekarte und Reservation für unsere Beiz", features: ["Eigene Idee"] },
    onChange: (state) => gemeldet.push(state),
  });

  ok(dom.node("vrSend") === null, "im Fragebogen-Modus entsteht ein Senden-Knopf");
  ok(dom.node("vrMail") === null, "im Fragebogen-Modus entsteht ein E-Mail-Feld");
  ok(gemeldet.length > 0, "der Baustein meldet seine Werte nicht nach aussen");

  const letzte = gemeldet[gemeldet.length - 1];
  ok(letzte.idea.includes("Speisekarte"), "die vorbelegte Idee ging verloren");
  ok(letzte.type === "Website", "die vorbelegte Art ging verloren");
  ok(letzte.features.includes("Eigene Idee"), "die vorbelegte Auswahl ging verloren");

  // Vorschläge holen (mobiler Weg) und eine Funktion dazunehmen.
  dom.node("vrSuggest").fire("click");
  const labels = dom.node("mmNodes").children.map((n) => n.children[0].textContent);
  ok(labels.some((l) => /Tischreservation/.test(l)),
    `die Wissensbasis wirkt im Fragebogen nicht: ${labels.join(", ")}`);
  const frei = dom.node("mmNodes").children.find((n) => /Tischreservation|Tisch/.test(n.children[0].textContent));
  ok(frei, `der passende Vorschlag fehlt: ${labels.join(", ")}`);
  frei.fire("click");
  ok(api.state().features.some((f) => /Tischreservation/.test(f)), "die Auswahl kommt nicht an");

  // Eine eigene Funktion lässt sich anhängen.
  dom.node("vrOwn").value = "Gutscheine verkaufen";
  dom.node("vrAdd").fire("click");
  ok(api.state().features.includes("Gutscheine verkaufen"), "eine eigene Funktion kommt nicht an");
  ok(dom.node("vrOwn").value === "", "das Eingabefeld wird nach dem Anhängen nicht geleert");

  ok(posted.length === 0, "der Fragebogen-Modus sendet von sich aus");
  ok(/geht mit dem Fragebogen ab/.test(dom.node("vrSum").innerHTML),
    `der Fragebogen-Modus verspricht einen eigenen Versand: ${dom.node("vrSum").innerHTML}`);
}

console.log(`visionroom: ok (${checks} Pruefungen)`);
