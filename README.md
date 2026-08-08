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
- `kunde.html` – Kundenseite je Projekt (Bearer-Link `?t=…`) inklusive
  Abschnitt „Angaben für Ihre Offerte"
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
node tests/kunde-page.test.mjs
node tests/visionroom.test.mjs
```

Beide führen die Seitenlogik wirklich aus (Skriptblock gegen ein DOM-Doppel)
und prüfen zusätzlich statisch, was NICHT passieren darf: keine Zugangsdaten
im Browser, kein Mail-Entwurf statt echtem Versand, keine Indexierung der
Kundenseite.

## Qualität

Vor einer Veröffentlichung werden mindestens Desktop und Mobile, interne
Sprunglinks, Tastaturbedienung und die Browser-Konsole geprüft.
