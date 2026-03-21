'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import {
  Camera, Trash2, ShieldCheck, AlertTriangle, Loader2,
  Save, ScanFace, Check, X, ChevronDown, Lightbulb,
  User, Mail, Zap, ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient, validateImageFile, compressImage } from '@/lib/api';
import { useAppConfig } from '@/hooks/use-app-config';
import type { User as UserType } from '@/lib/types';

/* ── types ────────────────────────────────────────────────────────────── */
type FaceImage = {
  saved:       { imageId: string; url: string } | null;
  pending:     { file: File; previewUrl: string } | null;
  deleteSaved: boolean;
};

type QualityCheck = { label: string; pass: boolean; hint?: string };

const CIRCLE_SIZE = 232; // outer ring diameter (photo is inset 6px each side = 220px)

/* ── face quality checker ─────────────────────────────────────────────── */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function runQualityChecks(file: File, blobUrl: string): Promise<QualityCheck[]> {
  const results: QualityCheck[] = [];
  let img: HTMLImageElement;
  try { img = await loadImg(blobUrl); }
  catch { return [{ label: 'Image readable', pass: false, hint: 'Could not read the image file.' }]; }

  const minDim = Math.min(img.naturalWidth, img.naturalHeight);
  results.push({
    label: 'Resolution',
    pass:  minDim >= 150,
    hint:  minDim < 150 ? 'Too small — use a photo at least 150 × 150 px.' : undefined,
  });

  const ratio = img.naturalWidth / img.naturalHeight;
  results.push({
    label: 'Portrait framing',
    pass:  ratio <= 1.4,
    hint:  ratio > 1.4 ? 'Use a portrait or square crop with your face centred.' : undefined,
  });

  results.push({
    label: 'Image quality',
    pass:  file.size >= 15_000,
    hint:  file.size < 15_000 ? 'Image seems heavily compressed — try a clearer photo.' : undefined,
  });

  try {
    type FD = { detect: (img: HTMLImageElement) => Promise<unknown[]> };
    type FDCtor = new (opts?: object) => FD;
    const FaceDetectorAPI = (window as typeof window & { FaceDetector?: FDCtor }).FaceDetector;
    if (FaceDetectorAPI) {
      const detector = new FaceDetectorAPI({ maxDetectedFaces: 1 });
      const faces = await detector.detect(img);
      results.push({
        label: 'Face detected',
        pass:  faces.length > 0,
        hint:  faces.length === 0 ? 'No face found — make sure your face is clear and well-lit.' : undefined,
      });
    }
  } catch { /* API unavailable — skip */ }

  return results;
}

/* ── CompletionRing (hero banner) ─────────────────────────────────────── */
function CompletionRing({ pct, size = 72 }: { pct: number; size?: number }) {
  const r    = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const half = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle cx={half} cy={half} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <motion.circle
          cx={half} cy={half} r={r}
          fill="none" stroke="#c9963a" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-white/80">{pct}%</span>
      </div>
    </div>
  );
}

