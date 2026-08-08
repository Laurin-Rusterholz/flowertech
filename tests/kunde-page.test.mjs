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
ok(fetches.length === 3,
  `es gibt ${fetches.length} fetch-Aufrufe statt drei (Snapshot lesen, Wunsch senden, Offertenanfrage senden)`);
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
    // Offertenanfrage
    "offerte", "qIntro", "qDone", "quoteForm", "qCompany", "qName", "qMail", "qPhone",
    "qAddress", "qNeed", "qNeedHelp", "qNeedNote", "qBudget", "qDeadline", "qNotes",
    "qHp", "qSubmit", "qStatus"];
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
    // Offertenanfrage: nur Inhaltliches ist vorbelegt, keine Kontaktdaten.
    quote: {
      open: true, status: null, statusLabel: "", submittedAt: "",
      prefill: { need: "Website mit Speisekarte", deliveryType: "website", budget: 4200, deadline: "2026-10-01" },
    },
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

// ── 9. Angaben für Ihre Offerte ───────────────────────────────────────────
// Der Kunde füllt hier selbst aus — erst sein Absenden erzeugt bei FlowerTech
// eine echte Offertenanfrage. Kein Mail-Entwurf, keine leere Offerte.
ok(/id="offerte"/.test(page), "es gibt keinen Abschnitt für die Offertenanfrage");
ok(/Angaben für Ihre Offerte/.test(page), "der Abschnitt ist nicht benannt");
for (const id of ["qCompany", "qName", "qMail", "qPhone", "qAddress", "qNeed", "qBudget", "qDeadline", "qNotes"]) {
  ok(new RegExp('id="' + id + '"').test(page), `im Offertenformular fehlt das Feld ${id}`);
}
ok(/Offertenanfrage senden/.test(page), "der primäre Knopf fehlt oder heisst anders");
ok(/kind: "quote"/.test(page), "die Offertenanfrage wird mit der falschen Art gesendet");
ok(/Ihre Offertenanfrage ist bei FlowerTech eingegangen/.test(page),
  "die geforderte Bestätigung fehlt");
ok(/id="qHp"/.test(page), "dem Offertenformular fehlt der Honeypot");
// Kein Mailweg — weder als Knopf noch als Rückfall.
ok(!/mailto:/.test(page), "die Kundenseite bietet einen Mail-Entwurf an");
ok(!/per E-Mail senden/.test(page), "der Mail-Rückfalltext steht auf der Seite");
// Nur der Bedarf ist Pflicht, ohne künstliche Mindestlänge.
const needTag = /<textarea id="qNeed"[\s\S]*?>/.exec(page)[0];
ok(/aria-required="true"/.test(needTag), "der Bedarf ist nicht als Pflichtfeld ausgezeichnet");
ok(/aria-describedby="qNeedHelp"/.test(needTag), "die Hilfe ist dem Bedarfsfeld nicht zugeordnet");
ok(/aria-invalid="true"/.test(needTag), "der leere Anfangszustand ist nicht markiert");
ok(/Beschreiben Sie kurz, was Sie brauchen/.test(page), "die Pflicht-Hilfe fehlt");
ok(/Zum Beispiel:/.test(page), "im Bedarfsfeld fehlt ein Beispiel");
ok(!/length\s*[<>]=?\s*[3-9]/.test(/function quoteNeed[\s\S]{0,400}/.exec(page)[0]),
  "es gibt eine künstliche Mindestlänge für den Bedarf");
const qBtn = /<button type="submit" id="qSubmit"[\s\S]*?>/.exec(page)[0];
ok(/aria-disabled="true"/.test(qBtn), "der gesperrte Knopf ist nicht als gesperrt ausgezeichnet");
ok(/aria-describedby="qNeedNote"/.test(qBtn), "der Hinweis ist dem Knopf nicht zugeordnet");
const qNote = /<p class="need" id="qNeedNote"[\s\S]*?>/.exec(page)[0];
ok(/aria-live="polite"/.test(qNote), "der Hinweis beim Knopf wird nicht vorgelesen");
ok(/role="status"/.test(qNote), "der Hinweis ist keine Statusmeldung");

