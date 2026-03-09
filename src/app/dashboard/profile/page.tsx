'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ShieldCheck, AlertTriangle, Loader2, X, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import type { User } from '@/lib/types';

const MAX_SLOTS = 3;

type Slot = {
  index: number;
  // image already saved on the server
  saved: { imageId: string; url: string } | null;
  // image selected locally, not yet uploaded
  pending: { file: File; previewUrl: string } | null;
  // true when the saved image should be deleted on Save
  deleteSaved: boolean;
};

function makeEmptySlots(): Slot[] {
  return Array.from({ length: MAX_SLOTS }, (_, i) => ({
    index: i,
    saved: null,
    pending: null,
    deleteSaved: false,
  }));
}

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [slots, setSlots] = useState<Slot[]>(makeEmptySlots());
  const [hasConsented, setHasConsented] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingFace, setIsSavingFace] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [userData, profileData] = await Promise.all([
          apiClient.getCurrentUser(),
          apiClient.getFaceProfile(),
        ]);
        if (cancelled) return;
        setCurrentUser(userData);
        const newSlots = makeEmptySlots();
        profileData.images.slice(0, MAX_SLOTS).forEach((img, i) => {
          newSlots[i].saved = { imageId: img.id, url: img.url ?? '' };
        });
        setSlots(newSlots);
      } catch {
        if (!cancelled) toast({ variant: 'destructive', title: 'Failed to load profile' });
      } finally {
        if (!cancelled) setIsProfileLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ─── Profile info ───────────────────────────────────────────────────────────

  const updateEmailAndName = async () => {
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      const updated = await apiClient.updateProfile(currentUser);
      setCurrentUser(updated);
      toast({ title: 'Profile updated!' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to update profile' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ─── Slot actions ───────────────────────────────────────────────────────────

  const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];

  const handleFileSelect = (slotIndex: number, file: File) => {
    if (!SUPPORTED_TYPES.includes(file.type.toLowerCase())) {
      toast({
        variant: 'destructive',
        title: 'Invalid image format',
        description: `"${file.name}" is not supported. Please upload a JPEG or PNG file.`,
      });
      return;
    }

    setSlots((prev) =>
      prev.map((s) => {
        if (s.index !== slotIndex) return s;
        // Revoke previous pending blob URL
        if (s.pending) URL.revokeObjectURL(s.pending.previewUrl);
        return {
          ...s,
          pending: { file, previewUrl: URL.createObjectURL(file) },
          // If a saved image exists it will be replaced → mark for deletion
          deleteSaved: !!s.saved,
        };
      })
    );
  };

  const handleCancelPending = (slotIndex: number) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.index !== slotIndex) return s;
        if (s.pending) URL.revokeObjectURL(s.pending.previewUrl);
        return { ...s, pending: null, deleteSaved: false };
      })
    );
  };

  const handleDeleteSaved = (slotIndex: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.index === slotIndex ? { ...s, deleteSaved: true } : s
      )
    );
  };

  // ─── Save face profile ──────────────────────────────────────────────────────

  const handleSaveFaceProfile = async () => {
    if (!hasConsented) {
      toast({ variant: 'destructive', title: 'Consent required', description: 'Check the consent box first.' });
      return;
    }

    const slotsToDelete = slots.filter((s) => s.deleteSaved && s.saved);
    const slotsToUpload = slots.filter((s) => s.pending);
    if (slotsToDelete.length === 0 && slotsToUpload.length === 0) return;

    setIsSavingFace(true);
    let anyFailed = false;

    // Delete removed images
    for (const slot of slotsToDelete) {
      try {
        await apiClient.deleteFaceProfileImage(slot.saved!.imageId);
      } catch {
        anyFailed = true;
        toast({ variant: 'destructive', title: `Failed to delete photo ${slot.index + 1}` });
      }
    }

    // Upload new images
    for (const slot of slotsToUpload) {
      const { file, previewUrl: blobUrl } = slot.pending!;
      try {
        const { upload_url, s3_key, face_image_id } = await apiClient.getPresignedUpload({
          filename: file.name,
          content_type: file.type || 'image/jpeg',
        });
        await apiClient.uploadToS3(upload_url, file, () => {});
        await apiClient.confirmFaceProfileUpload(face_image_id!, s3_key);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        anyFailed = true;
        toast({
          variant: 'destructive',
          title: `Failed to upload photo ${slot.index + 1}`,
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    }

    // Reload from server
    try {
      const profileData = await apiClient.getFaceProfile();
      const newSlots = makeEmptySlots();
      profileData.images.slice(0, MAX_SLOTS).forEach((img, i) => {
        newSlots[i].saved = { imageId: img.id, url: img.url ?? '' };
      });
      setSlots(newSlots);
    } catch {
      // fallback: clear pending/delete flags so at least UI reflects attempted changes
      setSlots((prev) =>
        prev.map((s) => ({ ...s, pending: null, deleteSaved: false }))
      );
    }

    setIsSavingFace(false);
    if (!anyFailed) toast({ title: 'Face profile saved!' });
  };

  // ─── Derived state ──────────────────────────────────────────────────────────

  const hasChanges = slots.some((s) => (s.deleteSaved && s.saved) || s.pending);

  // count of images that will exist after save
  const effectiveSavedCount = slots.filter(
    (s) => s.pending || (s.saved && !s.deleteSaved)
  ).length;

  const profileStatus =
    effectiveSavedCount >= MAX_SLOTS
      ? { variant: 'default' as const, title: 'Profile Ready', description: 'Your face profile is complete and ready for photo tagging.', icon: ShieldCheck }
      : { variant: 'destructive' as const, title: 'Add More Photos', description: `Add ${MAX_SLOTS - effectiveSavedCount} more photo(s) to complete your profile.`, icon: AlertTriangle };

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (isProfileLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Full-screen image preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* ── Profile info ── */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={currentUser?.name ?? ''}
                  disabled={isSavingProfile}
                  onChange={(e) =>
                    setCurrentUser((prev) => prev ? { ...prev, name: e.target.value } : null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={currentUser?.email ?? ''}
                  disabled={isSavingProfile}
                  onChange={(e) =>
                    setCurrentUser((prev) => prev ? { ...prev, email: e.target.value } : null)
                  }
                />
              </div>
              <Button className="w-full" onClick={updateEmailAndName} disabled={isSavingProfile}>
                {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Face profile ── */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Face Profile</CardTitle>
                <CardDescription>
                  Add up to {MAX_SLOTS} clear photos of your face to enable automatic photo tagging.
                </CardDescription>
              </div>
              {/* Save button — top-right, only when there are pending changes */}
              {hasChanges && (
                <Button
                  onClick={handleSaveFaceProfile}
                  disabled={isSavingFace || !hasConsented}
                  className="shrink-0"
                  size="sm"
                >
                  {isSavingFace ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />Save Photos</>
                  )}
                </Button>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              <Alert variant={profileStatus.variant}>
                <profileStatus.icon className="h-4 w-4" />
                <AlertTitle>{profileStatus.title}</AlertTitle>
                <AlertDescription>{profileStatus.description}</AlertDescription>
              </Alert>

              {/* 3 image slots */}
              <div className="grid grid-cols-3 gap-4">
                {slots.map((slot) => {
                  // What URL to display: pending preview takes priority, then saved (unless deleted)
                  const displayUrl =
                    slot.pending?.previewUrl ??
                    (!slot.deleteSaved ? slot.saved?.url : null) ??
                    null;

                  const isNew = !!slot.pending;

                  return (
                    <div key={slot.index} className="group relative aspect-square">
                      {/* Hidden file input, one per slot */}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/bmp,.jpg,.jpeg,.png,.gif,.bmp"
                        className="hidden"
                        ref={(el) => { fileRefs.current[slot.index] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(slot.index, file);
                          e.target.value = '';
                        }}
                      />

                      {displayUrl ? (
                        <>
                          {/* Image — click to preview full-size */}
                          <img
                            src={displayUrl}
                            alt={`Face photo ${slot.index + 1}`}
                            className="h-full w-full cursor-zoom-in rounded-xl object-cover"
                            onClick={() => setPreviewUrl(displayUrl)}
                          />

                          {/* Uploading overlay */}
                          {isSavingFace && isNew && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                              <Loader2 className="h-7 w-7 animate-spin text-white" />
                            </div>
                          )}

                          {/* "new" badge for pending images */}
                          {isNew && !isSavingFace && (
                            <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white shadow">
                              new
                            </span>
                          )}

                          {/* Hover action buttons */}
                          {!isSavingFace && (
                            <div className="absolute inset-0 flex items-end justify-center gap-2 rounded-xl bg-black/0 pb-2 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                              {/* Replace button */}
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow hover:bg-white"
                                title="Replace photo"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileRefs.current[slot.index]?.click();
                                }}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                              {/* Delete / Cancel button */}
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                                title={isNew ? 'Cancel' : 'Remove photo'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  isNew
                                    ? handleCancelPending(slot.index)
                                    : handleDeleteSaved(slot.index);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        /* Empty slot */
                        <button
                          className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => fileRefs.current[slot.index]?.click()}
                          disabled={isSavingFace}
                        >
                          <Plus className="h-7 w-7" />
                          <span className="text-xs font-medium">Add photo</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Consent checkbox */}
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <Checkbox
                  id="consent"
                  checked={hasConsented}
                  onCheckedChange={(v) => setHasConsented(v as boolean)}
                  className="mt-0.5"
                />
                <label htmlFor="consent" className="cursor-pointer text-sm leading-snug text-muted-foreground">
                  I consent to the use of my photos for facial recognition to enable automatic photo tagging.
                </label>
              </div>

              {/* Save button at the bottom (convenience) */}
              {hasChanges && (
                <div className="space-y-1.5">
                  <Button
                    className="w-full"
                    onClick={handleSaveFaceProfile}
                    disabled={isSavingFace || !hasConsented}
                  >
                    {isSavingFace ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" />Save Face Profile</>
                    )}
                  </Button>
                  {!hasConsented && (
                    <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                      Check the consent box above to enable saving.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
