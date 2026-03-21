'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Check } from 'lucide-react';
import { ACCENT_PRESETS } from '@/lib/theme-colors';
import { useTheme } from '@/components/theme-provider';

export function AccentPicker() {
  const { accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-xl"
            style={{ borderColor: '#e8e2d9' }}
          >
            {ACCENT_PRESETS.map((preset) => (
              <motion.button
                key={preset.hex}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="relative flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-2 ring-transparent transition-shadow"
                style={{
                  background: preset.hex,
                  outline: accent.hex === preset.hex ? `3px solid ${preset.hex}` : '3px solid transparent',
                  outlineOffset: '2px',
                }}
                title={preset.label}
                onClick={() => { setAccent(preset.hex); setOpen(false); }}
              >
                {accent.hex === preset.hex && (
                  <Check className="h-4 w-4 text-white drop-shadow" />
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1, rotate: 15 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg text-white"
        style={{ background: accent.hex }}
        onClick={() => setOpen((v) => !v)}
        title="Change accent colour"
      >
        <Palette className="h-5 w-5" />
      </motion.button>
    </div>
  );
}
