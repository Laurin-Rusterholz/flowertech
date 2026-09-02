/*
 * Die Vorbelegung des Kundenlinks (fragebogen.html).
 * ---------------------------------------------------------------------------
 * Der Befund: Die Kundschaft bekam einen Bogen, auf dem selbst das stand
 * leer, was FlowerTech längst wusste — Firma, Ansprechperson, E-Mail, die Art
 * des Vorhabens. Beim Fall „Aljia“ hiess das: Projektname, Ansprechperson,
 * E-Mail und „Website“ ein zweites Mal abtippen.
 *
 * Seither veröffentlicht Quantus im selben Datensatz `prefill` (`version`,
 * `values` nach Frageschlüssel) — nur Bekanntes, nichts Erfundenes. Die Seite
 * liest diese Werte nach dem Rendern in die passenden Felder.
 *
 * Bewiesen wird:
 *   1. Vorbelegte Werte stehen in den Feldern; Unbekanntes bleibt leer.
 *   2. Eine Auswahl wird nur vorbelegt, wenn der Wert eine Option ist.
 *   3. Alles bleibt editierbar: Beim Senden zählt, was im Feld steht — die
 *      Änderung der Kundschaft überschreibt die Vorbelegung.
 *   4. Der Vision Room beginnt mit vorbelegter Art, Idee und Funktionen.
 *   5. Ein Datensatz OHNE `prefill` verhält sich genau wie bisher.
 *   6. Nichts Internes: Die Seite liest ausschliesslich `prefill.values`.
 *
 * Die Logik wird wirklich ausgeführt (Skriptblock gegen ein DOM-Doppel).
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

const TOKEN = "a".repeat(30);
const FRAGEN = [
  { key: "projekt", label: "Projekt- / Firmenname", type: "text", role: "projectTitle", required: true, hint: "", options: [], vision: "" },
  { key: "company", label: "Firma / Organisation", type: "text", role: "company", required: false, hint: "", options: [], vision: "" },
  { key: "name", label: "Ansprechperson", type: "text", role: "contactName", required: true, hint: "", options: [], vision: "" },
  { key: "email", label: "E-Mail", type: "email", role: "contactEmail", required: true, hint: "", options: [], vision: "" },
  { key: "kind", label: "Was brauchen Sie?", type: "select", role: "", required: true, hint: "", options: ["Website", "Web-Programm", "Web-App", "Weiss ich noch nicht"], vision: "" },
  { key: "deadline", label: "Wunschtermin", type: "date", role: "deadline", required: false, hint: "", options: [], vision: "" },
  { key: "vision-idee", label: "Vision Room: Ihre Idee", type: "text", role: "", required: false, hint: "", options: [], vision: "idea" },
  { key: "vision-funktionen", label: "Vision Room: Funktionen", type: "textarea", role: "", required: false, hint: "", options: [], vision: "features" },
];

// Der Aljia-Fall, so wie Quantus ihn veröffentlicht: Bekanntes ja, Unbekanntes
// (Firma, Telefon, Adresse) nicht dabei — und keine ID, keine Herkunft.
const ALJIA = {
  version: 1,
  values: {
    projekt: "Reinigungsunternehmen Aljia",
    name: "Herr Aljia",
    email: "juledal19@gmail.com",
    kind: "Website",
  },
};

// ── Statisch: die Seite liest genau `prefill.values` und nichts Internes ───
ok(/data\.prefill/.test(page), "die Seite liest die Vorbelegung nicht aus dem Datensatz");
ok(/prefill\.values/.test(page), "die Seite liest die Werte nicht nach Frageschlüssel");
ok(!/prefill\.sources|prefill\.labels/.test(page),
  "die Seite liest die Herkunft der Vorbelegung — die gehört nicht nach aussen");
ok(/vorbelegen\(data\);\s*\n\s*setupVisionRoom\(\);/.test(page),
  "die Vorbelegung läuft nicht VOR dem Vision Room — er begänne leer");
ok(/id="vorbelegt"/.test(page), "der Hinweis auf die Vorbelegung fehlt in der Seite");
ok(/bereits für Sie eingetragen/.test(page), "der Hinweis an die Kundschaft fehlt");
ok(!/Sie müssen|Pflicht, zu prüfen/.test(page.slice(page.indexOf("function vorbelegen"), page.indexOf("function sichtbar"))),
  "der Hinweis an die Kundschaft ist nicht freundlich formuliert");
ok((page.match(/intakeForms/g) || []).length === 1, "die Vorbelegung holt sich einen zweiten Abruf");

/* Ein Feld-Doppel, das Auswahlfelder als solche kennt — sonst prüfte die
   Seite die Optionen nie. */
