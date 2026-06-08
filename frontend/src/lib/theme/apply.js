import { DEFAULT_THEME_ID, STORAGE_KEY } from "./constants";
import { getThemePreset } from "./presets";

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
