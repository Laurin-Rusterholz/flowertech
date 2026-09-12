/* ══ Sichtbares Pflichtfeld, das aus der Meldung fiel ════════════════════════
   BEFUND (12.09.2026, am Original-Kundenlink bestaetigt, Build
   fragebogen-2026-09-12-a): Auf Schritt 2 standen E-Mail (q_3), Telefon (q_4)
   und Adresse (q_5) leer; alle drei waren sichtbar als „· Pflichtfeld"
   beschriftet. Die Zeile darunter nannte nur „Adresse".

   URSACHE: Die Blattpruefung fragte die MARKE der Frage (q.vision) statt den
   ORT des Feldes. Traegt eine Frage die Vision-Marke, hat der Vision Room sie
   aber nicht uebernommen — Baustein nicht geladen, Raum nicht aufgebaut, Marke
   aus einem aelteren Fragebogen —, bleibt das Feld auf seinem Blatt stehen:
   sichtbar, verlangt, leer. Uebersprungen wurde es trotzdem.

   Dieses Skript stellt genau das im echten Browser nach und misst es hart:
   jede Erwartung ist eine Zusicherung, eine offene beendet den Lauf mit
   Exitcode 1.

   Isoliert: eigener Server auf 127.0.0.1, jede Verbindung nach draussen
   abgefangen, erfundener Fragebogen, Testtoken. Kein Versand, keine
   Kundendaten, keine Freigabe.

   Aufruf:  node scripts/pflichtfeld-vision-marke.mjs [port]
   PW_PFAD / CHROME_PFAD setzen playwright-core und Chromium, falls noetig. */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PW_PFAD || "playwright-core");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || 8961);
const T = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
            ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml" };
let visionRoomAusliefern = true;
const server = http.createServer((req,res)=>{
  let u = decodeURIComponent(req.url.split("?")[0]); if (u === "/") u = "/index.html";
  if (!visionRoomAusliefern && u === "/visionroom.js") { res.writeHead(404); return res.end(); }
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

const TOKEN = "TESTTESTTESTTESTTESTTEST";
const f = (key,label,type,required,extra) => Object.assign(
  { key, label, type, role:"", required:!!required, hint:"", options:[], vision:"", showIf:null }, extra||{});
/* Ein Fragebogen im Zuschnitt des Originals: Blatt 1 = Projekt, Firma, Name;
   Blatt 2 = E-Mail, Telefon, Adresse — alle drei verlangt. Inhalte erfunden. */
const FRAGEN = (marke) => [
  f("projekt","Projekt- / Firmenname","text",true),
  f("company","Firma / Organisation","text",false,{role:"company"}),
  f("name","Ansprechperson","text",true,{role:"contactName"}),
  f("email","E-Mail","email",true,{role:"contactEmail", vision: marke ? "idea" : ""}),
  f("phone","Telefon","tel",true,{role:"contactPhone", vision: marke ? "features" : ""}),
  f("adresse","Adresse","text",true,{role:"address"}),
  f("kind","Was brauchen Sie?","select",true,{options:["Website","Web-Programm","Web-App"]}),
  f("need","Ziel","textarea",true),
  f("notes","Sonstiges","textarea",false),
  f("idee","Ihre Idee","text",false,{vision: marke ? "" : "idea"}),
  f("funktionen","Funktionen","textarea",false,{vision: marke ? "" : "features"}),
];
const REC = (marke) => ({
  schema:1, title:"Ihre Angaben", status:"open", intro:"", company:{ name:"FlowerTech" },
  questions: FRAGEN(marke),
  prefill:{ version:1, values:{ projekt:"Beispielprojekt", company:"Beispielkunde AG", name:"Beispielperson" } },
  stage:"intake", tiles:{},
});

async function lauf(name, { marke, visionRoom }) {
  console.log(`\n══ ${name} ══`);
  visionRoomAusliefern = visionRoom;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PFAD
    || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const seitenfehler = [];
  page.on("pageerror", e => seitenfehler.push(e.message));
  const daten = REC(marke);
  await page.route("**://*/**", r => {
    const u = r.request().url();
    if (u.startsWith("http://127.0.0.1:" + PORT + "/")) return r.continue();
    if (/firebasedatabase/.test(u)) return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(daten) });
    if (/flowertech-upload/.test(u)) return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ ok:true, files:[] }) });
    return r.fulfill({ status:503, contentType:"application/json", body:"{}" });
  });
  await page.goto(`http://127.0.0.1:${PORT}/fragebogen.html?e=${TOKEN}`, { waitUntil:"domcontentloaded" });
  await page.waitForSelector("#q_0", { timeout:12000 });
  await page.waitForTimeout(700);
  await page.click("#bogenWeiter");
  await page.waitForTimeout(400);

  const stand = await page.evaluate(()=>{
    const lese = (id) => {
      const n = document.getElementById(id);
      if (!n) return null;
      const l = n.closest("label");
      const r = l.getBoundingClientRect();
      const traeger = document.getElementById("vrCarriers");
      return { leer: String(n.value || "").trim() === "",
        sichtbar: r.width > 0 && r.height > 0 && getComputedStyle(l).display !== "none",
        marke: /Pflichtfeld/.test(l.textContent) ? "pflicht" : /freiwillig/.test(l.textContent) ? "freiwillig" : "?",
        imRaum: !!(traeger && traeger.contains(l)) };
    };
    return { schritt:(document.getElementById("bogenStand")||{}).textContent || "",
      meldung:(document.getElementById("need")||{}).textContent || "",
      sendbar:(document.getElementById("submit")||{}).getAttribute("aria-disabled"),
      q3:lese("q_3"), q4:lese("q_4"), q5:lese("q_5") };
  });
  await browser.close();
  return { stand, seitenfehler };
}

