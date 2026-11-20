// Datos compartidos por content.js y popup.js (el manifest y popup.html cargan este archivo primero).
var DEFAULTS = {
  hideCalls: true,
  hideStatus: true,
  hideChannels: true,
  hideCommunities: true,
  hideMetaAI: true,
  hideBadge: true,
  blurText: false,
  blurTime: false,
  blurMedia: false,
  blurNames: false,
  blurAvatars: false,
  blurPreviews: false,
  blurReveal: true,
  blurAmount: 6,
  theme: "none",
  enabled: true,
};
var BLUR_KEYS = ["blurText", "blurTime", "blurMedia", "blurNames", "blurAvatars", "blurPreviews"];

// Paletas para WhatsApp Web. Cada una da la intención del tema; deriveTheme() calcula los tonos finales.
// Los nombres visibles están en _locales (theme_<id>). Un panel claro convierte el tema en modo claro.
//   --bg-sky-top / --bg-sky-bot  color del fondo de la conversación
//   --card-bg                    paneles (barra lateral, lista de chats, cabeceras)
//   --input-bg                   buscador, caja de mensaje, burbuja recibida
//   --accent / --accent-hover    botones, enlaces, chip y chat seleccionados
var THEMES = {
  snow: {
    "--bg-sky-top": "#eceef0",
    "--bg-sky-bot": "#e1e4e7",
    "--card-bg": "#ffffff",
    "--input-bg": "#f0f1f3",
    "--accent": "#5f6368",
    "--accent-hover": "#3c4043",
  },
  olive: {
    "--bg-sky-top": "#9CAF88",
    "--bg-sky-bot": "#859874",
    "--card-bg": "#1E1E1E",
    "--input-bg": "#2C2C2C",
    "--accent": "#8EC596",
    "--accent-hover": "#A8D5AF",
  },
  lagoon: {
    "--bg-sky-top": "#2b566e",
    "--bg-sky-bot": "#183647",
    "--card-bg": "#0f1e26",
    "--input-bg": "#1b3340",
    "--accent": "#55d1b2",
    "--accent-hover": "#7be0c7",
  },
  emerald: {
    "--bg-sky-top": "#2d5a27",
    "--bg-sky-bot": "#1b3d17",
    "--card-bg": "#0d140c",
    "--input-bg": "#162214",
    "--accent": "#50c878",
    "--accent-hover": "#76e098",
  },
  glacier: {
    "--bg-sky-top": "#e0f7fa",
    "--bg-sky-bot": "#b2ebf2",
    "--card-bg": "#10151a",
    "--input-bg": "#1e262e",
    "--accent": "#00d2ff",
    "--accent-hover": "#80eaff",
  },
  rose: {
    "--bg-sky-top": "#fbc4ab",
    "--bg-sky-bot": "#ff8fa3",
    "--card-bg": "#1a0f12",
    "--input-bg": "#2e1a1e",
    "--accent": "#ff4d6d",
    "--accent-hover": "#ff758f",
  },
  ember: {
    "--bg-sky-top": "#5e1515",
    "--bg-sky-bot": "#360808",
    "--card-bg": "#1a0b0b",
    "--input-bg": "#2e1212",
    "--accent": "#ff6b6b",
    "--accent-hover": "#ff8c8c",
  },
  amethyst: {
    "--bg-sky-top": "#261a36",
    "--bg-sky-bot": "#0f0814",
    "--card-bg": "#110b14",
    "--input-bg": "#231829",
    "--accent": "#d699ff",
    "--accent-hover": "#e5bfff",
  },
  amber: {
    "--bg-sky-top": "#fceabb",
    "--bg-sky-bot": "#f8b500",
    "--card-bg": "#1a1a10",
    "--input-bg": "#2d2d1a",
    "--accent": "#ffd900ec",
    "--accent-hover": "#fff44f",
  },
  graphite: {
    "--bg-sky-top": "#C6C6C6",
    "--bg-sky-bot": "#8B8B8B",
    "--card-bg": "#1e1e1e",
    "--input-bg": "#404040",
    "--accent": "#ffffff83",
    "--accent-hover": "#C6C6C6",
  },
};

// --- Tonos derivados ---
// Los colores de cada paleta se pensaron para fondos propios: usados tal cual, el fondo puede quedar
// chillón junto a los paneles y la burbuja enviada ilegible. Aquí se ajustan por contraste WCAG.
var INK_DARK = [17, 27, 33];
var INK_LIGHT = [247, 248, 250];
var META_ALPHA = 0.7; // hora y ticks dentro de la burbuja

