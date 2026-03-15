'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { Image, ShieldCheck, Users, Loader2, Copy, Check, LogOut, ArrowLeft, AlertTriangle, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient, EventDetailResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { confirmSlideDown } from '@/lib/animations';
import PageTransition from '@/components/page-transition';
import { ShareEventCard } from '@/components/share-event-card';

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const basePath = `/dashboard/events/${eventId}`;

  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  const handleCopyCode = () => {
    if (!event) return;
    navigator.clipboard.writeText(event.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveEvent = async () => {
    if (!currentUserId) return;
    setIsLeaving(true);
    try {
      await apiClient.leaveEvent(eventId, currentUserId);
      router.push('/dashboard');
    } catch {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  useEffect(() => {
    Promise.all([
      apiClient.getEvent(eventId),
      apiClient.getCurrentUser(),
    ])
      .then(([ev, me]) => {
        setEvent(ev);
        setCurrentUserId(me.id);
      })
      .catch(() => { })
      .finally(() => setIsLoading(false));
  }, [eventId]);

  const isOwner = event?.owner_id === currentUserId;

  const navItems = [
    { href: basePath, label: 'Gallery', icon: Image },
    ...(isOwner ?
      [{ href: `${basePath}/review`, label: 'Review', icon: ShieldCheck },
      { href: `${basePath}/participants`, label: 'Participants', icon: Users },] : []),
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Event not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <div className="flex items-center gap-3 flex-wrap justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-bold">{event.name}</h1>
            {isOwner && (
              <>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-sm font-mono font-semibold tracking-widest hover:bg-muted/80 transition-colors"
                  title="Click to copy join code"
                >
                  {event.join_code}
                  {copied
                    ? <Check className="h-3.5 w-3.5 text-green-500" />
                    : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onClick={() => setShowShareCard((v) => !v)}
                  className={[
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium transition-colors',
                    showShareCard
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card hover:bg-muted border-border',
                  ].join(' ')}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </motion.button>
              </>
            )}
          </div>

          {/* Leave Event — participants only */}
          {!isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
              onClick={() => setShowLeaveConfirm((v) => !v)}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Leave Event
            </Button>
          )}
        </div>

        {/* Inline motion confirmation strip */}
        <AnimatePresence>
          {showLeaveConfirm && (
            <motion.div
              variants={confirmSlideDown}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5 sm:mt-0" />
                <p className="flex-1 text-sm text-foreground">
                  You will lose access to all photos in <strong>{event.name}</strong>. You can rejoin using the join code.
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={() => setShowLeaveConfirm(false)}
                    disabled={isLeaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 sm:flex-none"
                    onClick={handleLeaveEvent}
                    disabled={isLeaving}
                  >
                    {isLeaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Leave Event
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share event card */}
        <AnimatePresence>
          {showShareCard && (
            <motion.div
              variants={confirmSlideDown}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden mt-3"
            >
              <ShareEventCard event={event} onClose={() => setShowShareCard(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-muted-foreground mt-1">{event.description}</p>
      </div>
      <div className="mb-4 border-b overflow-x-auto">
        <nav className="-mb-px flex space-x-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== basePath && pathname.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap px-3 pb-4 pt-1 text-sm font-medium transition-colors select-none',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <motion.span
                  animate={{ scale: isActive ? 1.05 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="flex items-center gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </motion.span>
                {isActive && (
                  <motion.div
                    layoutId="event-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-1"><PageTransition>{children}</PageTransition></div>
    </div>
  );
}
