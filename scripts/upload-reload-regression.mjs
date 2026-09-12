/* ══ Vision-Room-Dateien nach einem ECHTEN Neuladen ══════════════════════════
   BEFUND (12.09.2026, aus der Durchsicht des Upload-Wegs): Wer im Vision Room
   Dateien hochlädt und die Seite danach neu lädt, sieht sie nicht mehr. Die
   Dateien liegen weiterhin am Server (RTDB flowertech/intakeUploads/<token>,
   Bytes im Storage), zählen weiter gegen die Zehnergrenze — gehen beim
   Absenden aber NICHT mit, weil die Seite nur die Ids der laufenden Sitzung
   kennt. Ergebnis: Waisen allein durch ein Neuladen.

   Dieses Skript ist die Reproduktion und zugleich die Abnahme des Fixes. Jede
   Erwartung ist eine harte Zusicherung; eine offene beendet den Lauf mit
   Exitcode 1. Nichts wird ausgewertet, was `null` sein darf.

   ISOLIERT: eigener Server auf 127.0.0.1, JEDE Verbindung nach draussen wird
   abgefangen und von einem Doppel beantwortet, das den Serververtrag
   nachbildet — in der PRODUKTIONSFORM:
       PUT    → 201 { ok:true, file:{ id, name, type, size } }
       GET    → 200 { ok:true, files:[ { id, name, type, size } ] }
       DELETE → 200 { ok:true }
       OPTIONS→ 204 mit Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS
   Das Doppel hält die Dateien wie der Server: über das Neuladen hinweg. Es ist
   die einzige Quelle nach dem Reload — die Seite bekommt KEINE neue Saat.

   Kein Netz, keine echte Kundschaft, kein echter Token, keine Livesubmission:
   der Eingang wird abgefangen und nur protokolliert.

   Aufruf:  node scripts/upload-reload-regression.mjs [port]
   Chromium/Playwright wie in scripts/fragebogen-abnahme.mjs. */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PW_PFAD
  || "/tmp/claude-0/-home-user/18cbce41-cbe5-5300-9142-3055f6610cde/scratchpad/node_modules/playwright-core/index.mjs");

