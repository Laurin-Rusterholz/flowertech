/* ===========================================================================
   Vision Room — der gemeinsame Baustein.
   ---------------------------------------------------------------------------
   Diese Datei ist die EINZIGE Quelle für Aufbau, Auswahl- und Interaktions-
   logik des Vision Rooms. Sie wird von flowertech.ch (index.html) UND vom
   öffentlichen Fragebogen (fragebogen.html) benutzt.

   Vorher gab es im Fragebogen eine vereinfachte Zweitfassung: ein paar Chips
   statt der Mindmap, eine eigene, viel kürzere Vorschlagsliste, kein Typ, kein
   Ziehen, kein Umbenennen. Zwei Oberflächen für dieselbe Sache driften
   auseinander — und die Kundschaft sah je nach Weg etwas anderes.

   Zwei Betriebsarten, EIN Verhalten:

     mode: "inquiry"  (flowertech.ch)
       Der Einstieg OHNE Einladung. Der Baustein hat sein eigenes E-Mail-Feld
       und seinen eigenen Senden-Knopf; abgesendet wird eine ANFRAGE.

     mode: "intake"   (fragebogen.html)
       Der Vision Room ist Teil DESSELBEN Fragebogens. Kein E-Mail-Feld, kein
       Senden-Knopf, kein fetch — die Idee und die gewählten Funktionen sind
       zwei Antworten dieses Bogens und gehen mit ihm in EINEM Zug ab. Damit
       entsteht kein zweiter Versand und kein zweiter Vorgang.

   Alles andere ist in beiden Fällen identisch: dieselbe Wissensbasis, dieselbe
   Gewichtung der Vorschläge, dieselbe Mindmap, dieselben Tastatur- und
   Touch-Wege, dieselben ARIA-Auszeichnungen. Das Aussehen steht in
   visionroom.css.
   =========================================================================== */
