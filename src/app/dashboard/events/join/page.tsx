'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, CheckCircle2, Users } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { fadeInScale, staggerContainer, staggerItem } from '@/lib/animations';

/* ── OTP boxes ──────────────────────────────────────────────────────────── */
const BOX_COUNT = 6;

function JoinEventPage() {
  const router      = useRouter();
  const params      = useSearchParams();
  const { toast }   = useToast();

  const [chars, setChars]         = useState<string[]>(Array(BOX_COUNT).fill(''));
  const [status, setStatus]       = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [eventName, setEventName] = useState('');
  const inputRefs                 = useRef<(HTMLInputElement | null)[]>([]);

  const code = chars.join('');

  /* ── join logic ─────────────────────────────────────────────────────── */
  const tryJoin = useCallback(async (upperCode: string) => {
    if (upperCode.length < BOX_COUNT) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await apiClient.joinEvent(upperCode);
      setEventName(result.event.name);
      setStatus('success');
      setTimeout(() => router.push(`/dashboard/events/${result.event.id}`), 1200);
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.toLowerCase().includes('already a participant')) {
        const events = await apiClient.listEvents().catch(() => []);
        const found  = events.find((e) => e.join_code?.toUpperCase() === upperCode);
        if (found) {
          setEventName(found.name);
          setStatus('success');
          setTimeout(() => router.push(`/dashboard/events/${found.id}`), 1200);
          return;
        }
        toast({ title: 'You\'re already in!', description: 'Taking you there now…' });
        router.push('/dashboard');
        return;
      }
      setStatus('error');
      setErrorMsg('Code not found. Check and try again.');
      // shake then reset boxes
      setTimeout(() => {
        setChars(Array(BOX_COUNT).fill(''));
        setStatus('idle');
        inputRefs.current[0]?.focus();
      }, 900);
    }
  }, [router, toast]);

  /* ── auto-join from URL param ───────────────────────────────────────── */
  useEffect(() => {
    const c = params.get('code')?.toUpperCase();
    if (c?.length === BOX_COUNT) {
      setChars(c.split(''));
      tryJoin(c);
    }
  }, [params, tryJoin]);

  /* ── OTP box handlers ───────────────────────────────────────────────── */
  const handleChange = (i: number, val: string) => {
    const ch = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!ch) return;
    const next = [...chars];
    next[i] = ch[ch.length - 1]; // take last char in case of fast paste-per-box
    setChars(next);
    if (i < BOX_COUNT - 1) inputRefs.current[i + 1]?.focus();
    const filled = next.join('');
    if (filled.length === BOX_COUNT) tryJoin(filled);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...chars];
      if (next[i]) {
        next[i] = '';
        setChars(next);
      } else if (i > 0) {
        next[i - 1] = '';
        setChars(next);
        inputRefs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputRefs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < BOX_COUNT - 1) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, BOX_COUNT);
    if (!pasted) return;
    const next = Array(BOX_COUNT).fill('');
    pasted.split('').forEach((ch, idx) => { next[idx] = ch; });
    setChars(next);
    const focusIdx = Math.min(pasted.length, BOX_COUNT - 1);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === BOX_COUNT) tryJoin(pasted);
  };

  const busy = status === 'loading' || status === 'success';

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        className="w-full max-w-sm"
        variants={fadeInScale}
        initial="hidden"
        animate="visible"
      >
        {/* Back */}
        <motion.button
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={() => router.push('/dashboard')}
          className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </motion.button>

        {/* Icon + title */}
        <div className="mb-8 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
            animate={status === 'success' ? { scale: [1, 1.2, 1] } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div key="check"
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                </motion.div>
              ) : (
                <motion.div key="users"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Users className="h-7 w-7 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <h1 className="text-2xl font-bold">Join an Event</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the 6-character code from your organiser
          </p>
        </div>

        {/* OTP boxes */}
        <motion.div
          className="flex gap-2.5 justify-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          animate-custom={status === 'error' ? 'shake' : undefined}
        >
          <AnimatePresence>
            {status === 'error' && (
              <motion.div
                className="absolute"
                animate={{ x: [0, -10, 10, -10, 10, -6, 6, 0] }}
                transition={{ duration: 0.5 }}
              />
            )}
          </AnimatePresence>

          <motion.div
            className="flex gap-2.5"
            animate={status === 'error' ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {chars.map((ch, i) => (
              <motion.div key={i} variants={staggerItem}>
                <input
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="text"
                  maxLength={2}
                  value={ch}
                  disabled={busy}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  onFocus={(e) => e.target.select()}
                  className={[
                    'h-14 w-12 rounded-xl border-2 bg-card text-center text-xl font-bold tracking-widest outline-none transition-all',
                    'focus:border-primary focus:ring-2 focus:ring-primary/20',
                    ch ? 'border-primary/60 text-foreground' : 'border-border text-muted-foreground',
                    status === 'error' ? 'border-destructive bg-destructive/5' : '',
                    busy ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/40',
                  ].join(' ')}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Status messages */}
        <div className="mt-6 min-h-[24px] text-center">
          <AnimatePresence mode="wait">
            {status === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up event…
              </motion.div>
            )}
            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-sm font-medium text-primary"
              >
                Joined <strong>{eventName}</strong>! Taking you there…
              </motion.div>
            )}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-sm text-destructive"
              >
                {errorMsg}
              </motion.div>
            )}
            {status === 'idle' && code.length > 0 && code.length < BOX_COUNT && (
              <motion.div
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground"
              >
                {BOX_COUNT - code.length} more character{BOX_COUNT - code.length !== 1 ? 's' : ''} to go
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Helper text */}
        <motion.p
          className="mt-8 text-center text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          The code is shared by the event organiser and looks like{' '}
          <span className="font-mono font-semibold">INNO24</span>
        </motion.p>
      </motion.div>
    </div>
  );
}

export default function JoinEventPageWrapper() {
  return (
    <Suspense>
      <JoinEventPage />
    </Suspense>
  );
}
