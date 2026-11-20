const t = (key) => chrome.i18n.getMessage(key);

const HIDE_KEYS = ["hideCalls", "hideStatus", "hideChannels", "hideCommunities", "hideMetaAI", "hideBadge"];
const BLUR_ROWS = [...BLUR_KEYS, "blurReveal"];

const CHECK = '<path d="m5 12.500 4.500 4.500L19 7.500"/>';
const CROSS = '<path d="m7 7 10 10M17 7 7 17"/>';

const $ = (id) => document.getElementById(id);
const rows = new Map();
let settings = { ...DEFAULTS };
let saveTimer;

function save(patch) {
  Object.assign(settings, patch);
  chrome.storage.sync.set(patch);
  render();
}

function makeRow(key, label) {
  const row = document.createElement("button");
  row.className = "row";
  row.setAttribute("role", "menuitemcheckbox");
  row.innerHTML = '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"></svg><span class="grow"></span>';
  row.lastChild.textContent = label;
  row.addEventListener("click", () => save({ [key]: !settings[key] }));
  rows.set(key, row);
  return row;
}

function render() {
  const off = !settings.enabled;
  for (const [key, row] of rows) {
    row.setAttribute("aria-checked", String(settings[key]));
    row.firstChild.innerHTML = settings[key] ? CHECK : CROSS;
    if (key !== "enabled") row.disabled = off;
  }
  $("home").classList.toggle("off", off);
  for (const id of ["all", "none", "amount", "openThemes"]) $(id).disabled = off;
  $("amount").value = settings.blurAmount;
  $("themeName").textContent = themeLabel(settings.theme);
  paintPopup();
  renderThemes();
}

// --- Tema ---
function themeLabel(id) {
  return THEMES[id] ? t(`theme_${id}`) : t("themeDefault");
}

// El popup se viste con el tema elegido; sin tema usa los valores de popup.css.
function paintPopup() {
  const root = document.documentElement;
  const theme = THEMES[settings.theme];
  const vars = ["--bg", "--surface", "--text", "--muted", "--accent", "--line"];
  if (!theme) {
    vars.forEach((v) => root.style.removeProperty(v));
    root.removeAttribute("data-mode");
    return;
  }
  const d = deriveTheme(theme);
  const values = [theme["--card-bg"], theme["--input-bg"], d["--nwd-ink"], d["--nwd-muted"], d["--nwd-action"], d["--nwd-divider"]];
  vars.forEach((v, i) => root.style.setProperty(v, values[i]));
  root.dataset.mode = luminance(hexRgba(theme["--card-bg"]).rgb) > 0.5 ? "light" : "dark";
}

function renderThemes() {
  const list = $("themeList");
  list.replaceChildren();
  for (const id of ["none", ...Object.keys(THEMES)]) {
    const row = document.createElement("button");
    row.className = "row";
    row.setAttribute("role", "radio");
    row.setAttribute("aria-checked", String(id === settings.theme));
    row.innerHTML = '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"></svg><span class="grow"></span>';
    if (id === settings.theme) row.firstChild.innerHTML = CHECK;
    row.lastChild.textContent = themeLabel(id);
    if (THEMES[id]) {
      const d = deriveTheme(THEMES[id]);
      const dots = document.createElement("span");
      dots.className = "swatches";
      // Los tonos que se ven de verdad en WhatsApp, no los de la paleta original.
      for (const color of [THEMES[id]["--card-bg"], d["--nwd-wall"], d["--nwd-out"], d["--nwd-accent"]]) {
        const dot = document.createElement("i");
        dot.style.background = color;
        dots.append(dot);
      }
      row.append(dots);
    }
    row.addEventListener("click", () => save({ theme: id }));
    list.append(row);
  }
}

function showThemes(open) {
  $("home").hidden = open;
  $("themes").hidden = !open;
}

// --- Arranque ---
document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
document.documentElement.lang = chrome.i18n.getUILanguage();
$("master").append(makeRow("enabled", t("enabled")));
rows.get("enabled").classList.add("master");
HIDE_KEYS.forEach((k) => $("hide").append(makeRow(k, t(k))));
BLUR_ROWS.forEach((k) => $("blur").append(makeRow(k, t(k))));

const setBlur = (value) => save(Object.fromEntries(BLUR_KEYS.map((k) => [k, value])));
$("all").addEventListener("click", () => setBlur(true));
$("none").addEventListener("click", () => setBlur(false));
$("openThemes").addEventListener("click", () => showThemes(true));
$("back").addEventListener("click", () => showThemes(false));
$("amount").addEventListener("input", (e) => {
  settings.blurAmount = Number(e.target.value);
  // storage.sync admite 120 escrituras por minuto: arrastrar el control sin esperar las agotaría.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.sync.set({ blurAmount: settings.blurAmount }), 150);
});

chrome.storage.sync.get(DEFAULTS, (values) => {
  settings = { ...DEFAULTS, ...values };
  render();
});
