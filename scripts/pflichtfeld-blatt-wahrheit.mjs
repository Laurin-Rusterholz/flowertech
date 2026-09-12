/* ══ Was auf dem Blatt steht, wird auf dem Blatt geprueft ═══════════════════
   BEFUND (12.09.2026, 15:52, am Original-Kundenlink gemessen, Build
   fragebogen-2026-09-12-c): Auf Schritt 2 standen E-Mail, Telefon und Adresse
   leer und sichtbar, alle drei als „· Pflichtfeld" beschriftet, required=true,
   und KEINES lag im Vision Room (closest('#vrCarriers') === null). Gemeldet
   wurde trotzdem nur die Adresse; „Weiter" sprang auf die Adresse.

   Damit bleiben genau zwei Stellen, an denen ein sichtbares Feld aus der
   Pruefung fallen kann:

     1. feldSichtbar() glaubte dem hidden-Attribut am <label>. Das ist eine
        ABSICHT — ob das Feld verschwindet, entscheidet die Gestaltung. Eine
        Regel, die das Attribut ueberstimmt, laesst das Feld stehen: sichtbar
        fuer die Kundschaft, "nicht vorhanden" fuer die Pruefung.
     2. blattOffen() nahm die Felder aus der Buchfuehrung (bogenFragen) statt
        vom Blatt. Weicht die Zuordnung ab, meldet die Zeile die Felder eines
        anderen Blattes.

   Beide Faelle stellt dieses Skript im echten Browser nach und misst hart.
   Isoliert: eigener Server auf 127.0.0.1, jede Verbindung nach draussen
   abgefangen, erfundener Fragebogen, Testtoken, kein Versand.

   Aufruf:  node scripts/pflichtfeld-blatt-wahrheit.mjs [port] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PW_PFAD || "playwright-core");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || 8971);
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

const TOKEN = "TESTTESTTESTTESTTESTTEST";
const f = (key,label,type,required,extra) => Object.assign(
  { key, label, type, role:"", required:!!required, hint:"", options:[], vision:"", showIf:null }, extra||{});
const REC = (bedingung) => ({
  schema:1, title:"Ihre Angaben", status:"open", intro:"", company:{ name:"FlowerTech" },
  questions: [
    f("projekt","Projekt- / Firmenname","text",true),
    f("company","Firma / Organisation","text",false,{role:"company"}),
    f("name","Ansprechperson","text",true,{role:"contactName"}),
    f("email","E-Mail","email",true,{role:"contactEmail", showIf: bedingung ? {key:"projekt", value:"Nie eingegeben"} : null}),
    f("phone","Telefon","tel",true,{role:"contactPhone", showIf: bedingung ? {key:"projekt", value:"Nie eingegeben"} : null}),
    f("adresse","Adresse","text",true,{role:"address"}),
    f("kind","Was brauchen Sie?","select",true,{options:["Website","Web-Programm","Web-App"]}),
    f("need","Ziel","textarea",true),
    f("notes","Sonstiges","textarea",false),
  ],
  prefill:{ version:1, values:{ projekt:"Beispielprojekt", company:"Beispielkunde AG", name:"Beispielperson" } },
  stage:"intake", tiles:{},
});

async function lauf(name, { bedingung, hiddenUebersteuern, doppelteId, diagnose }) {
  console.log(`\n══ ${name} ══`);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PFAD
    || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const seitenfehler = [];
  page.on("pageerror", e => seitenfehler.push(e.message));
  const daten = REC(bedingung);
  await page.route("**://*/**", r => {
    const u = r.request().url();
    if (u.startsWith("http://127.0.0.1:" + PORT + "/")) return r.continue();
    if (/firebasedatabase/.test(u)) return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(daten) });
    if (/flowertech-upload/.test(u)) return r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ ok:true, files:[] }) });
    return r.fulfill({ status:503, contentType:"application/json", body:"{}" });
  });
  await page.goto(`http://127.0.0.1:${PORT}/fragebogen.html?e=${TOKEN}` + (diagnose ? "&diagnose=1" : ""),
    { waitUntil:"domcontentloaded" });
  await page.waitForSelector("#q_0", { timeout:12000 });
  /* Die Gestaltung ueberstimmt das hidden-Attribut — genau die Lage, in der
     ein "verborgenes" Feld vor der Kundschaft steht. */
  if (hiddenUebersteuern) await page.addStyleTag({ content: ".ck label[hidden], label[hidden]{display:block !important}" });
  /* Eine zweite Id „q_3" VOR dem Bogen: document.getElementById liefert dann
     nicht mehr das Feld vom Blatt, sondern diesen Fremdknoten — mit einem
     Wert, der das echte Feld als ausgefuellt erscheinen laesst. */
  if (doppelteId) await page.evaluate(()=>{
    const fremd = document.createElement("input");
    fremd.id = "q_3"; fremd.value = "aus einem anderen Knoten"; fremd.hidden = true;
    document.body.insertBefore(fremd, document.body.firstChild);
  });
  await page.waitForTimeout(600);
  await page.click("#bogenWeiter");
  await page.waitForTimeout(400);
  const stand = await page.evaluate(()=>{
    const lese = (id) => {
      /* Gemessen wird das Feld AUF DEM BLATT — nicht irgendein gleichnamiger
         Knoten. Genau dieser Unterschied ist Teil der Pruefung. */
      const blatt = document.querySelector("[data-blatt]:not([hidden])");
      const n = (blatt && blatt.querySelector('[id="' + id + '"]')) || document.getElementById(id);
      if (!n) return null;
      const l = n.closest("label");
      if (!l) return { leer: String(n.value || "").trim() === "", gemalt: false, labelHidden: null,
        marke: "ohne Label", imRaum: false };
      const r = l.getBoundingClientRect();
      return { leer: String(n.value || "").trim() === "",
        gemalt: r.width > 0 && r.height > 0 && getComputedStyle(l).display !== "none",
        labelHidden: !!l.hidden,
        marke: /Pflichtfeld/.test(l.textContent) ? "pflicht" : "anders",
        imRaum: !!(document.getElementById("vrCarriers") || { contains: () => false }).contains(l) };
    };
    return { schritt:(document.getElementById("bogenStand")||{}).textContent || "",
      meldung:(document.getElementById("need")||{}).textContent || "",
      sendbar:(document.getElementById("submit")||{}).getAttribute("aria-disabled"),
      diagnose: typeof window.__ftFeldDiagnose === "function" ? window.__ftFeldDiagnose() : null,
      tafel: (function(){ const t = document.getElementById("diagnose");
        return t ? { versteckt: !!t.hidden, text: (t.textContent||"").slice(0,4000),
          zeilen: t.querySelectorAll("table.ft-diagnose tbody tr").length } : null; })(),
      q3:lese("q_3"), q4:lese("q_4"), q5:lese("q_5") };
  });
  await browser.close();
  return { stand, seitenfehler };
}

