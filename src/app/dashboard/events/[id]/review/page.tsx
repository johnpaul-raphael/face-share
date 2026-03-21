'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, UserX, Users, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient, PhotoResponse, FaceMatchResponse } from '@/lib/api';
import { motion, AnimatePresence } from 'motion/react';

function confidenceInfo(score: number) {
  if (score >= 90) return { label: 'High', color: '#16a34a', bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.25)', Icon: ShieldCheck };
  if (score >= 75) return { label: 'Medium', color: '#d97706', bg: 'rgba(217,119,6,0.12)', border: 'rgba(217,119,6,0.25)', Icon: ShieldQuestion };
  return { label: 'Low', color: '#dc2626', bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.25)', Icon: ShieldAlert };
}

export default function ReviewPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { toast } = useToast();

  const { data: allPhotos = [], isLoading, mutate: mutatePhotos } = useSWR(
    `event-photos-${eventId}`,
    () => apiClient.getEventPhotos(eventId),
    { onError: () => toast({ variant: 'destructive', title: 'Photos unavailable', description: 'Refresh the page to try again.' }) },
  );

  const photos = allPhotos.filter((p) => !p.is_processing);
  const loadPhotos = () => mutatePhotos();

  const unmatchedPhotos = photos.filter((p) => p.match_count === 0);
  const matchedPhotos = photos.filter((p) => p.match_count > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Manual Review</h2>
          <p className="text-muted-foreground">
            Review AI face matches and manage unmatched photos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadPhotos}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="matched">
        <TabsList>
          <TabsTrigger value="matched">
            <Users className="h-4 w-4 mr-2" />
            Matched ({matchedPhotos.length})
          </TabsTrigger>
          <TabsTrigger value="unmatched">
            <UserX className="h-4 w-4 mr-2" />
            Unmatched ({unmatchedPhotos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matched" className="mt-4">
          {matchedPhotos.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {matchedPhotos.map((photo) => (
                <MatchedPhotoCard
                  key={photo.photo_id}
                  photo={photo}
                  eventId={eventId}
                  onMatchChange={loadPhotos}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="mx-auto h-12 w-12 text-muted-foreground" />}
              title="No Matched Photos"
              description="No photos have been matched to participants yet. Upload and process photos first."
            />
          )}
        </TabsContent>

        <TabsContent value="unmatched" className="mt-4">
          {unmatchedPhotos.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {unmatchedPhotos.map((photo) => (
                <UnmatchedPhotoCard key={photo.photo_id} photo={photo} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />}
              title="No Unmatched Photos"
              description="All processed photos have been matched to participants."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Matched Photo Card ────────────────────────────────────────────────────────

function MatchedPhotoCard({
  photo,
  eventId,
  onMatchChange,
}: {
  photo: PhotoResponse;
  eventId: string;
  onMatchChange: () => void;
}) {
  const { toast } = useToast();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { data: matches = [], isLoading: isLoadingMatches, mutate: mutateMatches } = useSWR(
    `photo-matches-${photo.photo_id}`,
    () => apiClient.getPhotoMatches(eventId, photo.photo_id),
    { onError: () => toast({ variant: 'destructive', title: 'Could not load match details' }) },
  );

  const handleConfirm = async (matchId: string) => {
    setActionInProgress(matchId);
    try {
      await apiClient.confirmMatch(eventId, photo.photo_id, matchId);
      mutateMatches((prev) => (prev ?? []).map((m) => (m.match_id === matchId ? { ...m, is_confirmed: true } : m)), false);
      toast({ title: 'Match confirmed' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to confirm match' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemove = async (matchId: string) => {
    setActionInProgress(matchId);
    try {
      await apiClient.deleteMatch(eventId, photo.photo_id, matchId);
      mutateMatches((prev) => (prev ?? []).filter((m) => m.match_id !== matchId), false);
      toast({ title: 'Match removed' });
      if (matches.length === 1) onMatchChange();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to remove match' });
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {photo.match_count} {photo.match_count === 1 ? 'Match' : 'Matches'}
        </CardTitle>
        <CardDescription>
          {photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleDateString() : 'Recently uploaded'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {photo.url ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`Photo ${photo.photo_id}`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">No preview</p>
          </div>
        )}

        <div className="space-y-2">
          {isLoadingMatches ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading matches…
            </div>
          ) : matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No match details available.</p>
          ) : (
            <AnimatePresence initial={false}>
              {matches.map((match, i) => {
                const { label, color, bg, border, Icon } = confidenceInfo(match.confidence);
                const pct = Math.round(match.confidence);
                return (
                  <motion.div
                    key={match.match_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 12, transition: { duration: 0.18 } }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 360, damping: 28 }}
                    className="overflow-hidden rounded-xl border"
                    style={{ borderColor: border, background: bg }}
                  >
                    <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 gap-2">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: color }}
                        >
                          {(match.user_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">
                            {match.user_name ?? match.user_id}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Icon className="h-3 w-3 shrink-0" style={{ color }} />
                            <span className="text-[10px] font-semibold" style={{ color }}>{pct}% · {label}</span>
                            {match.is_confirmed && (
                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">Confirmed</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        {!match.is_confirmed && (
                          <motion.div whileTap={{ scale: 0.88 }}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-100"
                              disabled={actionInProgress === match.match_id}
                              onClick={() => handleConfirm(match.match_id)}
                              title="Confirm match"
                            >
                              {actionInProgress === match.match_id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <CheckCircle className="h-3.5 w-3.5" />}
                            </Button>
                          </motion.div>
                        )}
                        <motion.div whileTap={{ scale: 0.88 }}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-100"
                            disabled={actionInProgress === match.match_id}
                            onClick={() => handleRemove(match.match_id)}
                            title="Remove match"
                          >
                            {actionInProgress === match.match_id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <XCircle className="h-3.5 w-3.5" />}
                          </Button>
                        </motion.div>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div className="px-3 pb-2.5">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-black/10">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: i * 0.05 + 0.15, duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Unmatched Photo Card ──────────────────────────────────────────────────────

function UnmatchedPhotoCard({ photo }: { photo: PhotoResponse }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserX className="h-4 w-4 text-muted-foreground" />
          Unmatched Photo
        </CardTitle>
        <CardDescription>
          <Badge variant="outline">No face match found</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {photo.url ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`Photo ${photo.photo_id}`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">No preview</p>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Uploaded {photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleDateString() : 'recently'}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
      <div className="text-center">
        {icon}
        <h3 className="mt-4 text-lg font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
