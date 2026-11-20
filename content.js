// Cada opción oculta los botones de la barra lateral cuyo aria-label o icono coincida.
// (content.css hace lo mismo al instante con :has(); esto es el respaldo para otros idiomas.)
const NAV_RULES = {
  hideCalls: {
    label: /^(llamadas?|calls?|chamadas?)$/i,
    icon: /call/i,
  },
  hideStatus: { label: /^(estados?|status|stories)$/i, icon: /^status/i },
  hideChannels: { label: /^(canales|channels?|canais)$/i, icon: /newsletter|channel/i },
  hideCommunities: { label: /^(comunidades|communities|comunidade)/i, icon: /community|communities/i },
  hideMetaAI: { label: /meta ?(ai|ia)/i, icon: /meta-?ai|metaai/i },
};

let stored = { ...DEFAULTS };
let settings = { ...DEFAULTS };

// Con la extensión desactivada todo se comporta como si cada opción estuviera apagada.
function refreshSettings() {
  settings = stored.enabled
    ? stored
    : Object.fromEntries(Object.entries(stored).map(([k, v]) => [k, typeof v === "boolean" ? false : v]));
  if (!stored.enabled) settings.theme = "none";
}

const NAV_SELECTOR = "[data-navbar-item], [role='tab'], [aria-label], [title]";
const INTERACTIVE = "button, [role='button'], [data-icon], img, svg, input";

function hide(el) {
  el.setAttribute("data-nwd-hidden", "");
}

function isVisible(el) {
  return !el.hasAttribute("data-nwd-hidden") && el.getBoundingClientRect().height > 0;
}

function isSeparator(el) {
  if (!el || el.hasAttribute("data-nwd-hidden")) return false;
  if (el.querySelector(INTERACTIVE) || el.textContent.trim()) return false;
  if (el.tagName === "HR" || el.getAttribute("role") === "separator") return true;
  const r = el.getBoundingClientRect();
  return r.height <= 4 || r.width <= 4;
}

// Oculta el botón, sube por contenedores que solo lo contenían y quita separadores contiguos.
function hideWithContext(el) {
  let t = el;
  for (let i = 0; i < 5; i++) {
    const p = t.parentElement;
    if (!p || p.id === "app" || p === document.body) break;
    if (p.getBoundingClientRect().width > 120) break;
    const others = [...p.children].filter((c) => c !== t && !isSeparator(c) && isVisible(c));
    if (others.length) break;
    t = p;
  }
  hide(t);
  [t.previousElementSibling, t.nextElementSibling].forEach((s) => isSeparator(s) && hide(s));
}

// Puntos y contadores de notificación en la barra lateral (rail). El hueco junto al icono de cada
// botón lo oculta el CSS; esto atrapa los que WhatsApp dibuje en otro sitio (p. ej. el de Estados).
const RAIL_SEL = 'header[data-testid="chatlist-header"][data-tab="2"]';
let rail = null;

function hideNavDots() {
  if (!settings.hideBadge || !rail) return;
  rail.querySelectorAll("*").forEach((el) => {
    if (el instanceof SVGElement || el.hasAttribute("data-nwd-hidden") || el.closest("[data-nwd-hidden]")) return;
    if (el.children.length) return;
    const r = el.getBoundingClientRect();
    if (!r.width || r.width > 32 || r.height > 32) return;
    const text = el.textContent.trim();
    let match = /^\d{1,3}\+?$/.test(text);
    if (!match && !text && r.width >= 4 && r.width <= 14 && r.height <= 14) {
      const cs = getComputedStyle(el);
      match = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && parseFloat(cs.borderTopLeftRadius) >= r.width / 2 - 1;
    }
    if (match) hide(el);
  });
}

function applyHiding() {
  if (!rail?.isConnected) rail = document.querySelector(RAIL_SEL);
  const scope = rail || document;
  scope.querySelectorAll("[data-nwd-hidden]").forEach((el) => el.removeAttribute("data-nwd-hidden"));
  hideNavDots();

  const active = Object.keys(NAV_RULES).filter((k) => settings[k]);
  if (!active.length) return;

  scope.querySelectorAll(NAV_SELECTOR).forEach((el) => {
    if (el.closest("#pane-side, #main") || el.hasAttribute("data-nwd-hidden")) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.left > 120) return;

    const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
    const icons = [...el.querySelectorAll("[data-icon]")].map((i) => i.getAttribute("data-icon")).join(" ");

    for (const key of active) {
      const rule = NAV_RULES[key];
      if ((label && rule.label.test(label)) || (icons && rule.icon.test(icons))) {
        hideWithContext(el);
        break;
      }
    }
  });
}

// --- Textos de apartados desactivados ---
// Carteles al pasar el cursor y accesos de la pantalla de inicio ("Pregúntale a Meta AI").
// Se detectan en el mismo momento en que entran al DOM y se ocultan antes de pintarse.
const CHATS_SEL = "#pane-side, #main";

