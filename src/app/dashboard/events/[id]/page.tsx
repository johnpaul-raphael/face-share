'use client';

import { Download, Upload, Loader2, X, FileImage, Trash2, Eye, Send, Lock, Star, CheckSquare, SlidersHorizontal, CalendarDays, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import useSWR from 'swr';
import { apiClient, PhotoResponse, validateImageFile, compressImage } from '@/lib/api';
import { useAppConfig } from '@/hooks/use-app-config';
import { staggerContainer, staggerItem, backdropVariants, slideUpOverlay } from '@/lib/animations';

type StatusFilter = 'all' | 'matched' | 'unmatched' | 'processing';

const STATUS_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'all',        label: 'All'        },
  { key: 'matched',    label: 'Matched'    },
  { key: 'unmatched',  label: 'Unmatched'  },
  { key: 'processing', label: 'Processing' },
];

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

const bulkBarVariants = {
  hidden: { y: 100, opacity: 0, scale: 0.95 },
  visible: { y: 0, opacity: 1, scale: 1, transition: { ...spring } },
  exit: { y: 100, opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: 'easeIn' as const } },
};

interface UploadingFile {
  file: File;
  id: string;
  progress: number;
  photoId?: string;
}

interface StagedPhoto {
  id: string;
  localUrl: string;
  file: File;
  uploadUrl: string;
  s3Key: string;
  photoId: string;
}

