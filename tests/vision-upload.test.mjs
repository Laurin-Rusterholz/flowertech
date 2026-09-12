/*
 * Dateien im Vision Room (visionroom.js + fragebogen.html).
 * ---------------------------------------------------------------------------
 * Der Befund der Live-Abnahme vom 02.09.2026: Im Vision Room fehlte der
 * Upload. Die Kundschaft muss Logos, Bilder, Designentwürfe und andere
 * Referenzdateien direkt dort hochladen können.
 *
 * Bewiesen wird:
 *   1. Der Block steht nur im Fragebogen-Modus mit Upload-Weg; flowertech.ch
 *      (Anfrage-Modus) zeigt ihn nicht. Er ist freiwillig und klar beschriftet.
 *   2. Mehrfachupload: mehrere gültige Dateien gehen einzeln an den Upload-Weg
 *      der Seite; der Baustein selbst ruft nichts auf.
 *   3. Ungültiger Typ, HEIC, Grössenlimit, leere Datei, Anzahl: verständliche
 *      Meldung, kein Upload.
 *   4. Entfernen — und ein gescheiterter Upload hinterlässt keinen Eintrag.
 *   5. Absenden mit Dateien: nur die Ids gehen im Bogen mit; ohne Dateien
 *      eine leere Liste. Der Upload geht als Roh-Bytes (PUT) an die
 *      Upload-Funktion, mit dem Einladungstoken — kein Base64.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { makeDom } from "./dom-double.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const component = fs.readFileSync(path.join(root, "visionroom.js"), "utf8");
const page = fs.readFileSync(path.join(root, "fragebogen.html"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "visionroom.css"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const tick = async (n = 3) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const datei = (name, type, size) => ({ name, type, size });
const MB = 1024 * 1024;

// ── 1. Statisch ────────────────────────────────────────────────────────────
ok(/id="vrFiles"/.test(component) && /Logos, Bilder, Designentwürfe/.test(component), "der Upload-Block fehlt im Baustein");
ok(/freiwillig/.test(component), "der Upload ist nicht als freiwillig beschriftet");
ok(/PNG, JPG, WEBP oder PDF/.test(component), "die erlaubten Typen stehen nicht am Block");
ok(/UPLOAD_ACCEPT = '\.png,\.jpg,\.jpeg,\.webp,\.pdf/.test(component) && /accept="' \+ UPLOAD_ACCEPT/.test(component), "die Dateiauswahl schränkt nicht auf die erlaubten Typen ein");
ok(!/fetch\(/.test(component.split("if (!intake) {")[0]), "der Baustein lädt selbst hoch — er darf nur zeigen und prüfen");
ok(!/FileReader|readAsDataURL|btoa\(/.test(component), "der Baustein wandelt Dateien in Base64 um");
ok(/upload: \{[^}]*send: hochladen[^}]*remove: dateiEntfernen/.test(page), "die Seite gibt dem Baustein keinen Upload-Weg mit");
ok(/method: "PUT"/.test(page) && /X-FlowerTech-Filename/.test(page) && /body: file/.test(page), "die Seite schickt die Datei nicht als Roh-Bytes");
ok(/flowertech-upload/.test(page) && !/flowertech-upload/.test(index), "die Upload-Funktion steht auf der falschen Seite");
ok(/\.mm-files\b/.test(css) && /\.mm-file-remove/.test(css), "die Gestalt des Upload-Blocks fehlt");
ok(!/upload:/.test(index.split("FlowerTechVisionRoom.mount")[1] || ""), "flowertech.ch gibt dem Baustein einen Upload-Weg mit");

// ── Aufbau des Bausteins im Fragebogen-Modus ──────────────────────────────
function baustein({ upload, initial } = {}) {
  const dom = makeDom({ innerWidth: 1200 });
  const mount = dom.ensure("visionRoomMount");
  const sandbox = {
    window: dom.window, document: dom.document, location: dom.window.location,
    setTimeout: dom.window.setTimeout, clearTimeout() {}, console, Promise, Array, Object, String, Number, Math,
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(component, context);
  const gemeldet = [];
  const api = dom.window.FlowerTechVisionRoom.mount(mount, {
    mode: "intake", upload, initial, onFiles: (list) => gemeldet.push(list),
  });
  return { dom, api, gemeldet };
}

// ── 2. Mehrfachupload ─────────────────────────────────────────────────────
{
  const gesendet = [];
  const entfernt = [];
  let n = 0;
  const upload = {
    maxBytes: 5 * MB, maxFiles: 3,
    send: (file) => { gesendet.push(file); return Promise.resolve({ ok: true, file: { id: "f_" + String(++n).padStart(10, "0"), name: file.name, type: file.type, size: file.size } }); },
    remove: (id) => { entfernt.push(id); return Promise.resolve(true); },
  };
  const { dom, api, gemeldet } = baustein({ upload });
  ok(dom.node("vrFiles") && dom.node("vrFileInput") && dom.node("vrFilePick"), "der Upload-Block wurde nicht aufgebaut");
  const aufbau = dom.node("visionRoomMount").innerHTML;
  ok(/bis 5 MB pro Datei/.test(aufbau) && /bis 3 Dateien/.test(aufbau) && /freiwillig/.test(aufbau),
    "die Grenzen stehen nicht am Block");
  ok(api.files().length === 0, "vor dem Upload sind Dateien da");

  const input = dom.node("vrFileInput");
  input.files = [datei("Logo.png", "image/png", 120 * 1024), datei("CD-Manual.pdf", "application/pdf", 2 * MB)];
  input.fire("change");
  ok(gesendet.length === 2, `es wurden ${gesendet.length} Dateien an den Upload-Weg gegeben statt zwei`);
  ok(dom.node("vrFileList").children.length === 2 && /uploading/.test(dom.node("vrFileList").children[0].className),
    "die Dateien erscheinen nicht sofort als „lädt hoch“");
  await tick();
  ok(api.files().length === 2 && api.files()[0].id === "f_0000000001" && api.files()[1].id === "f_0000000002",
    `nach dem Upload fehlen die Referenzen: ${JSON.stringify(api.files())}`);
  ok(dom.node("vrFileList").children.length === 2 && !/uploading/.test(dom.node("vrFileList").children[0].className),
    "die Liste zeigt die hochgeladenen Dateien nicht");
  ok(/2 Datei\(en\) hochgeladen/.test(dom.node("vrFileStatus").textContent), `die Bestätigung fehlt: ${dom.node("vrFileStatus").textContent}`);
  ok(gemeldet.length > 0 && gemeldet[gemeldet.length - 1].length === 2, "die Seite wird nicht über die Dateien informiert");
  ok(dom.node("mm").classList.contains("has-files"), "der Baustein kennzeichnet nicht, dass Dateien da sind");

  // ── 3. Ungültig: Typ, HEIC, Grösse, leer ──────────────────────────────
  const vorher = gesendet.length;
  input.files = [datei("anim.gif", "image/gif", 1000)];
  input.fire("change");
  ok(gesendet.length === vorher, "ein GIF wurde hochgeladen");
  ok(/PNG, JPG, WEBP und PDF/.test(dom.node("vrFileStatus").textContent) && dom.node("vrFileStatus").classList.contains("err"),
    `ein fremder Typ wird nicht verständlich abgelehnt: ${dom.node("vrFileStatus").textContent}`);
  input.files = [datei("IMG_0001.HEIC", "", 900 * 1024)];
  input.fire("change");
  ok(gesendet.length === vorher && /HEIC/.test(dom.node("vrFileStatus").textContent) && /JPG oder PNG/.test(dom.node("vrFileStatus").textContent),
    `HEIC wird nicht mit Hinweis abgelehnt: ${dom.node("vrFileStatus").textContent}`);
  input.files = [datei("riesig.png", "image/png", 5 * MB + 1)];
  input.fire("change");
  ok(gesendet.length === vorher && /5 MB/.test(dom.node("vrFileStatus").textContent), "eine zu grosse Datei wird hochgeladen");
  input.files = [datei("leer.png", "image/png", 0)];
  input.fire("change");
  ok(gesendet.length === vorher && /leer/.test(dom.node("vrFileStatus").textContent), "eine leere Datei wird hochgeladen");
  await tick();
  ok(api.files().length === 2 && dom.node("vrFileList").children.length === 2, "abgelehnte Dateien hinterliessen Einträge");

  // Die Endung genügt, wenn der Browser keinen Typ meldet.
  input.files = [datei("entwurf.webp", "", 300 * 1024)];
  input.fire("change");
  await tick();
  ok(gesendet.length === vorher + 1 && api.files().length === 3, "eine WEBP ohne gemeldeten Typ wurde abgelehnt");

  // Anzahl: die vierte bei höchstens drei.
  input.files = [datei("noch-eins.jpg", "image/jpeg", 1000)];
  input.fire("change");
  ok(gesendet.length === vorher + 1 && /höchstens 3/.test(dom.node("vrFileStatus").textContent),
    `die Anzahl wird nicht begrenzt: ${dom.node("vrFileStatus").textContent}`);

  // ── 4. Entfernen ──────────────────────────────────────────────────────
  const erste = dom.node("vrFileList").children[0];
  const knopf = erste.children.find((c) => c.tagName === "BUTTON");
  ok(knopf && /entfernen/.test(knopf.getAttribute("aria-label")), "der Entfernen-Knopf fehlt oder ist nicht beschriftet");
  knopf.fire("click");
  await tick();
  ok(entfernt[0] === "f_0000000001" && api.files().length === 2 && !api.files().some((f) => f.id === "f_0000000001"),
    `das Entfernen kam nicht an: ${JSON.stringify(api.files())} ${entfernt}`);
  ok(/entfernt/.test(dom.node("vrFileStatus").textContent), "das Entfernen wird nicht bestätigt");
  // Danach ist wieder Platz.
  input.files = [datei("noch-eins.jpg", "image/jpeg", 1000)];
  input.fire("change");
  await tick();
  ok(api.files().length === 3, "nach dem Entfernen ist kein Platz frei");
}

// Ein gescheiterter Upload: Meldung der Funktion wörtlich, kein Eintrag.
{
  const upload = {
    send: (file) => Promise.reject(new Error("Zu viele Uploads. Bitte in einer Stunde erneut versuchen.")),
    remove: () => Promise.resolve(true),
  };
  const { dom, api } = baustein({ upload });
  dom.node("vrFileInput").files = [datei("logo.png", "image/png", 100)];
  dom.node("vrFileInput").fire("change");
  await tick();
  ok(api.files().length === 0 && dom.node("vrFileList").children.length === 0, "ein gescheiterter Upload hinterliess einen Eintrag");
  ok(/Zu viele Uploads/.test(dom.node("vrFileStatus").textContent) && dom.node("vrFileStatus").classList.contains("err"),
    `die Meldung der Funktion erreicht die Kundschaft nicht: ${dom.node("vrFileStatus").textContent}`);
}

// Ohne Upload-Weg (flowertech.ch, oder Fragebogen ohne Token): kein Block.
{
  const { dom, api } = baustein({});
  ok(!dom.node("vrFiles"), "ohne Upload-Weg steht der Block trotzdem da");
  ok(api.files().length === 0, "ohne Upload-Weg gibt es Dateien");
}

// ── 5. Die Seite: Absenden mit und ohne Dateien ───────────────────────────
const TOKEN = "e".repeat(30);
const FRAGEN = [
  { key: "name", label: "Ansprechperson", type: "text", role: "contactName", required: true, hint: "", options: [], vision: "" },
  { key: "email", label: "E-Mail", type: "email", role: "contactEmail", required: true, hint: "", options: [], vision: "" },
  { key: "kind", label: "Was brauchen Sie?", type: "select", role: "", required: false, hint: "", options: ["Website", "Web-App"], vision: "" },
  { key: "vision-idee", label: "Idee", type: "text", role: "", required: false, hint: "", options: [], vision: "idea" },
  { key: "vision-funktionen", label: "Funktionen", type: "textarea", role: "", required: false, hint: "", options: [], vision: "features" },
];
async function seite({ bestand = [], listeScheitert = false } = {}) {
  const dom = makeDom({ innerWidth: 1200 });
  ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle", "intro", "vorbelegt",
    "form", "fields", "hp", "submit", "need", "status", "footer",
    "answered", "answeredTitle", "answeredText", "area", "tileOffer", "tilePreview", "tileAdmin",
    "visionRoom", "vrLead", "visionRoomMount", "vrCarriers"].forEach((id) => dom.ensure(id));
  const auswahl = dom.ensure("q_2", "SELECT");
  auswahl.options = ["", "Website", "Web-App"].map((value) => ({ value }));
  const form = { schema: 1, title: "Ihre Angaben", intro: "", status: "open", company: { name: "FlowerTech" },
    questions: FRAGEN, prefill: { version: 1, values: { name: "Herr Aljia", email: "juledal19@gmail.com", kind: "Website" } } };
  const calls = [];
  let n = 0;
  const fetchDouble = (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    if (String(url).includes("intakeForms")) return Promise.resolve({ ok: true, json: () => Promise.resolve(form) });
    if (String(url).includes("flowertech-upload")) {
      // Die Liste der eigenen Dateien: ein einfaches GET ohne method.
      if (!(init || {}).method) {
        if (listeScheitert) return Promise.resolve({ ok: false, status: 500,
          json: () => Promise.resolve({ error: "Die bisherigen Dateien konnten nicht geladen werden." }) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, files: bestand.slice() }) });
      }
      if ((init || {}).method === "DELETE") return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      const file = init.body;
      if (file.size > 5 * MB) return Promise.resolve({ ok: false, status: 413, json: () => Promise.resolve({ error: "Die Datei ist grösser als 5 MB." }) });
      return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({ ok: true, file: { id: "f_" + String(++n).padStart(10, "0"), name: file.name, type: file.type, size: file.size } }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  };
  dom.window.location.search = "?e=" + TOKEN;
  const ctx = {
    window: dom.window, document: dom.document, location: dom.window.location,
    setTimeout: dom.window.setTimeout, clearTimeout() {}, console,
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object, encodeURIComponent, decodeURIComponent,
    fetch: fetchDouble,
  };
  ctx.globalThis = ctx;
  dom.window.fetch = fetchDouble;
  const echtesGet = dom.document.getElementById;
  dom.document.getElementById = (id) => echtesGet(id) || (/^q_\d+$/.test(id) ? dom.ensure(id, "INPUT") : null);
  const context = vm.createContext(ctx);
  vm.runInContext(component, context);
  vm.runInContext(script, context);
  await tick();
  return { dom, calls };
}
{
  // Mit Dateien.
  const { dom, calls } = await seite();
  ok(dom.node("vrFiles") && dom.node("vrFileInput"), "der Upload-Block fehlt auf dem Fragebogen");
  // Sichtbar, bevor irgendjemand eine Idee tippt: nicht verborgen, mit Knopf,
  // Beschriftung und Abnahme-Marke — auch bei vorbelegter Art „Website".
  ok(dom.node("vrFiles").hidden === false && dom.node("vrFilePick") && dom.node("vrFileLabel"),
    "der Upload-Block ist auf dem Website-Fragebogen nicht sichtbar aufgebaut");
  const aufbau = dom.node("visionRoomMount").innerHTML;
  ok(/data-ft="vision-files"/.test(aufbau) && /aria-labelledby="vrFileLabel"/.test(aufbau),
    "Abnahme-Marke oder Beschriftung des Upload-Blocks fehlen");
  ok(aufbau.indexOf('id="vrFiles"') < aufbau.indexOf('id="mmCanvas"'), "der Upload-Block steht nicht vor der Mindmap");
  ok(dom.node("mmType").textContent === "Website", "die vorbelegte Art setzt den Vision Room nicht auf Website");
  dom.node("vrFileInput").files = [datei("logo.png", "image/png", 50 * 1024), datei("cd.pdf", "application/pdf", 3 * MB)];
  dom.node("vrFileInput").fire("change");
  await tick();
  const uploads = calls.filter((c) => c.url.includes("flowertech-upload") && c.init.method === "PUT");
  ok(uploads.length === 2, `es gingen ${uploads.length} Uploads ab statt zwei`);
  ok(uploads[0].url.includes("flowertech-upload?e=" + TOKEN), `der Upload trägt den Einladungstoken nicht: ${uploads[0].url}`);
  ok(uploads[0].init.headers["X-FlowerTech-Filename"] === "logo.png" && uploads[0].init.headers["Content-Type"] === "image/png",
    "Name oder Typ fehlen im Upload");
  ok(uploads[0].init.body && uploads[0].init.body.name === "logo.png", "die Datei geht nicht als Roh-Bytes ab");
  ok(!JSON.stringify(uploads.map((u) => Object.assign({}, u.init, { body: null }))).includes("base64"), "der Upload trägt Base64");

  // Eine zu grosse Datei: die Meldung der Funktion, kein Eintrag.
  dom.node("vrFileInput").files = [datei("riesig.png", "image/png", 5 * MB + 5)];
  dom.node("vrFileInput").fire("change");
  await tick();
  ok(/5 MB/.test(dom.node("vrFileStatus").textContent), "das Grössenlimit erreicht die Kundschaft nicht");

  // Eine entfernen.
  const knopf = dom.node("vrFileList").children[1].children.find((c) => c.tagName === "BUTTON");
  knopf.fire("click");
  await tick();
  const loeschungen = calls.filter((c) => c.url.includes("flowertech-upload") && c.init.method === "DELETE");
  ok(loeschungen.length === 1 && loeschungen[0].url.includes("&id=f_0000000002"), "das Entfernen erreicht die Funktion nicht");

  // Absenden: nur die Ids.
  dom.node("form").fire("submit");
  await tick();
  const sendung = calls.find((c) => c.url.includes("flowertech-portal"));
  ok(sendung, "der Bogen wurde nicht gesendet");
  const body = JSON.parse(sendung.init.body);
  ok(body.kind === "intake" && body.token === TOKEN, "der Bogen geht nicht als Fragebogen dieser Einladung ab");
  ok(Array.isArray(body.payload.files) && body.payload.files.length === 1 && body.payload.files[0] === "f_0000000001",
    `die Datei-Referenzen fehlen oder tragen zu viel: ${JSON.stringify(body.payload.files)}`);
  ok(!JSON.stringify(body).includes("storagePath") && !JSON.stringify(body).includes("logo.png"), "der Bogen trägt mehr als die Ids");
  ok(body.payload.answers.find((a) => a.key === "email").answer === "juledal19@gmail.com", "die Vorbelegung geht nicht mit dem Bogen ab");
  ok(calls.filter((c) => c.url.includes("flowertech-portal")).length === 1, "die Antworten gingen mehr als einmal ab");
}
{
  // Ohne Dateien: eine leere Liste, sonst wie bisher.
  const { dom, calls } = await seite();
  dom.node("form").fire("submit");
  await tick();
  const sendung = calls.find((c) => c.url.includes("flowertech-portal"));
  const body = JSON.parse(sendung.init.body);
  ok(Array.isArray(body.payload.files) && body.payload.files.length === 0, "ohne Dateien fehlt die leere Liste");
  /* Ein GET an die Upload-Funktion gibt es immer: die Seite fragt beim Aufbau,
     was diese Einladung schon hochgeladen hat. Geschrieben wird ohne Dateien
     nichts — kein PUT, kein DELETE. */
  ok(!calls.some((c) => c.url.includes("flowertech-upload") && ["PUT", "DELETE"].includes((c.init || {}).method)),
    "ohne Dateien wurde an der Upload-Funktion geschrieben");
}

