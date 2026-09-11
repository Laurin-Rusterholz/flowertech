/* ══ FlowerTech-Fragebogen: vollständige Design-Abnahme ═══════════════════
   Gehört NICHT zu `node tests/run-all.mjs` (das läuft ohne Netz und ohne
   Abhängigkeiten). Zum Wiederholen:

       npm i --no-save playwright-core          # einmalig
       node scripts/fragebogen-abnahme.mjs

   Der Pfad zu Chromium und die Playwright-Zeile unten sind an diese Maschine
   angepasst; auf einem anderen Rechner beide anpassen. Die Bilder landen in
   dem Ordner, den SP nennt.

   Isoliert: eigener Server auf 127.0.0.1, JEDE Verbindung nach draussen
   abgefangen. Es wird nichts veröffentlicht, nichts gesendet, keine echte
   Kundschaft berührt — die Testdaten sind erfunden, der Token ist ein
   Testtoken. Der Absendeweg ist blockiert und wird nur PROTOKOLLIERT.

   Geprüft: alle 11 Schritte, Vorbelegung, Pflichtfeldprüfung, Zurück/Weiter,
   mehrere Bild- und Dateiuploads im Vision Room, drei Breiten. */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "/tmp/claude-0/-home-user/18cbce41-cbe5-5300-9142-3055f6610cde/scratchpad/node_modules/playwright-core/index.mjs";
const SP = "/tmp/claude-0/-home-user/18cbce41-cbe5-5300-9142-3055f6610cde/scratchpad/abnahme";
const ROOT = "/home/user/flowertech";
const T = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml"};
const server = http.createServer((req,res)=>{ let u=decodeURIComponent(req.url.split("?")[0]); if(u==="/")u="/index.html";
  const p=path.join(ROOT,u); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{"Content-Type":T[path.extname(p)]||"application/octet-stream"});res.end(fs.readFileSync(p)); });
await new Promise(r=>server.listen(8903,"127.0.0.1",r));

const TOKEN = "TESTTESTTESTTESTTESTTEST";   // Testtoken, kein echter Kundenlink
const f = (key,label,type,required,extra) => Object.assign(
  { key, label, type, role:"", required:!!required, hint:"", options:[], vision:"" }, extra||{});
/* 28 Fragen wie in der echten Veröffentlichung → 10 Schritte zu drei Fragen
   plus der Vision Room = 11 Schritte. Inhalte frei erfunden. */
const FRAGEN = [
  f("projekt","Worum geht es?","text",true,{hint:"Ein Satz genügt."}),
  f("company","Betrieb oder Verein","text",true,{role:"company"}),
  f("name","Ihr Name","text",true,{role:"contactName"}),
  f("email","E-Mail","email",true,{role:"contactEmail"}),
  f("phone","Telefon","tel",false),
  f("adresse","Adresse","text",false),
  f("kind","Was soll entstehen?","select",true,{options:["Website","Web-Programm","Web-App"]}),
  f("need","Was soll die Seite für Sie tun?","textarea",true,{hint:"Zum Beispiel: mehr Anfragen, weniger Telefon."}),
  f("zielgruppe","Wen wollen Sie erreichen?","textarea",false),
  f("bisher","Gibt es bereits eine Website?","text",false),
  f("bisheriger-preis","Gibt es ein Budget?","text",false),
  f("termin","Wunschtermin","date",false),
  f("seiten","Welche Seiten braucht es?","textarea",false),
  f("inhalte","Wer liefert die Texte?","select",false,{options:["Wir","FlowerTech","Gemeinsam"]}),
  f("bilder","Gibt es Bilder?","select",false,{options:["Ja","Nein","Teilweise"]}),
  f("logo","Gibt es ein Logo?","select",false,{options:["Ja","Nein"]}),
  f("farben","Farben oder Stil","text",false),
  f("vorbilder","Websites, die Ihnen gefallen","textarea",false),
  f("domain","Wunschadresse im Netz","text",false),
  f("hosting","Wo liegt die Seite heute?","text",false),
  f("mail","Brauchen Sie E-Mail-Adressen?","select",false,{options:["Ja","Nein"]}),
  f("sprachen","Wie viele Sprachen?","select",false,{options:["Eine","Zwei","Mehr"]}),
  f("pflege","Wer pflegt die Inhalte später?","select",false,{options:["Wir selbst","FlowerTech"]}),
  f("rechtliches","Datenschutz/Impressum vorhanden?","select",false,{options:["Ja","Nein","Unklar"]}),
  f("erfolg","Woran merken Sie, dass es gelungen ist?","textarea",true),
  f("hinweise","Sonstiges","textarea",false),
  f("idee","Ihre Idee","textarea",false,{vision:"idea"}),
  f("funktionen","Funktionen","textarea",false,{vision:"features"}),
];
const VEROEFFENTLICHT = {
  schema:1, title:"Ihre Angaben", status:"open", generation:1,
  intro:"Damit wir Ihr Vorhaben verstehen, bevor irgendetwas gebaut wird. Nichts davon ist verbindlich.",
  questions:FRAGEN,
  prefill:{ version:1, values:{ company:"Muster Testbetrieb", name:"Testperson", email:"test@example.invalid" } },
  company:{ name:"FlowerTech" }, stage:"intake", tiles:{ offer:null, preview:null, admin:null },
  updatedAt:"2026-09-10T23:41:00.000Z",
};