export default function EventGalleryPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { image_quality } = useAppConfig();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stagedPhotosRef = useRef(stagedPhotos);
  const { toast } = useToast();

  stagedPhotosRef.current = stagedPhotos;

  const { data: event } = useSWR(`event-${eventId}`, () => apiClient.getEvent(eventId));
  const { data: me } = useSWR('current-user', () => apiClient.getCurrentUser());
  const { data: publishedPhotos = [], mutate: mutatePhotos } = useSWR(
    `event-photos-${eventId}`,
    () => apiClient.getEventPhotos(eventId),
    {
      refreshInterval: (data) => data?.some((p) => p.is_processing) ? 3000 : 0,
      onError: () => toast({ variant: 'destructive', title: 'Photos unavailable', description: 'Refresh the page to try again.' }),
    },
  );

  const isOwner = event && me ? event.owner_id === me.id : false;
  const canUpload = isOwner || (event && me
    ? (event.participants.find((p) => p.user_id === me.id)?.can_upload ?? false)
    : false);
  const coverS3Key = event?.cover_photo_s3_key ?? '';
  const coverImageUrl = event?.cover_image_url ?? '';

  // Unique uploaders for filter dropdown (owner only)
  const uploaderMap = new Map<string, string>();
  publishedPhotos.forEach((p) => {
    if (!uploaderMap.has(p.uploader_id)) {
      const participant = event?.participants.find((pt) => pt.user_id === p.uploader_id);
      uploaderMap.set(p.uploader_id, participant?.user_name ?? p.uploader_id.slice(0, 8));
    }
  });

  // Apply filters
  const filteredPhotos = publishedPhotos.filter((p) => {
    if (statusFilter === 'matched'    && (p.match_count === 0 || p.is_processing)) return false;
    if (statusFilter === 'unmatched'  && (p.match_count > 0  || p.is_processing)) return false;
    if (statusFilter === 'processing' && !p.is_processing) return false;
    if (uploaderFilter && p.uploader_id !== uploaderFilter) return false;
    if (dateFrom && p.uploaded_at && p.uploaded_at < dateFrom) return false;
    if (dateTo   && p.uploaded_at && p.uploaded_at > dateTo + 'T23:59:59') return false;
    return true;
  });

  const hasActiveFilter = statusFilter !== 'all' || uploaderFilter || dateFrom || dateTo;
  const clearFilters = () => { setStatusFilter('all'); setUploaderFilter(''); setDateFrom(''); setDateTo(''); };

  // Selectability: only non-processing photos
  const selectableIds = publishedPhotos.filter((p) => !p.is_processing).map((p) => p.photo_id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  useEffect(() => {
    return () => {
      stagedPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.localUrl));
    };
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => setSelected(new Set());

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  };

  const addFilesToUploadQueue = async (files: File[]) => {
    for (const file of files) {
      const validationError = validateImageFile(file, 'event');
      if (validationError) {
        toast({ variant: 'destructive', title: 'Cannot upload file', description: validationError });
        continue;
      }

      const toUpload = image_quality === 'optimized'
        ? await compressImage(file, 1920, 0.85)
        : file;

      const uploadingId = `${file.name}-${file.lastModified}-${Math.random()}`;
      setUploadingFiles((prev) => [...prev, { file: toUpload, id: uploadingId, progress: 0 }]);

      try {
        const { upload_url, s3_key, photo_id } = await apiClient.getPresignedUpload({
          filename: toUpload.name,
          content_type: toUpload.type || 'image/jpeg',
          file_size: toUpload.size,
          event_id: eventId,
        });

        await apiClient.uploadToS3(upload_url, toUpload, (pct) => {
          setUploadingFiles((prev) =>
            prev.map((f) => (f.id === uploadingId ? { ...f, progress: pct } : f))
          );
        });

        const localUrl = URL.createObjectURL(file);
        setStagedPhotos((prev) => [
          ...prev,
          { id: uploadingId, localUrl, file, uploadUrl: upload_url, s3Key: s3_key!, photoId: photo_id! },
        ]);
        toast({ title: 'Photo ready ✓', description: `${file.name} is in the queue.` });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: `${file.name} — ${err instanceof Error ? err.message : 'try again.'}`,
        });
      } finally {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadingId));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFilesToUploadQueue(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFilesToUploadQueue(Array.from(e.dataTransfer.files));
  };

  const handleRemoveStaged = (id: string) => {
    const p = stagedPhotos.find((sp) => sp.id === id);
    if (p) URL.revokeObjectURL(p.localUrl);
    setStagedPhotos((prev) => prev.filter((sp) => sp.id !== id));
  };

  const handlePublish = async () => {
    if (stagedPhotos.length === 0) return;
    setIsPublishing(true);

    if (isOwner) {
      let processed = 0;
      for (const photo of stagedPhotos) {
        try {
          await apiClient.processPhoto(eventId, photo.photoId);
          processed++;
        } catch (err) {
          console.error('Failed to process photo', photo.photoId, err);
        }
      }
      toast({
        title: `${processed} photo${processed !== 1 ? 's' : ''} live!`,
        description: 'Face recognition is scanning for matches now.',
      });
    } else {
      toast({
        title: `${stagedPhotos.length} photo${stagedPhotos.length !== 1 ? 's' : ''} submitted ✓`,
        description: 'The organiser will run face recognition shortly.',
      });
    }

    stagedPhotos.forEach((p) => URL.revokeObjectURL(p.localUrl));
    setStagedPhotos([]);
    mutatePhotos();
    setIsPublishing(false);
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await apiClient.deletePhoto(eventId, photoId);
      mutatePhotos((prev) => (prev ?? []).filter((p) => p.photo_id !== photoId), false);
      setSelected((prev) => { const n = new Set(prev); n.delete(photoId); return n; });
      toast({ title: 'Photo removed ✓', description: 'Gone from the event.' });
    } catch {
      toast({ variant: 'destructive', title: 'Couldn\'t remove photo', description: 'Try again in a moment.' });
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiClient.deletePhoto(eventId, id)));
    const deleted = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failed = ids.length - deleted.length;
    mutatePhotos((prev) => (prev ?? []).filter((p) => !deleted.includes(p.photo_id)), false);
    setSelected(new Set());
    setBulkDeleting(false);
    toast({
      title: `${deleted.length} photo${deleted.length !== 1 ? 's' : ''} deleted`,
      description: failed ? `${failed} couldn't be deleted.` : 'Gallery updated.',
    });
  };

  const handleSetCover = async (photo: PhotoResponse) => {
    try {
      await apiClient.updateEvent(eventId, { cover_image_url: photo.s3_key });
      router.refresh();
      toast({ title: 'Cover updated ✓', description: 'New cover is live on the event.' });
    } catch {
      toast({ variant: 'destructive', title: 'Cover not updated', description: 'Try selecting the photo again.' });
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* ── Photo preview overlay ── */}
      <AnimatePresence>
        {viewingUrl && (
          <>
            <motion.div
              key="backdrop"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-40 bg-black/80"
              onClick={() => setViewingUrl(null)}
            />
            <motion.div
              key="panel"
              variants={slideUpOverlay}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-background overflow-hidden md:inset-0 md:m-auto md:max-w-3xl md:max-h-[90vh] md:rounded-2xl"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-medium text-muted-foreground">Photo Preview</span>
                <button
                  onClick={() => setViewingUrl(null)}
                  className="rounded-full p-1.5 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center p-4 min-h-[50vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={viewingUrl}
                  alt="Full size preview"
                  className="max-h-[70vh] max-w-full object-contain rounded-lg"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Upload zone */}
      {canUpload ? (
        <Card className="border-2 border-dashed bg-secondary/50" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          <CardContent className="p-6 text-center">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*" className="hidden" />
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">Upload Photos</h3>
            <p className="text-sm text-muted-foreground">Drag and drop your event photos here, or click to browse.</p>
            <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>Browse Files</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed bg-secondary/30">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-muted-foreground">Upload Restricted</h3>
            <p className="text-sm text-muted-foreground">The event organizer has not granted you upload permission.</p>
          </CardContent>
        </Card>
      )}

      {/* Uploading progress */}
      {uploadingFiles.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Uploading Files</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {uploadingFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-4">
                <FileImage className="h-8 w-8 text-muted-foreground" />
                <div className="w-full space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate max-w-xs">{f.file.name}</span>
                    <span className="text-muted-foreground">{f.progress}%</span>
                  </div>
                  <Progress value={f.progress} className="h-2" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setUploadingFiles((prev) => prev.filter((u) => u.id !== f.id))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Staged photos */}
      {stagedPhotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Publish</CardTitle>
            <CardDescription>
              {isOwner
                ? 'Publishing will trigger face recognition on all photos.'
                : 'Review uploaded photos before submitting to the organizer.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {stagedPhotos.map((photo) => (
              <Card key={photo.id} className="group overflow-hidden">
                <CardContent className="relative aspect-square w-full p-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.localUrl} alt="staged" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-2">
                    <Button size="icon" variant="secondary" onClick={() => setViewingUrl(photo.localUrl)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => handleRemoveStaged(photo.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
          <CardFooter>
            <Button onClick={handlePublish} disabled={isPublishing} className="w-full sm:w-auto ml-auto">
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isOwner ? `Process & Publish ${stagedPhotos.length} Photos` : `Submit ${stagedPhotos.length} Photos`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Cover photo banner */}
      {isOwner && coverImageUrl && (
        <div className="relative overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImageUrl} alt="Event cover" className="h-48 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">Cover Photo</span>
          </div>
        </div>
      )}

      {/* Published gallery */}
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{isOwner ? 'All Photos' : 'Your Photos'}</h2>
            {!isOwner && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Showing photos where your face was recognized.
              </p>
            )}
          </div>
          {isOwner && selectableIds.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={toggleSelectAll}>
                <CheckSquare className="h-4 w-4" />
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </motion.div>
          )}
        </div>

        {/* ── Filter bar ── */}
        {isOwner && publishedPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            {/* Status pills + controls row */}
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />

              {/* Status segment pills */}
              <div className="flex rounded-xl bg-muted p-1 text-xs font-medium gap-0.5">
                {STATUS_PILLS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className="relative rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {statusFilter === key && (
                      <motion.div
                        layoutId="status-pill"
                        className="absolute inset-0 rounded-lg bg-background shadow-sm"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className={`relative z-10 transition-colors ${statusFilter === key ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Uploader dropdown */}
              {uploaderMap.size > 1 && (
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <select
                    value={uploaderFilter}
                    onChange={(e) => setUploaderFilter(e.target.value)}
                    className="rounded-xl border bg-background/60 backdrop-blur-sm py-1.5 pl-7 pr-8 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none cursor-pointer transition-all"
                  >
                    <option value="">All uploaders</option>
                    {[...uploaderMap.entries()].map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl border bg-background/60 py-1.5 px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl border bg-background/60 py-1.5 px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all cursor-pointer"
                />
              </div>

              {/* Clear all */}
              <AnimatePresence>
                {hasActiveFilter && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    onClick={clearFilters}
                    className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <X className="h-3 w-3" /> Clear
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Result count + active filter chips */}
            <AnimatePresence>
              {hasActiveFilter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-2 overflow-hidden"
                >
                  <motion.span
                    key={filteredPhotos.length}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums"
                  >
                    {filteredPhotos.length} of {publishedPhotos.length} photos
                  </motion.span>
                  {statusFilter !== 'all' && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {STATUS_PILLS.find(p => p.key === statusFilter)?.label}
                      <button onClick={() => setStatusFilter('all')}><X className="h-2.5 w-2.5" /></button>
                    </motion.span>
                  )}
                  {uploaderFilter && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {uploaderMap.get(uploaderFilter)}
                      <button onClick={() => setUploaderFilter('')}><X className="h-2.5 w-2.5" /></button>
                    </motion.span>
                  )}
                  {(dateFrom || dateTo) && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {dateFrom || '…'} → {dateTo || '…'}
                      <button onClick={() => { setDateFrom(''); setDateTo(''); }}><X className="h-2.5 w-2.5" /></button>
                    </motion.span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {filteredPhotos.map((photo) => {
            const isCover = photo.s3_key === coverS3Key;
            const isSelected = selected.has(photo.photo_id);
            return (
              <motion.div
                key={photo.photo_id}
                variants={staggerItem}
                whileHover={!photo.is_processing ? { y: -3, transition: { duration: 0.15 } } : {}}
                layout
              >
                <motion.div
                  animate={{
                    scale: isSelected ? 0.96 : 1,
                    transition: spring,
                  }}
                >
                  <Card className={cn(
                    'group overflow-hidden cursor-pointer transition-shadow duration-200',
                    isCover && 'ring-2 ring-yellow-400',
                    isSelected && 'ring-2 ring-primary shadow-lg shadow-primary/20',
                  )}>
                    <CardContent className="relative h-64 w-full p-0">
                      {photo.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.thumbnail_url ?? photo.url}
                          alt={`Photo ${photo.photo_id}`}
                          className={cn(
                            'h-full w-full object-cover transition-transform duration-300 group-hover:scale-105',
                            photo.is_processing && 'filter grayscale',
                          )}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-muted">
                          <FileImage className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}

                      {/* Processing overlay */}
                      {photo.is_processing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <p className="mt-2 text-sm">Processing…</p>
                        </div>
                      )}

                      {/* Selection checkbox — owner, non-processing */}
                      {isOwner && !photo.is_processing && (
                        <motion.div
                          className="absolute top-2 left-2 z-10"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{
                            opacity: isSelected ? 1 : undefined,
                            scale: isSelected ? 1 : undefined,
                          }}
                          whileHover={{ opacity: 1, scale: 1 }}
                        >
                          <div
                            className={cn(
                              'rounded-md p-0.5 transition-opacity',
                              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                            )}
                            onClick={(e) => { e.stopPropagation(); toggleSelect(photo.photo_id); }}
                          >
                            <Checkbox
                              checked={isSelected}
                              className={cn(
                                'h-5 w-5 border-2 bg-white/90 shadow-sm',
                                isSelected && 'border-primary',
                              )}
                              onCheckedChange={() => toggleSelect(photo.photo_id)}
                            />
                          </div>
                        </motion.div>
                      )}

                      {/* Hover actions */}
                      {!photo.is_processing && (
                        <div className={cn(
                          'absolute inset-0 transition-opacity duration-200',
                          isSelected ? 'bg-primary/10' : 'bg-black/20 opacity-0 group-hover:opacity-100',
                        )}>
                          {isOwner && !isSelected && (
                            <button
                              onClick={() => handleSetCover(photo)}
                              className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 hover:bg-black/70 transition-colors"
                              title={isCover ? 'Current cover' : 'Set as cover'}
                            >
                              <Star className={cn('h-4 w-4', isCover ? 'fill-yellow-400 text-yellow-400' : 'text-white')} />
                            </button>
                          )}
                          {!isSelected && (
                            <div className="absolute bottom-2 right-2 flex gap-2">
                              <Button size="icon" variant="secondary" onClick={() => photo.url && setViewingUrl(photo.url)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {photo.url && (
                                <a href={photo.url} download>
                                  <Button size="icon" variant="secondary"><Download className="h-4 w-4" /></Button>
                                </a>
                              )}
                              {isOwner && (
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  onClick={() => handleDeletePhoto(photo.photo_id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Selected checkmark overlay */}
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={spring}
                            className="rounded-full bg-primary p-2 shadow-lg"
                          >
                            <svg className="h-5 w-5 text-primary-foreground" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </motion.div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            );
          })}

          {filteredPhotos.length === 0 && (
            <div className="col-span-full flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
              <div className="text-center">
                <FileImage className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">
                  {hasActiveFilter ? 'No photos match your filters' : 'No Photos Yet'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasActiveFilter
                    ? 'Try adjusting or clearing your filters.'
                    : isOwner ? 'Upload some photos to get started!' : 'Photos where your face appears will show here.'}
                </p>
                {hasActiveFilter && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-xs font-medium text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Floating Bulk Action Bar ── */}
      <AnimatePresence>
        {isOwner && someSelected && (
          <motion.div
            key="bulk-bar"
            variants={bulkBarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-2xl border bg-background/80 backdrop-blur-xl px-4 py-2.5 shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/10">

              {/* Count pill */}
              <motion.div
                key={selected.size}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={spring}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
              >
                <CheckSquare className="h-3 w-3" />
                {selected.size} selected
              </motion.div>

              <div className="h-5 w-px bg-border mx-1" />

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 rounded-xl text-sm font-medium h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={bulkDeleting}
                onClick={handleBulkDelete}
              >
                {bulkDeleting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />}
                Delete {selected.size} Photo{selected.size !== 1 ? 's' : ''}
              </Button>

              <div className="h-5 w-px bg-border mx-1" />

              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-xl text-muted-foreground"
                onClick={clearSelection}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
