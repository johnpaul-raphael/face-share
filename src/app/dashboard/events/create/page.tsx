'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Share2, Check, Copy, Loader2, Plus, ImageIcon, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiClient, EventResponse } from '@/lib/api';
import { fadeInUp, fadeInScale, pageTransition } from '@/lib/animations';

const formSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
});

const GRADIENT_PALETTES = [
  'from-violet-400 to-purple-600',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-orange-400 to-rose-500',
  'from-amber-400 to-orange-500',
];

/* ── Cover upload zone ─────────────────────────────────────────────────── */
type CoverState = 'idle' | 'uploading' | 'done' | 'error';

function CoverUploadZone({
  previewUrl,
  state,
  progress,
  onFileSelect,
  onRemove,
  eventName,
}: {
  previewUrl: string | null;
  state: CoverState;
  progress: number;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  eventName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gradient = GRADIENT_PALETTES[(eventName.charCodeAt(0) || 0) % GRADIENT_PALETTES.length];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) onFileSelect(file);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Cover Photo <span className="text-muted-foreground font-normal">(optional)</span></p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ''; }}
      />

      <motion.div
        className="relative h-40 w-full overflow-hidden rounded-xl border-2 cursor-pointer transition-colors"
        style={{ borderStyle: previewUrl ? 'solid' : 'dashed', borderColor: previewUrl ? '#e8e2d9' : '#c8bfb0' }}
        whileHover={{ scale: state === 'uploading' ? 1 : 1.01 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onClick={() => state !== 'uploading' && !previewUrl && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Cover preview" className="h-full w-full object-cover" />

            {/* Upload progress overlay */}
            {state === 'uploading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
                <div className="w-32 h-1.5 rounded-full bg-white/30">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-xs text-white font-medium">{progress}%</span>
              </div>
            )}

            {/* Done tick */}
            {state === 'done' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute top-2 right-10 flex h-7 w-7 items-center justify-center rounded-full bg-green-500 shadow"
              >
                <Check className="h-4 w-4 text-white" />
              </motion.div>
            )}

            {/* Remove + change buttons */}
            {state !== 'uploading' && (
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 backdrop-blur shadow hover:bg-white transition-colors"
                  title="Change photo"
                >
                  <Upload className="h-3.5 w-3.5 text-gray-700" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 backdrop-blur shadow hover:bg-white transition-colors"
                  title="Remove photo"
                >
                  <X className="h-3.5 w-3.5 text-gray-700" />
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty — gradient preview with upload prompt */
          <div
            className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br ${gradient} opacity-30`}
          />
        )}

        {!previewUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Click or drag to upload</p>
            <p className="text-xs text-muted-foreground/70">JPG, PNG — recommended 1200×600</p>
          </div>
        )}

        {state === 'error' && (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-destructive/90 px-3 py-1.5 text-xs text-white text-center">
            Upload failed — photo won&apos;t be saved
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [createdEvent, setCreatedEvent] = useState<EventResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Cover photo state
  const [coverPreview, setCoverPreview]     = useState<string | null>(null);
  const [coverUrl, setCoverUrl]             = useState<string | null>(null);
  const [coverState, setCoverState]         = useState<CoverState>('idle');
  const [coverProgress, setCoverProgress]   = useState(0);
  const coverBlobRef                        = useRef<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  });

  /* ── Cover upload ──────────────────────────────────────────────────── */
  const handleCoverFile = async (file: File) => {
    // Revoke previous blob
    if (coverBlobRef.current) URL.revokeObjectURL(coverBlobRef.current);
    const blobUrl = URL.createObjectURL(file);
    coverBlobRef.current = blobUrl;
    setCoverPreview(blobUrl);
    setCoverState('uploading');
    setCoverProgress(0);
    setCoverUrl(null);

    try {
      const { upload_url, s3_key } = await apiClient.getPresignedUpload({
        filename: file.name,
        content_type: file.type || 'image/jpeg',
      });
      await apiClient.uploadToS3(upload_url, file, (pct) => setCoverProgress(pct));
      const { download_url } = await apiClient.getPresignedDownload(s3_key);
      setCoverUrl(download_url);
      setCoverState('done');
    } catch {
      setCoverState('error');
      toast({ variant: 'destructive', title: 'Cover skipped', description: 'Event will save without a cover image.' });
    }
  };

  const handleRemoveCover = () => {
    if (coverBlobRef.current) { URL.revokeObjectURL(coverBlobRef.current); coverBlobRef.current = null; }
    setCoverPreview(null);
    setCoverUrl(null);
    setCoverState('idle');
    setCoverProgress(0);
  };

  /* ── Form submit ───────────────────────────────────────────────────── */
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (coverState === 'uploading') {
      toast({ title: 'Almost there…', description: 'Cover photo is still uploading. Give it a moment.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const event = await apiClient.createEvent({
        name: values.name,
        description: values.description,
        cover_image_url: coverUrl ?? undefined,
      });
      setCreatedEvent(event);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Event not created',
        description: err instanceof Error ? err.message : 'Double-check your details and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const shareLink = typeof window !== 'undefined' && createdEvent
    ? `${window.location.origin}/dashboard/events/join?code=${createdEvent.join_code}`
    : '';
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(
    `Join my event "${createdEvent?.name}" on FaceShare! Use this link: ${shareLink}`
  )}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const eventName = form.watch('name');

  return (
    <motion.div
      className="max-w-xl mx-auto space-y-6"
      variants={pageTransition}
      initial="hidden"
      animate="visible"
    >
      {/* Back */}
      <motion.button
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        whileHover={{ x: -3 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </motion.button>

      <AnimatePresence mode="wait">
        {!createdEvent ? (
          /* ── Form ── */
          <motion.div
            key="form"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold">Create New Event</h1>
              <p className="text-muted-foreground mt-1">Fill in the details to set up your photo-sharing event.</p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
              {/* Cover photo upload */}
              <CoverUploadZone
                previewUrl={coverPreview}
                state={coverState}
                progress={coverProgress}
                onFileSelect={handleCoverFile}
                onRemove={handleRemoveCover}
                eventName={eventName}
              />

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Summer BBQ" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="A short description of your event." rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button type="submit" disabled={isSubmitting || coverState === 'uploading'} className="w-full">
                      {isSubmitting
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                        : coverState === 'uploading'
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading cover…</>
                        : <><Plus className="mr-2 h-4 w-4" />Create Event</>
                      }
                    </Button>
                  </motion.div>
                </form>
              </Form>
            </div>
          </motion.div>
        ) : (
          /* ── Success ── */
          <motion.div
            key="success"
            variants={fadeInScale}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
              >
                <Check className="h-8 w-8 text-primary" />
              </motion.div>
              <h1 className="text-2xl font-bold">Event Created!</h1>
              <p className="text-muted-foreground">Share the link below so others can join.</p>
            </div>

            {/* Cover preview on success */}
            {createdEvent.cover_image_url && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative h-36 overflow-hidden rounded-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={createdEvent.cover_image_url} alt={createdEvent.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                  <p className="font-bold text-white text-lg">{createdEvent.name}</p>
                </div>
              </motion.div>
            )}

            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              {/* Join code display */}
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Join Code</p>
                <div className="flex justify-center gap-2">
                  {createdEvent.join_code.split('').map((ch, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, type: 'spring', stiffness: 400, damping: 25 }}
                      className="flex h-12 w-10 items-center justify-center rounded-xl text-lg font-bold font-mono text-white shadow"
                      style={{ background: '#0f1a2e' }}
                    >
                      {ch}
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input value={shareLink} readOnly className="font-mono text-xs" />
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button onClick={handleCopy} variant="outline" size="icon">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </motion.div>
              </div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button asChild className="w-full">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share on WhatsApp
                  </a>
                </Button>
              </motion.div>
            </div>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Button variant="secondary" className="w-full" onClick={() => router.push(`/dashboard/events/${createdEvent.id}`)}>
                Open Event
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