function activeLabels() {
  return Object.keys(NAV_RULES)
    .filter((k) => settings[k])
    .map((k) => NAV_RULES[k].label);
}

function scanTexts(root) {
  const labels = activeLabels();
  if (!labels.length || !root || !root.isConnected) return;
  // Las conversaciones se saltan enteras: un bloque grande (la pantalla de inicio) sale barato.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === 3) return NodeFilter.FILTER_ACCEPT;
      return n.matches(CHATS_SEL) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.trim();
    const holder = n.parentElement;
    if (!holder || !t || t.length > 30) continue;
    if (holder.closest("[data-nwd-hidden]")) continue;
    if (!labels.some((re) => re.test(t))) {
      // El cartel se reutiliza: si ahora dice otra cosa, se vuelve a mostrar
      holder.closest("[data-nwd-tip]")?.removeAttribute("data-nwd-tip");
      continue;
    }
    // Sube mientras el contenedor no tenga más texto: así cae también el icono que lo acompaña.
    let el = holder;
    for (let i = 0; i < 6 && el.parentElement && el.parentElement.textContent.trim() === t; i++) el = el.parentElement;
    // Acceso de la pantalla de inicio (icono + nombre dentro de un botón): cae la ficha entera,
    // no solo su nombre (si no, queda el icono suelto).
    const btn = el.closest("button");
    if (btn && !btn.closest(RAIL_SEL)) {
      el = btn;
      for (let i = 0; i < 6; i++) {
        const p = el.parentElement;
        if (!p || p.children.length !== 1 || p.tagName === "SECTION" || p.id === "app") break;
        el = p;
      }
    }
    el.setAttribute("data-nwd-tip", "");
  }
}


function rescanTexts() {
  document.querySelectorAll("[data-nwd-tip]").forEach((el) => el.removeAttribute("data-nwd-tip"));
  scanTexts(document.body);
}

function checkTexts(record) {
  if (record.type === "characterData") {
    const p = record.target.parentElement;
    if (p && !p.closest(CHATS_SEL)) scanTexts(p);
    return;
  }
  record.addedNodes.forEach((n) => {
    if (n.nodeType === 1 && !n.closest(CHATS_SEL)) scanTexts(n);
  });
}

// --- Difuminado: etiquetado ---
// Se publican como tokens en <html data-nwd-on="..."> (WhatsApp reescribe el class de <html>,
// pero no atributos desconocidos). content.css los lee con html[data-nwd-on~="token"].
const FLAGS = {
  blurText: "text",
  blurTime: "time",
  blurMedia: "media",
  blurNames: "names",
  blurAvatars: "avatars",
  blurPreviews: "previews",
  blurReveal: "reveal",
  hideCalls: "hide-calls",
  hideStatus: "hide-status",
  hideChannels: "hide-channels",
  hideCommunities: "hide-communities",
  hideMetaAI: "hide-meta",
  hideBadge: "no-badge",
};

const MSG_SEL = '#main [data-id], #main [role="row"]';
const ROW_SEL = '#pane-side [role="row"], #pane-side [role="listitem"]';
const HEADER_SEL = "#main header";
const PANEL_SEL = '#main [data-testid="conversation-panel-messages"]';
const IMG_SEL = 'img, video, canvas, [style*="background-image"], svg image, svg > mask';

const CLOCK_RE = /^(editado|edited)?\s*\d{1,2}[:.]\d{2}(\s*[ap]\.?\s?m\.?)?$/i;
const EDITED_RE = /^(editado|edited)$/i;
const DATE_RE =
  /^(\d{1,4}[/.\-]\d{1,2}([/.\-]\d{1,4})?|ayer|hoy|yesterday|today|(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday))$/i;
const PHONE_RE = /^\+?\d[\d\s\-()]{6,}$/;

const anyBlur = () => BLUR_KEYS.some((k) => settings[k]);

const isClock = (t) => CLOCK_RE.test(t) || EDITED_RE.test(t);
const isTime = (t) => isClock(t) || DATE_RE.test(t);

function ownText(el) {
  let s = "";
  for (const n of el.childNodes) if (n.nodeType === 3) s += n.nodeValue;
  return s.trim();
}

function setTag(el, kind) {
  if (kind) {
    if (el.getAttribute("data-nwd") !== kind) el.setAttribute("data-nwd", kind);
  } else if (el.hasAttribute("data-nwd")) {
    el.removeAttribute("data-nwd");
  }
}

function textElements(container) {
  return [container, ...container.querySelectorAll("*")].filter(
    (el) => !(el instanceof SVGElement) && ownText(el)
  );
}

