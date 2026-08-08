/*
 * Vision Room — Pflichtfeld, Hinweise und echter Versand.
 * ---------------------------------------------------------------------------
 * Zwei Befunde, die hier abgesichert werden:
 *
 *   1. Der deaktivierte Senden-Knopf war nicht verständlich: Wer Funktionen
 *      anklickte, aber die Idee leer liess, sah nur einen ausgegrauten Knopf.
 *      Jetzt steht die Pflicht sichtbar im Zentrum UND beim Knopf — und die
 *      Funktionen sind ausdrücklich freiwillig.
 *
 *   2. „Senden" erzeugt eine echte Offertenanfrage bei FlowerTech. Kein
 *      Mail-Entwurf, kein „Direktversand nicht möglich — per E-Mail senden".
 *
 * Die Logik wird wirklich ausgeführt: Der Skriptblock der Seite läuft gegen ein
 * DOM-Doppel, und der Vision-Room-Teil wird daraus herausgeschnitten.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

// Der Stilblock trägt dieselben Klassennamen und erzeugt sonst falsche Treffer.
const markup = page.replace(/<style>[\s\S]*?<\/style>/g, "");

/* ── 1. Die Pflicht steht sichtbar im Zentrum ──────────────────────────────── */
ok(/id="vrIdeaHelp"/.test(markup), "im Zentrum steht keine Pflicht-Hilfe");
ok(/Beschreiben Sie kurz Ihre Idee, damit Sie senden können\./.test(markup),
  "die konkrete Pflicht-Hilfe fehlt im Ideenfeld");
ok(/Eine App, mit der Familien Aufgaben und Termine gemeinsam organisieren\./.test(markup),
  "das Beispiel fehlt");
ok(/Zum Beispiel:/.test(markup), "das Beispiel ist nicht als Beispiel gekennzeichnet");
// Die Hilfe ist echter Text, kein Platzhalter — sie steht auch bei Fokus da.
ok(/<p class="mm-need" id="vrIdeaHelp">/.test(markup),
  "die Hilfe ist kein eigenständiges Element, sondern nur ein Platzhalter");

/* ── 2. ARIA: das Feld ist als Pflichtfeld ausgezeichnet ──────────────────── */
const ideaTag = /<input id="vrIdea"[\s\S]*?>/.exec(markup)[0];
ok(/aria-required="true"/.test(ideaTag), "das Ideenfeld ist nicht als Pflichtfeld ausgezeichnet");
ok(/aria-describedby="vrIdeaHelp"/.test(ideaTag), "die Hilfe ist dem Feld nicht zugeordnet");
ok(/aria-invalid="true"/.test(ideaTag), "der leere Anfangszustand ist nicht als unvollständig markiert");
ok(/aria-label="Ihre Idee \(Pflichtfeld\)"/.test(ideaTag),
  "die Beschriftung für Vorlese-Software nennt die Pflicht nicht");
ok(/Pflichtfeld<\/label>|Pflichtfeld<\/em>|Ihre Idee · Pflichtfeld/.test(markup),
  "die sichtbare Beschriftung nennt die Pflicht nicht");

/* ── 3. Der Hinweis beim Knopf ist eine Live-Region ───────────────────────── */
const needTag = /<p class="mm-need-send"[\s\S]*?>/.exec(markup)[0];
ok(/aria-live="polite"/.test(needTag), "der Hinweis beim Knopf wird nicht vorgelesen");
ok(/role="status"/.test(needTag), "der Hinweis ist keine Statusmeldung");
ok(/Noch kurz Ihre Idee beschreiben, dann können Sie senden\./.test(markup),
  "der geforderte Hinweistext fehlt");
const sendTag = /<a class="bttn" id="vrSend"[\s\S]*?>/.exec(markup)[0];
ok(/aria-disabled="true"/.test(sendTag), "der gesperrte Knopf ist nicht als gesperrt ausgezeichnet");
ok(/aria-describedby="vrNeed"/.test(sendTag), "der Hinweis ist dem Knopf nicht zugeordnet");

/* ── 4. Gestaltung: leer und fokussiert sind sichtbare Zustände ───────────── */
ok(/\.mm-core\.empty\s*\{/.test(page), "das leere Zentrum hat keinen eigenen Zustand");
ok(/\.mm-core:focus-within\s*\{/.test(page), "es gibt keinen klaren Fokus-Zustand");
ok(/\.mm-core\.empty input::placeholder/.test(page),
  "der Platzhalter im leeren Zentrum bleibt kontrastarm");
ok(/--lime|--violet|--cyan/.test(/\.mm-core:focus-within[^}]*}/.exec(page)[0]),
  "der Fokus-Zustand nutzt nicht die FlowerTech-Farben");
// Gesperrt heisst lesbar-gesperrt, nicht fast unsichtbar.
ok(!/#vrSend \{ opacity: \.35/.test(page) && !/#vrSend \{ opacity: \.4;/.test(page),
  "der gesperrte Knopf wird weiterhin nur ausgeblendet");

