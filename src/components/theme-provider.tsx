'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  ACCENT_STORAGE_KEY,
  applyAccentVars,
  getAccentByHex,
} from '@/lib/theme-colors';

type Accent = (typeof ACCENT_PRESETS)[number];

interface ThemeContextValue {
  accent: Accent;
  setAccent: (hex: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<Accent>(DEFAULT_ACCENT);

  // On mount, read persisted preference and apply immediately.
  useEffect(() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    const preset = saved ? getAccentByHex(saved) : DEFAULT_ACCENT;
    setAccentState(preset);
    applyAccentVars(preset.hex, preset.hsl);
  }, []);

  const setAccent = useCallback((hex: string) => {
    const preset = getAccentByHex(hex);
    setAccentState(preset);
    applyAccentVars(preset.hex, preset.hsl);
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
  }, []);

  return (
    <ThemeContext.Provider value={{ accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}