function hexRgba(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return { rgb: [r, g, b], alpha: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
}

function mixRgb(a, b, t) {
  return a.map((v, i) => Math.round(v * t + b[i] * (1 - t)));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Mezcla `color` con `base` usando la mayor proporción de `color` que cumpla `ok`.
function fit(color, base, start, ok) {
  for (let t = start; t > 0; t -= 0.01) {
    const c = mixRgb(color, base, t);
    if (ok(c)) return c;
  }
  return base;
}

// Acerca `color` a `ink` hasta alcanzar `ratio` contra todos los fondos dados.
function readable(color, backgrounds, ratio, ink) {
  for (let t = 0; t <= 1; t += 0.01) {
    const c = mixRgb(ink, color, t);
    if (backgrounds.every((bg) => contrast(c, bg) >= ratio)) return c;
  }
  return ink;
}

function deriveTheme(colors) {
  const css = (rgb) => `rgb(${rgb.join(", ")})`;
  const card = hexRgba(colors["--card-bg"]).rgb;
  const input = hexRgba(colors["--input-bg"]).rgb;
  const top = hexRgba(colors["--bg-sky-top"]).rgb;
  const bot = hexRgba(colors["--bg-sky-bot"]).rgb;
  const isLight = luminance(card) > 0.5;
  const ink = isLight ? INK_DARK : INK_LIGHT;

  // El acento se aplana sobre el panel: varias paletas lo dan con alfa (#ffffff83).
  const rawAccent = hexRgba(colors["--accent"]);
  const accent = mixRgb(rawAccent.rgb, card, rawAccent.alpha);

  // Fondo: el tono del cielo, acercado al panel para que no compita con los mensajes.
  const sky = contrast(bot, card) < 1.15 ? top : bot;
  const wall = fit(sky, card, 1, (c) => (isLight ? luminance(c) >= 0.7 : luminance(c) <= 0.05));
  const doodle = mixRgb(accent, wall, 0.1);

  // Burbujas: la enviada lleva el acento, con el texto y la hora siempre legibles.
  const incoming = isLight ? card : input;
  const out = fit(accent, card, isLight ? 0.3 : 0.5, (c) => {
    return contrast(ink, c) >= 7 && contrast(mixRgb(ink, c, META_ALPHA), c) >= 4.5;
  });

  const elevated = mixRgb(input, card, 0.15);
  const soft = mixRgb(accent, card, 0.25); // chip seleccionado
  const link = readable(hexRgba(colors["--accent-hover"]).rgb, [out, input, card], 4.5, ink);
  const action = readable(accent, [card, input, soft], 4.5, ink);
  const onAccent = contrast(card, accent) >= contrast(ink, accent) ? card : ink;
  const inkRgb = ink.join(", ");

  return {
    "--nwd-accent": css(accent),
    "--nwd-accent-rgb": accent.join(", "),
    "--nwd-action": css(action),
    "--nwd-card-rgb": card.join(", "),
    "--nwd-disabled": `rgba(${inkRgb}, 0.38)`,
    "--nwd-divider": `rgba(${inkRgb}, ${isLight ? 0.12 : 0.1})`,
    "--nwd-doodle": css(doodle),
    "--nwd-elevated": css(elevated),
    "--nwd-elevated-rgb": elevated.join(", "),
    "--nwd-in": css(incoming),
    "--nwd-in-rgb": incoming.join(", "),
    "--nwd-ink": css(ink),
    "--nwd-ink-rgb": inkRgb,
    "--nwd-input-rgb": input.join(", "),
    "--nwd-inverse": isLight ? "#ffffff" : css(INK_DARK),
    "--nwd-link": css(link),
    "--nwd-meta": `rgba(${inkRgb}, ${META_ALPHA})`,
    "--nwd-muted": `rgba(${inkRgb}, ${isLight ? 0.66 : 0.62})`,
    "--nwd-on-accent": css(onAccent),
    "--nwd-out": css(out),
    "--nwd-out-rgb": out.join(", "),
    "--nwd-outline": `rgba(${inkRgb}, 0.2)`,
    "--nwd-pressed": `rgba(${inkRgb}, 0.12)`,
    "--nwd-soft": css(soft),
    "--nwd-soft-rgb": soft.join(", "),
    "--nwd-wall": css(wall),
  };
}