/* Die Wurzel ist das Repository, in dem dieses Skript liegt — nicht ein Pfad
   dieser Maschine. Nur so laesst sich die Abnahme anderswo wiederholen. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || 8907);
const T = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
            ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml" };
const server = http.createServer((req,res)=>{
  let u = decodeURIComponent(req.url.split("?")[0]); if (u === "/") u = "/index.html";
  const p = path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": T[path.extname(p)] || "application/octet-stream" });
  res.end(fs.readFileSync(p));
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

let offen = 0, geprueft = 0;
const zusichern = (bedingung, text) => {
  geprueft++;
  if (bedingung) { console.log("  ok    " + text); return true; }
  offen++; console.error("  FEHLT " + text); return false;
};

const TOKEN = "TESTTESTTESTTESTTESTTEST";      // Testtoken, kein echter Kundenlink
const f = (key,label,type,required,extra) => Object.assign(
  { key, label, type, role:"", required:!!required, hint:"", options:[], vision:"" }, extra||{});
const VEROEFFENTLICHT = {
  schema:1, title:"Ihre Angaben", status:"open", generation:1, intro:"",
  questions:[
    f("projekt","Worum geht es?","text",true),
    f("company","Betrieb","text",true,{role:"company"}),
    f("name","Ihr Name","text",true,{role:"contactName"}),
    f("email","E-Mail","email",true,{role:"contactEmail"}),
    f("idee","Ihre Idee","textarea",false,{vision:"idea"}),
    f("funktionen","Funktionen","textarea",false,{vision:"features"}),
  ],
  prefill:{ version:1, values:{ company:"Beispielkunde AG", name:"Beispielperson", email:"kontakt@example.com" } },
  company:{ name:"FlowerTech" }, stage:"intake", tiles:{ offer:null, preview:null, admin:null },
  updatedAt:"2026-09-12T08:00:00.000Z",
};

const dateien = [
  { name:"logo.png",     mimeType:"image/png",       buffer: Buffer.from("89504e470d0a1a0a0000000d49484452","hex") },
  { name:"briefing.pdf", mimeType:"application/pdf", buffer: Buffer.from("%PDF-1.4 Beispieldatei","utf8") },
];

async function umgebung(breite, hoehe){
  /* Das Serverdoppel. Es lebt ausserhalb der Seite und ueberlebt damit das
     Neuladen — genau wie der echte Server. */
  const ablage = new Map();                   // id → { id, name, type, size }
  const protokoll = { put:0, get:0, del:[], optionen:[], gesendet:null, posts:0 };
  let n = 0;
  /* Steuerung des Bestandsabrufs, um die Zustaende nachzustellen, in denen der
     Bogen NICHT abgehen darf: er laeuft noch, er ist gescheitert, oder er
     antwortet mit 200 und unbrauchbarem Inhalt. */
  const g = { modus:"ok", verzoegerung:0 };

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PFAD
    || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport:{ width:breite, height:hoehe } });
  const page = await ctx.newPage();
  const seitenfehler = [];
  page.on("pageerror", e => seitenfehler.push(e.message));

  await page.route("**://*/**", async route => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
    const kopf = { "Access-Control-Allow-Origin":"*", "Cache-Control":"no-store" };

    if (/firebasedatabase\.app/.test(url))
      return route.fulfill({ status:200, contentType:"application/json", headers:kopf,
        body: JSON.stringify(VEROEFFENTLICHT) });

    if (/flowertech-upload/.test(url)) {
      const u = new URL(url);
      const tok = u.searchParams.get("e") || "";
      if (tok !== TOKEN)                      // fremder Token bekommt nichts
        return route.fulfill({ status:404, contentType:"application/json", headers:kopf,
          body: JSON.stringify({ error:"Dieser Fragebogen ist nicht (mehr) verfügbar." }) });
      if (req.method() === "OPTIONS"){
        protokoll.optionen.push(url);
        return route.fulfill({ status:204, headers: Object.assign({}, kopf,
          { "Access-Control-Allow-Methods":"GET, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":"Content-Type, X-FlowerTech-Filename" }) });
      }
      if (req.method() === "GET"){
        protokoll.get++;
        if (g.verzoegerung) await new Promise(r => setTimeout(r, g.verzoegerung));
        if (g.modus === "fehler")
          return route.fulfill({ status:500, contentType:"application/json", headers:kopf,
            body: JSON.stringify({ error:"Serverfehler" }) });
        if (g.modus === "ungueltig")       // 200, aber ohne brauchbare Liste
          return route.fulfill({ status:200, contentType:"application/json", headers:kopf,
            body: JSON.stringify({ ok:true }) });
        if (g.modus === "kaputt")          // 200 mit unlesbarem Inhalt
          return route.fulfill({ status:200, contentType:"application/json", headers:kopf, body:"<html>nein" });
        return route.fulfill({ status:200, contentType:"application/json", headers:kopf,
          body: JSON.stringify({ ok:true, files: Array.from(ablage.values()) }) });
      }
      if (req.method() === "PUT"){
        protokoll.put++;
        const rohname = req.headers()["x-flowertech-filename"] || "";
        const name = decodeURIComponent(rohname) || "datei";
        const bytes = req.postDataBuffer() || Buffer.alloc(0);
        const id = "f_" + String(++n).padStart(10, "0");
        ablage.set(id, { id, name, type: req.headers()["content-type"] || "", size: bytes.length });
        // PRODUKTIONSFORM, nicht die verkuerzte {id,url}-Attrappe.
        return route.fulfill({ status:201, contentType:"application/json", headers:kopf,
          body: JSON.stringify({ ok:true, file: ablage.get(id) }) });
      }
      if (req.method() === "DELETE"){
        const id = new URL(url).searchParams.get("id") || "";
        protokoll.del.push(id);
        ablage.delete(id);
        return route.fulfill({ status:200, contentType:"application/json", headers:kopf,
          body: JSON.stringify({ ok:true }) });
      }
    }

    if (/flowertech-portal/.test(url)){
      // KEINE Livesubmission: der Eingang wird abgefangen und nur festgehalten.
      protokoll.posts++;
      protokoll.gesendet = JSON.parse(req.postData() || "{}");
      return route.fulfill({ status:200, contentType:"application/json", headers:kopf,
        body: JSON.stringify({ ok:true, submissionId:"test" }) });
    }
    return route.fulfill({ status:503, contentType:"application/json", headers:kopf,
      body: JSON.stringify({ error:"Im Test blockiert." }) });
  });

  const oeffnen = async () => {
    await page.goto(`http://127.0.0.1:${PORT}/fragebogen.html?e=${TOKEN}`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector("#q_0", { timeout:12000 });
    await bisZumVisionRoom();
  };
  const bisZumVisionRoom = async () => {
    for (let i = 0; i < 12; i++){
      const fertig = await page.evaluate(()=>{
        const vr = document.getElementById("visionRoom");
        return !!vr && !vr.hidden && !!document.querySelector("[data-ft='vision-files'] input[type=file]")
          && !document.querySelector("[data-ft='vision-files']").closest("[data-blatt]")?.hidden;
      }).catch(()=>false);
      if (fertig) break;
      const weiter = await page.evaluate(()=>{
        document.querySelectorAll("[data-blatt]:not([hidden]) [aria-invalid='true']").forEach(el=>{
          if (el.tagName === "SELECT") el.selectedIndex = 1;
          else if (el.type === "email") el.value = "kontakt@example.com";
          else el.value = "Beispieleingabe";
          el.dispatchEvent(new Event("input",{bubbles:true}));
          el.dispatchEvent(new Event("change",{bubbles:true}));
        });
        const b = document.getElementById("bogenWeiter");
        if (!b || b.hidden) return false;
        b.click(); return true;
      });
      await page.waitForTimeout(250);
      if (!weiter) break;
    }
    await page.waitForTimeout(600);
  };
  const gezeigt = () => page.evaluate(()=>Array.from(document.querySelectorAll(".mm-file")).map(li => ({
    id: li.dataset.id || "",
    name: (li.querySelector(".mm-file-name")||{}).textContent || "",
    entfernbar: !!li.querySelector(".mm-file-remove"),
  })));

  /* Alle Pflichtangaben fuellen — damit ein blockiertes Absenden spaeter
     NUR am Dateibestand liegen kann und an nichts anderem. */
  const fuellen = () => page.evaluate(()=>{
    document.querySelectorAll("[aria-invalid='true']").forEach(el=>{
      if (el.tagName === "SELECT") el.selectedIndex = 1;
      else if (el.type === "email") el.value = "kontakt@example.com";
      else el.value = "Beispieleingabe";
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
    });
  });
  const absendeversuch = async (wartenMs = 900) => {
    const vorher = protokoll.posts;
    await page.evaluate(()=>document.getElementById("form")
      .dispatchEvent(new Event("submit", { bubbles:true, cancelable:true })));
    await page.waitForTimeout(wartenMs);
    return {
      gesendet: protokoll.posts > vorher,
      status: await page.evaluate(()=>(document.getElementById("status")||{}).textContent || ""),
      knopf: await page.evaluate(()=>(document.getElementById("submit")||{}).getAttribute
        ? document.getElementById("submit").getAttribute("aria-disabled") : null),
    };
  };

  return { browser, page, ablage, protokoll, g, seitenfehler, oeffnen, bisZumVisionRoom, gezeigt, fuellen, absendeversuch };
}