(function () {
  "use strict";

  /* --- Wissensbasis: Domäne -> Funktionen (Treffer werden gewichtet) --- */
  const KB = [
    { k:['buchhalt','finanzbuch','rechnungswesen','treuhand','kassenbuch','bilanz','mwst','steuer'], f:['Belege per Foto erfassen','MwSt.-Abrechnung vorbereiten','Offene Posten & Mahnlauf','Bankabgleich automatisch','Export für den Treuhänder','Monatsabschluss & Auswertungen','Wiederkehrende Rechnungen','Spesen erfassen','Kassenbuch','Budget vs. Ist'] },
    { k:['offert','angebot','kalkul','preisliste','submission'], f:['Offerten-Vorlagen in Ihrem Design','KI-Entwurf aus Stichworten','Positionen aus früheren Projekten','Digitale Unterschrift','Automatisch nachfassen','Aus Offerte wird Rechnung','Rabatte & Staffelpreise','Varianten vergleichen'] },
    { k:['rechnung','faktur','mahn','zahlung','debitor'], f:['Rechnungen mit QR-Einzahlschein','Zahlungseingang abgleichen','Mahnlauf in drei Stufen','Teilzahlungen','Abo- und Serienrechnungen','Zahlungslink per Mail'] },
    { k:['termin','kalender','buchung','reservation','sitzung','planung','disposition'], f:['Online-Buchung rund um die Uhr','Automatische Bestätigung','Erinnerung per SMS/E-Mail','Kalender-Synchronisation','Puffer- & Sperrzeiten','Warteliste bei Absagen','Ressourcen & Räume','Serientermine'] },
    { k:['zeit','stunden','rapport','arbeitszeit','präsenz'], f:['Zeiterfassung per Knopfdruck','Stunden auf Projekt buchen','Überstunden & Saldo','Ferien und Absenzen','Monatsrapport als PDF','Erfassung offline'] },
    { k:['fitness','training','sport','lauf','gym','workout','muskel'], f:['Trainings automatisch loggen','Wochenziele & Fortschritt','KI-Trainingsplan','Puls- und Schlafdaten','Übungsbibliothek mit Videos','Persönliche Bestleistungen','Fortschrittsfotos','Regenerations-Empfehlung'] },
    { k:['ernähr','kalorien','diät','abnehm'], f:['Mahlzeiten erfassen','Kalorien & Makros','Barcode-Scan für Produkte','Wasserzufuhr','Wochenauswertung','Rezeptvorschläge'] },
    { k:['budget','spar','haushalt','ausgab','finanzen privat','geld'], f:['Ausgaben automatisch kategorisieren','Monatsbudget mit Warnung','Sparziele mit Fortschritt','Abos & Daueraufträge erkennen','Auswertung nach Kategorien','Belege fotografieren','Gemeinsame Kasse'] },
    { k:['mail','post','nachricht','inbox','kommunikation'], f:['Wichtiges automatisch nach oben','Newsletter automatisch ablegen','KI-Antwortvorschläge in Ihrem Ton','Zusammenfassung langer Mails','Erinnerung bei fehlender Antwort','Vorlagen mit einem Klick'] },
    { k:['lager','material','inventar','bestand','artikel','warenwirtschaft'], f:['Bestände in Echtzeit','Meldung vor dem Ausgehen','Bestellvorschläge','Barcode-Scan per Handy','Lieferanten-Verwaltung','Materialliste als PDF','Seriennummern & Chargen'] },
    { k:['kunde','crm','kontakt','adress','lead','akquise'], f:['Kundenkarte mit Historie','Notizen & Dokumente pro Kunde','Umsatz je Kunde','Wiedervorlagen','Aufgaben dem Team zuweisen','Datenschutz-konforme Ablage','Pipeline mit Stufen'] },
    { k:['shop','verkauf','bestell','produkt','e-commerce','laden','kasse'], f:['Produktkatalog mit Varianten','Warenkorb & Kasse','Online-Zahlung (TWINT, Karte)','Versand & Abholung','Lagerabgleich','Gutscheine & Aktionen','Bestellstatus für Kunden'] },
    { k:['restaurant','gastro','café','cafe','bar','menü','speise','beiz','pizzeria'], f:['Speisekarte in 5 Minuten ändern','Tischreservation online','Tagesmenü automatisch posten','Öffnungszeiten & Feiertage','Google-Eintrag gepflegt','Bewertungen sammeln','Take-away-Bestellung'] },
    { k:['praxis','arzt','patient','therapie','physio','zahn','coach','beratung'], f:['Online-Terminbuchung','Erinnerungen gegen No-Shows','Digitale Anmeldeformulare','Patientenakte & Verlauf','Rezept- und Berichtvorlagen','Abrechnung vorbereiten','Wartezimmer-Anzeige'] },
    { k:['handwerk','baustelle','montage','service','installat','reparatur','maler','elektr','sanitär','gartenbau','schreiner'], f:['Aufträge & Einsatzplanung','Stunden auf der Baustelle erfassen','Fotos direkt am Auftrag','Material pro Auftrag','Rapport digital unterschreiben','Offline weiterarbeiten','Fahrzeuge & Werkzeug'] },
    { k:['verein','mitglied','club','team','jugend'], f:['Mitgliederverwaltung','Beiträge & Mahnungen','Trainings- und Spielplan','An- und Abmeldungen','Newsletter an alle','Fotogalerie','Ämtli-Planung'] },
    { k:['schul','lern','kurs','bildung','nachhilfe','sprach','prüfung'], f:['Kursübersicht & Anmeldung','Lernfortschritt verfolgen','Aufgaben & Abgaben','Karteikarten mit Wiederholung','Zertifikate ausstellen','Stundenplan'] },
    { k:['immobil','miete','vermiet','wohnung','liegenschaft','hausverwalt'], f:['Objektübersicht mit Fotos','Mietverträge & Fristen','Nebenkosten abrechnen','Besichtigungstermine','Schadensmeldungen','Dokumentenarchiv','Mieter-Portal'] },
    { k:['auto','fahrzeug','flotte','garage','werkstatt','velo'], f:['Fahrzeugakte & Service-Historie','Serviceerinnerungen','Kostenübersicht pro Fahrzeug','Fahrtenbuch','Werkstattplanung','Reifen- & Teilelager'] },
    { k:['projekt','aufgabe','todo','organis','ticket','support'], f:['Aufgaben mit Fristen','Projektübersicht & Status','Zeiterfassung','Dateien pro Projekt','Team-Zuweisungen','Wochenreport','Kanban-Ansicht'] },
    { k:['rezept','koch','backen','essensplan'], f:['Rezept-Archiv mit Fotos','Wochenplan erstellen','Einkaufsliste automatisch','Nährwerte berechnen','Portionen umrechnen','Rezepte teilen'] },
    { k:['sammlung','archiv','fotoalbum','musik','bücher','film','vinyl','briefmark'], f:['Sammlung mit Bildern','Filter & schnelle Suche','Wert- und Statistiküberblick','Wunschliste','Import aus Tabelle','Verleih-Übersicht'] },
    { k:['portfolio','blog','magazin','news','artikel','journal'], f:['Beiträge selbst schreiben','Bildergalerien','Kategorien & Suche','Newsletter-Anmeldung','Kommentare (optional)','Autorenprofile'] },
    { k:['hochzeit','event','anlass','fest','konzert','messe'], f:['Programm & Ablauf','Gästeliste mit Zusagen','Anmeldeformular','Tischplan','Fotogalerie danach','Ticketverkauf'] },
    { k:['reise','urlaub','ferien','tour'], f:['Reiseplan mit Karte','Packliste','Ausgaben unterwegs','Fotos pro Tag','Dokumente offline','Ideen sammeln'] },
    { k:['garten','pflanze','tier','haustier','hund'], f:['Pflege-Erinnerungen','Tagebuch mit Fotos','Kosten im Blick','Termine beim Tierarzt','Futter- und Giessplan'] },
    { k:['gewohnheit','habit','tagebuch','journal','ziel','produktiv'], f:['Gewohnheiten abhaken','Serien & Streaks','Tagesrückblick','Stimmungsverlauf','Wochenauswertung','Erinnerungen'] },
    { k:['transport','logistik','lieferung','kurier','tour'], f:['Tourenplanung','Lieferscheine digital','Empfangsbestätigung mit Unterschrift','Live-Status für Kunden','Fahrzeugauslastung'] },
    { k:['reinigung','facility','hauswart','unterhalt'], f:['Objekt- und Tourenplan','Checklisten pro Einsatz','Fotos als Nachweis','Materialverbrauch','Rapport an Kunden'] },
    { k:['landwirt','hof','bauern','ernte'], f:['Felder & Kulturen','Ernte- und Ertragsjournal','Maschinen-Einsätze','Direktverkauf-Bestellungen','Wetter-Notizen'] }
  ];
  const BASE = {
    'Website': ['Mobil perfekt dargestellt','Kontaktformular','Google-Auffindbarkeit (SEO)','Bildergalerie','Mehrsprachig','Datenschutz-konform','Inhalte selbst ändern','Google-Maps & Anfahrt'],
    'Web-Programm': ['Als Programm installierbar','Offline weiterarbeiten','Benutzer & Rechte','Wunsch-Board fürs Team','KI-Assistent','Auswertungen & Export','Anbindung an Buchhaltung','Automatische Erinnerungen','Schweizer Hosting','Mobil auf der Baustelle'],
    'Web-App': ['Auf dem Handy installierbar','Offline nutzbar','Dunkles Design','Erinnerungen & Mitteilungen','Daten exportieren','Ohne Werbung & Abo','Widget für den Startbildschirm','Mit Familie teilen']
  };
  const COLORS = ['#c8ff2e', '#25d5ff', '#ff3ea5', '#ff7a1a', '#a06bff', '#3765ff'];

  /* Die Blume ist ein SVG-Symbol der Startseite. Fehlt es (der Fragebogen ist
     eine eigenständige Seite), bringt der Baustein es selbst mit. */
  var FLOWER_ID = "flowerG";
  var FLOWER_SVG =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<g id="' + FLOWER_ID + '">' +
    ['#c8ff2e', '#25d5ff', '#3765ff', '#a06bff', '#ff3ea5', '#ff7a1a'].map(function (color, i) {
      return '<path d="M50 47 C38.5 39 37.5 17 50 6 C62.5 17 61.5 39 50 47 Z" fill="' + color +
        '" transform="rotate(' + (i * 60) + ' 50 50)"/>';
    }).join('') +
    '<circle cx="50" cy="50" r="6" fill="#f6f6f4"/></g></defs></svg>';

  function ensureFlower() {
    if (document.getElementById(FLOWER_ID)) return;
    var holder = document.createElement('div');
    holder.innerHTML = FLOWER_SVG;
    var svg = holder.firstChild;
    if (svg) document.body.insertBefore(svg, document.body.firstChild);
  }

  /* Der Aufbau. Beide Seiten bekommen exakt dieselben Knoten, Klassen und
     ARIA-Auszeichnungen; im Fragebogen entfallen allein E-Mail-Feld und
     Senden-Knopf, weil dort nichts einzeln abgeschickt wird. */
  function markup(opts) {
    var o = opts || {};
    var intake = o.mode === 'intake';
    var cls = 'mm' + (o.rootClass ? ' ' + o.rootClass : '');
    return '<div class="' + cls + '" id="mm" data-mode="' + (intake ? 'intake' : 'inquiry') + '">' +
      '<div class="mm-top">' +
        '<div class="mm-mobile-step"><em>01</em><span>Was möchten Sie bauen?</span></div>' +
        '<div class="mm-types">' +
          '<button type="button" class="mt" data-t="Website"><i style="background:var(--lime)"></i>Website</button>' +
          '<button type="button" class="mt" data-t="Web-Programm"><i style="background:var(--cyan)"></i>Web-Programm</button>' +
          '<button type="button" class="mt" data-t="Web-App"><i style="background:var(--orange)"></i>Web-App</button>' +
        '</div>' +
        '<div class="mm-hint" id="mmHint">Idee eintippen → Funktionen anhängen</div>' +
        '<button type="button" class="mm-reset" id="mmReset" title="Visionroom neu starten">Neu starten</button>' +
      '</div>' +

      '<div class="mm-canvas" id="mmCanvas">' +
        '<svg class="mm-links" id="mmLinks" aria-hidden="true"></svg>' +
        '<div class="mm-mobile-step mm-idea-step"><em>02</em><span>Beschreiben Sie Ihre Idee</span></div>' +
        '<div class="mm-core empty" id="mmCore">' +
          '<span class="mc-halo"></span>' +
          '<span class="mc-flower"><svg viewBox="0 0 100 100" width="26" height="26" aria-hidden="true"><use href="#' + FLOWER_ID + '"/></svg></span>' +
          '<label class="mm-label" for="vrIdea">Ihre Idee · Pflichtfeld</label>' +
          '<input id="vrIdea" placeholder="Ihre Idee in einem Satz …" maxlength="90" autocomplete="off"' +
            ' aria-label="Ihre Idee (Pflichtfeld)" aria-required="true" aria-describedby="vrIdeaHelp" aria-invalid="true">' +
          '<p class="mm-need" id="vrIdeaHelp">' +
            '<b>Beschreiben Sie kurz Ihre Idee, damit Sie senden können.</b>' +
            '<span>Zum Beispiel: «Eine App, mit der Familien Aufgaben und Termine gemeinsam organisieren.»</span>' +
          '</p>' +
          '<button type="button" class="mm-suggest" id="vrSuggest">Vorschläge anzeigen</button>' +
          '<span class="mc-type" id="mmType">Art wählen</span>' +
          '<span class="mc-badge" id="mmBadge">0</span>' +
        '</div>' +
        '<div class="mm-mobile-step mm-feature-step"><em>03</em><span>Passende Funktionen wählen</span></div>' +
        '<div class="mm-nodes" id="mmNodes"></div>' +
        '<button type="button" class="mm-more" id="mmMore" hidden>Weitere Vorschläge anzeigen</button>' +
        '<div class="mm-empty" id="mmEmpty">' +
          '<span class="mm-empty-desktop">Tippen Sie Ihre Idee ins Zentrum —<br>z.&nbsp;B. <b>Buchhaltungsprogramm</b>, <b>Fitnesstracker</b>, <b>Restaurant-Website</b></span>' +
          '<span class="mm-empty-mobile">Wählen Sie zuerst eine Art, beschreiben Sie Ihre Idee und lassen Sie passende Funktionen vorschlagen.</span>' +
        '</div>' +
      '</div>' +

      '<div class="mm-foot">' +
        '<div class="mm-mobile-step"><em>04</em><span>' + (intake ? 'Auswahl übernehmen' : 'Auswahl senden') + '</span></div>' +
        '<div class="mm-own"><input id="vrOwn" placeholder="Eigene Funktion anhängen …" maxlength="70" autocomplete="off" aria-label="Eigene Funktion">' +
          '<button type="button" id="vrAdd" aria-label="Funktion hinzufügen">+</button></div>' +
        (intake ? '' :
          '<div class="mm-send">' +
            '<input id="vrMail" type="email" placeholder="Ihre E-Mail für die Antwort" autocomplete="email" aria-label="E-Mail für die Antwort">' +
            '<input id="vrHp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">' +
            '<a class="bttn" id="vrSend" href="#" role="button" aria-disabled="true" aria-describedby="vrNeed">Senden</a>' +
          '</div>') +
        '<p class="mm-need-send" id="vrNeed" role="status" aria-live="polite">' +
          'Noch kurz Ihre Idee beschreiben, dann können Sie senden.</p>' +
      '</div>' +
      '<div class="mm-sum" id="vrSum" aria-live="polite">Noch nichts gewählt.</div>' +
    '</div>';
  }


  /* Der Aufbau samt Verhalten. `container` bekommt die Mindmap; zurück kommt
     eine kleine Steuerung für die Seite, die den Baustein einsetzt. */
  function mount(container, opts) {
    var options = opts || {};
    var intake = options.mode === 'intake';
    if (!container) return null;
    ensureFlower();
    container.innerHTML = markup(options);

    var api = {};
    const el = id => document.getElementById(id);
    const canvas = el('mmCanvas'), nodesWrap = el('mmNodes'), links = el('mmLinks'), core = el('mmCore'), mm = el('mm');
    const vrIdea = el('vrIdea'), vrOwn = el('vrOwn'), vrMail = el('vrMail'), vrSend = el('vrSend'),
          vrSum = el('vrSum'), badge = el('mmBadge'), mmType = el('mmType'), mmEmpty = el('mmEmpty'), mmHint = el('mmHint'),
          vrSuggest = el('vrSuggest'), mmMore = el('mmMore'), vrNeed = el('vrNeed');
    if (!canvas) return null;

    let type = '', idea = '', items = [], mobileExpanded = false;   /* {label, on, custom, mx, my} */
    const dragHint = () => window.innerWidth <= 860
      ? 'Funktionen antippen — Ihre Auswahl bleibt sichtbar'
      : 'Ziehen zum Verschieben · Doppelklick zum Umbenennen';

    function suggest(txt, tp) {
      const x = (txt || '').toLowerCase();
      const scored = [];
      KB.forEach(e => {
        let hits = 0;
        e.k.forEach(k => { if (x.includes(k)) hits++; });
        if (hits) scored.push({ hits, f: e.f });
      });
      scored.sort((a, b) => b.hits - a.hits);
      let out = [];
      scored.forEach(sc => { out = out.concat(sc.f); });
      if (!out.length) out = ['Übersicht mit Kennzahlen','Suche & Filter','Daten erfassen & bearbeiten','Export als PDF','Benachrichtigungen','KI-Assistent für Texte'];
      out = out.filter((v, i) => out.indexOf(v) === i).slice(0, 10);
      (BASE[tp] || []).forEach(b => { if (!out.includes(b)) out.push(b); });
      return out.slice(0, 15);
    }

    function shake(node) { node.classList.add('shake'); setTimeout(() => node.classList.remove('shake'), 500); }
    function needType() {
      if (type) return false;
      document.querySelectorAll('.mt').forEach(shake);
      mmHint.textContent = 'Zuerst die Art wählen';
      return true;
    }

    /* --- Items neu bilden: Auswahl und eigene Einträge bleiben erhalten --- */
    function rebuild() {
      const keep = items.filter(it => it.on || it.custom);
      const fresh = suggest(idea, type).filter(f => !keep.some(k => k.label === f));
      items = keep.concat(fresh.map(f => ({ label: f, on: false, custom: false })));
      if (items.length > 16) items = items.slice(0, 16);
      render();
    }

    function render() {
      nodesWrap.innerHTML = '';
      items.forEach((it, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mnode' + (it.on ? ' on' : '');
        if (window.innerWidth <= 860 && !mobileExpanded && i >= 6 && !it.on) b.classList.add('mobile-hidden');
        b.style.setProperty('--c', COLORS[i % COLORS.length]);
        b.setAttribute('aria-pressed', it.on ? 'true' : 'false');
        b.setAttribute('aria-label', it.label + (it.on ? ' entfernen' : ' auswählen'));
        const sp = document.createElement('span'); sp.textContent = it.label; b.appendChild(sp);
        const u = document.createElement('u'); u.textContent = it.on ? '×' : '+'; u.setAttribute('aria-hidden', 'true'); b.appendChild(u);
        b.dataset.i = i;

        const toggle = () => {
          if (!it.on && needType()) return;
          if (it.on && it.custom) { items = items.filter(o => o !== it); render(); sync(); return; }
          it.on = !it.on; render(); sync();
        };
        u.addEventListener('pointerdown', e => e.stopPropagation());
        u.addEventListener('click', e => {
          e.stopPropagation();
          toggle();
        });

        let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
        if (window.innerWidth > 860) {
          /* Umbenennen und Verschieben gehören ausschliesslich zur Desktop-Mindmap. */
          b.addEventListener('dblclick', e => {
            e.preventDefault();
            const inp = document.createElement('input');
            inp.className = 'mn-edit'; inp.value = it.label; inp.maxLength = 70;
            sp.replaceWith(inp); inp.focus(); inp.select();
            const done = () => { it.label = inp.value.trim() || it.label; it.custom = true; render(); sync(); };
            inp.addEventListener('blur', done);
            inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
            inp.addEventListener('pointerdown', ev => ev.stopPropagation());
          });
          b.addEventListener('pointerdown', e => {
            if (e.target.tagName === 'INPUT') return;
            const r = canvas.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; moved = false;
            ox = it.mx !== undefined ? it.mx : (b._x - r.width / 2);
            oy = it.my !== undefined ? it.my : (b._y - r.height / 2);
            b.setPointerCapture(e.pointerId);
            b.classList.add('dragging');
          });
          b.addEventListener('pointermove', e => {
            if (!b.hasPointerCapture || !b.classList.contains('dragging')) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
            it.mx = ox + dx; it.my = oy + dy;
            layout();
          });
          const endDrag = () => b.classList.remove('dragging');
          b.addEventListener('pointerup', endDrag);
          b.addEventListener('pointercancel', endDrag);
        }

        /* Mobil ist die ganze Karte genau eine grosse, scrollfreundliche Aktion. */
        b.addEventListener('click', e => {
          if (window.innerWidth > 860 || e.target.tagName === 'INPUT' || moved) return;
          toggle();
        });

        nodesWrap.appendChild(b);
      });
      mmEmpty.classList.toggle('gone', items.length > 0);
      mm.classList.toggle('has-items', items.length > 0);
      if (mmMore) {
        const hiddenCount = items.filter((it, i) => i >= 6 && !it.on).length;
        mmMore.hidden = window.innerWidth > 860 || (!mobileExpanded && hiddenCount === 0);
        mmMore.textContent = mobileExpanded ? 'Weniger Vorschläge anzeigen' : hiddenCount + ' weitere Vorschläge anzeigen';
      }
      layout();
    }

    function layout() {
      const nodes = Array.from(nodesWrap.children);
      if (window.innerWidth <= 860) { links.innerHTML = ''; return; }
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const cx = w / 2, cy = h / 2;
      const rxO = Math.min(w * .375, 405), ryO = h * .375;
      const rxI = rxO * .56, ryI = ryO * .58;
      const sel = [], uns = [];
      nodes.forEach(n => (items[+n.dataset.i].on ? sel : uns).push(n));
      let paths = '';
      function place(group, rx, ry, offset) {
        const n = group.length || 1;
        group.forEach((b, i) => {
          const it = items[+b.dataset.i];
          let x, y;
          if (it.mx !== undefined) { x = cx + it.mx; y = cy + it.my; }
          else {
            const ang = (offset + (360 / n) * i) * Math.PI / 180;
            x = cx + Math.cos(ang) * rx; y = cy + Math.sin(ang) * ry;
          }
          b._x = x; b._y = y;
          b.style.transform = 'translate(-50%,-50%) translate(' + x + 'px,' + y + 'px)';
          const mx = cx + (x - cx) * .55, my = cy + (y - cy) * .55 + (it.on ? 0 : 14);
          const col = b.style.getPropertyValue('--c') || '#c8ff2e';
          paths += '<path class="' + (it.on ? 'live' : 'ghost') + '" d="M' + cx + ' ' + cy + ' Q' + mx + ' ' + my + ' ' + x + ' ' + y + '"' +
                   (it.on ? ' stroke="' + col + '" opacity=".8"' : '') + '/>';
        });
      }
      place(uns, rxO, ryO, -86);
      place(sel, rxI, ryI, -90 + (sel.length > 1 ? 180 / sel.length : 0));
      links.innerHTML = paths;
    }

    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    /* Pflicht ist allein die Idee. Funktionen sind ein Angebot, keine Huerde —
       wer nur einen Satz schreibt, muss senden koennen. Keine Mindestlaenge:
       geprueft wird ausschliesslich, ob nach dem Trimmen etwas dasteht. */
    function sync() {
      const picked = items.filter(i => i.on).map(i => i.label);
      badge.textContent = picked.length;
      badge.classList.toggle('on', picked.length > 0);
      mmType.textContent = type || 'Art wählen';
      idea = (vrIdea.value || '').trim();
      /* Im Fragebogen ist die E-Mail eine ganz normale Frage des Bogens — der
         Vision Room fragt sie nicht ein zweites Mal. Pflicht bleibt allein die
         Idee; die Funktionen sind auch dort ein Angebot, keine Huerde. */
      const mail = vrMail ? (vrMail.value || '').trim() : '';
      const mailOk = vrMail ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) : true;
      const ok = !!(type && idea && mailOk);
      mm.classList.toggle('has-picks', picked.length > 0);
      mm.classList.toggle('has-idea', !!idea);
      core.classList.toggle('empty', !idea);
      core.classList.toggle('filled', !!idea);
      vrIdea.setAttribute('aria-invalid', idea ? 'false' : 'true');
      if (vrNeed) {
        /* Der Hinweis nennt immer genau den naechsten Schritt und wird zur
           Bestaetigung, sobald die Idee steht — auch fuer Vorlese-Software. */
        vrNeed.textContent = !idea
          ? 'Noch kurz Ihre Idee beschreiben, dann können Sie senden.'
          : !type ? 'Ihre Idee ist da — jetzt oben noch die Art wählen, dann können Sie senden.'
          : !mailOk ? 'Ihre Idee ist da — jetzt noch Ihre E-Mail für die Antwort, dann können Sie senden.'
          : intake ? 'Ihre Idee ist da — sie geht zusammen mit dem Fragebogen ab.'
          : 'Ihre Idee ist da — Sie können jetzt senden.';
        vrNeed.classList.toggle('done', !!idea);
      }
      vrSum.innerHTML = (type && idea)
        ? '<b>' + esc(type) + '</b> — ' + esc(idea) +
          (picked.length ? ' · <b>' + picked.length + '</b> Funktionen angehängt' : ' · Funktionen sind freiwillig') +
          (intake ? ' · geht mit dem Fragebogen ab' : mailOk ? ' · bereit zum Senden' : ' · noch E-Mail eintragen')
        : (!type ? 'Wählen Sie oben die Art.' : 'Beschreiben Sie Ihre Idee.');
      if (vrSend) {
        vrSend.classList.toggle('ready', ok);
        vrSend.setAttribute('aria-disabled', ok ? 'false' : 'true');
        vrSend.href = '#';
      }
      /* Der einzige Ausgang des Bausteins: Der Fragebogen schreibt die Werte in
         seine eigenen Felder und sendet sie mit allen anderen Antworten ab. */
      if (typeof options.onChange === 'function') {
        options.onChange({ type: type, idea: idea, features: picked });
      }
    }

    if (!intake) {
      /* ── Versand an Quantus ───────────────────────────────────────────────
         Der oeffentliche Vision Room ist der Einstieg OHNE Einladung. Was hier
         ankommt, wird bei FlowerTech zu einer ANFRAGE — nicht zu einem Projekt
         und nicht zu einem Direktauftrag. Der naechste Schritt ist der
         Fragebogen-Link, den FlowerTech zurueckschickt; erst dessen Absenden
         erzeugt genau EIN Projekt und genau EINE Aufgabe.

         Wer bereits eine Einladung hat (?e=<Token>), gehoert nicht hierher: Der
         Vision Room ist dort Teil des Fragebogens, damit alles in einem Zug
         abgeschickt wird. Diese Seite verweist dann dorthin, statt einen
         zweiten Eingang zu oeffnen.

         Der Idempotenz-Schluessel verhindert Doppelanlagen bei Doppelklick oder
         Wiederholung.
         ------------------------------------------------------------------- */
      const QUANTUS_ENDPOINT = 'https://management-xo2-pro.netlify.app/.netlify/functions/flowertech-portal';
      const inviteToken = (() => {
        const t = new URLSearchParams(location.search).get('e') || '';
        return /^[A-Za-z0-9_-]{24,64}$/.test(t) ? t : '';
      })();

      function idemKey(parts) {
        const basis = parts.join('|');
        let hash = 5381;
        for (let i = 0; i < basis.length; i++) hash = ((hash << 5) + hash + basis.charCodeAt(i)) >>> 0;
        return 'ft_' + hash.toString(36) + '_' + basis.length.toString(36);
      }

      let sending = false;
      async function sendVision(ev) {
        if (ev) ev.preventDefault();
        if (sending || !vrSend.classList.contains('ready')) return;
        const picked = items.filter(i => i.on).map(i => i.label);
        const mail = (vrMail.value || '').trim();
        /* Mit Einladung gehoert der Vision Room in den Fragebogen — dort wird
           alles in EINEM Zug abgeschickt. Kein zweiter Eingang, kein zweiter
           Vorgang. */
        if (inviteToken) {
          location.href = '/fragebogen.html?e=' + encodeURIComponent(inviteToken) + '#visionRoom';
          return;
        }
        /* Der Bedarf ist die Idee; die Funktionen sind eine freiwillige Ergaenzung. */
        const payload = { type, need: idea, idea, features: picked, email: mail };
        sending = true;
        vrSum.textContent = 'Wird gesendet …';
        try {
          const res = await fetch(QUANTUS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'inquiry',
              source: 'vision-room',
              payload,
              website: (el('vrHp') || {}).value || '',
              idempotencyKey: idemKey(['', 'inquiry', mail, idea, picked.join(',')])
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Senden fehlgeschlagen');
          mm.classList.add('sent');
          vrSum.innerHTML = data.duplicate
            ? '<b>Bereits eingegangen.</b> Ihre Anfrage liegt bei FlowerTech.'
            : '<b>Ihre Anfrage ist bei FlowerTech eingegangen.</b> Wir schauen sie an und schicken Ihnen ' +
              'innert 24 h einen persönlichen Fragebogen-Link für die restlichen Angaben.';
          vrSend.classList.remove('ready');
          vrSend.setAttribute('aria-disabled', 'true');
          if (vrNeed) { vrNeed.textContent = 'Ihre Idee ist bei uns — Sie hören innert 24 h von uns.'; vrNeed.classList.add('done'); }
        } catch (e) {
          /* Kein Mail-Programm als Ausweg: der Knopf bleibt bedienbar und sagt,
             was los ist. */
          vrSum.innerHTML = '<b>Das Senden hat gerade nicht geklappt.</b> Bitte gleich nochmals auf «Senden» tippen.';
        }
        sending = false;
      }
      if (vrSend) vrSend.addEventListener('click', sendVision);
    }

    function setType(name, silent) {
      const b = Array.from(document.querySelectorAll('.mt')).find(o => o.dataset.t === name);
      if (!b) return;
      document.querySelectorAll('.mt').forEach(o => o.classList.remove('on'));
      b.classList.add('on'); type = name;
      core.style.borderColor = b.querySelector('i').style.background;
      if (window.innerWidth <= 860) {
        items = []; mobileExpanded = false; render();
        mmHint.textContent = idea ? 'Idee prüfen und Vorschläge anzeigen' : 'Als Nächstes: Idee beschreiben';
      } else {
        mmHint.textContent = idea ? dragHint()
          : (silent ? 'Aus Ihrer Auswahl übernommen — jetzt Idee eintippen' : 'Jetzt Idee ins Zentrum tippen');
        rebuild();
      }
      sync();
      if (!silent && window.innerWidth > 860) vrIdea.focus();
    }
    api.setType = n => setType(n, true);
    window.__vrSetType = api.setType;
    document.querySelectorAll('.mt').forEach(b => b.addEventListener('click', () => setType(b.dataset.t, false)));

    let t0;
    vrIdea.addEventListener('input', () => {
      clearTimeout(t0);
      idea = vrIdea.value.trim();
      if (window.innerWidth <= 860) {
        mmHint.textContent = idea ? 'Tippen Sie jetzt auf «Vorschläge anzeigen»' : 'Beschreiben Sie Ihre Idee';
        sync();
        return;
      }
      t0 = setTimeout(() => {
        if (!type) { sync(); return; }
        mmHint.textContent = dragHint();
        rebuild(); sync();
      }, 300);
    });
    function showSuggestions() {
      idea = vrIdea.value.trim();
      if (needType()) return;
      if (!idea) { shake(core); mmHint.textContent = 'Bitte beschreiben Sie zuerst Ihre Idee'; return; }
      mobileExpanded = false;
      rebuild(); sync();
      mmHint.textContent = dragHint();
    }
    if (vrSuggest) vrSuggest.addEventListener('click', showSuggestions);
    if (mmMore) mmMore.addEventListener('click', () => { mobileExpanded = !mobileExpanded; render(); });
    vrIdea.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (window.innerWidth <= 860) showSuggestions();
      else { idea = vrIdea.value.trim(); if (!needType()) { rebuild(); sync(); } }
    });

    function addOwn() {
      const v = vrOwn.value.trim(); if (!v) return;
      if (needType()) return;
      if (!items.some(i => i.label.toLowerCase() === v.toLowerCase())) items.unshift({ label: v, on: true, custom: true });
      vrOwn.value = ''; render(); sync();
    }
    el('vrAdd').addEventListener('click', addOwn);
    vrOwn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addOwn(); } });
    if (vrMail) vrMail.addEventListener('input', sync);
    const rs = el('mmReset');
    if (rs) rs.addEventListener('click', () => {
      type = ''; idea = ''; items = []; mobileExpanded = false;
      vrIdea.value = ''; vrOwn.value = ''; if (vrMail) vrMail.value = '';
      document.querySelectorAll('.mt').forEach(o => o.classList.remove('on'));
      core.style.borderColor = '';
      mmHint.textContent = window.innerWidth <= 860 ? 'Wählen Sie zuerst eine Art' : 'Idee eintippen → Funktionen anhängen';
      render(); sync();
    });
    window.addEventListener('resize', layout);
    render(); sync();

    /* Vorbelegung: Was im Fragebogen schon dasteht (etwa nach einem Wechsel
       zurück auf die Seite), erscheint im Zentrum und in der Auswahl — der
       Baustein erfindet nichts und verliert nichts. */
    var start = options.initial || {};
    if (start.idea) vrIdea.value = String(start.idea);
    if (start.type) setType(String(start.type), true);
    if (Array.isArray(start.features) && start.features.length) {
      start.features.forEach(function (label) {
        var value = String(label || '').trim();
        if (!value) return;
        if (!items.some(function (i) { return i.label.toLowerCase() === value.toLowerCase(); })) {
          items.unshift({ label: value, on: true, custom: true });
        } else {
          items.forEach(function (i) { if (i.label.toLowerCase() === value.toLowerCase()) i.on = true; });
        }
      });
      render();
    }
    sync();

    api.state = function () {
      return { type: type, idea: idea, features: items.filter(function (i) { return i.on; }).map(function (i) { return i.label; }) };
    };
    return api;
  }

  window.FlowerTechVisionRoom = { KB: KB, BASE: BASE, COLORS: COLORS, markup: markup, mount: mount };
})();
