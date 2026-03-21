'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { Image, ShieldCheck, Users, Loader2, Copy, Check, LogOut, ArrowLeft, AlertTriangle, Share2, Trash2, ImageIcon, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient, EventDetailResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleCopyCode = () => {
    if (!event) return;
    navigator.clipboard.writeText(event.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteEvent = async () => {
    setIsDeleting(true);
    try {
      await apiClient.deleteEvent(eventId);
      toast({
        title: `"${event?.name}" has been deleted`,
        description: 'All photos and participants were removed. S3 images will be purged within 7 days.',
      });
      router.push('/dashboard');
    } catch {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      toast({ variant: 'destructive', title: 'Deletion failed', description: 'Something went wrong. Try again.' });
    }
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
                  onClick={() => { setShowDeleteConfirm(false); setShowShareCard((v) => !v); }}
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
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.93 }}
                  animate={showDeleteConfirm
                    ? { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.5)', color: 'rgb(239,68,68)' }
                    : { backgroundColor: 'transparent', borderColor: 'rgba(239,68,68,0.25)', color: 'rgb(239,68,68)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onClick={() => { setShowShareCard(false); setShowDeleteConfirm((v) => !v); }}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium focus:outline-none"
                >
                  <motion.div
                    animate={showDeleteConfirm ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </motion.div>
                  Delete
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

        {/* Delete confirmation card — owner only */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              variants={confirmSlideDown}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-xl border border-destructive/30 bg-card overflow-hidden shadow-lg shadow-destructive/5">
                {/* red top bar */}
                <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-400" />

                <div className="px-5 py-4 space-y-4">
                  {/* header row */}
                  <div className="flex items-start gap-3">
                    <motion.div
                      animate={{ scale: [1, 1.12, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10"
                    >
                      <AlertTriangle className="h-4.5 w-4.5 text-destructive" style={{ width: 18, height: 18 }} />
                    </motion.div>
                    <div>
                      <p className="font-semibold text-sm text-foreground leading-tight">
                        Delete <span className="text-destructive">{event.name}</span>?
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This action is <span className="font-medium text-destructive">permanent</span> and cannot be undone.
                      </p>
                    </div>
                  </div>

                  {/* what gets deleted */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: ImageIcon, label: 'All photos', sub: 'deleted instantly' },
                      { icon: UserX,     label: 'Participants', sub: 'removed from event' },
                      { icon: Trash2,    label: 'S3 images', sub: 'purged in 7 days' },
                    ].map(({ icon: Icon, label, sub }) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-1 rounded-lg bg-destructive/5 border border-destructive/10 px-2 py-2.5 text-center"
                      >
                        <Icon className="h-4 w-4 text-destructive/70" />
                        <span className="text-[11px] font-semibold text-foreground leading-tight">{label}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{sub}</span>
                      </div>
                    ))}
                  </div>

                  {/* action row */}
                  <div className="flex justify-end gap-2 pt-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="text-muted-foreground"
                    >
                      Cancel
                    </Button>
                    <motion.button
                      whileHover={{ scale: 1.03, boxShadow: '0 4px 20px rgba(239,68,68,0.35)' }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      disabled={isDeleting}
                      onClick={handleDeleteEvent}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-1.5 text-sm font-semibold text-destructive-foreground shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isDeleting
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                      {isDeleting ? 'Deleting…' : 'Delete Permanently'}
                    </motion.button>
                  </div>
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
