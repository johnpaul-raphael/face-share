'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Image as ImageIcon, User, Plus, X, Users, CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import { useMyPhotosBadge } from '@/hooks/use-my-photos-badge';

const TABS = [
  { href: '/dashboard',           label: 'Home',    icon: Home                    },
  { href: '/dashboard/my-photos', label: 'Photos',  icon: ImageIcon, badge: true  },
  null, // FAB center slot
  { href: '/dashboard/profile',   label: 'Profile', icon: User                    },
] as const;

const FAB_ACTIONS = [
  { href: '/dashboard/events/join',   label: 'Join Event',   icon: Users,        color: 'bg-card border-2 border-primary text-primary' },
  { href: '/dashboard/events/create', label: 'Create Event', icon: CalendarPlus, color: 'bg-primary text-primary-foreground'            },
];

export function MobileNav() {
  const pathname     = usePathname();
  const { newCount } = useMyPhotosBadge();
  const [fabOpen, setFabOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
            onClick={() => setFabOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* FAB action cards */}
      <AnimatePresence>
        {fabOpen && (
          <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 flex flex-col gap-2.5 items-center md:hidden">
            {FAB_ACTIONS.map((action, i) => (
              <motion.div
                key={action.href}
                initial={{ opacity: 0, y: 16, scale: 0.88 }}
                animate={{ opacity: 1, y: 0,  scale: 1    }}
                exit={{    opacity: 0, y: 16, scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30, delay: i * 0.07 }}
              >
                <Link href={action.href} onClick={() => setFabOpen(false)}>
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-3 rounded-2xl px-6 py-3.5 shadow-xl ${action.color}`}
                    style={{ minWidth: 190 }}
                  >
                    <action.icon className="h-5 w-5 shrink-0" />
                    <span className="font-semibold text-sm">{action.label}</span>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ── Bottom bar ─────────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t bg-card"
        style={{ borderColor: '#e8e2d9', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Single row, all items stretch to same height */}
        <div className="flex h-16 items-stretch">

          {TABS.map((tab, i) => {

            /* ── FAB center slot ── */
            if (tab === null) {
              return (
                <div key="fab" className="flex flex-1 items-center justify-center">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    onClick={() => setFabOpen((v) => !v)}
                    /* float button 18px above bar using negative margin */
                    className="relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
                    style={{ background: '#0f1a2e' }}
                  >
                    <motion.div
                      animate={{ rotate: fabOpen ? 45 : 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                    >
                      {fabOpen
                        ? <X    className="h-6 w-6 text-white"                        />
                        : <Plus className="h-6 w-6" style={{ color: '#c9963a' }}      />
                      }
                    </motion.div>

                    {/* Pulse ring */}
                    {!fabOpen && (
                      <motion.div
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{ border: '2px solid rgba(201,150,58,0.45)' }}
                        animate={{ scale: [1, 1.28, 1], opacity: [0.7, 0, 0.7] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                  </motion.button>
                </div>
              );
            }

            /* ── Regular tab ── */
            const active     = isActive(tab.href);
            const showBadge  = 'badge' in tab && tab.badge && newCount > 0;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setFabOpen(false)}
                className="flex flex-1 flex-col items-center justify-center gap-1"
              >
                {/* Icon */}
                <div className="relative">
                  <motion.div
                    animate={{ scale: active ? 1.18 : 1, y: active ? -1 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <tab.icon
                      className="h-5 w-5"
                      style={{ color: active ? 'var(--brand, #c9963a)' : '#9ca3af' }}
                    />
                  </motion.div>

                  {/* Badge */}
                  <AnimatePresence>
                    {showBadge && (
                      <motion.span
                        key="badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white"
                      >
                        {newCount > 9 ? '9+' : newCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Label */}
                <span
                  className="text-[10px] font-medium leading-none"
                  style={{ color: active ? 'var(--brand, #c9963a)' : '#9ca3af' }}
                >
                  {tab.label}
                </span>

                {/* Active underline dot */}
                <motion.div
                  className="h-0.5 w-4 rounded-full"
                  animate={{ scaleX: active ? 1 : 0, opacity: active ? 1 : 0 }}
                  style={{ background: 'var(--brand, #c9963a)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