/* ── 1) Der gemeldete Fall: verborgen gemeint, sichtbar gemalt ───────────── */
{
  const { stand, seitenfehler } = await lauf("hidden ueberstimmt — Feld steht vor der Kundschaft",
    { bedingung:true, hiddenUebersteuern:true });
  zusichern(/Schritt 2/.test(stand.schritt), `Schritt 2 erreicht (${stand.schritt})`);
  for (const [id, feld] of [["q3","E-Mail"], ["q4","Telefon"], ["q5","Adresse"]]) {
    zusichern(stand[id] && stand[id].gemalt && stand[id].leer && stand[id].marke === "pflicht" && !stand[id].imRaum,
      `${feld} ist gemalt, leer, Pflichtfeld und nicht im Vision Room (${JSON.stringify(stand[id])})`);
    zusichern(stand.meldung.includes(feld), `die Meldung nennt ${feld}: "${stand.meldung}"`);
  }
  zusichern(stand.q3.labelHidden === true && stand.q4.labelHidden === true,
    "Vorbedingung: die beiden Felder tragen das hidden-Attribut");
  zusichern(stand.sendbar === "true", `der Bogen gilt nicht als sendbereit (aria-disabled=${stand.sendbar})`);
  zusichern(seitenfehler.length === 0, `keine Seitenfehler (${seitenfehler.slice(0,2).join(" | ")})`);
}