/* ── 1) Der gemeldete Fall: Marke da, Vision Room nicht ──────────────────── */
{
  const { stand, seitenfehler } = await lauf("Marke ohne Vision Room (der gemeldete Fall)",
    { marke:true, visionRoom:false });
  zusichern(/Schritt 2/.test(stand.schritt), `Schritt 2 erreicht (${stand.schritt})`);
  for (const [id, feld] of [["q3","E-Mail"], ["q4","Telefon"], ["q5","Adresse"]]) {
    zusichern(stand[id] && stand[id].sichtbar && stand[id].leer && stand[id].marke === "pflicht" && !stand[id].imRaum,
      `${feld} steht sichtbar, leer und als Pflichtfeld auf dem Blatt (${JSON.stringify(stand[id])})`);
    zusichern(stand.meldung.includes(feld), `die Meldung nennt ${feld}: "${stand.meldung}"`);
  }
  zusichern(stand.sendbar === "true", `der Bogen gilt nicht als sendbereit (aria-disabled=${stand.sendbar})`);
  zusichern(seitenfehler.length === 0, `keine Seitenfehler (${seitenfehler.slice(0,2).join(" | ")})`);
}

/* ── 2) Gegenrichtung: der Vision Room hat die Felder wirklich ──────────── */
{
  const { stand, seitenfehler } = await lauf("Marke MIT Vision Room", { marke:true, visionRoom:true });
  zusichern(stand.q3.imRaum && stand.q4.imRaum, "der Vision Room hat die beiden Felder uebernommen");
  zusichern(!stand.q3.sichtbar && !stand.q4.sichtbar, "die uebernommenen Felder stehen nicht mehr auf dem Blatt");
  zusichern(stand.meldung.includes("Adresse") && !stand.meldung.includes("E-Mail") && !stand.meldung.includes("Telefon"),
    `nur die Adresse gehoert auf dieses Blatt: "${stand.meldung}"`);
  zusichern(seitenfehler.length === 0, `keine Seitenfehler (${seitenfehler.slice(0,2).join(" | ")})`);
}

/* ── 3) Ohne Marke bleibt alles, wie es war ──────────────────────────────── */
{
  const { stand } = await lauf("Fragebogen ohne fremde Marke", { marke:false, visionRoom:true });
  ["E-Mail", "Telefon", "Adresse"].forEach((feld) => {
    zusichern(stand.meldung.includes(feld), `die Meldung nennt ${feld}: "${stand.meldung}"`);
  });
}

server.close();
console.log(`\n${geprueft - offen} von ${geprueft} Zusicherungen erfuellt.`);
if (offen) { console.error(`${offen} Zusicherung(en) offen — Abnahme NICHT bestanden.`); process.exit(1); }
console.log("Abnahme bestanden.");
