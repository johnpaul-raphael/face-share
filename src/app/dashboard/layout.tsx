import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarInset,
} from '@/components/ui/sidebar';
import { UserNav } from '@/components/user-nav';
import AppLogo from '@/components/app-logo';
import { DashboardNav } from '@/components/dashboard-nav';
import { MobileNav } from '@/components/mobile-nav';
import PageTransition from '@/components/page-transition';
import { MotionHeaderButton } from '@/components/motion-header-button';
import { AccentPicker } from '@/components/accent-picker';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <Sidebar className="hidden md:flex">
        <SidebarHeader>
          <div className="flex h-12 items-center px-3">
            <AppLogo />
          </div>
        </SidebarHeader>
        <DashboardNav />
      </Sidebar>

      <SidebarInset>
        {/* ── Header ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 sm:px-6"
          style={{ borderColor: '#e8e2d9' }}>
          {/* Mobile: logo on left */}
          <div className="md:hidden">
            <AppLogo />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Join event button — desktop only (mobile uses FAB) */}
            <div className="hidden md:block">
              <MotionHeaderButton href="/dashboard/events/join" />
            </div>
            <UserNav />
          </div>
        </header>

        {/* ── Page content — extra bottom padding on mobile for bottom nav ── */}
        <main className="flex-1 overflow-auto p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>

        {/* ── AccentPicker — hidden on mobile (sits above bottom nav awkwardly) ── */}
        <div className="hidden md:block">
          <AccentPicker />
        </div>
      </SidebarInset>

      {/* ── Mobile bottom navigation ── */}
      <MobileNav />
    </SidebarProvider>
  );
}
