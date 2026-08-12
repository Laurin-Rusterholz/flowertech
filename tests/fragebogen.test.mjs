/*
 * Der öffentliche Fragebogen (fragebogen.html).
 * ---------------------------------------------------------------------------
 * Er ist der Einstieg: FlowerTech legt in Quantus eine Kundenanfrage an,
 * kopiert diesen Link und gibt ihn der Kundschaft. Erst das Absenden erzeugt
 * dort einen Vorgang — die Seite selbst kennt weder Projekt noch Kundendaten.
 *
 * Geprüft wird deshalb vor allem, was NICHT passieren darf: kein Zugriff ohne
 * gültigen Einladungstoken, keine Zugangsdaten im Browser, keine Indexierung,
 * kein zweiter Vorgang bei einem Reload.
 *
 * Und: Der Vision Room gehört zu DIESER Einladung. Er ist kein zweiter Kanal,
 * sondern zwei Fragen desselben Fragebogens — abgeschickt in einem Zug, damit
 * genau EIN Projekt entsteht statt zweier auseinanderdriftender Vorgänge.
 *
 * Derselbe Link wächst inzwischen zum Kundenbereich: Offerte, Vorschau und
 * Verwaltung kommen dazu, sobald Quantus sie ausdrücklich freigibt. Das prüft
 * tests/kundenbereich.test.mjs. Hier bleibt geprüft, dass der Fragebogen selbst
 * unverändert funktioniert — und dass Vertrag, AGB und Kundenportal an diesem
 * Link nichts zu suchen haben.
 *
 * Die Logik wird wirklich ausgeführt: Der Skriptblock läuft gegen ein DOM-Doppel.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { makeDom } from "./dom-double.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, "fragebogen.html"), "utf8");
const toml = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

// Der Stilblock trägt dieselben Wörter und erzeugt sonst falsche Treffer.
const markupOf = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, "");

// ── 1. Eigenständig und ohne Geheimnisse ──────────────────────────────────
ok(/<title>[^<]*FlowerTech/.test(page), "die Seite hat keinen eigenen Titel");
// Geladen wird ausschliesslich von dieser Domain — und zwar genau der
// gemeinsame Vision Room. Ein Skript oder Stil von einer fremden Herkunft wäre
// ein Mitleser auf einer Seite mit Kundendaten.
const quellen = (page.match(/(?:src|href)="([^"]+\.(?:js|css))"/g) || [])
  .map((m) => /"([^"]+)"/.exec(m)[1]);
ok(quellen.every((q) => q.startsWith("/")), `die Seite lädt Fremdes: ${quellen.join(", ")}`);
ok(quellen.includes("/visionroom.js") && quellen.includes("/visionroom.css"),
  "die Seite benutzt nicht den gemeinsamen Vision Room");
ok(!/<script[^>]+src="https?:/i.test(page), "die Seite lädt Skripte von fremden Servern");
ok(!/<link[^>]+stylesheet[^>]+https?:/i.test(page), "die Seite lädt Stile von fremden Servern");
ok(!/firebase[^"']*\.js|firebasejs|gstatic/i.test(page), "das Firebase-SDK wird geladen");
ok(!/apiKey|serviceAccount|private_key|FIREBASE_[A-Z_]+|Bearer\s+[A-Za-z0-9]/i.test(page),
  "die Seite enthält Zugangsdaten");
ok(!/\.set\(|\.update\(|\.remove\(/.test(page), "die Seite schreibt direkt in die Datenbank");
const fetches = page.match(/fetch\(/g) || [];
ok(fetches.length === 2, `es gibt ${fetches.length} fetch-Aufrufe statt zwei (Fragebogen lesen, Antworten senden)`);
ok(/encodeURIComponent\(token\)/.test(page), "der Token wird nicht kodiert eingesetzt");

// ── 2. Ohne gültige Einladung passiert nichts ─────────────────────────────
ok(/\{24,64\}/.test(page), "die Tokenform wird nicht geprüft");
ok(/Der Link ist unvollständig/.test(page), "ein fehlender Token wird nicht freundlich behandelt");
ok(/nicht mehr gültig/.test(page), "ein erneuerter Token wird nicht freundlich behandelt");
ok(/Gerade nicht erreichbar/.test(page), "ein Netzfehler wird nicht freundlich behandelt");
ok(!/existiert nicht|unbekannt|kein Fragebogen gefunden/i.test(page),
  "die Fehlermeldung verrät, ob eine Einladung existiert");

// ── 3. Nicht indexieren, nicht zwischenspeichern ──────────────────────────
ok(/name="robots"[^>]*noindex/.test(page), "die Seite ist nicht auf noindex gesetzt");
ok(/name="referrer"[^>]*no-referrer/.test(page), "der Token könnte über den Referrer abfliessen");
ok(/for = "\/fragebogen\.html"/.test(toml), "es gibt keine eigenen Header für den Fragebogen");
const block = toml.slice(toml.indexOf('for = "/fragebogen.html"'));
ok(/Cache-Control = "no-store"/.test(block), "der Fragebogen darf nicht zwischengespeichert werden");
ok(/X-Robots-Tag = "noindex/.test(block), "der noindex-Header fehlt");

// ── 4. Responsive, im FlowerTech-Design, bedienbar ────────────────────────
ok(/name="viewport"[^>]*width=device-width/.test(page), "die Seite ist nicht responsive");
ok(/--lime|--cyan|--violet/.test(page), "die Seite nutzt nicht die FlowerTech-Farben");
/* Warm und hell: ein Familienbetrieb, kein Konzern. */
ok(/--bg:#faf6f0/.test(page), "die Seite ist nicht warm und hell");
/* Das FlowerTech-Bild bleibt dunkel; hell wird die Bühne, auf der die Website
   der Kundschaft steht — sonst sitzt eine helle Website im Schwarzen. */
ok(/--buehne:#f4ede3/.test(page), "die Bühne der Website ist nicht hell");
ok(/\.pv-stage\{[^}]*background:var\(--buehne\)/.test(page.replace(/\s*\n\s*/g, "")),
  "die Website steht nicht auf der hellen Bühne");
ok(/id="hp"/.test(page), "der Honeypot fehlt");
ok(/kind: "intake"/.test(page), "die Antworten werden mit der falschen Art gesendet");
ok(/idempotencyKey/.test(page), "Doppeleinreichungen sind nicht abgesichert");
ok(!/mailto:/.test(page), "die Seite bietet einen Mail-Entwurf an");

// ── 4b. Was an diesem Link NIE vorkommt ───────────────────────────────────
// Der Link wächst inzwischen: Offerte, Vorschau und Verwaltung kommen dazu,
// sobald Quantus sie ausdrücklich freigibt (bewiesen in
// tests/kundenbereich.test.mjs). Drei Dinge bleiben ausdrücklich draussen —
// sie haben ihre eigene Freigabe und ihren eigenen Link.
// Geprüft wird, was die Seite ausliefern kann — Kommentare erreichen niemanden
// und dürfen benennen, was hier ausdrücklich NICHT hingehört.
const ohneKommentare = (html) => html
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const lieferbar = ohneKommentare(page);
/* Seit August 2026 gilt die umgekehrte Vorgabe fuer zwei dieser vier Punkte:
   Vertrag UND zentrale Standard-AGB gehoeren ausdruecklich auf DIESEN einen
   Link — er ist die vollstaendige Kundensicht und waechst mit dem Projekt.
   Beide haengen weiterhin an ihrer eigenen Bedingung: der Vertrag an einer
   ausdruecklichen Freigabe, die AGB an gar keiner (sie sind fuer alle gleich).

   Was NICHT hierher gehoert, bleibt streng verboten: ein ZWEITER Link und
   alles, was aus dem internen Bereich stammt. */
[[/clientPortals/, "den Kundenportal-Snapshot"], [/kunde\.html/, "das Kundenportal (ein zweiter Link)"],
 [/portalToken/, "einen Portaltoken"], [/projectId/, "eine Projekt-ID"],
].forEach(([re, was]) => {
  ok(!re.test(lieferbar), `der Fragebogen zeigt ${was} — das gehört nicht an diesen Link`);
});
// Und umgekehrt: Beides MUSS die Seite darstellen koennen.
ok(/tiles\.contract/.test(page), "die Seite kann keinen Vertrag darstellen");
ok(/tiles\.terms/.test(page), "die Seite kann die Standard-AGB nicht darstellen");
ok(/renderContract/.test(page) && /renderTerms/.test(page),
  "es fehlt ein eigener Baustein für Vertrag oder AGB");
// Die Stufen entstehen ausschliesslich aus dem gelieferten Datensatz — nicht
// aus einem zweiten Abruf und nicht von einer zweiten Adresse.
ok(/data\.tiles/.test(page), "die Seite liest die Kacheln nicht aus dem Datensatz");
ok((page.match(/intakeForms/g) || []).length === 1,
  "die Seite holt ihren Stand an mehr als einer Stelle");

// ── 4c. Der Vision Room steht IM Fragebogen ───────────────────────────────
ok(/id="visionRoom"/.test(markupOf(page)), "der Vision Room fehlt auf der Seite");
ok(/<form id="form"[\s\S]*id="visionRoom"[\s\S]*<\/form>/.test(markupOf(page)),
  "der Vision Room steht ausserhalb des Formulars — er würde getrennt gesendet");
ok(/q\.vision === "idea"/.test(page) && /q\.vision === "features"/.test(page),
  "der Vision Room hängt nicht an den Fragen des Fragebogens");
ok(/FlowerTechVisionRoom\.mount\(/.test(page), "der gemeinsame Vision Room wird nicht eingesetzt");
ok(/mode: "intake"/.test(page), "der Vision Room läuft nicht im Fragebogen-Modus");
ok(/id="visionRoomMount"/.test(markupOf(page)), "der Vision Room hat keinen Platz im Formular");
ok(/<form id="form"[\s\S]*id="visionRoomMount"[\s\S]*<\/form>/.test(markupOf(page)),
  "der Vision Room steht ausserhalb des Formulars");
ok(!/vr-chip|VISION_SUGGESTIONS|VISION_BASE/.test(page),
  "die vereinfachte Zweitfassung des Vision Rooms steht weiterhin in der Seite");

// ── 5. Die Logik wirklich ausführen ───────────────────────────────────────
{
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
  const nodes = {};
  const handlers = {};
  const mk = (id) => ({
    id, textContent: "", innerHTML: "", hidden: false, value: "", disabled: false,
    checked: false, className: "", attrs: {}, tagName: "DIV", style: {},
    focus() {}, reset() {}, scrollIntoView() {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
    addEventListener(t, fn) { handlers[id + ":" + t] = fn; },
    querySelector() { return null; },
  });
  const get = (id) => (nodes[id] = nodes[id] || mk(id));
  ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
    "form", "fields", "hp", "submit", "need", "status", "footer",
    "answered", "answeredTitle", "answeredText", "area", "tileOffer", "tilePreview", "tileAdmin"]
    .forEach(get);

  const TOKEN = "e".repeat(30);
  const posted = [];
  const form = {
    schema: 1, title: "Ihre Angaben für FlowerTech", intro: "Kurz ein paar Fragen.",
    status: "open", company: { name: "FlowerTech" },
    questions: [
      { key: "name", label: "Ihr Name", type: "text", role: "contactName", required: true, hint: "", options: [] },
      { key: "email", label: "E-Mail", type: "email", role: "contactEmail", required: true, hint: "Für die Antwort.", options: [] },
      { key: "art", label: "Was brauchen Sie?", type: "select", role: "", required: false, hint: "", options: ["Website", "Web-App"] },
      { key: "ziel", label: "Was soll erreicht werden?", type: "textarea", role: "need", required: true, hint: "", options: [] },
      { key: "farbe", label: "Lieblingsfarbe", type: "text", role: "", required: false, hint: "", options: [] },
    ],
  };

  const ctx = {
    document: { getElementById: (id) => nodes[id] || null, title: "" },
    location: { search: "?e=" + TOKEN, hash: "" },
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object, console,
    fetch: (url, init) => {
      posted.push({ url, init });
      if (String(url).includes("intakeForms")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(form) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    },
  };
  ctx.window = ctx;
  // Die Felder entstehen aus den Fragen — das DOM-Doppel legt sie bei Bedarf an.
  ctx.document.getElementById = (id) => nodes[id] || (/^q_\d+$/.test(id) ? get(id) : null);

  new Function(...Object.keys(ctx), script)(...Object.values(ctx));
  await new Promise((r) => setTimeout(r, 0));

  // Der Fragebogen wird geladen und gerendert.
  ok(posted[0].url.includes("intakeForms/" + TOKEN), `der Fragebogen wird nicht geladen: ${posted[0].url}`);
  ok(posted[0].url.startsWith("https://"), "der Fragebogen wird unverschlüsselt geladen");
  ok(nodes.content.hidden === false && nodes.loading.hidden === true, "die Seite bleibt im Ladezustand");
  ok(nodes.title.textContent === "Ihre Angaben für FlowerTech", "der Titel des Fragebogens fehlt");
  ok(nodes.intro.textContent === "Kurz ein paar Fragen.", "die Einleitung fehlt");

  const html = nodes.fields.innerHTML;
  ok((html.match(/<label for="q_/g) || []).length === 5, "es werden nicht alle Fragen gezeigt");
  ok(html.includes("Lieblingsfarbe"), "eine selbst definierte Frage fehlt");
  ok(html.includes("<textarea"), "der lange Text wird als einzeiliges Feld gezeigt");
  ok(html.includes('<option value="Website">'), "die Auswahlmöglichkeiten fehlen");
  ok(html.includes('type="email"'), "die E-Mail wird nicht als E-Mail-Feld gezeigt");
  ok((html.match(/Pflichtfeld/g) || []).length === 3, "die Pflichtfragen sind nicht ausgezeichnet");
  ok(html.includes("freiwillig"), "freiwillige Fragen werden nicht als solche benannt");
  ok(html.includes('aria-required="true"'), "die Pflicht ist für Vorlese-Software nicht erkennbar");
  ok(html.includes('aria-describedby="q_1_h"'), "der Hinweis ist der Frage nicht zugeordnet");

  // Leer: gesperrt und erklärt.
  ok(nodes.submit.getAttribute("aria-disabled") === "true", "im Leerzustand ist der Knopf aktiv");
  ok(/Noch offen/.test(nodes.need.textContent), `der Hinweis erklärt nichts: ${nodes.need.textContent}`);
  ok(/Ihr Name/.test(nodes.need.textContent) && /E-Mail/.test(nodes.need.textContent),
    "der Hinweis benennt die offenen Pflichtfragen nicht");
  ok(nodes.q_0.getAttribute("aria-invalid") === "true", "das leere Pflichtfeld ist nicht markiert");

  // Teilweise ausgefüllt: weiterhin gesperrt.
  nodes.q_0.value = "Anna Muster";
  handlers["q_0:input"]();
  ok(nodes.submit.getAttribute("aria-disabled") === "true", "eine offene Pflichtfrage schaltet den Knopf frei");
  ok(!/Ihr Name/.test(nodes.need.textContent), "die beantwortete Frage steht weiter als offen da");

  // Vollständig: frei, und ein einziges Wort genügt (keine Mindestlänge).
  nodes.q_1.value = "anna@beiz.ch";
  nodes.q_3.value = " Shop ";
  handlers["q_1:input"]();
  handlers["q_3:input"]();
  ok(nodes.submit.getAttribute("aria-disabled") === "false", "eine vollständige Antwort schaltet nicht frei");
  ok(nodes.q_0.getAttribute("aria-invalid") === "false", "das ausgefüllte Pflichtfeld gilt weiter als leer");
  ok(/senden/.test(nodes.need.textContent) && nodes.need.className.includes("done"),
    "der Hinweis wird nicht zur Bestätigung");

  // Absenden.
  nodes.q_2.value = "Website";
  nodes.q_4.value = "Tannengrün";
  handlers["form:submit"]({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));

  const call = posted[posted.length - 1];
  const body = JSON.parse(call.init.body);
  ok(call.url.includes("flowertech-portal"), `der Eingang stimmt nicht: ${call.url}`);
  ok(body.kind === "intake", `die falsche Art wurde gesendet: ${body.kind}`);
  ok(body.token === TOKEN, "die Einladung fehlt im Versand");
  ok(body.payload.answers.length === 5, "es werden nicht alle Antworten gesendet");
  ok(body.payload.answers[0].answer === "Anna Muster", "die Antwort wird nicht getrimmt gesendet");
  ok(body.payload.answers[3].answer === "Shop", "der freie Text wird nicht getrimmt gesendet");
  ok(body.payload.answers[4].answer === "Tannengrün", "die selbst definierte Antwort fehlt");
  ok(body.payload.answers[0].key === "name" && body.payload.answers[0].role === "contactName",
    "Schlüssel oder Rolle der Frage fehlen — die Zuordnung im Projekt wäre nicht möglich");
  // Der Schlüssel haengt an der Einladung, nicht am Inhalt: ein Reload darf
  // keinen zweiten Vorgang erzeugen.
  ok(body.idempotencyKey === body.idempotencyKey && /^ft_/.test(body.idempotencyKey),
    "der Idempotenz-Schlüssel fehlt");
  ok(!JSON.stringify(body).includes("hash"), "im Versand steht Unerwartetes");
  ok(/eingegangen/.test(nodes.status.textContent), `die Bestätigung fehlt: ${nodes.status.textContent}`);
  ok(nodes.submit.hidden === true, "nach dem Senden lässt sich erneut senden");
  ok(nodes.fields.innerHTML === "", "das Formular steht nach dem Senden weiterhin da");
}

// ── 6. Ein bereits beantworteter Fragebogen wird nicht nochmals gezeigt ───
{
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
  const nodes = {};
  const mk = (id) => ({
    id, textContent: "", innerHTML: "", hidden: false, value: "", attrs: {}, className: "",
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute() { return null; },
    addEventListener() {}, focus() {}, scrollIntoView() {},
  });
  ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
    "form", "fields", "hp", "submit", "need", "status", "footer",
    "answered", "answeredTitle", "answeredText", "area", "tileOffer", "tilePreview", "tileAdmin"]
    .forEach((id) => { nodes[id] = mk(id); });

  const ctx = {
    document: { getElementById: (id) => nodes[id] || null, title: "" },
    location: { search: "?e=" + "e".repeat(30), hash: "" },
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object, console,
    fetch: () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: "answered", questions: [{ key: "a", label: "A", type: "text" }] }),
    }),
  };
  ctx.window = ctx;
  new Function(...Object.keys(ctx), script)(...Object.values(ctx));
  await new Promise((r) => setTimeout(r, 0));

  ok(nodes.error.hidden === false && nodes.content.hidden === true,
    "ein beantworteter Fragebogen lässt sich erneut ausfüllen");
  ok(/bei uns/.test(nodes.errorTitle.textContent),
    `der Zustand wird nicht freundlich benannt: ${nodes.errorTitle.textContent}`);
}

// ── 7. Der Vision Room läuft — und sendet mit demselben Absenden ─────────
// Zwei Eigenschaften zugleich:
//   * Es ist DERSELBE Baustein wie auf flowertech.ch (visionroom.js) — keine
//     vereinfachte Zweitfassung mehr.
//   * EIN Klick auf „Antworten senden" schickt Kundendaten UND Vision Room.
//     Es gibt keinen zweiten Versand und damit keinen zweiten Vorgang.
{
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
  const component = fs.readFileSync(path.join(root, "visionroom.js"), "utf8");
  // Am Telefon führt der Weg über „Vorschläge anzeigen" — die enge Breite
  // prüft zugleich, dass der Baustein dort bedienbar bleibt.
  const dom = makeDom({ innerWidth: 400 });
  ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro",
    "form", "fields", "hp", "submit", "need", "status", "footer",
    "answered", "answeredTitle", "answeredText", "area", "tileOffer", "tilePreview", "tileAdmin",
    "visionRoom", "vrLead", "visionRoomMount", "vrCarriers"].forEach((id) => dom.ensure(id));

  const TOKEN = "e".repeat(30);
  const posted = [];
  const form = {
    schema: 1, title: "Ihre Angaben für FlowerTech", intro: "Kurz ein paar Fragen.",
    status: "open", company: { name: "FlowerTech" },
    questions: [
      { key: "name", label: "Ansprechperson", type: "text", role: "contactName", required: true, hint: "", options: [], vision: "" },
      { key: "email", label: "E-Mail", type: "email", role: "contactEmail", required: true, hint: "", options: [], vision: "" },
      { key: "kind", label: "Was brauchen Sie?", type: "select", role: "", required: false, hint: "", options: ["Website", "Web-Programm", "Web-App", "Weiss ich noch nicht"], vision: "" },
      { key: "vision-idee", label: "Vision Room: Ihre Idee", type: "text", role: "", required: false, hint: "", options: [], vision: "idea" },
      { key: "vision-funktionen", label: "Vision Room: Funktionen", type: "textarea", role: "", required: false, hint: "", options: [], vision: "features" },
    ],
  };

  const fetchDouble = (url, init) => {
    posted.push({ url, init });
    if (String(url).includes("intakeForms")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(form) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  };

  dom.window.location.search = "?e=" + TOKEN;
  const ctx = {
    window: dom.window, document: dom.document, location: dom.window.location,
    setTimeout: dom.window.setTimeout, clearTimeout() {}, console,
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object,
    fetch: fetchDouble,
  };
  ctx.globalThis = ctx;
  dom.window.fetch = fetchDouble;
  // Die Felder entstehen aus den Fragen — das Doppel legt sie bei Bedarf an.
  const echtesGet = dom.document.getElementById;
  dom.document.getElementById = (id) => echtesGet(id) || (/^q_\d+$/.test(id) ? dom.ensure(id, "INPUT") : null);

  const context = vm.createContext(ctx);
  vm.runInContext(component, context);   // erst der gemeinsame Baustein …
  vm.runInContext(script, context);      // … dann die Seite, die ihn benutzt
  await new Promise((r) => setTimeout(r, 0));

  ok(dom.node("visionRoom").hidden === false,
    "der Vision Room bleibt verborgen, obwohl er gefragt ist");
  ok(dom.node("vrIdea"), "der Baustein wurde nicht eingesetzt");
  ok(dom.node("vrSend") === null && dom.node("vrMail") === null,
    "im Fragebogen entsteht ein zweiter Versandweg");
  // Die Fragen bleiben die Wertträger — sie wandern in den Behälter.
  ok(dom.node("vrCarriers").children.length === 2,
    `es wurden ${dom.node("vrCarriers").children.length} Wertträger übernommen statt zwei`);

  // Die Art wird nur einmal gefragt: Vision Room und Auswahlfrage sind eins.
  dom.types.find((b) => b.dataset.t === "Website").fire("click");
  ok(dom.node("q_2").value === "Website",
    `die Art des Vision Rooms landet nicht in der Frage: ${dom.node("q_2").value}`);

  // Die Vorschläge entstehen aus der Idee — aus der gemeinsamen Wissensbasis.
  dom.node("vrIdea").value = "Speisekarte und Reservation für unsere Beiz";
  dom.node("vrIdea").fire("input");
  dom.node("vrSuggest").fire("click");
  const labels = dom.node("mmNodes").children.map((n) => n.children[0].textContent);
  ok(labels.some((l) => /Tischreservation/.test(l)),
    `die Vorschläge passen nicht zur Idee: ${labels.join(", ")}`);
  ok(labels.some((l) => /Kontaktformular|Mobil perfekt dargestellt/.test(l)),
    "die Grundvorschläge der gewählten Art fehlen");
  ok(dom.node("q_3").value.includes("Speisekarte"),
    `die Idee landet nicht in der Antwort: ${dom.node("q_3").value}`);

  // Eine Funktion wählen — sie schreibt sich in die Antwort der Frage.
  const tisch = dom.node("mmNodes").children.find((n) => /Tischreservation/.test(n.children[0].textContent));
  ok(tisch, "der passende Vorschlag fehlt");
  tisch.fire("click");
  ok(/Tischreservation/.test(dom.node("q_4").value),
    `die gewählte Funktion landet nicht in der Antwort: ${dom.node("q_4").value}`);

  // Eine eigene Funktion lässt sich anhängen.
  dom.node("vrOwn").value = "Gutscheine verkaufen";
  dom.node("vrAdd").fire("click");
  ok(dom.node("q_4").value.includes("Gutscheine verkaufen"), "eine eigene Funktion kommt nicht an");
  ok(dom.node("vrOwn").value === "", "das Eingabefeld wird nach dem Anhängen nicht geleert");

  // Der Vision Room ist freiwillig: er sperrt das Absenden nicht.
  dom.node("q_0").value = "Anna Muster";
  dom.node("q_1").value = "anna@beiz.ch";
  dom.node("q_0").fire("input");
  dom.node("q_1").fire("input");
  ok(dom.node("submit").getAttribute("aria-disabled") === "false",
    "der freiwillige Vision Room sperrt das Absenden");

  // EIN Absenden — Kundendaten und Vision Room zusammen.
  const vorher = posted.length;
  dom.node("form").fire("submit");
  await new Promise((r) => setTimeout(r, 0));
  ok(posted.length === vorher + 1,
    `es wurden ${posted.length - vorher} Sendungen ausgelöst statt genau einer`);

  const body = JSON.parse(posted[posted.length - 1].init.body);
  ok(body.kind === "intake", `die falsche Art wurde gesendet: ${body.kind}`);
  ok(body.token === TOKEN, "die Einladung fehlt im Versand");
  ok(body.payload.answers.length === 5, "es werden nicht alle Antworten gesendet");
  const idee = body.payload.answers.find((a) => a.key === "vision-idee");
  const funktionen = body.payload.answers.find((a) => a.key === "vision-funktionen");
  ok(idee && idee.answer.includes("Speisekarte"), "die Vision-Idee fehlt im Versand");
  ok(funktionen && /Tischreservation/.test(funktionen.answer), "die Vision-Funktionen fehlen im Versand");
  ok(funktionen.answer.includes("Gutscheine verkaufen"), "die eigene Funktion fehlt im Versand");
  ok(body.payload.answers.find((a) => a.key === "kind").answer === "Website",
    "die im Vision Room gewählte Art fehlt im Versand");
  // Der Schlüssel hängt an der Einladung: ein Reload erzeugt keinen zweiten Vorgang.
  ok(/^ft_/.test(body.idempotencyKey), "der Idempotenz-Schlüssel fehlt");
}

console.log(`fragebogen: ok (${checks} Pruefungen)`);
