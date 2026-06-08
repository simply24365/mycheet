import { DEFAULT_THEME_ID, STORAGE_KEY } from "./constants";
import { blend, contrastText, toCssColor, toHslString } from "./color";
import { COMMON_THEME_SEEDS, PASTEL_THEME_SEEDS } from "./seeds";

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
