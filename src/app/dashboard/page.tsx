'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Users, ArrowRight, CalendarDays, Crown, Sparkles, ImageIcon, Clock, Search, X } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import useSWR from 'swr';
import { apiClient, EventResponse, MyPhotosGroup } from '@/lib/api';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { staggerContainer, staggerItem, fadeInUp, fadeInLeft, fadeInRight } from '@/lib/animations';

/* ── helpers ──────────────────────────────────────────────────────────── */
function greeting(): [string, string] {
  const h = new Date().getHours();
  if (h < 12) return ['Good morning', '☀️'];
  if (h < 17) return ['Good afternoon', '🌤️'];
  return ['Good evening', '🌙'];
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  <  1) return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const GRADIENT_PALETTES = [
  'from-violet-400 to-purple-600',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-orange-400 to-rose-500',
  'from-pink-400 to-fuchsia-600',
  'from-amber-400 to-orange-500',
];

function eventGradient(name: string) {
  return GRADIENT_PALETTES[name.charCodeAt(0) % GRADIENT_PALETTES.length];
}

/* ── AnimatedCount — count-up when scrolled into view ────────────────── */
function AnimatedCount({ value }: { value: number }) {
  const ref      = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;           // stay at 0 until scrolled into view
    if (value === 0) { setDisplay(0); return; }
    const startTime = performance.now();
    const duration  = 850;
    const tick = (now: number) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setDisplay(Math.round(eased * value));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    let rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isInView, value]);

  return <span ref={ref}>{display}</span>;
}

