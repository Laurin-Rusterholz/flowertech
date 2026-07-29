# Sicherheit

## Unterstützte Version

Unterstützt wird der aktuelle Stand des Branches `main` sowie die daraus
veröffentlichte Netlify-Version.

## Sicherheitslücken melden

Bitte keine sensiblen Details in einem öffentlichen Issue veröffentlichen.
Meldungen können vertraulich an `contact@laurin-rusterholz.ch` gesendet werden.

Hilfreich sind:

- betroffene URL oder Funktion
- nachvollziehbare Schritte
- erwartetes und tatsächliches Verhalten
- mögliche Auswirkungen

Zugangsdaten, Tokens, persönliche Kundendaten und vollständige
Produktions-Datensätze sollen nicht mitgesendet werden.

## Grundsätze

- Keine Secrets im Frontend oder Repository
- Serverseitige Validierung aller externen Eingaben
- Strenge Firebase-Regeln mit minimalen Berechtigungen
- Rate-Limits und Bot-Schutz für öffentliche Formulare
- Regelmäßige Backups vor strukturellen Datenänderungen
- Security-Header über Netlify
