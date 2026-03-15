'use client';

import { Download, Upload, Loader2, X, FileImage, Trash2, Eye, Send, Lock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { apiClient, PhotoResponse } from '@/lib/api';
import { staggerContainer, staggerItem, backdropVariants, slideUpOverlay } from '@/lib/animations';

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
  const [publishedPhotos, setPublishedPhotos] = useState<PhotoResponse[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [coverS3Key, setCoverS3Key] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stagedPhotosRef = useRef(stagedPhotos);
  const { toast } = useToast();

  stagedPhotosRef.current = stagedPhotos;

  useEffect(() => {
    const load = async () => {
      try {
        const [event, me] = await Promise.all([
          apiClient.getEvent(eventId),
          apiClient.getCurrentUser(),
        ]);
        const owner = event.owner_id === me.id;
        setIsOwner(owner);
        setCoverS3Key(event.cover_photo_s3_key ?? '');
        setCoverImageUrl(event.cover_image_url ?? '');
        if (owner) {
          setCanUpload(true);
        } else {
          const myParticipant = event.participants.find((p) => p.user_id === me.id);
          setCanUpload(myParticipant?.can_upload ?? false);
        }
      } catch {
        // ignore
      }

      apiClient.getEventPhotos(eventId)
        .then(setPublishedPhotos)
        .catch(() => toast({ variant: 'destructive', title: 'Photos unavailable', description: 'Refresh the page to try again.' }));
    };
    load();
  }, [eventId, toast]);

  useEffect(() => {
    return () => {
      stagedPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.localUrl));
    };
  }, []);

  const addFilesToUploadQueue = async (files: File[]) => {
    for (const file of files) {
      const uploadingId = `${file.name}-${file.lastModified}-${Math.random()}`;
      setUploadingFiles((prev) => [...prev, { file, id: uploadingId, progress: 0 }]);

      try {
        const { upload_url, s3_key, photo_id } = await apiClient.getPresignedUpload({
          filename: file.name,
          content_type: file.type || 'image/jpeg',
          event_id: eventId,
        });

        await apiClient.uploadToS3(upload_url, file, (pct) => {
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
    apiClient.getEventPhotos(eventId).then(setPublishedPhotos).catch(() => {});
    setIsPublishing(false);
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await apiClient.deletePhoto(eventId, photoId);
      setPublishedPhotos((prev) => prev.filter((p) => p.photo_id !== photoId));
      const deleted = publishedPhotos.find((p) => p.photo_id === photoId);
      if (deleted && deleted.s3_key === coverS3Key) {
        setCoverS3Key('');
        setCoverImageUrl('');
      }
      toast({ title: 'Photo removed ✓', description: 'Gone from the event.' });
    } catch {
      toast({ variant: 'destructive', title: 'Couldn\'t remove photo', description: 'Try again in a moment.' });
    }
  };

  const handleSetCover = async (photo: PhotoResponse) => {
    try {
      await apiClient.updateEvent(eventId, { cover_image_url: photo.s3_key });
      setCoverS3Key(photo.s3_key);
      setCoverImageUrl(photo.url ?? '');
      router.refresh();
      toast({ title: 'Cover updated ✓', description: 'New cover is live on the event.' });
    } catch {
      toast({ variant: 'destructive', title: 'Cover not updated', description: 'Try selecting the photo again.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Motion photo preview overlay ── */}
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
      <div>
        <h2 className="text-xl font-bold mb-4">
          {isOwner ? 'All Photos' : 'Your Photos'}
        </h2>
        {!isOwner && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing photos where your face was recognized.
          </p>
        )}
        {isOwner && (
          <p className="text-sm text-muted-foreground mb-4">
            Click the <Star className="inline h-3 w-3" /> on any photo to set it as the event cover.
          </p>
        )}
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {publishedPhotos.map((photo) => {
            const isCover = photo.s3_key === coverS3Key;
            return (
              <motion.div key={photo.photo_id} variants={staggerItem} whileHover={{ y: -2, transition: { duration: 0.15 } }}>
                <Card className={cn('group overflow-hidden', isCover && 'ring-2 ring-yellow-400')}>
                  <CardContent className="relative h-64 w-full p-0">
                    {photo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.url}
                        alt={`Photo ${photo.photo_id}`}
                        className={cn('h-full w-full object-cover transition-transform duration-300 group-hover:scale-105', photo.is_processing && 'filter grayscale')}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-muted">
                        <FileImage className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    {photo.is_processing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="mt-2 text-sm">Processing…</p>
                      </div>
                    )}
                    {!photo.is_processing && (
                      <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                        {isOwner && (
                          <button
                            onClick={() => handleSetCover(photo)}
                            className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 hover:bg-black/70"
                            title={isCover ? 'Current cover' : 'Set as cover'}
                          >
                            <Star className={cn('h-4 w-4', isCover ? 'fill-yellow-400 text-yellow-400' : 'text-white')} />
                          </button>
                        )}
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
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {publishedPhotos.length === 0 && stagedPhotos.length === 0 && uploadingFiles.length === 0 && (
            <div className="col-span-full flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
              <div className="text-center">
                <FileImage className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Photos Yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isOwner ? 'Upload some photos to get started!' : 'Photos where your face appears will show here.'}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