/* ── EventCard ────────────────────────────────────────────────────────── */
function EventCard({
  event, isOwner, myPhotoCount,
}: {
  event: EventResponse; isOwner: boolean; myPhotoCount: number;
}) {
  return (
    <Link href={`/dashboard/events/${event.id}`}>
      <motion.div
        variants={staggerItem}
        whileHover={{ y: -6, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm hover:shadow-lg transition-shadow"
        style={{ borderColor: '#e8e2d9' }}
      >
        {/* Cover image */}
        <div className="relative h-40 overflow-hidden">
          {event.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.cover_image_url}
              alt={event.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${eventGradient(event.name)}`}>
              <span className="text-5xl font-black text-white/30 select-none">
                {event.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Gradient fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Owner / Member badge */}
          <div className="absolute top-3 left-3">
            {isOwner ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                <Crown className="h-3 w-3" /> Owner
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                <Users className="h-3 w-3" /> Member
              </span>
            )}
          </div>

          {/* Bottom-right: participant count */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-white/90 font-medium">
            <Users className="h-3.5 w-3.5" />
            {event.participant_count}
          </div>

          {/* Bottom-left: "X photos of you" badge — appears when we have matches */}
          {myPhotoCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-primary/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white shadow"
            >
              <ImageIcon className="h-2.5 w-2.5" />
              {myPhotoCount} of you
            </motion.div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-1 p-3.5">
          <h3 className="font-semibold leading-snug line-clamp-1 text-sm">{event.name}</h3>
          {event.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {event.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-3.5 py-2.5 gap-2" style={{ borderColor: '#f0ece5' }}>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
            <Clock className="h-3 w-3 shrink-0" />
            {relativeTime(event.updated_at ?? event.created_at)}
          </span>
          <motion.div
            whileHover={{ x: 3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="shrink-0"
          >
            <ArrowRight className="h-4 w-4 text-primary" />
          </motion.div>
        </div>
      </motion.div>
    </Link>
  );
}

/* ── CreateCard ───────────────────────────────────────────────────────── */
function CreateCard() {
  return (
    <Link href="/dashboard/events/create">
      <motion.div
        variants={staggerItem}
        whileHover={{ y: -6, scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
        whileTap={{ scale: 0.98 }}
        className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors hover:border-primary/50 hover:bg-primary/5"
        style={{ borderColor: '#e8e2d9' }}
      >
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
          whileHover={{ rotate: 90, scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Plus className="h-6 w-6 text-primary" />
        </motion.div>
        <div className="text-center">
          <p className="text-sm font-semibold">New Event</p>
          <p className="text-xs text-muted-foreground mt-0.5">Create & share photos</p>
        </div>
      </motion.div>
    </Link>
  );
}

/* ── main page ────────────────────────────────────────────────────────── */
const TABS = ['All', 'My Events', 'Joined'] as const;
type Tab = (typeof TABS)[number];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [greetText, greetEmoji] = greeting();

  const { data: events = [], isLoading: eventsLoading, error: eventsError } =
    useSWR('events', () => apiClient.listEvents());
  const { data: user = null, isLoading: userLoading } =
    useSWR<User | null>('current-user', () => apiClient.getCurrentUser());
  const { data: myPhotos = [] } =
    useSWR<MyPhotosGroup[]>('my-photos', () => apiClient.getMyPhotos().catch(() => []));

  const isLoading = eventsLoading || userLoading;

  useEffect(() => {
    if (eventsError) toast({ variant: 'destructive', title: 'Dashboard couldn\'t load', description: 'Refresh the page to try again.' });
  }, [eventsError, toast]);

  const myPhotoCountByEvent = Object.fromEntries(
    myPhotos.map((g) => [g.event_id, g.photos.length])
  );

  const owned  = events.filter((e) => e.owner_id === user?.id);
  const joined = events.filter((e) => e.owner_id !== user?.id);
  const tabFiltered = activeTab === 'My Events' ? owned : activeTab === 'Joined' ? joined : events;
  const visible = searchQuery
    ? tabFiltered.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tabFiltered;
  const hasActiveSearch = searchQuery.length > 0;

  /* ── loading skeleton ─────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0,1,2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">

      {/* ── Greeting ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <motion.span
            className="text-3xl leading-none"
            animate={{ rotate: [0, 12, -8, 12, 0] }}
            transition={{ duration: 1.2, delay: 0.4, ease: 'easeInOut' }}
          >
            {greetEmoji}
          </motion.span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {greetText}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 pl-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {formatDate()}
        </p>
      </motion.div>

      {/* ── Quick-action tiles ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div variants={fadeInLeft} initial="hidden" animate="visible">
          <Link href="/dashboard/events/create">
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="relative overflow-hidden rounded-2xl p-5 text-white shadow-md"
              style={{ background: '#0f1a2e' }}
            >
              <div className="pointer-events-none absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle at 70% 20%, #c9963a 0%, transparent 60%)' }} />
              <Plus className="mb-3 h-6 w-6" style={{ color: '#c9963a' }} />
              <p className="font-semibold text-sm">Create Event</p>
              <p className="text-[11px] mt-0.5 text-white/60">Set up your event</p>
              <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-white/30" />
            </motion.div>
          </Link>
        </motion.div>

        <motion.div variants={fadeInRight} initial="hidden" animate="visible">
          <Link href="/dashboard/events/join">
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="relative overflow-hidden rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow"
              style={{ background: 'white', borderColor: '#e8e2d9' }}
            >
              <Users className="mb-3 h-6 w-6 text-primary" />
              <p className="font-semibold text-sm">Join Event</p>
              <p className="text-[11px] mt-0.5 text-muted-foreground">Enter a join code</p>
              <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/40" />
            </motion.div>
          </Link>
        </motion.div>
      </div>

      {/* ── Stats strip — count-up on scroll ──────────────────────────── */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        {[
          { label: 'Total Events', value: events.length, icon: CalendarDays },
          { label: 'My Events',    value: owned.length,  icon: Crown        },
          { label: 'Joined',       value: joined.length, icon: Users        },
        ].map(({ label, value, icon: Icon }) => (
          <motion.div
            key={label}
            variants={staggerItem}
            whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
            className="rounded-2xl border bg-card p-3.5 text-center shadow-sm cursor-default"
            style={{ borderColor: '#e8e2d9' }}
          >
            <motion.div
              className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Icon className="h-4 w-4 text-primary" />
            </motion.div>
            <p className="text-2xl font-bold tabular-nums">
              <AnimatedCount value={value} />
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Events section ────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Section header + tab switcher */}
        <motion.div
          className="flex flex-wrap items-center justify-between gap-3"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          <h2 className="text-lg font-semibold">Your Events</h2>

          <div className="flex rounded-xl bg-muted p-1 text-sm font-medium">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative rounded-lg px-3 py-1 transition-colors"
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-lg bg-card shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 ${activeTab === tab ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {tab}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="relative"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events…"
            className="w-full rounded-xl border bg-background/60 backdrop-blur-sm py-2.5 pl-10 pr-10 text-[16px] sm:text-sm outline-none ring-0 transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          <AnimatePresence>
            {hasActiveSearch && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Result count — only shown when searching */}
        <AnimatePresence>
          {hasActiveSearch && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-muted-foreground overflow-hidden"
            >
              {visible.length === 0
                ? `No events match "${searchQuery}"`
                : `${visible.length} event${visible.length !== 1 ? 's' : ''} found`}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Cards grid — stagger on scroll */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            {visible.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isOwner={event.owner_id === user?.id}
                myPhotoCount={myPhotoCountByEvent[event.id] ?? 0}
              />
            ))}
            <CreateCard />
          </motion.div>
        </AnimatePresence>

        {/* Empty state */}
        {visible.length === 0 && (
          <motion.div
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-16"
            style={{ borderColor: '#e8e2d9' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
              animate={hasActiveSearch ? {} : { y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              {hasActiveSearch
                ? <Search className="h-8 w-8 text-primary" />
                : <Sparkles className="h-8 w-8 text-primary" />}
            </motion.div>
            <div className="text-center">
              <p className="font-semibold">
                {hasActiveSearch ? `No results for "${searchQuery}"` : 'No events here yet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveSearch ? 'Try a different search term.' :
                 activeTab === 'My Events' ? 'Create your first event to get started.' :
                 activeTab === 'Joined'    ? 'Join an event using a code from your organiser.' :
                                            'Create or join an event to get started.'}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