async function lauf(breite, hoehe){
  console.log(`\n══ ${breite}x${hoehe} ══`);
  const u = await umgebung(breite, hoehe);
  const { page, ablage, protokoll, seitenfehler, oeffnen, bisZumVisionRoom, gezeigt } = u;
  const browser = u.browser;

  // ── 1) Hochladen ───────────────────────────────────────────────────────
  await oeffnen();
  zusichern(await page.locator("[data-ft='vision-files']").count() === 1, "der Upload-Block ist da");
  await page.locator("[data-ft='vision-files'] input[type=file]").first().setInputFiles(dateien);
  await page.waitForTimeout(1200);
  let liste = await gezeigt();
  zusichern(protokoll.put === 2, `zwei Dateien gingen an die Upload-Funktion (${protokoll.put})`);
  zusichern(liste.length === 2 && liste.every(x => x.id && x.entfernbar),
    `beide Dateien stehen mit Id und Entfernen-Knopf in der Liste (${JSON.stringify(liste)})`);
  const idsVorher = liste.map(x => x.id).sort();
  zusichern(ablage.size === 2, `der Server haelt beide Dateien (${ablage.size})`);

  // ── 2) ECHTES Neuladen, keine neue Saat ────────────────────────────────
  const getVorReload = protokoll.get;
  await page.reload({ waitUntil:"domcontentloaded" });
  await page.waitForSelector("#q_0", { timeout:12000 });
  await bisZumVisionRoom();
  liste = await gezeigt();
  zusichern(protokoll.get > getVorReload,
    `die Seite fragt nach dem Neuladen die bereits hochgeladenen Dateien ab (GET-Aufrufe: ${protokoll.get})`);
  zusichern(liste.length === 2, `nach dem Neuladen stehen beide Dateien wieder da (${liste.length})`);
  zusichern(JSON.stringify(liste.map(x => x.id).sort()) === JSON.stringify(idsVorher),
    `es sind dieselben Dateien, nicht neue (${JSON.stringify(liste.map(x=>x.id).sort())} statt ${JSON.stringify(idsVorher)})`);
  zusichern(liste.length === 2 && liste.every(x => x.entfernbar),
    "beide lassen sich nach dem Neuladen entfernen");
  zusichern(protokoll.put === 2, `das Neuladen hat nichts erneut hochgeladen (${protokoll.put} PUT)`);

  // ── 3) Entfernen nach dem Neuladen, dann noch einmal neu laden ─────────
  /* Ohne wiederhergestellte Liste sind die folgenden Schritte gegenstandslos.
     Sie werden dann nicht uebersprungen, sondern ausdruecklich als offen
     gemeldet — sonst faende der Lauf am Befund vorbei. */
  if (!liste.length){
    for (const text of [
      "das Entfernen erreicht die Funktion mit der richtigen Id",
      "der Server hat die Datei wirklich weggenommen",
      "nach dem zweiten Neuladen steht genau die verbliebene Datei da",
      "die nach dem Neuladen wiederhergestellte Datei geht mit dem Bogen ab",
      "keine Waise: jede noch gespeicherte Datei ist auch abgesendet",
    ]) zusichern(false, text + " — nicht pruefbar, es wurde nichts wiederhergestellt");
    await browser.close();
    return;
  }
  const zuEntfernen = liste[0].id;
  await page.locator(`.mm-file[data-id="${zuEntfernen}"] .mm-file-remove`).click({ timeout:4000 });
  await page.waitForTimeout(800);
  zusichern(protokoll.del.includes(zuEntfernen),
    `das Entfernen erreicht die Funktion mit der richtigen Id (${JSON.stringify(protokoll.del)})`);
  zusichern(ablage.size === 1, `der Server hat die Datei wirklich weggenommen (${ablage.size})`);
  await page.reload({ waitUntil:"domcontentloaded" });
  await page.waitForSelector("#q_0", { timeout:12000 });
  await bisZumVisionRoom();
  liste = await gezeigt();
  zusichern(liste.length === 1 && liste[0].id !== zuEntfernen,
    `nach dem zweiten Neuladen steht genau die verbliebene Datei da (${JSON.stringify(liste)})`);

  // ── 4) Absenden nach dem Neuladen: die Bindung muss stimmen ────────────
  await page.evaluate(()=>{
    document.querySelectorAll("[aria-invalid='true']").forEach(el=>{
      if (el.tagName === "SELECT") el.selectedIndex = 1;
      else if (el.type === "email") el.value = "kontakt@example.com";
      else el.value = "Beispieleingabe";
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
    });
    document.getElementById("form").dispatchEvent(new Event("submit", { bubbles:true, cancelable:true }));
  });
  await page.waitForTimeout(1200);
  const g = protokoll.gesendet;
  zusichern(!!g && g.kind === "intake" && g.token === TOKEN,
    `der Bogen geht als Fragebogen dieser Einladung ab (${g ? g.kind + "/" + (g.token||"").slice(0,6) : "nichts gesendet"})`);
  zusichern(!!g && Array.isArray(g.payload.files) && g.payload.files.length === 1 && g.payload.files[0] === liste[0].id,
    `die nach dem Neuladen wiederhergestellte Datei geht mit (${g ? JSON.stringify(g.payload.files) : "—"})`);
  zusichern(!!g && !JSON.stringify(g).includes("storagePath") && !JSON.stringify(g).includes(zuEntfernen),
    "der Bogen traegt weder Ablageorte noch die entfernte Datei");
  zusichern(Array.from(ablage.keys()).every(id => (g && g.payload.files || []).includes(id)),
    `keine Waise: jede noch gespeicherte Datei ist auch abgesendet (${JSON.stringify(Array.from(ablage.keys()))})`);
  zusichern(seitenfehler.length === 0, `keine Seitenfehler (${seitenfehler.slice(0,2).join(" | ")})`);

  await browser.close();
}

