# FlowerTech

FlowerTech entwickelt moderne Websites und Web-Apps für Schweizer KMU und
Privatpersonen. Die Website zeigt das Angebot, den Visionroom und das
FlowerTech-System in einer interaktiven, responsiven Präsentation.

## Live

- Vorschau: <https://keen-baklava-08de84.netlify.app/>
- Ziel-Domain: <https://flowertech.ch/>

## Struktur

Die aktuelle Website ist bewusst als eigenständige statische Seite gebaut:

- `index.html` – vollständige Website inklusive Styles, Interaktionen und
  inline SVGs
- `visionroom.js` / `visionroom.css` – der Vision Room als **einziger**
  Baustein: Aufbau, Wissensbasis, Auswahl- und Interaktionslogik samt Gestalt.
  `index.html` setzt ihn im Anfrage-Modus ein (eigenes E-Mail-Feld, eigener
  Senden-Knopf), `fragebogen.html` im Fragebogen-Modus (kein zweiter Versand —
  Idee und Funktionen gehen als zwei Antworten mit dem Bogen ab)
- `fragebogen.html` – der **eine Kundenlink** je Einladung (`?e=…`). Er ist der
  Einstieg: erst das Absenden erzeugt in Quantus einen Vorgang — und dieselbe
  Adresse wächst danach zum Kundenbereich (siehe unten)
- `kunde.html` – Kundenportal je Projekt (Bearer-Link `?t=…`): Vorschau,
  Änderungswünsche, AGB mit Zustimmung, Rückfragen, Fortschritt
- `netlify.toml` – Netlify-Build- und Security-Header
- `SECURITY.md` – Sicherheits- und Meldeprozess
- `tests/` – Prüfungen ohne Build-Tools (`node tests/<datei>.test.mjs`)

Es werden keine Build-Tools und keine Laufzeit-Abhängigkeiten benötigt.

## Lokal starten

```bash
python3 -m http.server 4173
```

Danach <http://127.0.0.1:4173/> öffnen.

## Der Kundenbereich: eine Adresse, die mitwächst

Die Kundschaft lernt genau **eine** Adresse — `fragebogen.html?e=<Einladung>`.
Sie wird nie ersetzt und nie erneuert. Was auf ihr steht, entscheidet
ausschliesslich der Datensatz, den Quantus unter
`flowertech/intakeForms/<token>` veröffentlicht (`stage` und `tiles`); die Seite
erfindet nichts dazu und ruft nichts Zweites ab.

| Stufe | Sichtbar, sobald … | Zeigt |
| --- | --- | --- |
| 1 · Fragebogen | immer | Kundendaten, Bestandesaufnahme, Vision Room |
| Leistung · TEST | `tiles.testService` mit Titel | unverbindliche Übersicht mit Kostenstand statt Betrag |
| 2 · Offerte | `tiles.offer` mit echtem Versandstatus **und** `sentAt` | Dokument, Betrag, Gültigkeit, Status |
| 3 · Vorschau | `tiles.preview` mit freigegebener HTTPS-Adresse | die Adresse ausgeschrieben · Vorschau ansehen · Änderungswunsch senden |
| 3 · Vertrag | `tiles.contract` mit freigegebenem Dokument | Projektauftrag zum Lesen und Drucken |
| 3 · Verwaltung | `tiles.admin` — und nur mit sichtbarer Vorschau | Verwaltung öffnen |
| AGB | `tiles.terms` — immer, ohne Freigabe | die zentrale Standard-AGB samt Fassung |

Grundsätze der Seite:

* **Entwürfe nie.** Neben der Freigabe in Quantus prüft die Seite selbst, dass
  ein echter Versandstatus und ein Versandzeitpunkt dastehen.
* **Keine leeren Platzhalter.** Was nicht freigegeben ist, existiert auf der
  Seite nicht — auch nicht als Andeutung.
* **Drei Schichten um Offerten- und Vertragsdokument:** entschärft in Quantus,
  ein zweites Mal auf der Seite, und eingesperrt in einem `sandbox`-iframe ohne
  Skripte.
* **Nur HTTPS** wird verlinkt, mit `rel="noopener noreferrer"`.
* **Die Vorschau-Adresse steht ausgeschrieben da** — nicht nur im Knopf. Ein
  Knopf allein ist keine Adresse, die sich lesen oder weitergeben lässt.
* **Herkunft wird benannt.** Eine Vorschau, die nicht aus der bestätigten
  Claude-Code-Rückgabe stammt (`provisional: true`), erscheint vollständig,
  wird aber als **Testvorschau · Zwischenstand** ausgezeichnet — nie als
  fertige Fassung.
* **Änderungswünsche** gehen mit demselben Einladungstoken an denselben
  abgesicherten Eingang (`kind: "change"`) — kein zweiter Weg, keine Projekt-ID
  im Browser. Ohne geöffnete Rückmeldung steht wenigstens der Weg dorthin da.
* **Ausserhalb dieses Links bleibt** das alte Kundenportal (`kunde.html`) — es
  hat seinen eigenen Token und seine eigene Freigabe. Diese Seite hängt an
  nichts davon.