/* ── 6. Nach dem Neuladen: was schon hochgeladen ist, steht wieder da ──────
   BEFUND (12.09.2026): Nach einem Neuladen kannte die Seite nur die Ids der
   laufenden Sitzung. Die Dateien lagen weiter am Server, zaehlten gegen die
   Zehnergrenze und gingen beim Absenden nicht mit — Waisen allein durch ein
   Neuladen. Der Browserlauf dazu: scripts/upload-reload-regression.mjs. */
{
  const bestand = [
    { id: "f_0000000001", name: "logo.png", type: "image/png", size: 50 * 1024 },
    { id: "f_0000000002", name: "briefing.pdf", type: "application/pdf", size: 3 * MB },
  ];
  const { dom, calls } = await seite({ bestand });
  const abfrage = calls.filter((c) => c.url.includes("flowertech-upload") && !(c.init || {}).method);
  ok(abfrage.length === 1, `die Seite erfragt die eigenen Dateien nicht genau einmal (${abfrage.length})`);
  ok(abfrage[0].url === "https://management-xo2-pro.netlify.app/.netlify/functions/flowertech-upload?e=" + TOKEN,
    `die Abfrage geht an die falsche Adresse: ${abfrage[0].url}`);
  ok(dom.node("vrFileList").children.length === 2, "die bereits hochgeladenen Dateien stehen nicht in der Liste");
  ok(/logo\.png/.test(dom.node("vrFileList").children[0].children[0].textContent), "die erste Datei fehlt");
  const knopf = dom.node("vrFileList").children[0].children.find((c) => c.tagName === "BUTTON");
  ok(knopf && /entfernen/.test(knopf.getAttribute("aria-label")), "die wiederhergestellte Datei laesst sich nicht entfernen");
  ok(/2 Datei\(en\) hochgeladen/.test(dom.node("vrFileStatus").textContent),
    `der Stand wird nicht benannt: ${dom.node("vrFileStatus").textContent}`);

  // Entfernen: DELETE mit der richtigen Id, und sie geht nicht mehr mit.
  knopf.fire("click");
  await tick();
  const weg = calls.filter((c) => c.url.includes("flowertech-upload") && (c.init || {}).method === "DELETE");
  ok(weg.length === 1 && weg[0].url.includes("&id=f_0000000001"), `das Entfernen erreicht die Funktion nicht: ${JSON.stringify(weg.map((w) => w.url))}`);

  dom.node("form").fire("submit");
  await tick();
  const body = JSON.parse(calls.find((c) => c.url.includes("flowertech-portal")).init.body);
  ok(body.payload.files.length === 1 && body.payload.files[0] === "f_0000000002",
    `die wiederhergestellte Datei geht nicht richtig mit: ${JSON.stringify(body.payload.files)}`);
  ok(!JSON.stringify(body).includes("logo.png") && !JSON.stringify(body).includes("storagePath"),
    "der Bogen traegt mehr als die Ids");
}
{
  // Dieselbe Datei zweimal gemeldet: kein Doppeleintrag.
  const doppelt = { id: "f_0000000001", name: "logo.png", type: "image/png", size: 1000 };
  const { dom } = await seite({ bestand: [doppelt, doppelt] });
  ok(dom.node("vrFileList").children.length === 1, "eine doppelt gemeldete Datei steht zweimal da");
}
{
  // Scheitert die Abfrage, wird das gesagt — eine stille Leere haette die
  // Kundschaft dazu gebracht, dieselbe Datei ein zweites Mal hochzuladen.
  const { dom, calls } = await seite({ listeScheitert: true });
  ok(dom.node("vrFileList").children.length === 0, "nach einer gescheiterten Abfrage stehen Dateien da");
  ok(/nicht geladen/.test(dom.node("vrFileStatus").textContent) && dom.node("vrFileStatus").classList.contains("err"),
    `die gescheiterte Abfrage bleibt still: ${dom.node("vrFileStatus").textContent}`);
  ok(!calls.some((c) => ["PUT", "DELETE"].includes((c.init || {}).method)), "nach der gescheiterten Abfrage wurde geschrieben");
}

console.log(`vision-upload: ok (${checks} Pruefungen)`);
