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
- `fragebogen.html` – öffentlicher Fragebogen je Einladung (`?e=…`). Er ist der
  Einstieg: erst das Absenden erzeugt in Quantus einen Vorgang
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
node tests/fragebogen.test.mjs
node tests/kunde-page.test.mjs
node tests/visionroom.test.mjs
```

`tests/dom-double.mjs` ist das gemeinsame DOM-Doppel dieser Tests — kein Test.

Alle drei führen die Seitenlogik wirklich aus (Skriptblock gegen ein DOM-Doppel)
und prüfen zusätzlich statisch, was NICHT passieren darf: keine Zugangsdaten
im Browser, kein Mail-Entwurf statt echtem Versand, keine Indexierung von
Fragebogen und Kundenportal, keine Vorschau ausserhalb des sandboxed iframe.

## Qualität

Vor einer Veröffentlichung werden mindestens Desktop und Mobile, interne
Sprunglinks, Tastaturbedienung und die Browser-Konsole geprüft.