function tagMessage(container) {
  container.setAttribute("data-nwd-seen", "");
  container.querySelector("[data-id]")?.setAttribute("data-nwd-seen", "");
  for (const el of textElements(container)) {
    const t = ownText(el);
    let kind = "text";
    if (isClock(t)) kind = "time";
    else if (
      el.closest('[data-testid="author"]') ||
      (!el.closest(".selectable-text") && (t.startsWith("~") || PHONE_RE.test(t)))
    )
      kind = "name";
    setTag(el, kind);
  }
}

function tagHeader(header) {
  for (const el of textElements(header)) setTag(el, isTime(ownText(el)) ? "time" : "name");
}

// Separadores de fecha ("Hoy", "Ayer"): viven fuera de las filas de mensajes.
function tagDates(root) {
  for (const el of textElements(root)) {
    if (el.closest('[role="row"], [data-id], button')) continue;
    if (isTime(ownText(el))) setTag(el, "time");
  }
}

// Lista de chats: se usan los data-testid de cada zona de la fila.
function tagRow(row) {
  row.setAttribute("data-nwd-seen", "");
  for (const el of textElements(row)) {
    const t = ownText(el);
    let kind = null;
    if (isTime(t) || el.closest('[data-testid="chat-list-timestamp"]')) kind = "time";
    else if (el.closest('[data-testid="cell-frame-title"], [data-testid="cell-frame-label"]')) kind = "name";
    else if (el.closest('[data-testid="cell-frame-secondary"]')) kind = "preview";
    setTag(el, kind);
  }
}

// Imágenes. Los avatares de WhatsApp son <img> o <svg> (con <image> o solo <mask> + inicial).
// Dentro de un mensaje (data-id) una imagen es "media", incluidas las miniaturas de respuestas.
const pendingImages = new WeakSet();

function tagImages(roots) {
  const targets = new Set();
  const skips = [];
  for (const root of roots) {
    for (const el of [root, ...root.querySelectorAll(IMG_SEL)]) {
      if (!el.matches?.(IMG_SEL)) continue;
      const target = el instanceof SVGElement ? el.closest("svg") : el;
      if (!target) continue;
      const done = target.getAttribute("data-nwd-img");
      if (done === "media" || done === "avatar") continue;
      const fixed = !target.closest("#app") || target.closest("footer") || target.matches(".emoji, [data-plain-text]");
      if (!fixed) targets.add(target);
      else if (done !== "skip") skips.push(target);
    }
  }
  // Primero se mide todo y luego se escribe: intercalarlo forzaría un reflow por cada imagen.
  const measured = [...targets].map((target) => [target, target.getBoundingClientRect()]);
  skips.forEach((target) => target.setAttribute("data-nwd-img", "skip"));
  for (const [target, r] of measured) {
    const isSvg = target instanceof SVGElement;
    if (target.tagName === "IMG" && !r.width && !target.complete) {
      if (!pendingImages.has(target)) {
        pendingImages.add(target);
        target.addEventListener("load", () => {
          pendingImages.delete(target);
          tagImages([target]);
        }, { once: true });
      }
      continue;
    }
    const tiny = r.width < 20 || r.height < 20 || r.width > 600;
    if (tiny || (!isSvg && !["IMG", "VIDEO"].includes(target.tagName) && target.textContent.trim())) {
      target.setAttribute("data-nwd-img", "skip");
      continue;
    }
    const kind = !isSvg && target.closest("#main [data-id]") ? "media" : "avatar";
    target.setAttribute("data-nwd-img", kind);
    target.parentElement?.setAttribute("data-nwd-box", kind);
  }
}

// Etiqueta de una vez todo lo cambiado: varios nodos de un mismo mensaje cuentan como un solo mensaje.
function tagWithin(nodes) {
  const msgs = new Set();
  const rows = new Set();
  const headers = new Set();
  const dates = new Set();
  const roots = new Set();
  const collect = (node, sel, set) => {
    node.querySelectorAll(sel).forEach((el) => set.add(el));
    const up = node.closest(sel);
    if (up) set.add(up);
  };
  for (let node of nodes) {
    if (node && node.nodeType === 3) node = node.parentElement;
    if (!node || node.nodeType !== 1 || !node.isConnected) continue;
    collect(node, MSG_SEL, msgs);
    collect(node, ROW_SEL, rows);
    collect(node, HEADER_SEL, headers);
    if (node.closest(PANEL_SEL) && !node.closest(MSG_SEL)) dates.add(node);
    else node.querySelectorAll(PANEL_SEL).forEach((panel) => dates.add(panel));
    roots.add(node);
  }
  // Una fila contiene su [data-id]: se etiqueta solo la de fuera.
  new Set([...msgs].map((el) => el.closest('#main [role="row"]') || el)).forEach(tagMessage);
  rows.forEach(tagRow);
  headers.forEach(tagHeader);
  dates.forEach(tagDates);
  tagImages(roots);
}

