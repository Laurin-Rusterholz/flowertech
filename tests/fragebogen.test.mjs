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
 * Die Logik wird wirklich ausgeführt: Der Skriptblock läuft gegen ein DOM-Doppel.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, "fragebogen.html"), "utf8");
const toml = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

// ── 1. Eigenständig und ohne Geheimnisse ──────────────────────────────────
ok(/<title>[^<]*FlowerTech/.test(page), "die Seite hat keinen eigenen Titel");
ok(!/<script[^>]+src=/i.test(page), "die Seite lädt externe Skripte");
ok(!/<link[^>]+stylesheet/i.test(page), "die Seite lädt externe Stylesheets");
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
ok(/prefers-color-scheme/.test(page), "die Seite kennt kein helles Schema");
ok(/id="hp"/.test(page), "der Honeypot fehlt");
ok(/kind: "intake"/.test(page), "die Antworten werden mit der falschen Art gesendet");
ok(/idempotencyKey/.test(page), "Doppeleinreichungen sind nicht abgesichert");
ok(!/mailto:/.test(page), "die Seite bietet einen Mail-Entwurf an");

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
    "form", "fields", "hp", "submit", "need", "status", "footer"].forEach(get);

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
    "form", "fields", "hp", "submit", "need", "status", "footer"].forEach((id) => { nodes[id] = mk(id); });

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

console.log(`fragebogen: ok (${checks} Pruefungen)`);
