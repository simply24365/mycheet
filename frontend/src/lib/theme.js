export const DEFAULT_THEME_ID = "obsidian";

const STORAGE_KEY = "mycheet.theme";

const COMMON_THEME_SEEDS = [
  { id: "obsidian", name: "Obsidian", accent: "#f8fafc" },
  { id: "graphite", name: "Graphite", accent: "#cbd5e1" },
  { id: "ruby", name: "Ruby", accent: "#ef4444" },
  { id: "ember", name: "Ember", accent: "#f97316" },
  { id: "amber", name: "Amber", accent: "#f59e0b" },
  { id: "citron", name: "Citron", accent: "#eab308" },
  { id: "lime", name: "Lime", accent: "#84cc16" },
  { id: "moss", name: "Moss", accent: "#65a30d" },
  { id: "green", name: "Green", accent: "#22c55e" },
  { id: "emerald", name: "Emerald", accent: "#10b981" },
  { id: "teal", name: "Teal", accent: "#14b8a6" },
  { id: "cyan", name: "Cyan", accent: "#06b6d4" },
  { id: "sky", name: "Sky", accent: "#38bdf8" },
  { id: "blue", name: "Blue", accent: "#3b82f6" },
  { id: "navy", name: "Navy", accent: "#1d4ed8" },
  { id: "indigo", name: "Indigo", accent: "#6366f1" },
  { id: "violet", name: "Violet", accent: "#8b5cf6" },
  { id: "purple", name: "Purple", accent: "#a855f7" },
  { id: "fuchsia", name: "Fuchsia", accent: "#d946ef" },
  { id: "pink", name: "Pink", accent: "#ec4899" },
  { id: "rose", name: "Rose", accent: "#f43f5e" },
  { id: "coral", name: "Coral", accent: "#fb7185" },
  { id: "copper", name: "Copper", accent: "#c2410c" },
  { id: "mocha", name: "Mocha", accent: "#8b5e3c" },
];

const PASTEL_THEME_SEEDS = [
  { id: "pastel-cloud", name: "Cloud", accent: "#e2e8f0" },
  { id: "pastel-fog", name: "Fog", accent: "#d8dee9" },
  { id: "pastel-mist", name: "Mist", accent: "#dbeafe" },
  { id: "pastel-skywash", name: "Skywash", accent: "#bfdbfe" },
  { id: "pastel-periwinkle", name: "Periwinkle", accent: "#c7d2fe" },
  { id: "pastel-lavender", name: "Lavender", accent: "#ddd6fe" },
  { id: "pastel-lilac", name: "Lilac", accent: "#e9d5ff" },
  { id: "pastel-orchid", name: "Orchid", accent: "#f5d0fe" },
  { id: "pastel-blush", name: "Blush", accent: "#fbcfe8" },
  { id: "pastel-petal", name: "Petal", accent: "#fecdd3" },
  { id: "pastel-peach", name: "Peach", accent: "#fed7aa" },
  { id: "pastel-apricot", name: "Apricot", accent: "#fde2c0" },
  { id: "pastel-butter", name: "Butter", accent: "#fef3c7" },
  { id: "pastel-lemon", name: "Lemon", accent: "#fef9c3" },
  { id: "pastel-pistachio", name: "Pistachio", accent: "#d9f99d" },
  { id: "pastel-sage", name: "Sage", accent: "#dcfce7" },
  { id: "pastel-mint", name: "Mint", accent: "#ccfbf1" },
  { id: "pastel-seafoam", name: "Seafoam", accent: "#a7f3d0" },
  { id: "pastel-aqua", name: "Aqua", accent: "#cffafe" },
  { id: "pastel-glacier", name: "Glacier", accent: "#e0f2fe" },
  { id: "pastel-oat", name: "Oat", accent: "#f5f1e8" },
  { id: "pastel-sand", name: "Sand", accent: "#ead7b7" },
  { id: "pastel-clay", name: "Clay", accent: "#f2d1c9" },
  { id: "pastel-melon", name: "Melon", accent: "#fdc9b6" },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex) {
  const value = String(hex || "").trim().replace("#", "");
  if (value.length === 3) {
    return `#${value.split("").map(part => part + part).join("")}`;
  }
  return `#${value.padEnd(6, "0").slice(0, 6)}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const parts = [r, g, b].map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"));
  return `#${parts.join("")}`;
}