// --- Temas ---
// content.css traduce estas variables a los tokens --WDS-* de WhatsApp (que pintan toda la interfaz).
// Cambiar una variable en <html> recalcula los estilos de toda la página: solo se toca si cambió el tema.
let appliedTheme = null;
let themeVars = [];

function applyTheme() {
  const root = document.documentElement;
  const theme = THEMES[settings.theme];
  if (settings.theme === appliedTheme) return Boolean(theme);
  appliedTheme = settings.theme;
  themeVars.forEach((v) => root.style.removeProperty(v));
  themeVars = [];
  if (!theme) return false;

  const vars = { ...theme, ...deriveTheme(theme) };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  themeVars = Object.keys(vars);
  return true;
}

function appContainer() {
  return document.getElementById("app") || document.body;
}

function applyFlags() {
  const root = document.documentElement;
  const on = Object.entries(FLAGS)
    .filter(([key]) => settings[key])
    .map(([, token]) => token);
  if (anyBlur()) on.push("any");
  if (applyTheme()) on.push("themed");
  const value = on.join(" ");
  if (root.getAttribute("data-nwd-on") !== value) root.setAttribute("data-nwd-on", value);
  const amount = `${settings.blurAmount}px`;
  if (root.style.getPropertyValue("--nwd-amt") !== amount) root.style.setProperty("--nwd-amt", amount);
  if (anyBlur()) tagWithin([appContainer()]);
}

// --- Contador en título e icono ---
const COUNT_RE = /^\(\d+\)\s*/;
let cleanFavicon = null;
const FALLBACK_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#25d366"/></svg>'
  );

function fixTitle() {
  if (settings.hideBadge && COUNT_RE.test(document.title)) {
    document.title = document.title.replace(COUNT_RE, "");
  }
}

function fixFavicon(hadCount) {
  if (!settings.hideBadge) return;
  document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]').forEach((l) => {
    const href = l.getAttribute("href") || "";
    if (href === (cleanFavicon || FALLBACK_FAVICON)) return;
    if (!cleanFavicon && !hadCount && !/unread|badge/i.test(href) && !href.startsWith("data:")) {
      cleanFavicon = href;
      return;
    }
    if (hadCount || /unread|badge/i.test(href) || href.startsWith("data:")) {
      l.setAttribute("href", cleanFavicon || FALLBACK_FAVICON);
    }
  });
}

function watchTitle() {
  const title = document.querySelector("title");
  if (!title) return false;
  new MutationObserver(() => {
    const hadCount = COUNT_RE.test(document.title);
    fixTitle();
    fixFavicon(hadCount);
  }).observe(title, { childList: true, characterData: true, subtree: true });
  fixTitle();
  return true;
}

// Pasada completa de respaldo (los cambios concretos se etiquetan al instante en el observer).
// Corre como mucho una vez por segundo y en tiempo libre, para no competir con el scroll.
let scheduled = false;

function fullPass() {
  scheduled = false;
  if (!rail?.isConnected) applyHiding();
  if (anyBlur()) tagWithin([appContainer()]);
  fixTitle();
  fixFavicon(false);
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => requestIdleCallback(fullPass, { timeout: 500 }), 1000);
}

function applyAll() {
  for (const step of [applyFlags, applyHiding, rescanTexts, fixTitle, () => fixFavicon(false)]) {
    try {
      step();
    } catch (err) {
      console.error("[quiet-whatsapp]", err);
    }
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const [k, v] of Object.entries(changes)) stored[k] = v.newValue;
  refreshSettings();
  applyAll();
});

function start() {
  // El observer corre como microtarea, antes del pintado: lo nuevo nace ya difuminado/oculto.
  new MutationObserver((records) => {
    const blur = anyBlur();
    const changed = new Set();
    let railDirty = false;
    for (const r of records) {
      if (rail && rail.contains(r.target)) railDirty = true;
      checkTexts(r);
      if (!blur) continue;
      if (r.type === "characterData") changed.add(r.target);
      else r.addedNodes.forEach((n) => changed.add(n));
    }
    if (changed.size) tagWithin(changed);
    if (railDirty) applyHiding();
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  new MutationObserver(() => {
    if (!document.documentElement.hasAttribute("data-nwd-on")) applyFlags();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-nwd-on"] });

  if (!watchTitle()) {
    const wait = new MutationObserver(() => {
      if (watchTitle()) wait.disconnect();
    });
    wait.observe(document.documentElement, { childList: true, subtree: true });
  }
  applyAll();
}

// Se arranca con los ajustes ya leídos: así nunca se pinta nada con los valores por defecto.
chrome.storage.sync.get(DEFAULTS, (values) => {
  stored = { ...DEFAULTS, ...values };
  refreshSettings();
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start);
});