const bericht = [];
const browser = await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
for (const [name, geraet, breite] of [
  ["handy",  { viewport:{width:390,height:900}, isMobile:true, hasTouch:true, deviceScaleFactor:2 }, 390],
  ["tablet", { viewport:{width:820,height:1180} }, 820],
  ["desktop",{ viewport:{width:1440,height:1100} }, 1440],
]) {
  const ctx = await browser.newContext(geraet); const page = await ctx.newPage();
  const fehler = []; page.on("pageerror", e=>fehler.push(e.message));
  const draussen = [];                      // was die Seite nach draussen wollte
  // Jede Verbindung nach draussen wird abgefangen. NICHTS verlässt diesen Rechner.
  await page.route("**://*/**", async route => {
    const url = route.request().url();
    if (url.startsWith("http://127.0.0.1:8903/")) return route.continue();
    draussen.push(route.request().method() + " " + url.slice(0,120));
    if (/firebasedatabase\.app/.test(url))
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(VEROEFFENTLICHT)});
    if (/flowertech-upload/.test(url)) {
      if (route.request().method()==="PUT")
        return route.fulfill({status:200,contentType:"application/json",
          body:JSON.stringify({ id:"testdatei_"+draussen.length, url:"https://example.invalid/x" })});
      return route.fulfill({status:200,contentType:"application/json",body:"{}"});
    }
    // Der Absendeweg bleibt ZU. Käme es je dazu, stünde es hier im Protokoll.
    return route.fulfill({status:503,contentType:"application/json",
      body:JSON.stringify({ error:"Im Test blockiert — es wird nichts gesendet." })});
  });

  const r = { geraet:name, breite, schritte:[] };
  await page.goto(`http://127.0.0.1:8903/fragebogen.html?e=${TOKEN}`,{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#q_0",{timeout:12000});
  await page.waitForTimeout(400);

  const stand = () => page.evaluate(()=>({
    schritt: (document.getElementById("bogenSchrittZahl")||{}).textContent || "",
    zeile: (document.getElementById("bogenStand")||{}).textContent || "",
    balken: (document.getElementById("bogenBalken")||{}).style.width || "",
    meldung: (document.getElementById("need")||{}).textContent || "",
    weiter: !(document.getElementById("bogenWeiter")||{}).hidden,
    zurueck: !(document.getElementById("bogenZurueck")||{}).hidden,
    senden: !(document.getElementById("submit")||{}).hidden,
    sendbar: (document.getElementById("submit")||{}).getAttribute && document.getElementById("submit").getAttribute("aria-disabled"),
    sichtbar: Array.from(document.querySelectorAll("[data-blatt]")).filter(s=>!s.hidden).length,
    felder: Array.from(document.querySelectorAll("[data-blatt]:not([hidden]) label")).length,
    ueberlauf: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));

  // ── Vorbelegung ────────────────────────────────────────────────────────
  r.vorbelegung = await page.evaluate(()=>({
    company:(document.getElementById("q_1")||{}).value,
    name:(document.getElementById("q_2")||{}).value,
    email:(document.getElementById("q_3")||{}).value,
    hinweisSichtbar: !(document.getElementById("vorbelegt")||{}).hidden,
  }));
  r.schritte.push(Object.assign({ nr:1 }, await stand()));

  // ── Pflichtfeldpruefung auf Schritt 1 ─────────────────────────────────
  await page.click("#bogenWeiter");
  await page.waitForTimeout(250);
  const blockiert = await stand();
  r.validierung = { bleibtStehen: blockiert.schritt.startsWith("1"), meldung: blockiert.meldung,
    fokusFeld: await page.evaluate(()=>document.activeElement && document.activeElement.id) };
  await page.screenshot({ path:`${SP}/${name}-01-validierung.png` });

  // ── Durch alle Schritte ───────────────────────────────────────────────
  for (let n=1; n<=12; n++){
    // offene Pflichtangaben des sichtbaren Schrittes füllen
    await page.evaluate(()=>{
      document.querySelectorAll("[data-blatt]:not([hidden]) [aria-invalid='true']").forEach(el=>{
        if (el.tagName==="SELECT") el.selectedIndex = 1;
        else if (el.type==="date") el.value = "2026-12-01";
        else if (el.type==="email") el.value = "test@example.invalid";
        else el.value = "Testeingabe für die Abnahme";
        el.dispatchEvent(new Event("input",{bubbles:true}));
        el.dispatchEvent(new Event("change",{bubbles:true}));
      });
    });
    await page.waitForTimeout(120);
    const s = await stand();
    if (n<=3 || !s.weiter) await page.screenshot({ path:`${SP}/${name}-${String(n+1).padStart(2,"0")}-schritt.png` });
    if (!s.weiter) { r.schritte.push(Object.assign({ nr:n, letzter:true }, s)); break; }
    await page.click("#bogenWeiter"); await page.waitForTimeout(220);
    r.schritte.push(Object.assign({ nr:n+1 }, await stand()));
  }

  // ── Vision Room: mehrere Bilder und Dateien ───────────────────────────
  await page.waitForTimeout(1500);
  r.vision = { sichtbar: await page.locator("#visionRoom").isVisible().catch(()=>false),
    uploadBlock: await page.locator("[data-ft='vision-files']").count() };
  const dateien = [
    { name:"logo.png",  mimeType:"image/png",  buffer: Buffer.from("89504e470d0a1a0a0000000d49484452","hex") },
    { name:"entwurf.jpg", mimeType:"image/jpeg", buffer: Buffer.from("ffd8ffe000104a46494600","hex") },
    { name:"referenz.png", mimeType:"image/png", buffer: Buffer.from("89504e470d0a1a0a0000000d49484452","hex") },
    { name:"briefing.pdf", mimeType:"application/pdf", buffer: Buffer.from("%PDF-1.4 Testdatei","utf8") },
  ];
  const eingabe = page.locator("[data-ft='vision-files'] input[type=file]").first();
  if (await eingabe.count()) {
    await eingabe.setInputFiles(dateien);
    await page.waitForTimeout(1500);
  }
  r.vision.dateien = await page.locator(".mm-file").allTextContents().catch(()=>[]);
  r.vision.hochgeladen = draussen.filter(x=>/PUT .*flowertech-upload/.test(x)).length;
  // Referenzadresse mit Kommentar — der zweite Weg des Vision Rooms
  const idee = page.locator("#visionRoomMount textarea").first();
  if (await idee.count()) { await idee.fill("Eine ruhige Seite für einen Testbetrieb."); await page.waitForTimeout(300); }
  await page.screenshot({ path:`${SP}/${name}-13-visionroom.png`, fullPage:false });
  r.visionVoll = await page.evaluate(()=>({
    ueberlauf: document.documentElement.scrollWidth > window.innerWidth + 1,
    breiteVR: Math.round((document.getElementById("visionRoom")||{getBoundingClientRect:()=>({width:0})}).getBoundingClientRect().width),
  }));

  // ── Zurueck und Weiter ────────────────────────────────────────────────
  await page.click("#bogenZurueck"); await page.waitForTimeout(250);
  const zurueck1 = await stand();
  await page.click("#bogenZurueck"); await page.waitForTimeout(250);
  const zurueck2 = await stand();
  r.zurueck = { nach1: zurueck1.schritt, nach2: zurueck2.schritt,
    eingabeErhalten: await page.evaluate(()=>{
      const el = document.querySelector("[data-blatt]:not([hidden]) input, [data-blatt]:not([hidden]) textarea");
      return el ? String(el.value||"").slice(0,40) : null; }) };
  // und wieder nach vorn
  await page.click("#bogenWeiter"); await page.waitForTimeout(200);
  await page.click("#bogenWeiter"); await page.waitForTimeout(400);
  r.wiederVorn = (await stand()).schritt;

  r.gesamt = { schritteGezaehlt: (await stand()).zeile, draussen: draussen.slice(0,6),
    keinVersand: draussen.filter(x=>/flowertech-portal/.test(x)).length === 0, fehler: fehler.slice(0,3) };
  bericht.push(r);
  await ctx.close();
}
await browser.close(); server.close();
fs.writeFileSync(`${SP}/bericht.json`, JSON.stringify(bericht,null,1));
console.log(JSON.stringify(bericht.map(b=>({
  geraet:b.geraet, breite:b.breite,
  schritteInsgesamt: b.schritte.length,
  ersterStand: b.schritte[0] && b.schritte[0].zeile,
  letzterStand: b.schritte[b.schritte.length-1] && b.schritte[b.schritte.length-1].zeile,
  vorbelegung:b.vorbelegung, validierung:b.validierung, vision:b.vision,
  visionVoll:b.visionVoll, zurueck:b.zurueck, wiederVorn:b.wiederVorn,
  ueberlauf: b.schritte.some(s=>s.ueberlauf), keinVersand:b.gesamt.keinVersand, fehler:b.gesamt.fehler,
})),null,1));