function feldDoppel(nodes, handlers, fragen) {
  const mk = (id, tag) => ({
    id, tagName: tag || "DIV", textContent: "", innerHTML: "", hidden: false, value: "", disabled: false,
    className: "", attrs: {}, style: {}, options: [],
    focus() {}, scrollIntoView() {}, closest() { return null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
    addEventListener(t, fn) { handlers[id + ":" + t] = fn; },
    querySelector() { return null; },
  });
  ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro", "vorbelegt",
    "form", "fields", "hp", "submit", "need", "status", "footer",
    "answered", "answeredTitle", "answeredText", "area", "tileOffer", "tilePreview", "tileAdmin"]
    .forEach((id) => { nodes[id] = mk(id); });
  fragen.forEach((q, i) => {
    const node = mk("q_" + i, q.type === "select" ? "SELECT" : q.type === "textarea" ? "TEXTAREA" : "INPUT");
    if (q.type === "select") node.options = [""].concat(q.options).map((value) => ({ value }));
    nodes["q_" + i] = node;
  });
  return nodes;
}

async function seite(form) {
  const nodes = {};
  const handlers = {};
  const posted = [];
  feldDoppel(nodes, handlers, form.questions);
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
  new Function(...Object.keys(ctx), script)(...Object.values(ctx));
  await new Promise((r) => setTimeout(r, 0));
  return { nodes, handlers, posted };
}

const bogen = (extra) => Object.assign({
  schema: 1, title: "Ihre Angaben", intro: "Kurz ein paar Fragen.", status: "open",
  company: { name: "FlowerTech" }, generation: 1, stage: "intake",
  tiles: { offer: null, preview: null, admin: null, terms: null, testService: null, contract: null },
  questions: FRAGEN,
}, extra || {});

// ── 1. Der Aljia-Fall: Bekanntes steht da, Unbekanntes bleibt leer ─────────
{
  const { nodes } = await seite(bogen({ prefill: ALJIA }));
  ok(nodes.content.hidden === false, "die Seite bleibt im Ladezustand");
  ok(nodes.q_0.value === "Reinigungsunternehmen Aljia", `der Projektname ist nicht vorbelegt: „${nodes.q_0.value}“`);
  ok(nodes.q_2.value === "Herr Aljia", `die Ansprechperson ist nicht vorbelegt: „${nodes.q_2.value}“`);
  ok(nodes.q_3.value === "juledal19@gmail.com", `die E-Mail ist nicht vorbelegt: „${nodes.q_3.value}“`);
  ok(nodes.q_4.value === "Website", `die Art ist nicht vorbelegt: „${nodes.q_4.value}“`);
  // Unbekannt heisst leer — keine Firma, kein Termin, keine Idee erfunden.
  ok(nodes.q_1.value === "" && nodes.q_5.value === "" && nodes.q_6.value === "" && nodes.q_7.value === "",
    "ein unbekanntes Feld wurde mit etwas gefüllt");
  ok(nodes.q_0.getAttribute("data-vorbelegt") === "1" && nodes.q_1.getAttribute("data-vorbelegt") === null,
    "vorbelegte Felder sind nicht als solche gekennzeichnet");
  // Der Hinweis: kurz, freundlich, nur wenn etwas vorbelegt ist.
  ok(nodes.vorbelegt.hidden === false, "der Hinweis auf die Vorbelegung bleibt verborgen");
  ok(/bereits für Sie eingetragen/.test(nodes.vorbelegt.textContent) && /anpassen/.test(nodes.vorbelegt.textContent),
    `der Hinweis sagt nicht, dass alles anpassbar bleibt: ${nodes.vorbelegt.textContent}`);
  ok(nodes.vorbelegt.textContent.length < 160, "der Hinweis ist zu lang für eine Randnotiz");
  // Die Pflichtprüfung sieht die Vorbelegung: nur die Art fehlt nicht mehr —
  // offen bleiben die Pflichtfelder, die niemand kannte.
  ok(!/Projekt- \/ Firmenname|Ansprechperson|E-Mail|Was brauchen Sie/.test(nodes.need.textContent),
    `ein vorbelegtes Pflichtfeld gilt weiter als offen: ${nodes.need.textContent}`);
  ok(nodes.submit.getAttribute("aria-disabled") === "false",
    "vollständig vorbelegte Pflichtfelder schalten das Senden nicht frei");
}

