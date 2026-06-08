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

export function blend(startHex, endHex, ratio) {
  const from = hexToRgb(startHex);
  const to = hexToRgb(endHex);
  const t = clamp(ratio, 0, 1);

  return rgbToHex({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  });
}

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (value) => {
    const channel = value / 255;
    if (channel <= 0.03928) return channel / 12.92;
    return ((channel + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
}

export function contrastText(backgroundHex, darkText = "#0f172a", lightText = "#ffffff") {
  return luminance(backgroundHex) > 0.56 ? darkText : lightText;
}

export function toHslString(hex) {
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