/* ── 2) Wirklich verborgen bleibt wirklich verborgen ─────────────────────── */
{
  const { stand } = await lauf("verborgen und nicht gemalt", { bedingung:true, hiddenUebersteuern:false });
  zusichern(!stand.q3.gemalt && !stand.q4.gemalt, "die bedingten Felder sind nicht gemalt");
  zusichern(stand.meldung.includes("Adresse") && !stand.meldung.includes("E-Mail") && !stand.meldung.includes("Telefon"),
    `was niemand sieht, wird nicht verlangt: "${stand.meldung}"`);
}

/* ── 3) Ohne Bedingung: unveraendert ─────────────────────────────────────── */
{
  const { stand } = await lauf("ohne Bedingung", { bedingung:false, hiddenUebersteuern:false });
  ["E-Mail", "Telefon", "Adresse"].forEach((feld) => {
    zusichern(stand.meldung.includes(feld), `die Meldung nennt ${feld}: "${stand.meldung}"`);
  });
  const d = stand.diagnose;
  zusichern(!!d, "die lesende Selbstauskunft __ftFeldDiagnose() antwortet");
  zusichern(d && JSON.stringify(d.aufDemBlatt) === JSON.stringify(d.ausDerBuchfuehrung),
    `Blatt und Buchfuehrung stimmen ueberein: ${d ? JSON.stringify(d.aufDemBlatt) : "-"}`);
  zusichern(d && JSON.stringify(d.gemeldet) === JSON.stringify([3,4,5]),
    `die Selbstauskunft nennt genau die offenen Felder: ${d ? JSON.stringify(d.gemeldet) : "-"}`);
  zusichern(d && d.felder.every((x) => x.verlangtLautDaten === (x.verlangtLautFeld === "true")),
    "Daten und Feld sagen bei „verlangt“ dasselbe");
}

/* ── 4) Doppelt vergebene Id: das Feld vom Blatt zaehlt ──────────────────── */
{
  const { stand, seitenfehler } = await lauf("zweite Id q_3 vor dem Bogen",
    { bedingung:false, hiddenUebersteuern:false, doppelteId:true });
  const d = stand.diagnose;
  const feld3 = d && d.felder.find((x) => x.i === 3);
  zusichern(!!feld3 && feld3.idDoppelt === 2, `die Id ist doppelt vergeben (${feld3 ? feld3.idDoppelt : "-"})`);
  zusichern(!!feld3 && feld3.knotenVomBlattIstDerVonGetElementById === false,
    "getElementById liefert einen anderen Knoten als das Blatt — genau der Fall");
  zusichern(!!feld3 && feld3.hatWert === false, "der Wert wird am Feld DES BLATTES gelesen, nicht am Fremdknoten");
  zusichern(stand.meldung.includes("E-Mail"), `die Meldung nennt E-Mail trotz Fremdknoten: "${stand.meldung}"`);
  zusichern(seitenfehler.length === 0, `keine Seitenfehler (${seitenfehler.slice(0,2).join(" | ")})`);
}

/* ── 5) Diagnosemodus: sichtbar, lesend, ohne Antworten ─────────────────── */
{
  const { stand, seitenfehler } = await lauf("?diagnose=1", { bedingung:true, hiddenUebersteuern:false, diagnose:true });
  zusichern(!!stand.tafel && stand.tafel.versteckt === false, "die Diagnosetafel steht sichtbar unter dem Bogen");
  zusichern(!!stand.tafel && stand.tafel.zeilen === 3, `die Tafel zeigt die drei Felder des Blattes (${stand.tafel ? stand.tafel.zeilen : "-"})`);
  zusichern(!!stand.tafel && /Schritt 2 von/.test(stand.tafel.text), "die Tafel nennt Schritt und Blatt");
  zusichern(!!stand.tafel && !/Beispielprojekt|Beispielkunde|Beispielperson/.test(stand.tafel.text),
    "die Tafel zeigt KEINE Antworten aus dem Bogen");
  zusichern(!!stand.tafel && !stand.tafel.text.includes(TOKEN), "die Tafel zeigt den Token nicht");
  zusichern(seitenfehler.length === 0, `keine Seitenfehler (${seitenfehler.slice(0,2).join(" | ")})`);
}

server.close();
console.log(`\n${geprueft - offen} von ${geprueft} Zusicherungen erfuellt.`);
if (offen) { console.error(`${offen} Zusicherung(en) offen — Abnahme NICHT bestanden.`); process.exit(1); }
console.log("Abnahme bestanden.");