// ── 2. Eine Auswahl nur mit einer echten Option; ein Datum nur als Datum ───
{
  const { nodes } = await seite(bogen({ prefill: { version: 1, values: {
    kind: "Onlineshop", deadline: "bald", projekt: "  Beiz Muster  ", unbekannt: "x",
  } } }));
  ok(nodes.q_4.value === "", `eine fremde Option wurde in die Auswahl gezwungen: „${nodes.q_4.value}“`);
  ok(nodes.q_5.value === "", `ein unbrauchbares Datum wurde eingetragen: „${nodes.q_5.value}“`);
  ok(nodes.q_0.value === "Beiz Muster", "der Wert wird nicht getrimmt eingetragen");
  ok(nodes.vorbelegt.hidden === false, "trotz einer Vorbelegung fehlt der Hinweis");
}

// ── 3. Editierbar: die Änderung der Kundschaft überschreibt die Vorbelegung ─
{
  const { nodes, handlers, posted } = await seite(bogen({ prefill: ALJIA }));
  // Die Kundschaft korrigiert die E-Mail und wählt eine andere Art.
  nodes.q_3.value = "info@aljia-reinigung.ch";
  nodes.q_4.value = "Web-App";
  handlers["q_3:input"]();
  handlers["q_4:change"]();
  ok(nodes.submit.getAttribute("aria-disabled") === "false", "nach der Korrektur ist das Senden gesperrt");

  handlers["form:submit"]({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));
  const body = JSON.parse(posted[posted.length - 1].init.body);
  ok(body.kind === "intake" && body.token === TOKEN, "die Antworten gehen nicht als Fragebogen dieser Einladung ab");
  const antwort = (key) => (body.payload.answers.find((a) => a.key === key) || {}).answer;
  ok(antwort("email") === "info@aljia-reinigung.ch", `die Korrektur der Kundschaft geht nicht mit: ${antwort("email")}`);
  ok(antwort("kind") === "Web-App", `die geänderte Art geht nicht mit: ${antwort("kind")}`);
  ok(antwort("projekt") === "Reinigungsunternehmen Aljia" && antwort("name") === "Herr Aljia",
    "unveränderte Vorbelegung geht nicht als Antwort mit");
  ok(antwort("company") === "", "ein leeres Feld wurde beim Senden gefüllt");
  ok(!JSON.stringify(body).includes("prefill"), "die Vorbelegung selbst wird zurückgeschickt");
}

// ── 4. Ohne `prefill`: genau wie bisher ───────────────────────────────────
{
  const { nodes } = await seite(bogen());
  ok(nodes.content.hidden === false, "ein Datensatz ohne Vorbelegung lädt nicht mehr");
  ok(FRAGEN.every((q, i) => nodes["q_" + i].value === ""), "ohne Vorbelegung steht etwas in den Feldern");
  ok(nodes.vorbelegt.hidden === true && nodes.vorbelegt.textContent === "",
    "ohne Vorbelegung erscheint der Hinweis trotzdem");
  ok(nodes.submit.getAttribute("aria-disabled") === "true", "ohne Vorbelegung ist das Senden frei");
}
{
  // Auch ein kaputtes oder leeres `prefill` stört nicht.
  const { nodes } = await seite(bogen({ prefill: "kaputt" }));
  ok(nodes.content.hidden === false && nodes.vorbelegt.hidden === true, "ein unbrauchbares prefill reisst die Seite mit");
  const leer = await seite(bogen({ prefill: { version: 1, values: {} } }));
  ok(leer.nodes.vorbelegt.hidden === true, "eine leere Vorbelegung zeigt einen Hinweis");
}