/* ── QualityRing (animated ring around the face photo circle) ─────────── */
function QualityRing({ status, checks }: { status: 'idle' | 'checking' | 'done'; checks: QualityCheck[] }) {
  const r         = CIRCLE_SIZE / 2 - 5;
  const circ      = 2 * Math.PI * r;
  const allPassed = checks.length > 0 && checks.every(c => c.pass);
  const ringColor = allPassed ? '#22c55e' : '#f59e0b';

  if (status === 'idle') return null;

  return (
    <div className="pointer-events-none absolute inset-0 rounded-full" style={{ zIndex: 10 }}>
      {status === 'checking' ? (
        /* Spinning gold arc */
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: '5px solid rgba(201,150,58,0.15)',
            borderTopColor: '#c9963a',
            borderRightColor: 'rgba(201,150,58,0.5)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        <>
          {/* Draw-on completion ring */}
          <svg
            className="absolute inset-0"
            style={{ transform: 'rotate(-90deg)' }}
            width={CIRCLE_SIZE}
            height={CIRCLE_SIZE}
          >
            <circle
              cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={r}
              fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5"
            />
            <motion.circle
              cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={r}
              fill="none" stroke={ringColor} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
            />
          </svg>

          {/* Pulse rings when all checks pass */}
          {allPassed && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '4px solid #22c55e' }}
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 1.18, opacity: 0 }}
                transition={{ duration: 1.0, delay: 1.0 }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '3px solid #22c55e' }}
                initial={{ scale: 1, opacity: 0.45 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 1.2, delay: 1.25 }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── QualityPanel ─────────────────────────────────────────────────────── */
function QualityPanel({ checks, status }: { checks: QualityCheck[]; status: 'checking' | 'done' }) {
  const allPassed = status === 'done' && checks.every(c => c.pass);
  const hasFail   = status === 'done' && checks.some(c => !c.pass);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div
        className="rounded-xl border p-4 space-y-3"
        style={{
          borderColor: allPassed ? '#86efac' : hasFail ? '#fde68a' : '#e8e2d9',
          background:  allPassed ? '#f0fdf4'  : hasFail ? '#fffbeb'  : '#f8f5f0',
        }}
      >
        <div className="flex items-center gap-2">
          {status === 'checking'
            ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
            : allPassed
              ? <ShieldCheck className="h-4 w-4 text-green-600" />
              : <AlertTriangle className="h-4 w-4 text-amber-500" />}
          <span className={`text-xs font-semibold ${
            status === 'checking' ? 'text-muted-foreground'
            : allPassed ? 'text-green-700' : 'text-amber-700'
          }`}>
            {status === 'checking'
              ? 'Analysing photo quality…'
              : allPassed
                ? 'Photo looks great — ready to save!'
                : 'Photo quality issues detected'}
          </span>
        </div>

        {checks.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.25 }}
            className="flex items-start gap-2.5"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.1 + 0.1, type: 'spring', stiffness: 500, damping: 20 }}
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                c.pass ? 'bg-green-500' : 'bg-amber-400'
              }`}
            >
              {c.pass ? <Check className="h-2.5 w-2.5 text-white" /> : <X className="h-2.5 w-2.5 text-white" />}
            </motion.div>
            <div>
              <p className={`text-xs font-medium ${c.pass ? 'text-green-800' : 'text-amber-800'}`}>{c.label}</p>
              {c.hint && <p className="mt-0.5 text-[10px] text-amber-600 leading-snug">{c.hint}</p>}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── PhotoTips ────────────────────────────────────────────────────────── */
const TIPS = [
  { icon: '💡', title: 'Good lighting',    body: 'Face a window or lamp — avoid shadows across your face.' },
  { icon: '👤', title: 'Look straight',    body: 'Face the camera directly. Angled shots reduce accuracy.' },
  { icon: '🚫', title: 'No obstructions', body: 'Remove sunglasses, hats, or anything covering your face.' },
  { icon: '🖼️', title: 'Fill the frame',  body: 'Your face should take up most of the photo area.' },
];

function PhotoTips() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e8e2d9' }}>
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Tips for the best face photo</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 pb-4 pt-3 grid grid-cols-2 gap-3" style={{ borderColor: '#e8e2d9' }}>
              {TIPS.map(tip => (
                <div key={tip.title} className="flex items-start gap-2.5 rounded-lg bg-muted/30 p-2.5">
                  <span className="text-base leading-none">{tip.icon}</span>
                  <div>
                    <p className="text-[11px] font-semibold">{tip.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{tip.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── main page ────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const [currentUser, setCurrentUser]           = useState<UserType | null>(null);
  const [faceImage, setFaceImage]               = useState<FaceImage>({ saved: null, pending: null, deleteSaved: false });
  const [hasConsented, setHasConsented]         = useState(false);
  const [isSavingProfile, setIsSavingProfile]   = useState(false);
  const [isSavingFace, setIsSavingFace]         = useState(false);
  const [qualityStatus, setQualityStatus]       = useState<'idle' | 'checking' | 'done'>('idle');
  const [qualityChecks, setQualityChecks]       = useState<QualityCheck[]>([]);
  const [lightboxUrl, setLightboxUrl]           = useState<string | null>(null);
  const { image_quality } = useAppConfig();

  const cameraInputRef   = useRef<HTMLInputElement | null>(null);
  const explorerInputRef = useRef<HTMLInputElement | null>(null);
  const originalNameRef  = useRef('');
  const { toast } = useToast();

  /* ── load ─────────────────────────────────────────────────────────── */
  const { isLoading: userLoading } = useSWR('current-user', () => apiClient.getCurrentUser(), {
    onSuccess: (data) => {
      setCurrentUser(data);
      originalNameRef.current = data.name ?? '';
    },
    onError: () => toast({ variant: 'destructive', title: 'Couldn\'t load your profile', description: 'Check your connection and refresh.' }),
  });
  const { isLoading: faceLoading } = useSWR('face-profile', () => apiClient.getFaceProfile(), {
    onSuccess: (data) => {
      const first = data.images[0];
      if (first) setFaceImage({ saved: { imageId: first.id, url: first.url ?? '' }, pending: null, deleteSaved: false });
    },
  });

  const isProfileLoading = userLoading || faceLoading;

  /* ── unified save ─────────────────────────────────────────────────── */
  const saveAll = async () => {
    const nameChanged = currentUser?.name !== originalNameRef.current;
    if (hasChanges && !hasConsented) {
      toast({ variant: 'destructive', title: 'One more thing', description: 'Tick the consent box below to save your face photo.' });
      return;
    }
    let anyFailed = false;

    // Save name if changed
    if (nameChanged && currentUser) {
      setIsSavingProfile(true);
      try {
        const updated = await apiClient.updateProfile(currentUser);
        setCurrentUser(updated);
        originalNameRef.current = updated.name ?? '';
      } catch {
        anyFailed = true;
        toast({ variant: 'destructive', title: 'Name not saved', description: 'Something went wrong — give it another try.' });
      } finally { setIsSavingProfile(false); }
    }

    // Save face if changed
    if (hasChanges) {
      setIsSavingFace(true);
      if (faceImage.deleteSaved && faceImage.saved) {
        try { await apiClient.deleteFaceProfileImage(faceImage.saved.imageId); }
        catch { anyFailed = true; toast({ variant: 'destructive', title: 'Photo not removed', description: 'Try again in a moment.' }); }
      }
      if (faceImage.pending) {
        const { file, previewUrl: blobUrl } = faceImage.pending;
        try {
          // Face profile photos are always compressed — 1024px at 92% quality
          // is optimal for Rekognition face indexing accuracy vs storage cost
          const toUpload = await compressImage(file, 1024, 0.92);
          const { upload_url, s3_key, face_image_id } = await apiClient.getPresignedUpload({
            filename: toUpload.name, content_type: toUpload.type || 'image/jpeg', file_size: toUpload.size,
          });
          await apiClient.uploadToS3(upload_url, toUpload, () => {});
          await apiClient.confirmFaceProfileUpload(face_image_id!, s3_key);
          URL.revokeObjectURL(blobUrl);
        } catch (err) {
          anyFailed = true;
          toast({ variant: 'destructive', title: 'Photo upload hit a snag', description: err instanceof Error ? err.message : 'Check your connection and try again.' });
        }
      }
      try {
        const profileData = await apiClient.getFaceProfile();
        const first = profileData.images[0];
        setFaceImage(first
          ? { saved: { imageId: first.id, url: first.url ?? '' }, pending: null, deleteSaved: false }
          : { saved: null, pending: null, deleteSaved: false });
      } catch {
        setFaceImage(prev => ({ ...prev, pending: null, deleteSaved: false }));
      }
      setIsSavingFace(false);
      setQualityStatus('idle');
      setQualityChecks([]);
    }

    if (!anyFailed) toast({ title: 'Profile saved ✓', description: 'Your changes are all set.' });
  };

  /* ── file select ──────────────────────────────────────────────────── */
  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateImageFile(file, 'face');
    if (validationError) {
      toast({ variant: 'destructive', title: 'Cannot use this file', description: validationError });
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setFaceImage(prev => {
      if (prev.pending) URL.revokeObjectURL(prev.pending.previewUrl);
      return { ...prev, pending: { file, previewUrl: blobUrl }, deleteSaved: !!prev.saved };
    });
    setQualityStatus('checking');
    setQualityChecks([]);
    await new Promise(r => setTimeout(r, 700));
    const checks = await runQualityChecks(file, blobUrl);
    setQualityChecks(checks);
    setQualityStatus('done');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  /* ── delete ───────────────────────────────────────────────────────── */
  const handleDelete = () => {
    setFaceImage(prev => {
      if (prev.pending) { URL.revokeObjectURL(prev.pending.previewUrl); return { ...prev, pending: null, deleteSaved: false }; }
      return { ...prev, deleteSaved: true };
    });
    setQualityStatus('idle');
    setQualityChecks([]);
  };

  /* ── derived ──────────────────────────────────────────────────────── */
  const displayUrl   = faceImage.pending?.previewUrl ?? (!faceImage.deleteSaved ? faceImage.saved?.url : null) ?? null;
  const hasImage     = !!displayUrl;
  const hasFace      = hasImage;
  const hasChanges   = (faceImage.deleteSaved && !!faceImage.saved) || !!faceImage.pending;
  const nameChanged  = currentUser?.name !== originalNameRef.current;
  const isSaving     = isSavingProfile || isSavingFace;
  const hasAnything  = nameChanged || hasChanges;
  const initials     = currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '??';
  const completePct  = Math.round(([!!currentUser?.name?.trim(), hasFace].filter(Boolean).length / 2) * 100);

  /* ── loading ──────────────────────────────────────────────────────── */
  if (isProfileLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-36 animate-pulse rounded-3xl bg-muted" />
        <div className="h-52 animate-pulse rounded-2xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <>
      {/* ── Lightbox ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxUrl && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLightboxUrl(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <div className="relative pointer-events-auto">
                <button
                  onClick={() => setLightboxUrl(null)}
                  className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-800" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lightboxUrl} alt="Face preview" className="max-h-[85vh] max-w-[85vw] rounded-2xl shadow-2xl object-contain" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="max-w-lg mx-auto space-y-5">

        {/* ── Hero banner ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl p-6"
          style={{ background: 'linear-gradient(135deg, #0f1a2e 0%, #1a3257 55%, #0d2340 100%)' }}
        >
          <div className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 rounded-full opacity-[0.07]" style={{ background: '#c9963a' }} />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-44 w-44 rounded-full opacity-[0.04]" style={{ background: '#c9963a' }} />

          <div className="relative flex items-center gap-5">
            <div className="relative shrink-0">
              <CompletionRing pct={completePct} size={72} />
              <div className="absolute inset-0 flex items-center justify-center">
                {hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayUrl!} alt="avatar" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/20" />
                ) : (
                  <span className="text-sm font-bold text-white">{initials}</span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="truncate text-xl font-bold text-white">{currentUser?.name || 'Your Profile'}</h1>
              <p className="truncate text-xs text-white/50 mt-0.5">{currentUser?.email}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={hasFace ? 'ok' : 'nok'}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      hasFace ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {hasFace
                      ? <><ShieldCheck className="h-3 w-3" /> Face registered</>
                      : <><AlertTriangle className="h-3 w-3" /> Face required</>}
                  </motion.div>
                </AnimatePresence>
                <span className="text-[10px] text-white/30">{completePct}% complete</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Identity card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-2xl border bg-card p-5 shadow-sm space-y-4"
          style={{ borderColor: '#e8e2d9' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Identity</h2>
              <p className="text-[11px] text-muted-foreground">How others see you in events</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Display Name
              </Label>
              <Input
                value={currentUser?.name ?? ''}
                placeholder="Your name"
                disabled={isSavingProfile}
                onChange={e => setCurrentUser(p => p ? { ...p, name: e.target.value } : null)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Email
                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700 normal-case tracking-normal ml-1">Verified</span>
              </Label>
              <Input
                value={currentUser?.email ?? ''}
                disabled
                className="rounded-xl bg-muted/40 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-[10px] text-muted-foreground">Email is your login credential and cannot be changed.</p>
            </div>
          </div>

        </motion.div>

        {/* ── Face identity card ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="rounded-2xl border bg-card p-5 shadow-sm space-y-5"
          style={{ borderColor: '#e8e2d9' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ScanFace className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Face Identity</h2>
                <p className="text-[11px] text-muted-foreground">Your biometric key to finding photos</p>
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={hasFace ? 'active' : 'req'}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold ${
                  hasFace ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {hasFace ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {hasFace ? 'Active' : 'Not set'}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            capture="user"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
          />
          <input
            ref={explorerInputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
          />

          {/* ── Round photo zone ──────────────────────────────────── */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="relative"
              style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
            >
              {/* Inner photo circle */}
              <div
                className="absolute rounded-full overflow-hidden"
                style={{
                  top: 6, left: 6, right: 6, bottom: 6,
                  background: hasImage ? 'transparent' : '#f0ece5',
                  cursor: hasImage ? 'default' : 'pointer',
                }}
                onClick={!hasImage ? () => explorerInputRef.current?.click() : undefined}
              >
                {hasImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayUrl!}
                      alt="Face profile"
                      className="h-full w-full object-cover"
                      style={{ objectPosition: 'center top', cursor: 'zoom-in' }}
                      onClick={() => setLightboxUrl(displayUrl!)}
                    />
                    {/* Saving overlay */}
                    {isSavingFace && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                        <Loader2 className="h-7 w-7 animate-spin text-white" />
                        <p className="text-[10px] font-semibold text-white">Saving…</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Animated dashed border */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ border: '2px dashed rgba(201,150,58,0.45)' }}
                    />

                    {/* Camera icon — click → camera capture */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                      <motion.button
                        type="button"
                        className="relative flex h-16 w-16 items-center justify-center rounded-full focus:outline-none"
                        style={{ background: 'rgba(201,150,58,0.10)' }}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                        onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                        aria-label="Open camera"
                      >
                        <Camera className="h-7 w-7" style={{ color: '#c9963a' }} />
                        <motion.div
                          className="pointer-events-none absolute inset-0 rounded-full"
                          style={{ border: '2px solid rgba(201,150,58,0.35)' }}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
                          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
                        />
                      </motion.button>
                      <div className="text-center pointer-events-none">
                        <p className="text-[10px] font-semibold" style={{ color: '#c9963a' }}>Tap for camera</p>
                        <p className="text-[9px] text-muted-foreground">or tap outside for file</p>
                      </div>
                    </div>

                    {/* Scanning line */}
                    <motion.div
                      className="pointer-events-none absolute inset-x-0 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(201,150,58,0.4), transparent)' }}
                      animate={{ y: [15, 195, 15] }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </>
                )}
              </div>

              {/* Quality ring — sits around the photo circle */}
              <QualityRing status={qualityStatus} checks={qualityChecks} />

              {/* Camera FAB — change photo */}
              {hasImage && !isSavingFace && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute bottom-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-lg"
                  style={{ background: '#0f1a2e', border: '2.5px solid white' }}
                  onClick={() => cameraInputRef.current?.click()}
                  aria-label="Change photo"
                >
                  <Camera className="h-4 w-4 text-white" />
                </motion.button>
              )}

              {/* Delete FAB */}
              {hasImage && !isSavingFace && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute bottom-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-lg"
                  style={{ background: '#ef4444', border: '2.5px solid white' }}
                  onClick={handleDelete}
                  aria-label="Delete photo"
                >
                  <Trash2 className="h-4 w-4 text-white" />
                </motion.button>
              )}

              {/* "New" badge */}
              {faceImage.pending && !isSavingFace && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-1 right-4 z-20 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-white shadow"
                  style={{ background: 'var(--brand, #c9963a)' }}
                >
                  New
                </motion.span>
              )}
            </div>

            {/* Hint below circle */}
            {!hasImage && (
              <p className="text-[11px] text-muted-foreground text-center">
                JPEG · PNG · Square or portrait photo recommended
              </p>
            )}
          </div>

          {/* Quality check panel */}
          <AnimatePresence>
            {qualityStatus !== 'idle' && (
              <QualityPanel checks={qualityChecks} status={qualityStatus} />
            )}
          </AnimatePresence>

          {/* Photo tips */}
          <PhotoTips />

          {/* Consent */}
          <div className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: '#f8f5f0' }}>
            <Checkbox
              id="consent"
              checked={hasConsented}
              onCheckedChange={v => setHasConsented(v as boolean)}
              className="mt-0.5"
            />
            <label htmlFor="consent" className="cursor-pointer text-xs leading-relaxed text-muted-foreground">
              I consent to the use of my photo for facial recognition to automatically find me in event photos.
            </label>
          </div>

          {/* Single save button */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400 }}>
            <Button
              className="w-full rounded-xl"
              onClick={saveAll}
              disabled={isSaving || !hasAnything}
            >
              {isSaving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                : <><Save className="mr-2 h-4 w-4" />Save Profile</>}
            </Button>
          </motion.div>
          {hasChanges && !hasConsented && (
            <p className="text-center text-[11px] text-amber-600">Tick the consent box above to save your face photo.</p>
          )}
        </motion.div>

        {/* ── Upload Quality (read-only, controlled via AWS SSM) ────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-2xl border overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 bg-muted/30">
            <div className="flex items-center gap-2.5">
              {image_quality === 'optimized'
                ? <Zap className="h-4 w-4 text-green-600" />
                : <ImageIcon className="h-4 w-4 text-amber-500" />}
              <div>
                <p className="text-sm font-semibold">Upload Quality</p>
                <p className="text-[11px] text-muted-foreground">Managed by administrator</p>
              </div>
            </div>
            <motion.div
              key={image_quality}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                image_quality === 'optimized'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {image_quality === 'optimized' ? 'Cost Optimized' : 'Full Resolution'}
            </motion.div>
          </div>
          <div className={`px-5 py-3 text-xs leading-relaxed border-t ${
            image_quality === 'optimized'
              ? 'bg-green-50/50 text-green-800'
              : 'bg-amber-50/50 text-amber-800'
          }`}>
            {image_quality === 'optimized' ? (
              <>
                <span className="font-semibold">Images are automatically resized to 1920px and compressed before upload.</span>
                {' '}Storage costs are minimised, face recognition runs faster, and uploads are quicker on mobile.
                Gallery photos remain sharp on any phone or laptop screen.
              </>
            ) : (
              <>
                <span className="font-semibold">Images are uploaded at full resolution without compression.</span>
                {' '}Every pixel from your camera is preserved — ideal for archiving or high-quality prints.
                Files are larger and uploads may take longer on slower connections.
              </>
            )}
          </div>
        </motion.div>

      </div>
    </>
  );
}
