/*
 * Ein kleiner CSS-Leser für die Frage: Wird dieses Element weggeblendet?
 * ---------------------------------------------------------------------------
 * Der Anlass war ein Fehler, den kein DOM-Test finden konnte: Die Kopfzeile des
 * Cockpits stand vollständig im Dokument, mit allen Umschaltern, und war
 * trotzdem unsichtbar. Eine einzige Regel war schuld —
 *
 *     body.ck-on header{display:none}
 *
 * gedacht für den Seitenkopf, wirksam für JEDEN <header> im Dokument. Die
 * Kopfzeile des Cockpits ist selbst ein <header>.
 *
 * Diese Datei liest den <style>-Block der Seite und beantwortet für einen
 * angegebenen Elementpfad (html › body › … › Element), ob ihn eine Regel
 * unsichtbar macht. Sie ist bewusst klein: Sie versteht Typ, Klasse, id,
 * einfache Attributselektoren sowie Nachfahr- und Kind-Verkettung. Regeln mit
 * Pseudoklassen (`:hover`) bleiben aussen vor — ein Element, das erst beim
 * Zeigen verschwindet, ist ein anderes Thema.
 *
 * Sie ersetzt keinen Browser. Sie schliesst genau die Lücke zwischen „steht im
 * DOM" und „ist zu sehen", in die dieser Fehler gefallen ist.
 */

/* Erklärungen, nach denen ein Element (oder alles darin) verschwindet. */
const VERSTECKT = [
  [/display\s*:\s*none/i, "display:none"],
  [/visibility\s*:\s*hidden/i, "visibility:hidden"],
  [/content-visibility\s*:\s*hidden/i, "content-visibility:hidden"],
  [/(^|;)\s*height\s*:\s*0(px|%)?\s*(;|$)/i, "height:0"],
  [/(^|;)\s*max-height\s*:\s*0(px|%)?\s*(;|$)/i, "max-height:0"],
  [/(^|;)\s*opacity\s*:\s*0(\.0+)?\s*(;|$)/i, "opacity:0"],
  [/clip-path\s*:\s*inset\(\s*100%/i, "clip-path:inset(100%)"],
];

/* Regeln einlesen — auch die in @media-Blöcken. Eine Kopfzeile, die auf
   schmalen Geräten verschwindet, ist genauso weg wie eine, die es immer ist. */
export function regeln(css) {
  const sauber = String(css).replace(/\/\*[\s\S]*?\*\//g, "");
  const liste = [];
  const medien = [];
  // @media-Blöcke herauslösen und ihren Inhalt gesondert einlesen.
  const rest = sauber.replace(/@media([^{]+)\{([\s\S]*?)\n\s*\}/g, (_, bedingung, inhalt) => {
    medien.push({ bedingung: bedingung.trim(), inhalt });
    return "";
  });
  const einlesen = (text, bedingung) => {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let treffer;
    while ((treffer = re.exec(text))) {
      const wahl = treffer[1].trim();
      if (!wahl || wahl.charAt(0) === "@") continue;
      wahl.split(",").forEach((sel) => {
        if (sel.trim()) liste.push({ selektor: sel.trim(), regeln: treffer[2], bedingung: bedingung });
      });
    }
  };
  einlesen(rest, "");
  medien.forEach((m) => einlesen(m.inhalt, m.bedingung));
  return liste;
}

/* Trifft ein einzelner Selektorteil (z. B. `header.ck-top`) auf ein Element? */
function trifft(teil, element) {
  const marken = teil.match(/^[a-zA-Z][\w-]*|\*|#[\w-]+|\.[\w-]+|\[[^\]]+\]/g);
  if (!marken || marken.join("") !== teil) return false;
  return marken.every((marke) => {
    if (marke === "*") return true;
    if (marke.charAt(0) === "#") return element.id === marke.slice(1);
    if (marke.charAt(0) === ".") return (element.klassen || []).indexOf(marke.slice(1)) >= 0;
    if (marke.charAt(0) === "[") {
      const inhalt = marke.slice(1, -1);
      const paar = /^([\w-]+)(?:\s*=\s*"?([^"\]]*)"?)?$/.exec(inhalt);
      if (!paar) return false;
      const attrs = element.attrs || {};
      if (!Object.prototype.hasOwnProperty.call(attrs, paar[1])) return false;
      return paar[2] === undefined || String(attrs[paar[1]]) === paar[2];
    }
    return String(element.tag || "").toLowerCase() === marke.toLowerCase();
  });
}

/* Passt der Selektor auf das letzte Element des Pfades? Von rechts gelesen,
   genau wie im Browser. */
export function passt(selektor, pfad) {
  const roh = selektor.replace(/\s*>\s*/g, " > ").split(/\s+/).filter(Boolean);
  if (roh.some((t) => t !== ">" && /[:(+~]/.test(t))) return false; // nicht auswertbar
  const teile = [];
  let kind = false;
  roh.forEach((t) => {
    if (t === ">") { kind = true; return; }
    teile.push({ kind: kind, teil: t });
    kind = false;
  });
  let i = teile.length - 1;
  let k = pfad.length - 1;
  if (!trifft(teile[i].teil, pfad[k])) return false;
  for (i = teile.length - 2; i >= 0; i--) {
    const alsKind = teile[i + 1].kind;
    k--;
    if (alsKind) {
      if (k < 0 || !trifft(teile[i].teil, pfad[k])) return false;
    } else {
      let gefunden = false;
      while (k >= 0) {
        if (trifft(teile[i].teil, pfad[k])) { gefunden = true; break; }
        k--;
      }
      if (!gefunden) return false;
    }
  }
  return true;
}

/* Alle Gründe, aus denen dieser Pfad unsichtbar wäre. Leer = sichtbar.
   Geprüft wird der ganze Pfad: Ein verstecktes Elternteil nimmt das Kind mit. */
export function versteckt(css, pfad) {
  const alle = regeln(css);
  const gruende = [];
  pfad.forEach((_, index) => {
    const bis = pfad.slice(0, index + 1);
    alle.forEach((regel) => {
      if (!passt(regel.selektor, bis)) return;
      VERSTECKT.forEach(([muster, name]) => {
        if (muster.test(regel.regeln)) {
          gruende.push(`${regel.selektor}{${name}}` +
            (regel.bedingung ? ` in @media${regel.bedingung}` : "") +
            (index < pfad.length - 1 ? ` (trifft den Vorfahren ${beschreibe(bis[index])})` : ""));
        }
      });
    });
  });
  return gruende;
}

export function beschreibe(element) {
  return String(element.tag || "*") + (element.id ? "#" + element.id : "") +
    (element.klassen || []).map((k) => "." + k).join("");
}

/* Ein Element im Pfad: Typ, id, Klassen und die Attribute, die im Betrieb
   wirklich dranstehen — `hidden` gehört ausdrücklich dazu. */
export function el(tag, id, klassen, attrs) {
  return { tag: tag, id: id || "", klassen: klassen || [], attrs: attrs || {} };
}