// ── 5. Der Vision Room initialisiert sich aus Art, Idee und Funktionen ─────
{
  const component = fs.readFileSync(path.join(root, "visionroom.js"), "utf8");
  const dom = makeDom({ innerWidth: 1200 });
  ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro", "vorbelegt",
    "form", "fields", "hp", "submit", "need", "status", "footer",
    "answered", "answeredTitle", "answeredText", "area", "tileOffer", "tilePreview", "tileAdmin",
    "visionRoom", "vrLead", "visionRoomMount", "vrCarriers"].forEach((id) => dom.ensure(id));
  // Die Auswahlfrage als echtes SELECT mit Optionen.
  const auswahl = dom.ensure("q_4", "SELECT");
  auswahl.options = [""].concat(FRAGEN[4].options).map((value) => ({ value }));

  const form = bogen({ prefill: { version: 1, values: {
    projekt: "Beiz Muster", name: "Anna Muster", email: "anna@beiz.ch", kind: "Website",
    "vision-idee": "Speisekarte und Reservation für unsere Beiz",
    "vision-funktionen": "Tischreservation online\nSpeisekarte in 5 Minuten ändern",
  } } });
  const posted = [];
  const fetchDouble = (url, init) => {
    posted.push({ url, init });
    if (String(url).includes("intakeForms")) return Promise.resolve({ ok: true, json: () => Promise.resolve(form) });
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
  const echtesGet = dom.document.getElementById;
  dom.document.getElementById = (id) => echtesGet(id) || (/^q_\d+$/.test(id) ? dom.ensure(id, "INPUT") : null);

  const context = vm.createContext(ctx);
  vm.runInContext(component, context);
  vm.runInContext(script, context);
  await new Promise((r) => setTimeout(r, 0));

  ok(dom.node("visionRoom").hidden === false, "der Vision Room bleibt verborgen");
  ok(dom.node("vrIdea").value === "Speisekarte und Reservation für unsere Beiz",
    `die Idee steht nicht im Zentrum: „${dom.node("vrIdea").value}“`);
  ok(dom.node("mmType").textContent === "Website",
    `die Art ist im Vision Room nicht gesetzt: „${dom.node("mmType").textContent}“`);
  const gewaehlt = dom.node("mmNodes").children
    .filter((n) => n.getAttribute("aria-pressed") === "true")
    .map((n) => n.children[0].textContent);
  ok(gewaehlt.includes("Tischreservation online") && gewaehlt.includes("Speisekarte in 5 Minuten ändern"),
    `die vorbelegten Funktionen sind nicht gewählt: ${gewaehlt.join(", ")}`);
  ok(dom.node("q_4").value === "Website", "die Art der Auswahlfrage ist nach dem Aufbau nicht mehr „Website“");
  // Die Wertträger tragen weiterhin die Vorbelegung — bis die Kundschaft sie ändert.
  ok(dom.node("q_6").value.includes("Speisekarte") && /Tischreservation/.test(dom.node("q_7").value),
    "die Antworten des Vision Rooms verlieren die Vorbelegung");

  // Editierbar auch hier: eine Funktion abwählen, die Idee ändern.
  const tisch = dom.node("mmNodes").children.find((n) => n.children[0].textContent === "Tischreservation online");
  tisch.children[1].fire("click");
  ok(!/Tischreservation online/.test(dom.node("q_7").value), "eine abgewählte Funktion bleibt in der Antwort");
  dom.node("vrIdea").value = "Nur eine Speisekarte";
  dom.node("vrIdea").fire("input");
  ok(dom.node("q_6").value === "Nur eine Speisekarte", "die geänderte Idee landet nicht in der Antwort");
}

console.log(`vorbelegung: ok (${checks} Pruefungen)`);