/* ── 5. Versandvertrag: echte Offertenanfrage, kein Mailprogramm ──────────── */
ok(/kind: 'quote'/.test(page), "der Vision Room sendet keine Offertenanfrage");
ok(/source: 'vision-room'/.test(page), "die Herkunft der Anfrage fehlt");
ok(/flowertech-portal/.test(page), "der abgesicherte Eingang wird nicht aufgerufen");
ok(/idempotencyKey/.test(page), "Doppeleinreichungen sind nicht abgesichert");
ok(/id="vrHp"/.test(markup), "der Honeypot fehlt");
ok(/\{24,64\}/.test(page), "der Zuordnungs-Token wird nicht auf Form geprüft");
ok(!/dataset\.mailto/.test(page), "es gibt weiterhin einen Rückfall auf ein Mailprogramm");
ok(!/Direktversand nicht möglich/.test(page), "der Mail-Rückfalltext steht weiterhin auf der Seite");
ok(!/mailto:[^"']*Visionroom/.test(page), "der Vision Room baut weiterhin einen Mail-Entwurf");
ok(/Ihre Offertenanfrage ist bei FlowerTech eingegangen/.test(page),
  "die Bestätigung nach erfolgreichem Senden fehlt");

/* ── 6. Die Logik wirklich ausführen ──────────────────────────────────────── */
{
  const script = /<script>\n([\s\S]*?)\n<\/script>/.exec(page)[1];
  const start = script.indexOf("/* ================= Visionroom");
  const end = script.indexOf("/* ================= Mobile-Menü");
  ok(start > 0 && end > start, "der Vision-Room-Block liess sich nicht herausschneiden");
  const source = script.slice(start, end);

  // ── Ein sehr kleines DOM-Doppel: nur, was der Vision Room anfasst ────────
  function mk(tag) {
    const cls = new Set();
    const node = {
      tagName: String(tag || "div").toUpperCase(),
      children: [], attrs: {}, dataset: {}, handlers: {},
      textContent: "", value: "", hidden: false, type: "",
      _html: "",
      clientWidth: 1200, clientHeight: 600,
      style: {
        setProperty() {}, getPropertyValue() { return ""; },
      },
      classList: {
        add: (...c) => c.forEach((x) => cls.add(x)),
        remove: (...c) => c.forEach((x) => cls.delete(x)),
        contains: (c) => cls.has(c),
        toggle: (c, on) => {
          if (on === undefined) return cls.has(c) ? cls.delete(c) : cls.add(c);
          return on ? cls.add(c) : cls.delete(c);
        },
      },
      // innerHTML = "" leert im Browser auch die Kindknoten — sonst wachsen
      // die Vorschlags-Knoten bei jedem render() weiter an.
      get innerHTML() { return node._html; },
      set innerHTML(v) { node._html = String(v); if (!v) node.children.length = 0; },
      get className() { return Array.from(cls).join(" "); },
      set className(v) {
        cls.clear();
        String(v).split(/\s+/).filter(Boolean).forEach((x) => cls.add(x));
      },
      setAttribute(k, v) { node.attrs[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(node.attrs, k) ? node.attrs[k] : null; },
      addEventListener(t, fn) { (node.handlers[t] = node.handlers[t] || []).push(fn); },
      removeEventListener() {},
      appendChild(c) { node.children.push(c); return c; },
      querySelector() { return mk("i"); },
      querySelectorAll() { return []; },
      focus() {},
      fire(t, ev) {
        (node.handlers[t] || []).forEach((fn) => fn(Object.assign({
          preventDefault() {}, stopPropagation() {}, target: node, key: "",
        }, ev || {})));
      },
    };
    return node;
  }

  const nodes = {};
  ["mmCanvas", "mmNodes", "mmLinks", "mmCore", "mm", "vrIdea", "vrOwn", "vrMail", "vrSend",
    "vrSum", "mmBadge", "mmType", "mmEmpty", "mmHint", "vrSuggest", "mmMore", "vrNeed",
    "vrHp", "vrAdd", "mmReset"].forEach((id) => { nodes[id] = mk(); });

  const types = ["Website", "Web-Programm", "Web-App"].map((t) => {
    const b = mk("button");
    b.dataset.t = t;
    return b;
  });

  let sent = null;
  const ctx = {
    document: {
      getElementById: (id) => nodes[id] || null,
      querySelectorAll: (sel) => (sel === ".mt" ? types : []),
      createElement: (tag) => mk(tag),
    },
    location: { search: "" },
    URLSearchParams, JSON, Math, Number, String, Array, Object, Date, RegExp, Promise, console,
    setTimeout: (fn) => { if (typeof fn === "function") fn(); return 0; },
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => fn(),
    fetch: (url, init) => {
      sent = { url, body: JSON.parse(init.body) };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    },
  };
  ctx.window = { innerWidth: 1200, addEventListener() {}, document: ctx.document };
  const fn = new Function(...Object.keys(ctx), source);
  fn(...Object.values(ctx));

  const send = nodes.vrSend;
  const need = nodes.vrNeed;

  // Anfangszustand: leer, gesperrt, erklärt.
  ok(!send.classList.contains("ready"), "der Knopf ist im Leerzustand aktiv");
  ok(send.getAttribute("aria-disabled") === "true", "der Leerzustand ist nicht als gesperrt ausgezeichnet");
  ok(/Noch kurz Ihre Idee beschreiben/.test(need.textContent),
    `der Hinweis erklärt den Leerzustand nicht: ${need.textContent}`);
  ok(nodes.mmCore.classList.contains("empty"), "das leere Zentrum ist nicht als leer markiert");

  // Nur Funktionen gewählt, Idee leer — genau der gemeldete Fall.
  types[0].fire("click");
  nodes.vrMail.value = "familie@muster.ch";
  nodes.vrMail.fire("input");
  ok(!send.classList.contains("ready"),
    "ohne Idee ist der Knopf aktiv — die Pflicht wäre wirkungslos");
  ok(/Noch kurz Ihre Idee beschreiben/.test(need.textContent),
    "bei gewählter Art und Mail erklärt der Hinweis die fehlende Idee nicht");
  ok(nodes.vrIdea.getAttribute("aria-invalid") === "true",
    "das leere Pflichtfeld ist nicht als unvollständig markiert");

  // Ein einziges Wort genügt — keine künstliche Mindestlänge.
  nodes.vrIdea.value = "  Hofladen  ";
  nodes.vrIdea.fire("input");
  ok(send.classList.contains("ready"), "ein kurzer, sinnvoller Text schaltet den Knopf nicht frei");
  ok(send.getAttribute("aria-disabled") === "false", "der freigeschaltete Knopf gilt weiter als gesperrt");
  ok(/Sie können jetzt senden/.test(need.textContent),
    `der Hinweis wird nicht zur Bestätigung: ${need.textContent}`);
  ok(need.classList.contains("done"), "die Bestätigung ist nicht als erledigt markiert");
  ok(nodes.mmCore.classList.contains("filled"), "das gefüllte Zentrum wird nicht umgeschaltet");
  ok(nodes.vrIdea.getAttribute("aria-invalid") === "false", "das gefüllte Pflichtfeld gilt weiter als leer");

  // Funktionen sind freiwillig: ohne eine einzige Auswahl bleibt „Senden" aktiv.
  ok(nodes.mmBadge.textContent === "0" || Number(nodes.mmBadge.textContent) === 0,
    "es wurde ungefragt eine Funktion ausgewählt");
  ok(send.classList.contains("ready"), "ohne gewählte Funktion wird der Versand gesperrt");

  // Wieder leeren: der Hinweis kommt zurück, der Knopf sperrt.
  nodes.vrIdea.value = "   ";
  nodes.vrIdea.fire("input");
  ok(!send.classList.contains("ready"), "nur Leerzeichen gelten als Idee");
  ok(/Noch kurz Ihre Idee beschreiben/.test(need.textContent), "der Hinweis kehrt nicht zurück");

  // Fehlende Mail wird eigenständig benannt, nicht mit der Idee vermischt.
  nodes.vrIdea.value = "Hofladen";
  nodes.vrIdea.fire("input");
  nodes.vrMail.value = "";
  nodes.vrMail.fire("input");
  ok(!send.classList.contains("ready"), "ohne Rückkanal ist der Versand offen");
  ok(/E-Mail/.test(need.textContent), `der Hinweis nennt die fehlende Mail nicht: ${need.textContent}`);

  // ── Der Versand selbst ────────────────────────────────────────────────────
  nodes.vrMail.value = "familie@muster.ch";
  nodes.vrMail.fire("input");
  send.fire("click");
  // Der Versand ist asynchron — die Bestätigung steht erst nach dem Durchlauf da.
  await new Promise((r) => setTimeout(r, 0));
  ok(sent, "es wurde nichts gesendet");
  ok(sent.url.includes("flowertech-portal"), `der Eingang stimmt nicht: ${sent.url}`);
  ok(sent.body.kind === "quote", `die falsche Art wurde gesendet: ${sent.body.kind}`);
  ok(sent.body.source === "vision-room", "die Herkunft fehlt im Versand");
  ok(sent.body.payload.need === "Hofladen", "der Bedarf fehlt im Versand");
  ok(sent.body.payload.email === "familie@muster.ch", "der Rückkanal fehlt im Versand");
  ok(Array.isArray(sent.body.payload.features), "die freiwilligen Funktionen fehlen als Feld");
  ok(sent.body.payload.features.length === 0, "es wurden ungefragt Funktionen mitgeschickt");
  ok(typeof sent.body.idempotencyKey === "string" && sent.body.idempotencyKey.startsWith("ft_"),
    "der Idempotenz-Schlüssel fehlt");
  ok(!send.dataset.mailto, "es wurde doch ein Mail-Entwurf vorbereitet");
  ok(/eingegangen/.test(nodes.vrSum.innerHTML), "die Bestätigung nach dem Senden fehlt");
}

console.log(`visionroom: ok (${checks} Pruefungen)`);