/* ══ Sperre: solange der Bestand nicht feststeht, geht nichts ab ═══════════
   BEFUND aus der Durchsicht von PR39: der Bestandsabruf lief unbeaufsichtigt
   nebenher. Wer schnell genug war — oder wessen Abruf scheiterte — konnte
   absenden, BEVOR die alten Ids uebernommen waren: dieselbe Waisenfolge, nur
   ueber die Zeit statt ueber das Neuladen. Geprueft wird deshalb, dass ein
   Absenden in genau diesen drei Zustaenden nichts verschickt und danach die
   Wiederholung gelingt — ohne dass eine Eingabe verloren geht. */
async function laufSperre(breite, hoehe){
  console.log(`\n══ Sperre ${breite}x${hoehe} ══`);
  const u = await umgebung(breite, hoehe);
  const { page, ablage, protokoll, g, seitenfehler, oeffnen, bisZumVisionRoom, gezeigt, fuellen, absendeversuch } = u;

  // Zwei Dateien anlegen, damit es etwas zu verlieren gibt.
  await oeffnen();
  await page.locator("[data-ft='vision-files'] input[type=file]").first().setInputFiles(dateien);
  await page.waitForTimeout(1200);
  zusichern(ablage.size === 2, `zwei Dateien liegen am Server (${ablage.size})`);
  const alleIds = Array.from(ablage.keys()).sort();

  // ── A) Der Abruf laeuft noch ──────────────────────────────────────────
  g.verzoegerung = 2500;
  await page.reload({ waitUntil:"domcontentloaded" });
  await page.waitForSelector("#q_0", { timeout:12000 });
  await bisZumVisionRoom();
  await fuellen();
  const sofort = await absendeversuch(600);
  zusichern(!sofort.gesendet, `waehrend der Bestand laedt, geht nichts ab (${protokoll.posts} Sendungen)`);
  zusichern(/geladen|Moment/i.test(sofort.status), `der Status nennt den Grund — "${sofort.status}"`);
  zusichern(sofort.knopf === "true", `der Sendeknopf ist als gesperrt gekennzeichnet (aria-disabled=${sofort.knopf})`);
  zusichern((await gezeigt()).length === 0, "waehrend des Ladens steht noch keine Datei da");

  // Ist der Bestand da, geht es regulaer weiter — mit ALLEN Ids.
  await page.waitForTimeout(2600);
  const nachLaden = await gezeigt();
  zusichern(nachLaden.length === 2, `nach dem Laden stehen beide Dateien da (${nachLaden.length})`);
  const jetzt = await absendeversuch();
  zusichern(jetzt.gesendet, "nach erfolgreichem Abruf geht der Bogen nicht ab");
  zusichern(JSON.stringify((protokoll.gesendet.payload.files || []).slice().sort()) === JSON.stringify(alleIds),
    `es gehen alle bestehenden Ids mit: ${JSON.stringify(protokoll.gesendet.payload.files)}`);

  // ── B) Der Abruf scheitert ────────────────────────────────────────────
  g.verzoegerung = 0; g.modus = "fehler";
  protokoll.gesendet = null;
  const postsVorB = protokoll.posts;
  await page.reload({ waitUntil:"domcontentloaded" });
  await page.waitForSelector("#q_0", { timeout:12000 });
  await bisZumVisionRoom();
  await fuellen();
  const eingabeVorher = await page.evaluate(()=>(document.getElementById("q_0")||{}).value || "");
  const beiFehler = await absendeversuch();
  zusichern(!beiFehler.gesendet && protokoll.posts === postsVorB,
    `bei gescheitertem Abruf geht nichts ab (${protokoll.posts - postsVorB} Sendungen)`);
  zusichern(/nicht geladen/i.test(beiFehler.status), `der Status nennt den Grund — "${beiFehler.status}"`);
  zusichern(!/Method not allowed|Serverfehler/i.test(beiFehler.status),
    "die Meldung der Gegenstelle steht NICHT vor der Kundschaft");
  zusichern(await page.evaluate(()=>(document.getElementById("q_0")||{}).value || "") === eingabeVorher,
    "die Eingaben stehen nach dem gescheiterten Versuch unveraendert da");

  // Wiederholen: der naechste Versuch holt den Bestand erneut …
  g.modus = "ok";
  const zweiter = await absendeversuch(1500);
  zusichern(!zweiter.gesendet, "der Wiederholversuch sendet nichts ungefragt");
  zusichern((await gezeigt()).length === 2, `nach der Wiederholung stehen beide Dateien da (${(await gezeigt()).length})`);
  zusichern(/wieder da|jetzt/i.test(zweiter.status), `die gelungene Wiederholung wird gesagt — "${zweiter.status}"`);
  // … und erst der naechste Druck sendet, dann aber vollstaendig.
  const dritter = await absendeversuch();
  zusichern(dritter.gesendet, "nach der gelungenen Wiederholung geht der Bogen nicht ab");
  zusichern(JSON.stringify((protokoll.gesendet.payload.files || []).slice().sort()) === JSON.stringify(alleIds),
    `nach der Wiederholung gehen alle Ids mit: ${JSON.stringify(protokoll.gesendet.payload.files)}`);

  // ── C) 200 mit unbrauchbarem Inhalt ───────────────────────────────────
  for (const modus of ["ungueltig", "kaputt"]) {
    g.modus = modus;
    const postsVorC = protokoll.posts;
    await page.reload({ waitUntil:"domcontentloaded" });
    await page.waitForSelector("#q_0", { timeout:12000 });
    await bisZumVisionRoom();
    await fuellen();
    const r = await absendeversuch();
    zusichern(!r.gesendet && protokoll.posts === postsVorC,
      `200 mit unbrauchbarem Inhalt (${modus}) gilt nicht still als leer — es geht nichts ab`);
    zusichern(/nicht geladen/i.test(r.status), `${modus}: der Status nennt den Grund`);
    zusichern((await gezeigt()).length === 0, `${modus}: es steht keine Datei da, die niemand gemeldet hat`);
  }
  // Danach geht es mit einer gueltigen Antwort regulaer weiter.
  g.modus = "ok";
  await absendeversuch(1500);
  const zuletzt = await absendeversuch();
  zusichern(zuletzt.gesendet, "nach der Rueckkehr zu einer gueltigen Antwort geht der Bogen nicht ab");
  zusichern(JSON.stringify((protokoll.gesendet.payload.files || []).slice().sort()) === JSON.stringify(alleIds),
    `zuletzt gehen alle Ids mit: ${JSON.stringify(protokoll.gesendet.payload.files)}`);

  // ── D) Die leere, gueltige Antwort darf NICHT sperren ─────────────────
  ablage.clear();
  await page.reload({ waitUntil:"domcontentloaded" });
  await page.waitForSelector("#q_0", { timeout:12000 });
  await bisZumVisionRoom();
  await fuellen();
  const leer = await absendeversuch();
  zusichern(leer.gesendet, "eine gueltige leere Liste laesst das Absenden regulaer zu");
  zusichern(Array.isArray(protokoll.gesendet.payload.files) && protokoll.gesendet.payload.files.length === 0,
    `ohne Dateien geht eine leere Liste mit: ${JSON.stringify(protokoll.gesendet.payload.files)}`);

  zusichern(seitenfehler.length === 0, `keine Seitenfehler (${seitenfehler.slice(0,2).join(" | ")})`);
  await u.browser.close();
}

await lauf(1440, 1000);
await lauf(390, 900);
await laufSperre(1440, 1000);

server.close();
console.log(`\n${geprueft - offen} von ${geprueft} Zusicherungen erfuellt.`);
if (offen) { console.error(`${offen} Zusicherung(en) offen — Abnahme NICHT bestanden.`); process.exit(1); }
console.log("Abnahme bestanden.");
