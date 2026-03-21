// Accent colour presets — hex for display, hsl for CSS variable injection.
// CSS vars use bare HSL triplets (no hsl() wrapper) because Tailwind wraps them:
//   bg-primary → background: hsl(var(--primary))
// We also set --brand as a full hex value for direct use in inline styles.

export const ACCENT_PRESETS = [
  { label: 'Gold',   hex: '#c9963a', hsl: '39 57% 51%'  },
  { label: 'Navy',   hex: '#1e3a5f', hsl: '214 52% 24%' },
  { label: 'Purple', hex: '#7c3aed', hsl: '262 83% 58%' },
  { label: 'Teal',   hex: '#0d9488', hsl: '175 84% 32%' },
  { label: 'Rose',   hex: '#e11d48', hsl: '347 77% 50%' },
] as const;

export const DEFAULT_ACCENT = ACCENT_PRESETS[0];

export const ACCENT_STORAGE_KEY = 'faceshare_accent';

export function getAccentByHex(hex: string) {
  return ACCENT_PRESETS.find((a) => a.hex === hex) ?? DEFAULT_ACCENT;
}

/** Apply an accent preset to the document root as CSS variables. */
export function applyAccentVars(hex: string, hsl: string) {
  const root = document.documentElement.style;
  root.setProperty('--primary', hsl);
  root.setProperty('--accent', hsl);
  root.setProperty('--ring', hsl);
  root.setProperty('--sidebar-primary', hsl);
  root.setProperty('--sidebar-ring', hsl);
  root.setProperty('--brand', hex); // for direct inline-style use: var(--brand)
}