// ── 10. Das Offertenformular wirklich bedienen ────────────────────────────
{
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
  const nodes = {};
  const handlers = {};
  const mk = (id) => ({
    id, textContent: "", innerHTML: "", hidden: false, value: "", disabled: false,
    className: "", attrs: {}, style: {}, focus() {}, reset() {}, scrollIntoView() {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
    addEventListener(t, fn) { handlers[id + ":" + t] = fn; },
  });
  const ids = ["loading", "error", "errorTitle", "errorText", "content", "title", "subtitle",
    "steps", "bar", "closedNote", "costs", "linksCard", "links", "blocks", "milestones",
    "versions", "changes", "footer", "changeForm", "crTitle", "crDetail", "crBy", "crHp",
    "crSubmit", "crStatus", "offerte", "qIntro", "qDone", "quoteForm", "qCompany", "qName",
    "qMail", "qPhone", "qAddress", "qNeed", "qNeedHelp", "qNeedNote", "qBudget", "qDeadline",
    "qNotes", "qHp", "qSubmit", "qStatus"];
  ids.forEach((id) => { nodes[id] = mk(id); });

  const TOKEN2 = "q".repeat(30);
  const posted = [];
  const snapshot = {
    schema: 1, title: "Beiz-Website", deliveryType: "website", stage: "lead",
    stageLabel: "Lead", stageIndex: 0, stageSteps: [{ label: "Lead", current: true }],
    closed: false, updatedAt: "2026-08-08T10:00:00.000Z", company: { name: "FlowerTech" },
    costs: {}, content: [], milestones: [], changes: [], versions: [],
    quote: { open: true, status: null, statusLabel: "", submittedAt: "",
      prefill: { need: "Website mit Speisekarte", deliveryType: "website", budget: 4200, deadline: "2026-10-01" } },
  };

  const ctx = {
    document: { getElementById: (id) => nodes[id] || mk(id), title: "" },
    location: { search: "?t=" + TOKEN2, hash: "#offerte" },
    URLSearchParams, URL, Date, Number, String, Math, JSON, RegExp, Promise, console,
    fetch: (url, init) => {
      posted.push({ url, init });
      // Lesen und Senden gehen an verschiedene Adressen — daran wird unterschieden.
      if (String(url).includes("clientPortals")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(snapshot) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    },
  };
  ctx.window = ctx;
  new Function(...Object.keys(ctx), script)(...Object.values(ctx));
  await new Promise((r) => setTimeout(r, 0));

  // Vorbelegung: nur Inhaltliches.
  ok(nodes.qNeed.value === "Website mit Speisekarte", "der bekannte Bedarf wird nicht vorbelegt");
  ok(nodes.qBudget.value === "4200", "der bekannte Budgetrahmen wird nicht vorbelegt");
  ok(nodes.qDeadline.value === "2026-10-01", "das bekannte Wunschdatum wird nicht vorbelegt");
  ok(nodes.qCompany.value === "" && nodes.qMail.value === "",
    "Kontaktdaten werden aus dem Snapshot vorbelegt — die dürfen dort gar nicht stehen");
  // Mit Vorbelegung ist der Knopf sofort bedienbar.
  ok(nodes.qSubmit.getAttribute("aria-disabled") === "false",
    "trotz ausgefülltem Bedarf bleibt der Knopf gesperrt");
  ok(/Sie können jetzt senden/.test(nodes.qNeedNote.textContent),
    `der Hinweis bestätigt nicht: ${nodes.qNeedNote.textContent}`);

  // Leeren: gesperrt und erklärt.
  nodes.qNeed.value = "   ";
  handlers["qNeed:input"]();
  ok(nodes.qSubmit.getAttribute("aria-disabled") === "true", "ohne Bedarf ist der Knopf aktiv");
  ok(nodes.qNeed.getAttribute("aria-invalid") === "true", "das leere Pflichtfeld gilt als ausgefüllt");
  ok(/Noch kurz beschreiben/.test(nodes.qNeedNote.textContent), "der Hinweis erklärt den Leerzustand nicht");

  // Ein einziges Wort genügt — keine künstliche Mindestlänge.
  nodes.qNeed.value = " Shop ";
  handlers["qNeed:input"]();
  ok(nodes.qSubmit.getAttribute("aria-disabled") === "false",
    "ein kurzer, sinnvoller Bedarf schaltet den Knopf nicht frei");

  // Senden: echter Aufruf an den abgesicherten Eingang.
  nodes.qCompany.value = "Beiz AG";
  nodes.qMail.value = "anna@beiz.ch";
  handlers["quoteForm:submit"]({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));
  const call = posted[posted.length - 1];
  ok(call.init, "es wurde nichts gesendet");
  const body = JSON.parse(call.init.body);
  ok(call.url.includes("flowertech-portal"), `der Eingang stimmt nicht: ${call.url}`);
  ok(body.kind === "quote", `die falsche Art wurde gesendet: ${body.kind}`);
  ok(body.token === TOKEN2, "der Projektbezug fehlt im Versand");
  ok(body.payload.need === "Shop", "der Bedarf fehlt im Versand");
  ok(body.payload.company === "Beiz AG", "die Firma fehlt im Versand");
  ok(typeof body.idempotencyKey === "string" && body.idempotencyKey.startsWith("ft_"),
    "der Idempotenz-Schlüssel fehlt");
  ok(/eingegangen/.test(nodes.qStatus.textContent),
    `die Bestätigung fehlt: ${nodes.qStatus.textContent}`);
}

console.log(`kundenseite: ok (${checks} Pruefungen)`);
