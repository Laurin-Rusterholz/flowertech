/*
 * Kundenseite (kunde.html) — statische und Laufzeitpruefungen.
 *
 * Die Seite zeigt Kundschaft ihren Projektstand. Sie ist ein Bearer-Link:
 * Wer die URL hat, sieht den Inhalt. Deshalb steht hier vor allem, was NICHT
 * passieren darf — kein Firebase-SDK, keine Zugangsdaten, keine Indexierung,
 * kein Nachladen von der Hauptseite und keine unsicheren Links.
 *
 * Die Renderfunktion wird wirklich ausgefuehrt: der Skriptblock wird aus der
 * Seite geschnitten und gegen ein DOM-Doppel laufen gelassen.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, "kunde.html"), "utf8");
const toml = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

// ── 1. Eigenstaendig, kein Redirect ────────────────────────────────────────
ok(/<title>[^<]*FlowerTech/.test(page), "die Seite hat keinen eigenen Titel");
ok(!/location\.replace|location\.href\s*=|http-equiv=["']refresh/i.test(page),
  "die Seite leitet weiter, statt selbst zu rendern");
ok(!/management-xo2-pro[^"']*\/flowertech-kunde\.html/.test(page),
  "die Seite verweist auf die alte Quantus-Ansicht");
// Keine externen Skripte oder Styles — die Seite muss auch stehen, wenn die
// Hauptseite umgebaut wird.
ok(!/<script[^>]+src=/i.test(page), "die Seite laedt externe Skripte");
ok(!/<link[^>]+stylesheet/i.test(page), "die Seite laedt externe Stylesheets");
ok(!/firebase[^"']*\.js|firebasejs|gstatic/i.test(page), "das Firebase-SDK wird geladen");

// ── 2. Keine Geheimnisse, kein Admin-Zugang ────────────────────────────────
ok(!/apiKey|serviceAccount|private_key|FIREBASE_[A-Z_]+|Bearer\s+[A-Za-z0-9]/i.test(page),
  "die Seite enthaelt Zugangsdaten");
ok(!/\.set\(|\.update\(|\.remove\(/.test(page),
  "die Seite schreibt direkt in die Datenbank");
// Genau EIN lesender Zugriff auf den vorgefilterten Snapshot (Kommentare
// zaehlen nicht mit — geprueft wird der tatsaechliche Aufruf).
const reads = page.match(/SNAPSHOT_BASE \+/g) || [];
ok(reads.length === 1, `es gibt ${reads.length} Zugriffe auf den Snapshot statt genau einem`);
const fetches = page.match(/fetch\(/g) || [];
// Genau zwei Ausgaenge: den Snapshot lesen und ueber EINEN gemeinsamen
// post()-Weg senden. Kein zweiter Sendeweg, kein Mailprogramm.
ok(fetches.length === 2,
  `es gibt ${fetches.length} fetch-Aufrufe statt zwei (Snapshot lesen, senden)`);
ok(/encodeURIComponent\(token\)/.test(page), "der Token wird nicht kodiert eingesetzt");

// ── 3. Token-Behandlung ────────────────────────────────────────────────────
ok(/\{24,64\}/.test(page), "die Tokenform wird nicht geprueft");
ok(/Der Link ist unvollständig/.test(page), "ein fehlender Token wird nicht freundlich behandelt");
ok(/nicht mehr gültig/.test(page), "ein erneuerter Token wird nicht freundlich behandelt");
ok(/Gerade nicht erreichbar/.test(page), "ein Netzfehler wird nicht freundlich behandelt");
// Der Leerfall darf nicht verraten, ob es den Vorgang je gab.
ok(!/existiert nicht|unbekanntes Projekt|kein Projekt gefunden/i.test(page),
  "die Fehlermeldung verraet, ob ein Vorgang existiert");

// ── 4. Nicht indexieren, nicht zwischenspeichern ───────────────────────────
ok(/name="robots"[^>]*noindex/.test(page), "die Seite ist nicht auf noindex gesetzt");
ok(/name="referrer"[^>]*no-referrer/.test(page), "der Token koennte ueber den Referrer abfliessen");
ok(/for = "\/kunde\.html"/.test(toml), "es gibt keine eigenen Header fuer die Kundenseite");
ok(/X-Robots-Tag = "noindex/.test(toml), "der noindex-Header fehlt");
ok(/Cache-Control = "no-store"/.test(toml), "die Kundenseite darf nicht zwischengespeichert werden");

// ── 5. CSP erlaubt genau das Noetige ───────────────────────────────────────
const csp = /connect-src([^;]*);/.exec(toml);
ok(!!csp, "die CSP kennt keine connect-src-Regel");
ok(/firebasedatabase\.app/.test(csp[1]), "die CSP verbietet das Laden des Snapshots");
ok(/management-xo2-pro/.test(csp[1]), "die CSP verbietet das Senden von Änderungswünschen");
ok(/default-src 'self'/.test(toml), "die CSP ist nicht mehr restriktiv");
ok(/frame-ancestors 'none'/.test(toml), "die Seite darf eingebettet werden");

// ── 6. Responsive und im FlowerTech-Design ─────────────────────────────────
ok(/name="viewport"[^>]*width=device-width/.test(page), "die Seite ist nicht responsive");
ok(/--lime|--cyan|--violet/.test(page), "die Seite nutzt nicht die FlowerTech-Farben");
ok(/prefers-color-scheme/.test(page), "die Seite kennt kein helles Schema");
ok(/@media print/.test(page), "die Seite ist nicht druckbar aufbereitet");

// ── 7. Die Renderfunktion wirklich ausfuehren ──────────────────────────────
{
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
  const nodes = {};
  const mk = () => ({
    textContent: "", innerHTML: "", hidden: false, value: "", disabled: false,
    className: "", style: {}, attrs: {}, focus() {}, reset() {}, addEventListener() {},
    scrollIntoView() {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
  });
  const ids = ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle",
    "steps", "bar", "closedNote", "costs", "linksCard", "links", "blocks", "milestones",
    "versions", "changes", "footer", "changeForm", "crTitle", "crDetail", "crBy", "crHp",
    "crSubmit", "crStatus",
    // Kundenportal
    "vorschau", "preview", "previewNote", "previewActions", "previewFull", "angaben",
    "intakeNote", "intakeAnswers", "fragenCard", "fragen", "aStatus", "agbCard", "agbTitle",
    "agbNotice", "agbBody", "agbState", "agbForm", "agbCheck", "agbSubmit", "agbNeed", "agbStatus"];
  ids.forEach((id) => { nodes[id] = mk(); });

  const TOKEN = "t".repeat(28);
  let requested = "";
  const snapshot = {
    schema: 1, title: "Website Muster", deliveryType: "website",
    stage: "build", stageLabel: "Umsetzung", stageIndex: 3,
    stageSteps: [
      { label: "Lead", done: true }, { label: "Bestandesaufnahme", done: true },
      { label: "Angebot / Vertrag", done: true }, { label: "Umsetzung", current: true },
      { label: "Änderungsrunde" }, { label: "Freigabe / Abschluss" },
    ],
    closed: false, updatedAt: "2026-08-08T10:00:00.000Z",
    company: { name: "FlowerTech", email: "hallo@flowertech.ch" },
    costs: { agreed: 4500, invoiced: 2000, paid: 2000, open: 0 },
    content: [{ title: "Angebot", body: "Wir bauen …" }],
    milestones: [{ title: "Entwurf", date: "2026-09-01", done: true }],
    changes: [{ title: "Bild tauschen", status: "new", statusLabel: "Neu", detail: "" }],
    versions: [{ label: "Entwurf 1", at: "2026-08-08T10:00:00.000Z", approved: false }],
    // Bewusst unsicher: darf NICHT verlinkt werden.
    previewUrl: "http://unsicher.example",
    adminUrl: "https://admin.muster.ch/",
  };

  const ctx = {
    document: { getElementById: (id) => nodes[id] || mk(), title: "" },
    location: { search: "?t=" + TOKEN },
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, console,
    fetch: (url) => { requested = url; return Promise.resolve({ ok: true, json: () => Promise.resolve(snapshot) }); },
  };
  ctx.window = ctx;
  const fn = new Function(...Object.keys(ctx), script);
  fn(...Object.values(ctx));

  // Warten, bis die Promise-Kette durch ist.
  await new Promise((r) => setTimeout(r, 0));

  ok(requested.includes("clientPortals/" + TOKEN), `der Snapshot wird nicht geladen: ${requested}`);
  ok(requested.startsWith("https://"), "der Snapshot wird unverschluesselt geladen");
  ok(nodes.title.textContent === "Website Muster", "der Projektname wird nicht angezeigt");
  ok(nodes.content.hidden === false && nodes.loading.hidden === true, "die Seite bleibt im Ladezustand");
  ok(nodes.steps.innerHTML.includes("Umsetzung"), "der Phasenfortschritt fehlt");
  ok((nodes.steps.innerHTML.match(/class="step /g) || []).length === 6, "es werden nicht alle Phasen gezeigt");
  ok(nodes.steps.innerHTML.includes("now"), "die aktuelle Phase ist nicht hervorgehoben");
  ok(nodes.bar.style.width === "67%", `der Fortschrittsbalken stimmt nicht: ${nodes.bar.style.width}`);
  ok(/4/.test(nodes.costs.innerHTML) && /Vereinbart/.test(nodes.costs.innerHTML), "die Kosten fehlen");
  ok(nodes.blocks.innerHTML.includes("Wir bauen"), "die Leistungsbeschreibung fehlt");
  ok(nodes.milestones.innerHTML.includes("Entwurf"), "die Termine fehlen");
  ok(nodes.versions.innerHTML.includes("zur Ansicht"), "der Freigabestatus fehlt");
  ok(nodes.changes.innerHTML.includes("Bild tauschen"), "die Änderungswünsche fehlen");
  // Die unsichere Vorschau-URL wird verworfen, der gueltige Admin-Link bleibt.
  ok(!nodes.links.innerHTML.includes("unsicher.example"), "eine http-URL wird verlinkt");
  ok(nodes.links.innerHTML.includes("admin.muster.ch"), "der gueltige Link fehlt");
  ok(/rel="noopener noreferrer"/.test(nodes.links.innerHTML), "externe Links leaken den Referrer");
}

// ── 8. Änderungswünsche gehen über den abgesicherten Eingang ───────────────
ok(/flowertech-portal/.test(page), "Änderungswünsche gehen nicht an den abgesicherten Eingang");
ok(/kind: "change"/.test(page), "der Änderungswunsch hat die falsche Art");
ok(/idempotencyKey/.test(page), "Doppeleinreichungen sind nicht abgesichert");
ok(/id="crHp"/.test(page), "der Honeypot fehlt");

// ── 9. Das Kundenportal ist mehr als ein Formular ─────────────────────────
ok(/id="vorschau"/.test(page), "es gibt keinen Abschnitt für die Vorschau");
ok(/id="agbCard"/.test(page), "es gibt keinen Abschnitt für die AGB");
ok(/id="fragenCard"/.test(page), "es gibt keinen Abschnitt für Rückfragen");
ok(/id="angaben"/.test(page), "die eigenen Angaben aus dem Fragebogen fehlen");
ok(/Ihre Änderungswünsche/.test(page), "das Änderungsmenü fehlt");
// Die Vorschau ist fremdes HTML: sie läuft abgeschottet.
const frame = /<iframe id="preview"[\s\S]*?>/.exec(page)[0];
ok(/\bsandbox\b/.test(frame), "die Vorschau läuft nicht in einem sandboxed iframe");
ok(!/allow-scripts/.test(frame), "die Vorschau darf Skripte ausführen");
ok(!/allow-same-origin/.test(frame), "die Vorschau läuft im Ursprung der Kundenseite");
ok(/frame-src 'self'/.test(toml), "die CSP regelt eingebettete Inhalte nicht");

// Das Offertenformular ist weg — der Einstieg ist der Fragebogen.
ok(!/Angaben für Ihre Offerte/.test(page), "das alte Offertenformular steht noch auf der Kundenseite");
ok(!/kind: "quote"/.test(page), "die Kundenseite sendet weiterhin eine Offertenanfrage");
ok(!/mailto:/.test(page), "die Kundenseite bietet einen Mail-Entwurf an");

// AGB: ausdrückliche Zustimmung, nichts vorangekreuzt.
ok(/kind: "terms"/.test(page), "die Zustimmung wird mit der falschen Art gesendet");
const agbCheck = /<input type="checkbox" id="agbCheck"[^>]*>/.exec(page)[0];
ok(!/checked/.test(agbCheck), "die Zustimmung ist vorangekreuzt");
const agbBtn = /<button type="submit" id="agbSubmit"[\s\S]*?>/.exec(page)[0];
ok(/aria-disabled="true"/.test(agbBtn), "der Zustimmungsknopf ist nicht als gesperrt ausgezeichnet");
ok(/aria-describedby="agbNeed"/.test(agbBtn), "der Hinweis ist dem Knopf nicht zugeordnet");
ok(/aria-live="polite"/.test(/<p class="need" id="agbNeed"[\s\S]*?>/.exec(page)[0]),
  "der Hinweis wird nicht vorgelesen");
ok(/kind: "answer"/.test(page), "Rückantworten werden mit der falschen Art gesendet");

// ── 10. Das Portal wirklich bedienen ──────────────────────────────────────
{
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
  const nodes = {};
  const handlers = {};
  const forms = {};
  const mk = (id) => ({
    id, textContent: "", innerHTML: "", hidden: false, value: "", disabled: false,
    checked: false, className: "", attrs: {}, style: {}, srcdoc: "", onclick: null,
    focus() {}, reset() {}, scrollIntoView() {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
    addEventListener(t, fn) { handlers[id + ":" + t] = fn; },
    querySelector(sel) {
      const m = /data-i="(\d+)"/.exec(sel);
      return m ? (forms[m[1]] = forms[m[1]] || { addEventListener(t, fn) { handlers["qform:" + m[1]] = fn; } }) : null;
    },
  });
  const ids = ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle",
    "steps", "bar", "closedNote", "costs", "linksCard", "links", "blocks", "milestones",
    "versions", "changes", "footer", "changeForm", "crTitle", "crDetail", "crBy", "crHp",
    "crSubmit", "crStatus", "vorschau", "preview", "previewNote", "previewActions", "previewFull",
    "angaben", "intakeNote", "intakeAnswers", "fragenCard", "fragen", "aStatus",
    "agbCard", "agbTitle", "agbNotice", "agbBody", "agbState", "agbForm", "agbCheck",
    "agbSubmit", "agbNeed", "agbStatus"];
  ids.forEach((id) => { nodes[id] = mk(id); });

  const TOKEN2 = "q".repeat(30);
  const posted = [];
  const snapshot = {
    schema: 1, title: "Beiz-Website", deliveryType: "website", stage: "build",
    stageLabel: "Umsetzung", stageIndex: 3, stageSteps: [{ label: "Lead", done: true }],
    closed: false, updatedAt: "2026-08-08T10:00:00.000Z", company: { name: "FlowerTech" },
    costs: {}, content: [], milestones: [], versions: [],
    changes: [{ title: "Bild tauschen", status: "new", statusLabel: "Neu", detail: "" }],
    portal: { key: "preview", label: "Vorschau", index: 1, total: 4,
      steps: [{ label: "Fragebogen erhalten", done: true }, { label: "Vorschau", current: true }],
      openChanges: 1 },
    preview: { html: "<h1>Entwurf</h1>", updatedAt: "2026-08-08T09:00:00.000Z", sanitized: [] },
    terms: { title: "AGB (Entwurf)", version: "1-2026-08-08", body: "Diese Bedingungen gelten.",
      notice: "ENTWURF — vor Einsatz rechtlich prüfen.", accepted: false, acceptedAt: "", outdated: false },
    questions: [{ id: "q1", question: "Haben Sie ein Logo als Datei?", answer: "", askedAt: "2026-08-08T08:00:00.000Z" },
      { id: "q2", question: "Öffnungszeiten?", answer: "Mo–Fr 8–18 Uhr", answeredAt: "2026-08-08T09:30:00.000Z" }],
    intake: { title: "Ihre Angaben", submittedAt: "2026-08-08T07:00:00.000Z",
      answers: [{ label: "Ziel", answer: "Mehr Reservationen" }] },
  };

  const ctx = {
    document: { getElementById: (id) => nodes[id] || mk(id), title: "" },
    location: { search: "?t=" + TOKEN2, hash: "" },
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, Array, Object, console,
    fetch: (url, init) => {
      posted.push({ url, init });
      if (String(url).includes("clientPortals")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(snapshot) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    },
  };
  ctx.window = ctx;
  ctx.open = () => null;
  new Function(...Object.keys(ctx), script)(...Object.values(ctx));
  await new Promise((r) => setTimeout(r, 0));

  // Vorschau
  ok(nodes.preview.srcdoc === "<h1>Entwurf</h1>", "die Vorschau wird nicht gezeigt");
  ok(nodes.preview.hidden === false, "die Vorschau bleibt versteckt");
  ok(/aktuelle Entwurf/.test(nodes.previewNote.textContent), "die Vorschau wird nicht eingeordnet");

  // Eigene Angaben
  ok(nodes.angaben.hidden === false, "die eigenen Angaben bleiben versteckt");
  ok(nodes.intakeAnswers.innerHTML.includes("Mehr Reservationen"), "die eigenen Angaben fehlen");

  // Rückfragen: offene mit Formular, beantwortete als Verlauf.
  ok(nodes.fragenCard.hidden === false, "die Rückfragen bleiben versteckt");
  ok(nodes.fragen.innerHTML.includes("Haben Sie ein Logo"), "die offene Rückfrage fehlt");
  ok(nodes.fragen.innerHTML.includes("Mo–Fr 8–18 Uhr"), "die beantwortete Rückfrage fehlt");
  ok((nodes.fragen.innerHTML.match(/<form /g) || []).length === 1,
    "eine bereits beantwortete Frage wird nochmals zur Antwort gestellt");

  // AGB: nichts ist vorangekreuzt, der Knopf bleibt gesperrt.
  ok(nodes.agbCard.hidden === false, "die AGB bleiben versteckt");
  ok(nodes.agbBody.textContent === "Diese Bedingungen gelten.", "der AGB-Text fehlt");
  ok(/ENTWURF/.test(nodes.agbNotice.textContent), "der Prüfhinweis fehlt");
  ok(nodes.agbSubmit.getAttribute("aria-disabled") === "true", "die Zustimmung ist ohne Häkchen möglich");
  handlers["agbForm:submit"]({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));
  const bodies = () => posted.filter((p) => p.init && p.init.body).map((p) => JSON.parse(p.init.body));
  ok(!bodies().some((b) => b.kind === "terms"), "eine Zustimmung ohne Häkchen wird gesendet");

  nodes.agbCheck.checked = true;
  handlers["agbCheck:change"]();
  ok(nodes.agbSubmit.getAttribute("aria-disabled") === "false", "das Häkchen schaltet nicht frei");
  ok(nodes.agbNeed.className.includes("done"), "der Hinweis wird nicht zur Bestätigung");

  handlers["agbForm:submit"]({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));
  const terms = bodies().filter((b) => b.kind === "terms");
  ok(terms.length === 1, `es wurden ${terms.length} Zustimmungen gesendet statt einer`);
  ok(terms[0].token === TOKEN2, "der Projektbezug fehlt bei der Zustimmung");
  ok(terms[0].payload.version === "1-2026-08-08", "die Fassung fehlt bei der Zustimmung");
  ok(terms[0].payload.accepted === true, "die Zustimmung ist nicht ausdrücklich");
  ok(/eingegangen/.test(nodes.agbStatus.textContent), "die Bestätigung fehlt");
  ok(nodes.agbForm.hidden === true, "nach der Zustimmung lässt sich erneut zustimmen");

  // Rückantwort senden
  nodes.a_0 = mk("a_0");
  nodes.a_0.value = " Ja, als SVG. ";
  handlers["qform:0"]({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));
  const answers = bodies().filter((b) => b.kind === "answer");
  ok(answers.length === 1, "die Rückantwort wurde nicht gesendet");
  ok(answers[0].payload.questionId === "q1", "die Antwort hängt an der falschen Frage");
  ok(answers[0].payload.answer === "Ja, als SVG.", "die Antwort wird nicht getrimmt gesendet");
  ok(/eingegangen/.test(nodes.aStatus.textContent), "die Bestätigung der Antwort fehlt");

  // Änderungswunsch geht weiterhin über denselben Eingang.
  nodes.crTitle.value = "Startseite: anderes Bild";
  handlers["changeForm:submit"]({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));
  const changes = bodies().filter((b) => b.kind === "change");
  ok(changes.length === 1, "der Änderungswunsch wurde nicht gesendet");
  ok(changes[0].payload.title === "Startseite: anderes Bild", "der Änderungswunsch ist unvollständig");

  // Alles ging an denselben abgesicherten Eingang.
  ok(posted.slice(1).every((p) => String(p.url).includes("flowertech-portal")),
    "es gibt einen zweiten Sendeweg");
}

console.log(`kundenseite: ok (${checks} Pruefungen)`);