Die Gegenseite (Freigaben, Veröffentlichung, Claude-Code-Rückgabe, Datenvertrag)
liegt in `ai-sync`, `docs/flowertech-workflow.md`, Abschnitte 4g bis 4g-2.

## Deployment

Netlify veröffentlicht den Repository-Root. Ein Push auf `main` kann direkt als
Produktions-Deploy verwendet werden.

```text
Build command:  (leer)
Publish directory: .
```

## Datenschutz und Secrets

- Keine API-Schlüssel, Tokens oder Passwörter gehören in dieses Repository.
- Formulare und Automationen werden ausschließlich über serverseitige
  Endpunkte angebunden.
- Lokale `.env`-Dateien werden durch `.gitignore` ausgeschlossen.
- Browser-Datenzugriffe werden durch Firebase-Regeln und authentifizierte
  Server-Funktionen geschützt.

## Tests

Ohne Abhängigkeiten, direkt mit Node:

```bash
node tests/run-all.mjs      # alle auf einmal — dasselbe läuft in der CI
```

Einzeln geht auch:

```bash
node tests/fragebogen.test.mjs         # der Fragebogen selbst
node tests/kundenbereich.test.mjs      # die Stufen hinter demselben Link
node tests/kundenlink-lehner.test.mjs  # der Live-Befund: Vorschau, Offerte, AGB
node tests/cockpit-kopfzeile.test.mjs  # Kopfzeile, Ansichten, Kunden-Backend
node tests/auswahlmodus.test.mjs       # Elementauswahl in der Vorschau
node tests/kunde-page.test.mjs         # das Kundenportal
node tests/visionroom.test.mjs         # der gemeinsame Vision Room
```

`tests/dom-double.mjs` (DOM-Doppel) und `tests/css-sichtbarkeit.mjs`
(CSS-Kaskade) sind gemeinsame Hilfen dieser Tests — keine Tests.

Alle führen die Seitenlogik wirklich aus (Skriptblock gegen ein DOM-Doppel) und
prüfen zusätzlich statisch, was NICHT passieren darf: keine Zugangsdaten im
Browser, kein Mail-Entwurf statt echtem Versand, keine Indexierung von
Fragebogen und Kundenportal, keine Vorschau ausserhalb des sandboxed iframe,
keine Kachel ohne Freigabe und kein Entwurf nach aussen.

## Standard-Abnahme

Nach jedem Deploy dieselben Schritte, in dieser Reihenfolge. Sie sind bewusst
kurz — was hier durchfällt, fällt sonst der Kundschaft auf.

1. **Testlauf** — `node tests/run-all.mjs` muss vollständig grün sein.
   Dasselbe läuft in der CI; ein roter Lauf ist ein Abbruch, keine Notiz.
2. **Frischer Kundenlink** — `https://flowertech.ch/fragebogen.html?e=<Token>`
   neu öffnen, dann einmal hart neu laden (⌘/Strg + Shift + R). Ohne das sieht
   man die vorige Fassung und prüft eine Seite, die es nicht mehr gibt.
   Zur Kontrolle in der Konsole:
   `document.documentElement.dataset.ftCockpit` — steht dort nicht die Fassung
   dieser Auslieferung, ist der Deploy noch nicht durch.
3. **Alle Ansichten** — Website · Verwaltung · Offerte · Vertrag · AGB & Kunde ·
   Fragebogen einmal durchschalten. Jede ersetzt die Mitte vollständig; nie
   stehen zwei gleichzeitig da.
4. **Desktop und Mobil** — dieselbe Runde im schmalen Fenster (unter 900 px).
   Kopfzeile, Bereichsleiste und Änderungsleiste müssen lesbar bleiben.
5. **Vorschau bedienbar** — mit *ausgeschaltetem* Auswahlmodus durch die
   eingebettete Website klicken: Menü, Links, Seitenwechsel funktionieren.
6. **Elementauswahl** — „Element auswählen“ einschalten, in der Vorschau auf
   eine Stelle tippen. Erwartet: kein Seitenwechsel, die Änderungsleiste öffnet
   sich, Bereich *Website*, Titel und Details tragen Abschnitt und Seite.
   Meldet sich die Vorschau nicht, steht dort „noch nicht verbunden“ — das ist
   eine ehrliche Auskunft, kein stiller Ausfall.
7. **Nichts wird dabei gesendet** — erst der Knopf „Änderungswunsch senden“
   schickt etwas. Für die Abnahme wird kein echter Kundenwunsch abgeschickt.
8. **Browser-Konsole** — keine Fehler, keine Warnungen aus dieser Seite.

Was nie behauptet werden darf: ein Auswahlmodus, der nicht verbunden ist, oder
eine angelegte Aufgabe, die der Eingang nicht bestätigt hat.

## Qualität

Vor einer Veröffentlichung werden mindestens Desktop und Mobile, interne
Sprunglinks, Tastaturbedienung und die Browser-Konsole geprüft.
