'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Image as ImageIcon, User, Settings } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useMyPhotosBadge } from '@/hooks/use-my-photos-badge';

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Dashboard', icon: Home,      badge: false },
  { href: '/dashboard/my-photos',  label: 'My Photos', icon: ImageIcon, badge: true  },
  { href: '/dashboard/profile',    label: 'Profile',   icon: User,      badge: false },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { newCount } = useMyPhotosBadge();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      <SidebarContent>
        <SidebarMenu>
          {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(href);
            const showBadge = badge && newCount > 0;

            return (
              <SidebarMenuItem key={href}>
                <Link
                  href={href}
                  onClick={handleNavClick}
                  className={[
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors select-none outline-none',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {/* Sliding background pill */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-lg bg-primary/10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  {/* Icon with badge */}
                  <motion.span
                    className="relative z-10"
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <Icon className="h-4 w-4" />
                    <AnimatePresence>
                      {showBadge && (
                        <motion.span
                          key="badge"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white shadow"
                        >
                          {newCount > 9 ? '9+' : newCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.span>

                  <span className="relative z-10 flex-1">{label}</span>

                  {/* Inline count chip */}
                  <AnimatePresence>
                    {showBadge && (
                      <motion.span
                        key="chip"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="relative z-10 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white"
                      >
                        +{newCount} new
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </motion.button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
