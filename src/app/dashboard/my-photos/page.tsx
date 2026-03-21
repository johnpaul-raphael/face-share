'use client';

import { useEffect, useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Download, Image as ImageIcon, X, ChevronLeft, ChevronRight,
  Sparkles, Loader2, ZoomIn, ShieldCheck, ShieldAlert, ShieldQuestion,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiClient } from '@/lib/api';
import type { MyPhotosGroup, MyPhotoEntry } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useMyPhotosBadge } from '@/hooks/use-my-photos-badge';
import { fadeInUp, fadeInScale, staggerContainer, staggerItem } from '@/lib/animations';

/* ── types ────────────────────────────────────────────────────────────── */
type LightboxState = { groupIndex: number; photoIndex: number } | null;

/* ── helpers ──────────────────────────────────────────────────────────── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeName(eventName: string, photoId: string) {
  return `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_${photoId}.jpg`;
}

function confidenceLevel(score: number): { label: string; color: string; bg: string; Icon: React.ElementType } {
  if (score >= 90) return { label: `${Math.round(score)}% match`, color: '#16a34a', bg: 'rgba(22,163,74,0.18)', Icon: ShieldCheck };
  if (score >= 75) return { label: `${Math.round(score)}% match`, color: '#d97706', bg: 'rgba(217,119,6,0.18)', Icon: ShieldQuestion };
  return { label: `${Math.round(score)}% match`, color: '#dc2626', bg: 'rgba(220,38,38,0.18)', Icon: ShieldAlert };
}

/* ── useDownload ──────────────────────────────────────────────────────── */
function useDownload() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const downloadImage = useCallback(async (url: string, name: string, id: string) => {
    setDownloading(prev => new Set(prev).add(id));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast({ variant: 'destructive', title: 'Download hit a snag', description: 'Couldn\'t save this photo — try again.' });
    } finally {
      setDownloading(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [toast]);

  return { downloadImage, downloading };
}

/* ── PhotoCard ────────────────────────────────────────────────────────── */
function PhotoCard({
  photo, groupName, onOpen, downloadImage, downloading,
}: {
  photo: MyPhotoEntry;
  groupName: string;
  onOpen: () => void;
  downloadImage: (url: string, name: string, id: string) => void;
  downloading: Set<string>;
}) {
  const isDownloading = downloading.has(photo.photo_id);
  const name = safeName(groupName, photo.photo_id);

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className="group relative overflow-hidden rounded-2xl bg-muted shadow-sm hover:shadow-xl transition-shadow"
      style={{ aspectRatio: '3/4' }}
    >
      {photo.is_processing ? (
        /* ── Processing state ── */
        <div className="h-full w-full flex flex-col items-center justify-center gap-3">
          <motion.div
            className="relative flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'rgba(201,150,58,0.12)' }}
          >
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#c9963a' }} />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(201,150,58,0.3)' }}
              animate={{ scale: [1, 1.45, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            />
          </motion.div>
          <p className="text-[10px] font-medium text-muted-foreground">Processing…</p>
        </div>
      ) : photo.url ? (
        /* ── Photo loaded ── */
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={`Photo from ${groupName}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
            onClick={onOpen}
          />

          {/* Gradient overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
            onClick={onOpen}
          />

          {/* Date — top-left on hover */}
          <div className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <span className="rounded-full bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[9px] text-white/80">
              {formatDate(photo.uploaded_at)}
            </span>
          </div>

          {/* Confidence badge — always visible, bottom-left */}
          {photo.confidence > 0 && (() => {
            const { label, color, bg, Icon } = confidenceLevel(photo.confidence);
            return (
              <motion.div
                className="absolute bottom-2 left-2 z-10"
                initial={{ opacity: 0, scale: 0.7, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.15 }}
              >
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold shadow-md backdrop-blur-sm"
                  style={{ color, background: bg }}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {label}
                </span>
              </motion.div>
            );
          })()}

          {/* Actions — bottom-right on hover */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex gap-1.5">
              <motion.button
                type="button" whileTap={{ scale: 0.88 }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                onClick={e => { e.stopPropagation(); onOpen(); }}
                aria-label="View full size"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </motion.button>
              <motion.button
                type="button" whileTap={{ scale: 0.88 }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                onClick={e => { e.stopPropagation(); downloadImage(photo.url!, name, photo.photo_id); }}
                disabled={isDownloading}
                aria-label="Download photo"
              >
                {isDownloading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
              </motion.button>
            </div>
          </div>
        </>
      ) : (
        /* ── No URL ── */
        <div className="h-full w-full flex items-center justify-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
        </div>
      )}
    </motion.div>
  );
}

/* ── Lightbox ─────────────────────────────────────────────────────────── */
function Lightbox({
  groups, state, onClose, onPrev, onNext, downloadImage, downloading,
}: {
  groups: MyPhotosGroup[];
  state: LightboxState;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  downloadImage: (url: string, name: string, id: string) => void;
  downloading: Set<string>;
}) {
  const group = state ? groups[state.groupIndex] : null;
  const photo = group?.photos[state?.photoIndex ?? 0] ?? null;
  const total = group?.photos.length ?? 0;
  const isFirst = (state?.photoIndex ?? 0) === 0;
  const isLast  = (state?.photoIndex ?? 0) >= total - 1;

  return (
    <AnimatePresence>
      {state && photo && group && (
        <>
          {/* Backdrop */}
          <motion.div
            key="lb-backdrop"
            className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Close */}
          <button
            className="fixed top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Prev */}
          {!isFirst && (
            <motion.button
              key="lb-prev"
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              onClick={e => { e.stopPropagation(); onPrev(); }}
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>
          )}

          {/* Next */}
          {!isLast && (
            <motion.button
              key="lb-next"
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              onClick={e => { e.stopPropagation(); onNext(); }}
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          )}

          {/* Photo + info */}
          <motion.div
            key={`lb-photo-${state.groupIndex}-${state.photoIndex}`}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-16 pointer-events-none"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url!}
              alt="Full size photo"
              className="pointer-events-auto max-h-[72vh] max-w-[80vw] rounded-2xl shadow-2xl object-contain"
            />

            {/* Bottom bar */}
            <div className="pointer-events-auto flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-white font-semibold text-sm">{group.event_name}</p>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <p className="text-white/40 text-[11px]">
                      {(state.photoIndex) + 1} of {total} · {formatDate(photo.uploaded_at)}
                    </p>
                    {photo.confidence > 0 && (() => {
                      const { label, color, bg, Icon } = confidenceLevel(photo.confidence);
                      return (
                        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ color, background: bg }}>
                          <Icon className="h-2.5 w-2.5" />{label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold text-white transition-colors"
                style={{ background: 'rgba(201,150,58,0.25)', border: '1px solid rgba(201,150,58,0.4)' }}
                onClick={() => photo.url && downloadImage(photo.url, safeName(group.event_name, photo.photo_id), photo.photo_id)}
                disabled={downloading.has(photo.photo_id)}
              >
                {downloading.has(photo.photo_id)
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                Download
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── main page ────────────────────────────────────────────────────────── */
export default function MyPhotosPage() {
  const [activeEvent, setActiveEvent] = useState<string>('all');
  const [lightbox, setLightbox]     = useState<LightboxState>(null);
  const { toast }      = useToast();
  const { clearBadge } = useMyPhotosBadge();
  const { downloadImage, downloading } = useDownload();

  /* ── load ─────────────────────────────────────────────────────────── */
  const { data: groups = [], isLoading } = useSWR<MyPhotosGroup[]>(
    'my-photos',
    () => apiClient.getMyPhotos(),
    {
      onSuccess: () => clearBadge(),
      onError: () => toast({ variant: 'destructive', title: 'Photos unavailable', description: 'Refresh the page to try again.' }),
    },
  );

  /* ── keyboard navigation ──────────────────────────────────────────── */
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setLightbox(prev => prev && prev.photoIndex > 0 ? { ...prev, photoIndex: prev.photoIndex - 1 } : prev);
      } else if (e.key === 'ArrowRight') {
        setLightbox(prev => {
          if (!prev) return prev;
          const max = (groups[prev.groupIndex]?.photos.length ?? 1) - 1;
          return prev.photoIndex < max ? { ...prev, photoIndex: prev.photoIndex + 1 } : prev;
        });
      } else if (e.key === 'Escape') {
        setLightbox(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, groups]);

  /* ── derived ──────────────────────────────────────────────────────── */
  const totalPhotos    = groups.reduce((n, g) => n + g.photos.length, 0);
  const processingCount = groups.reduce((n, g) => n + g.photos.filter(p => p.is_processing).length, 0);
  const visibleGroups  = activeEvent === 'all' ? groups : groups.filter(g => g.event_id === activeEvent);

  /* ── loading skeleton ─────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="flex gap-2">
          {[80, 130, 100].map((w, i) => (
            <div key={i} className="h-8 animate-pulse rounded-full bg-muted" style={{ width: w, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-muted" style={{ aspectRatio: '3/4', animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Lightbox ──────────────────────────────────────────────────── */}
      <Lightbox
        groups={groups}
        state={lightbox}
        onClose={() => setLightbox(null)}
        onPrev={() => setLightbox(prev => prev && prev.photoIndex > 0 ? { ...prev, photoIndex: prev.photoIndex - 1 } : prev)}
        onNext={() => setLightbox(prev => {
          if (!prev) return prev;
          const max = (groups[prev.groupIndex]?.photos.length ?? 1) - 1;
          return prev.photoIndex < max ? { ...prev, photoIndex: prev.photoIndex + 1 } : prev;
        })}
        downloadImage={downloadImage}
        downloading={downloading}
      />

      <div className="space-y-5">

        {/* ── Hero stats strip ──────────────────────────────────────── */}
        <motion.div
          variants={fadeInUp} initial="hidden" animate="visible"
          className="relative overflow-hidden rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, #0f1a2e 0%, #1a3257 60%, #0d2340 100%)' }}
        >
          <div className="pointer-events-none absolute -top-6 -right-6 h-32 w-32 rounded-full opacity-[0.07]" style={{ background: '#c9963a' }} />
          <div className="pointer-events-none absolute -bottom-8 -left-4 h-36 w-36 rounded-full opacity-[0.04]" style={{ background: '#c9963a' }} />

          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-white">My Photos</h1>
                <p className="text-xs text-white/50 mt-0.5">All photos you appear in, found by AI</p>
              </div>
              {processingCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold text-amber-300" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {processingCount} processing
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-5">
              <div>
                <p className="text-2xl font-bold text-white">{totalPhotos}</p>
                <p className="text-[10px] text-white/35 uppercase tracking-widest mt-0.5">Photos</p>
              </div>
              <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <p className="text-2xl font-bold text-white">{groups.length}</p>
                <p className="text-[10px] text-white/35 uppercase tracking-widest mt-0.5">Events</p>
              </div>
            </div>
          </div>
        </motion.div>

        {groups.length > 0 ? (
          <>
            {/* ── Event filter chips ─────────────────────────────── */}
            {groups.length > 1 && (
              <motion.div
                variants={fadeInUp} initial="hidden" animate="visible"
                className="flex gap-2 overflow-x-auto pb-0.5"
                style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' } as React.CSSProperties}
              >
                {(['all', ...groups.map(g => g.event_id)] as string[]).map(id => {
                  const label  = id === 'all' ? 'All Events' : (groups.find(g => g.event_id === id)?.event_name ?? id);
                  const count  = id === 'all' ? totalPhotos : (groups.find(g => g.event_id === id)?.photos.length ?? 0);
                  const active = activeEvent === id;
                  return (
                    <motion.button
                      key={id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveEvent(id)}
                      className="shrink-0 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        background:  active ? '#0f1a2e' : 'transparent',
                        color:       active ? 'white'   : '#6b7280',
                        borderColor: active ? '#0f1a2e' : '#e8e2d9',
                      }}
                    >
                      {label}
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{
                          background: active ? 'rgba(201,150,58,0.25)' : '#f0ece5',
                          color:      active ? '#c9963a' : '#9ca3af',
                        }}
                      >
                        {count}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {/* ── Photo groups ───────────────────────────────────── */}
            <motion.div
              className="space-y-10"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {visibleGroups.map((group, idx) => {
                const realGroupIdx = groups.findIndex(g => g.event_id === group.event_id);
                return (
                  <motion.div key={group.event_id} variants={staggerItem}>
                    {/* Event header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold">{group.event_name}</h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {group.photos.length} photo{group.photos.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
                        style={{ borderColor: '#e8e2d9' }}
                        onClick={() =>
                          group.photos
                            .filter(p => p.url)
                            .forEach(p => downloadImage(p.url!, safeName(group.event_name, p.photo_id), `bulk-${p.photo_id}`))
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download all
                      </motion.button>
                    </div>

                    {/* Grid */}
                    <motion.div
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                      variants={staggerContainer}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, margin: '-40px' }}
                    >
                      {group.photos.map((photo, photoIdx) => (
                        <PhotoCard
                          key={photo.photo_id}
                          photo={photo}
                          groupName={group.event_name}
                          onOpen={() => setLightbox({ groupIndex: realGroupIdx, photoIndex: photoIdx })}
                          downloadImage={downloadImage}
                          downloading={downloading}
                        />
                      ))}
                    </motion.div>

                    {idx < visibleGroups.length - 1 && (
                      <div className="mt-10 h-px" style={{ background: '#e8e2d9' }} />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        ) : (
          /* ── Empty state ────────────────────────────────────────── */
          <motion.div
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 gap-4 text-center"
            style={{ borderColor: '#e8e2d9' }}
            variants={fadeInScale}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(201,150,58,0.08)' }}
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="h-7 w-7" style={{ color: '#c9963a' }} />
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ border: '2px solid rgba(201,150,58,0.22)' }}
                animate={{ scale: [1, 1.18, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
              />
            </motion.div>
            <div>
              <h3 className="text-base font-semibold">No photos yet</h3>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                Join an event and face recognition will automatically find the photos you appear in.
              </p>
            </div>
          </motion.div>
        )}

      </div>
    </>
  );
}