function blend(startHex, endHex, ratio) {
  const from = hexToRgb(startHex);
  const to = hexToRgb(endHex);
  const t = clamp(ratio, 0, 1);

  return rgbToHex({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  });
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (value) => {
    const channel = value / 255;
    if (channel <= 0.03928) return channel / 12.92;
    return ((channel + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
}

function contrastText(backgroundHex, darkText = "#0f172a", lightText = "#ffffff") {
  return luminance(backgroundHex) > 0.56 ? darkText : lightText;
}

function toHslString(hex) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = ((blue - red) / delta) + 2;
    else hue = ((red - green) / delta) + 4;
  }

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs((2 * lightness) - 1));

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function toCssColor(hslValue) {
  return `hsl(${hslValue})`;
}

function buildCommonTheme(seed) {
  const accent = seed.accent;
  const background = seed.id === DEFAULT_THEME_ID ? "#060709" : blend("#050608", accent, 0.10);
  const card = seed.id === DEFAULT_THEME_ID ? "#0b0d11" : blend("#0b0d11", accent, 0.14);
  const secondary = seed.id === DEFAULT_THEME_ID ? "#12161d" : blend("#12161d", accent, 0.20);
  const muted = seed.id === DEFAULT_THEME_ID ? "#181d25" : blend("#181d25", accent, 0.25);
  const accentSurface = seed.id === DEFAULT_THEME_ID ? "#1e2531" : blend(secondary, accent, 0.18);
  const border = seed.id === DEFAULT_THEME_ID ? "#27303d" : blend("#27303d", accent, 0.28);
  const foreground = seed.id === DEFAULT_THEME_ID ? "#f8fafc" : blend("#f8fafc", accent, 0.08);
  const mutedForeground = seed.id === DEFAULT_THEME_ID ? "#94a3b8" : blend("#94a3b8", accent, 0.12);
  const primary = seed.id === DEFAULT_THEME_ID ? "#f8fafc" : accent;
  const ring = seed.id === DEFAULT_THEME_ID ? "#e2e8f0" : blend(accent, "#ffffff", 0.18);

  const tokens = {
    background: toHslString(background),
    foreground: toHslString(foreground),
    card: toHslString(card),
    "card-foreground": toHslString(foreground),
    popover: toHslString(card),
    "popover-foreground": toHslString(foreground),
    primary: toHslString(primary),
    "primary-foreground": toHslString(contrastText(primary)),
    secondary: toHslString(secondary),
    "secondary-foreground": toHslString(foreground),
    muted: toHslString(muted),
    "muted-foreground": toHslString(mutedForeground),
    accent: toHslString(accentSurface),
    "accent-foreground": toHslString(foreground),
    destructive: toHslString("#dc2626"),
    "destructive-foreground": toHslString("#ffffff"),
    border: toHslString(border),
    input: toHslString(border),
    ring: toHslString(ring),
    radius: "0.75rem",
  };

  return {
    id: seed.id,
    name: seed.name,
    group: "common",
    groupLabel: "보편",
    mode: "dark",
    tokens,
    preview: {
      background: toCssColor(tokens.background),
      surface: toCssColor(tokens.secondary),
      accent: toCssColor(tokens.primary),
      border: toCssColor(tokens.border),
      text: toCssColor(tokens.foreground),
    },
  };
}

function buildPastelTheme(seed) {
  const accent = seed.accent;
  const background = blend("#ffffff", accent, 0.12);
  const card = blend("#ffffff", accent, 0.18);
  const secondary = blend("#ffffff", accent, 0.24);
  const muted = blend("#ffffff", accent, 0.31);
  const accentSurface = blend("#ffffff", accent, 0.40);
  const border = blend("#cbd5e1", accent, 0.34);
  const foreground = blend("#111827", accent, 0.08);
  const mutedForeground = blend("#475569", accent, 0.12);
  const primary = blend(accent, "#111827", 0.14);
  const ring = blend(primary, "#ffffff", 0.12);

  const tokens = {
    background: toHslString(background),
    foreground: toHslString(foreground),
    card: toHslString(card),
    "card-foreground": toHslString(foreground),
    popover: toHslString(card),
    "popover-foreground": toHslString(foreground),
    primary: toHslString(primary),
    "primary-foreground": toHslString(contrastText(primary)),
    secondary: toHslString(secondary),
    "secondary-foreground": toHslString(foreground),
    muted: toHslString(muted),
    "muted-foreground": toHslString(mutedForeground),
    accent: toHslString(accentSurface),
    "accent-foreground": toHslString(foreground),
    destructive: toHslString("#dc2626"),
    "destructive-foreground": toHslString("#ffffff"),
    border: toHslString(border),
    input: toHslString(border),
    ring: toHslString(ring),
    radius: "0.75rem",
  };

  return {
    id: seed.id,
    name: seed.name,
    group: "pastel",
    groupLabel: "파스텔",
    mode: "light",
    tokens,
    preview: {
      background: toCssColor(tokens.background),
      surface: toCssColor(tokens.secondary),
      accent: toCssColor(tokens.primary),
      border: toCssColor(tokens.border),
      text: toCssColor(tokens.foreground),
    },
  };
}

export const COMMON_THEME_PRESETS = COMMON_THEME_SEEDS.map(buildCommonTheme);
export const PASTEL_THEME_PRESETS = PASTEL_THEME_SEEDS.map(buildPastelTheme);
export const THEME_PRESETS = [...COMMON_THEME_PRESETS, ...PASTEL_THEME_PRESETS];

const themeById = new Map(THEME_PRESETS.map(theme => [theme.id, theme]));

export function getThemePreset(themeId) {
  return themeById.get(themeId) || themeById.get(DEFAULT_THEME_ID);
}

export function resolveThemeId(payload) {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    if (typeof payload.data === "string" && payload.data.trim()) return payload.data;
    if (typeof payload?.[0] === "string" && payload[0].trim()) return payload[0];
  }
  return DEFAULT_THEME_ID;
}

export function getStoredThemeId() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function applyTheme(themeId = DEFAULT_THEME_ID) {
  const theme = getThemePreset(themeId);

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    Object.entries(theme.tokens).forEach(([token, value]) => {
      root.style.setProperty(`--${token}`, value);
    });
    root.style.colorScheme = theme.mode;
    root.dataset.theme = theme.id;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // Ignore storage failures in embedded webviews.
  }

  return theme;
}

export function applyStoredTheme() {
  return applyTheme(getStoredThemeId());
}