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
| 2 · Offerte | `tiles.offer` mit echtem Versandstatus **und** `sentAt` | Dokument, Betrag, Gültigkeit, Status |
| 3 · Vorschau | `tiles.preview` mit freigegebener HTTPS-Adresse | Vorschau ansehen · Änderungswunsch senden |
| 3 · Verwaltung | `tiles.admin` — und nur mit sichtbarer Vorschau | Verwaltung öffnen |

Grundsätze der Seite:

* **Entwürfe nie.** Neben der Freigabe in Quantus prüft die Seite selbst, dass
  ein echter Versandstatus und ein Versandzeitpunkt dastehen.
* **Keine leeren Platzhalter.** Was nicht freigegeben ist, existiert auf der
  Seite nicht — auch nicht als Andeutung.
* **Drei Schichten um das Offertendokument:** entschärft in Quantus, ein zweites
  Mal auf der Seite, und eingesperrt in einem `sandbox`-iframe ohne Skripte.
* **Nur HTTPS** wird verlinkt, mit `rel="noopener noreferrer"`.
* **Änderungswünsche** gehen mit demselben Einladungstoken an denselben
  abgesicherten Eingang (`kind: "change"`) — kein zweiter Weg, keine Projekt-ID
  im Browser.
* **Ausserhalb dieses Links bleiben** Vertrag, AGB und das Kundenportal
  (`kunde.html`) — sie haben ihre eigene Freigabe.

Die Gegenseite (Freigaben, Veröffentlichung, Datenvertrag) liegt in `ai-sync`,
`docs/flowertech-workflow.md`, Abschnitt 4g.

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
node tests/fragebogen.test.mjs      # der Fragebogen selbst
node tests/kundenbereich.test.mjs   # die Stufen hinter demselben Link
node tests/kunde-page.test.mjs      # das Kundenportal
node tests/visionroom.test.mjs      # der gemeinsame Vision Room
```

`tests/dom-double.mjs` ist das gemeinsame DOM-Doppel dieser Tests — kein Test.

Alle führen die Seitenlogik wirklich aus (Skriptblock gegen ein DOM-Doppel) und
prüfen zusätzlich statisch, was NICHT passieren darf: keine Zugangsdaten im
Browser, kein Mail-Entwurf statt echtem Versand, keine Indexierung von
Fragebogen und Kundenportal, keine Vorschau ausserhalb des sandboxed iframe,
keine Kachel ohne Freigabe und kein Entwurf nach aussen.

## Qualität

Vor einer Veröffentlichung werden mindestens Desktop und Mobile, interne
Sprunglinks, Tastaturbedienung und die Browser-Konsole geprüft.
