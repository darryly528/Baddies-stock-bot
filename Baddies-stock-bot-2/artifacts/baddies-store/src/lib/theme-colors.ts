export function applyThemeColors(primaryHex: string, secondaryHex: string) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", primaryHex);
  root.style.setProperty("--color-ring", primaryHex);
  root.style.setProperty("--color-accent-foreground", primaryHex);
  root.style.setProperty("--color-secondary", secondaryHex);

  const hex = primaryHex.replace("#", "");
  if (hex.length !== 6) return;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  root.style.setProperty("--color-accent", `rgba(${r}, ${g}, ${b}, 0.15)`);
  root.style.setProperty("--accent-r", String(r));
  root.style.setProperty("--accent-g", String(g));
  root.style.setProperty("--accent-b", String(b));

  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : l < 0.5 ? d / (max + min) : d / (2 - max - min);
  const h =
    d === 0 ? 0
    : max === rN ? ((gN - bN) / d + (gN < bN ? 6 : 0)) / 6
    : max === gN ? ((bN - rN) / d + 2) / 6
    : ((rN - gN) / d + 4) / 6;
  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);

  const shades: [string, number][] = [
    ["200", 85], ["300", 74], ["400", 64], ["500", 54], ["600", 44], ["700", 36],
  ];
  const families = ["violet", "purple", "fuchsia", "pink"];
  for (const [shade, lightness] of shades) {
    const val = `hsl(${hDeg} ${Math.max(sPct, 70)}% ${lightness}%)`;
    for (const name of families) {
      root.style.setProperty(`--color-${name}-${shade}`, val);
    }
  }

  root.style.setProperty("--gradient-end", secondaryHex);
}
