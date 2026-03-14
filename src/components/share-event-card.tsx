'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Copy, Check, MessageCircle } from 'lucide-react';
import { fadeInScale, staggerContainer, staggerItem } from '@/lib/animations';
import type { EventDetailResponse } from '@/lib/api';

interface ShareEventCardProps {
  event: EventDetailResponse;
  onClose: () => void;
}

export function ShareEventCard({ event }: ShareEventCardProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/events/join?code=${event.join_code}`
      : `/dashboard/events/join?code=${event.join_code}`;

  const whatsappText = encodeURIComponent(
    `Join "${event.name}" on FaceShare! Use code: ${event.join_code} or link: ${shareUrl}`,
  );
  const whatsappHref = `https://wa.me/?text=${whatsappText}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(event.join_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const codeChars = event.join_code.toUpperCase().split('');

  return (
    <motion.div
      variants={fadeInScale}
      initial="hidden"
      animate="visible"
      className="w-full overflow-hidden rounded-2xl shadow-2xl border border-white/10"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-6 py-5"
        style={{ backgroundColor: '#0f1a2e' }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(201,150,58,0.15)' }}
        >
          <Camera className="h-5 w-5" style={{ color: '#c9963a' }} />
        </div>
        <span className="text-lg font-bold tracking-tight" style={{ color: '#c9963a' }}>
          FaceShare
        </span>
        <span className="ml-auto text-xs font-medium text-white/40 uppercase tracking-widest">
          Invite
        </span>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="bg-white px-6 py-7">
        {/* Invitation label */}
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          You&rsquo;re invited to
        </p>

        {/* Event name */}
        <h2 className="text-2xl font-bold text-gray-900 leading-tight">{event.name}</h2>

        {/* Description */}
        {event.description && (
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{event.description}</p>
        )}

        {/* Divider */}
        <div className="my-5 h-px bg-gray-100" />

        {/* Join Code section */}
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Join Code
        </p>

        {/* Code boxes */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex gap-2"
        >
          {codeChars.map((char, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              className="flex h-12 w-10 items-center justify-center rounded-xl border-2 border-gray-100 font-mono text-xl font-bold tracking-widest select-none"
              style={{
                backgroundColor: '#0f1a2e',
                color: '#c9963a',
                borderColor: 'rgba(201,150,58,0.3)',
              }}
            >
              {char}
            </motion.div>
          ))}
        </motion.div>

        {/* Share URL */}
        <p className="mt-4 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500 border border-gray-100">
          {shareUrl}
        </p>
      </div>

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div
        className="flex gap-2 px-6 py-4 border-t border-gray-100 bg-white"
      >
        {/* Copy Code */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={copyCode}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <AnimatePresence mode="wait" initial={false}>
            {codeCopied ? (
              <motion.span
                key="check-code"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="flex items-center gap-1.5"
              >
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Copied!</span>
              </motion.span>
            ) : (
              <motion.span
                key="copy-code"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="flex items-center gap-1.5"
              >
                <Copy className="h-4 w-4" />
                Copy Code
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Copy Link */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={copyLink}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <AnimatePresence mode="wait" initial={false}>
            {linkCopied ? (
              <motion.span
                key="check-link"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="flex items-center gap-1.5"
              >
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Copied!</span>
              </motion.span>
            ) : (
              <motion.span
                key="copy-link"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="flex items-center gap-1.5"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* WhatsApp */}
        <motion.a
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#25D366' }}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </motion.a>
      </div>
    </motion.div>
  );
}
