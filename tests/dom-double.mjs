/*
 * Ein leichtes DOM-Doppel für die Seitentests.
 * ---------------------------------------------------------------------------
 * Die Seiten dieses Repositories haben keinen Bauschritt und keine
 * Abhängigkeiten — die Tests führen ihre Skriptblöcke deshalb gegen dieses
 * Doppel aus, statt einen ganzen Browser mitzuschleppen.
 *
 * Es kann genau so viel, wie der Vision Room und der Fragebogen anfassen:
 * Knoten über ihre id finden, erzeugtes HTML einlesen, Elemente anlegen und
 * anhängen, Klassen und Attribute setzen, Ereignisse auslösen. Alles darüber
 * hinaus fehlt bewusst — ein Doppel, das zu viel kann, prüft am Ende sich
 * selbst statt der Seite.
 */

export function makeDom({ innerWidth = 1200, innerHeight = 900 } = {}) {
  const byId = {};
  const types = [];

  function mk(tag = "DIV", id = "") {
    const node = {
      id,
      tagName: String(tag).toUpperCase(),
      _html: "",
      _classes: [],
      _handlers: {},
      textContent: "",
      value: "",
      hidden: false,
      disabled: false,
      href: "",
      maxLength: 0,
      children: [],
      options: [],
      dataset: {},
      attrs: {},
      parentNode: null,
      style: {
        setProperty(name, value) { this[name] = value; },
        getPropertyValue(name) { return this[name] || ""; },
      },
      clientWidth: innerWidth,
      clientHeight: 560,
      getBoundingClientRect() {
        return { width: innerWidth, height: 560, top: 0, left: 0, bottom: 560, right: innerWidth };
      },
      focus() {}, select() {}, blur() { node.fire("blur"); },
      setPointerCapture() {}, hasPointerCapture() { return true; },
      scrollIntoView() {},
      setAttribute(k, v) { node.attrs[k] = String(v); },
      getAttribute(k) { return node.attrs[k] == null ? null : node.attrs[k]; },
      removeAttribute(k) { delete node.attrs[k]; },
      addEventListener(type, fn) { (node._handlers[type] = node._handlers[type] || []).push(fn); },
      removeEventListener() {},
      appendChild(child) { node.children.push(child); child.parentNode = node; return child; },
      removeChild(child) { node.children = node.children.filter((c) => c !== child); return child; },
      insertBefore(child) { node.children.unshift(child); child.parentNode = node; return child; },
      remove() { if (node.parentNode) node.parentNode.removeChild(node); },
      replaceWith() {},
      closest(sel) {
        if (sel !== "label") return null;
        node._label = node._label || mk("LABEL", node.id ? node.id + "_label" : "");
        return node._label;
      },
      querySelector(sel) {
        if (sel === "i") { node._i = node._i || mk("I"); return node._i; }
        return null;
      },
      querySelectorAll() { return []; },
      click() { node.fire("click"); },
      fire(type, event) {
        const list = (node._handlers[type] || []).slice();
        const ev = event || {
          preventDefault() {}, stopPropagation() {},
          target: node, clientX: 0, clientY: 0, key: "",
        };
        list.forEach((fn) => fn(ev));
        return ev;
      },
    };
    Object.defineProperty(node, "className", {
      get() { return node._classes.join(" "); },
      set(value) { node._classes = String(value || "").split(/\s+/).filter(Boolean); },
      configurable: true,
    });
    node.classList = {
      add(...names) { names.forEach((n) => { if (n && !node._classes.includes(n)) node._classes.push(n); }); },
      remove(...names) { node._classes = node._classes.filter((c) => !names.includes(c)); },
      toggle(name, on) {
        const want = on === undefined ? !node._classes.includes(name) : !!on;
        if (want) this.add(name); else this.remove(name);
        return want;
      },
      contains(name) { return node._classes.includes(name); },
    };
    Object.defineProperty(node, "innerHTML", {
      get() { return node._html; },
      set(value) {
        node._html = String(value == null ? "" : value);
        node.children = [];
        register(node._html);
      },
      configurable: true,
    });
    return node;
  }

  /* Erzeugtes HTML wird eingelesen: Jede id wird zu einem Knoten, den die Seite
     danach über getElementById findet — genau wie im Browser. Die Art-Knöpfe
     tragen keine id; sie werden über ihre Klasse gesammelt. */
  function register(html) {
    const tags = String(html).match(/<([a-zA-Z][\w-]*)\b[^>]*>/g) || [];
    if (/class="mm-types"/.test(html)) types.length = 0;
    tags.forEach((tag) => {
      const name = /<([a-zA-Z][\w-]*)/.exec(tag)[1];
      const cls = (/\sclass="([^"]*)"/.exec(tag) || [])[1] || "";
      const dataT = (/\sdata-t="([^"]*)"/.exec(tag) || [])[1];
      const id = (/\sid="([^"]+)"/.exec(tag) || [])[1];
      if (!id) {
        if (cls.split(/\s+/).includes("mt") && dataT) {
          const button = mk(name);
          button.className = cls;
          button.dataset.t = dataT;
          types.push(button);
        }
        return;
      }
      const node = byId[id] || (byId[id] = mk(name, id));
      node.tagName = name.toUpperCase();
      if (cls) node.className = cls;
      if (dataT) node.dataset.t = dataT;
      /* Beschreibende Attribute wie im Browser übernehmen: Erzeugtes HTML, das
         `data-ft="view"` oder `aria-selected` trägt, muss danach auch über
         getAttribute auffindbar sein — sonst prüfte der Test nur die
         Zeichenkette, aus der er gebaut wurde. */
      (tag.match(/\s(data-[\w-]+|aria-[\w-]+|role)="([^"]*)"/g) || []).forEach((paar) => {
        const [, schluessel, wert] = /\s([\w-]+)="([^"]*)"/.exec(paar);
        node.attrs[schluessel] = wert;
        if (schluessel.indexOf("data-") === 0) {
          node.dataset[schluessel.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = wert;
        }
      });
      const value = (/\svalue="([^"]*)"/.exec(tag) || [])[1];
      if (value != null && !node.value) node.value = value;
      if (/\shidden(?=[\s>/])/.test(tag)) node.hidden = true;
      node._tag = tag;
      // Ein <select> trägt seine Optionen — der Vision Room fragt sie ab,
      // bevor er die Art des Vorhabens in die Frage schreibt.
      if (node.tagName === "SELECT") {
        const start = String(html).indexOf(tag);
        const rest = String(html).slice(start, String(html).indexOf("</select>", start));
        node.options = (rest.match(/<option value="([^"]*)"/g) || [])
          .map((m) => ({ value: /"([^"]*)"/.exec(m)[1] }));
      }
    });
  }

  const body = mk("BODY", "body");
  /* Das Wurzelelement trägt die Baumarke der ausgelieferten Fassung
     (`data-ft-cockpit`) — die Seite setzt sie, die Abnahme liest sie. */
  const documentElement = mk("HTML");
  const document = {
    title: "",
    body,
    documentElement,
    getElementById: (id) => byId[id] || null,
    createElement: (tag) => mk(tag),
    addEventListener() {},
    /* Nur die eine Sammelabfrage, die der Vision Room wirklich benutzt. */
    querySelectorAll: (sel) => (sel === ".mt" ? types.slice() : []),
    querySelector: () => null,
  };

  const window = {
    innerWidth, innerHeight,
    document,
    addEventListener() {}, removeEventListener() {},
    setTimeout: (fn) => { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    location: { search: "", hash: "", href: "" },
  };
  window.window = window;

  return {
    window, document, body, documentElement, byId, types,
    node: (id) => byId[id] || null,
    ensure: (id, tag) => (byId[id] = byId[id] || mk(tag || "DIV", id)),
    register, mk,
  };
}
