'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, X, Upload, Ban, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence } from 'motion/react';

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

const bulkBarVariants = {
  hidden: { y: 100, opacity: 0, scale: 0.95 },
  visible: { y: 0, opacity: 1, scale: 1, transition: { ...spring } },
  exit: { y: 100, opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: 'easeIn' as const } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, x: 16, transition: { duration: 0.2 } },
};

export default function ParticipantsPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { toast } = useToast();

  const [togglingUpload, setTogglingUpload] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const { data: event, isLoading: eventLoading } =
    useSWR(`event-${eventId}`, () => apiClient.getEvent(eventId));
  const { data: me, isLoading: meLoading } =
    useSWR('current-user', () => apiClient.getCurrentUser());
  const { data: participants = [], isLoading: participantsLoading, mutate: mutateParticipants } =
    useSWR(`participants-${eventId}`, () => apiClient.listParticipants(eventId), {
      onError: () => toast({ variant: 'destructive', title: 'Couldn\'t load attendees', description: 'Refresh the page to try again.' }),
    });

  const isLoading = eventLoading || meLoading || participantsLoading;
  const ownerId = event?.owner_id ?? null;
  const currentUserId = me?.id ?? null;
  const isOwner = currentUserId === ownerId;

  const selectableIds = participants.filter((p) => p.user_id !== ownerId).map((p) => p.user_id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  };

  const clearSelection = () => setSelected(new Set());

  const handleRemove = async (userId: string, userName: string) => {
    try {
      await apiClient.removeParticipant(eventId, userId);
      mutateParticipants((prev) => (prev ?? []).filter((p) => p.user_id !== userId), false);
      setSelected((prev) => { const n = new Set(prev); n.delete(userId); return n; });
      toast({ title: `${userName} removed`, description: 'They\'ve been taken off the guest list.' });
    } catch {
      toast({ variant: 'destructive', title: 'Couldn\'t remove them', description: 'Try again in a moment.' });
    }
  };

  const handleToggleUpload = async (userId: string, currentValue: boolean) => {
    setTogglingUpload(userId);
    try {
      const updated = await apiClient.setUploadPermission(eventId, userId, !currentValue);
      mutateParticipants(
        (prev) => (prev ?? []).map((p) => (p.user_id === userId ? { ...p, can_upload: updated.can_upload } : p)),
        false,
      );
      toast({
        title: updated.can_upload ? 'Upload access on' : 'Upload access off',
        description: `${updated.user_name} ${updated.can_upload ? 'can now upload photos.' : 'can no longer upload photos.'}`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Permission not changed', description: 'Something went wrong — try again.' });
    } finally {
      setTogglingUpload(null);
    }
  };

  const handleBulkRemove = async () => {
    setBulkProcessing(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiClient.removeParticipant(eventId, id)));
    const removed = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failed = ids.length - removed.length;
    mutateParticipants((prev) => (prev ?? []).filter((p) => !removed.includes(p.user_id)), false);
    setSelected(new Set());
    setBulkProcessing(false);
    toast({
      title: `${removed.length} participant${removed.length !== 1 ? 's' : ''} removed`,
      description: failed ? `${failed} couldn't be removed.` : 'Guest list updated.',
    });
  };

  const handleBulkUpload = async (grant: boolean) => {
    setBulkProcessing(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiClient.setUploadPermission(eventId, id, grant)));
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    mutateParticipants(
      (prev) => (prev ?? []).map((p) => selected.has(p.user_id) ? { ...p, can_upload: grant } : p),
      false,
    );
    setSelected(new Set());
    setBulkProcessing(false);
    toast({
      title: grant ? `Upload granted to ${succeeded}` : `Upload revoked from ${succeeded}`,
      description: `${succeeded} participant${succeeded !== 1 ? 's' : ''} updated.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Participants
          </CardTitle>
          <CardDescription>
            {participants.length} {participants.length === 1 ? 'person' : 'people'} in this event.
            {isOwner && ' Select participants to perform bulk actions.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">

          {/* Table header */}
          <div className="grid grid-cols-[2rem_2.5rem_1fr_1fr_5rem_5rem_3rem] items-center gap-4 px-6 py-3 border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {isOwner ? (
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            ) : <span />}
            <span />
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            {isOwner && <span>Upload</span>}
            {isOwner && <span />}
          </div>

          {/* Rows */}
          <AnimatePresence initial={false}>
            {participants.map((p, i) => {
              const isParticipantOwner = p.user_id === ownerId;
              const isSelected = selected.has(p.user_id);
              return (
                <motion.div
                  key={p.user_id}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className={`grid grid-cols-[2rem_2.5rem_1fr_1fr_5rem_5rem_3rem] items-center gap-4 px-6 py-4 border-b last:border-0 transition-colors duration-150 ${
                    isSelected ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-muted/30'
                  }`}
                >
                  {/* Checkbox */}
                  {isOwner ? (
                    <motion.div animate={{ scale: isSelected ? 1.1 : 1 }} transition={spring}>
                      <Checkbox
                        checked={isSelected}
                        disabled={isParticipantOwner}
                        onCheckedChange={() => toggleSelect(p.user_id)}
                        aria-label={`Select ${p.user_name}`}
                      />
                    </motion.div>
                  ) : <span />}

                  {/* Avatar */}
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`text-xs ${isSelected ? 'bg-primary/20' : ''}`}>
                      {p.user_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <span className="font-medium text-sm truncate">{p.user_name}</span>
                  <span className="text-sm text-muted-foreground truncate">{p.user_email}</span>

                  {/* Role */}
                  <div>
                    {isParticipantOwner ? (
                      <Badge variant="default" className="text-xs">Owner</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Member</Badge>
                    )}
                  </div>

                  {/* Upload toggle */}
                  {isOwner && (
                    <div>
                      {isParticipantOwner ? (
                        <Badge variant="secondary" className="text-xs">Always</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={p.can_upload}
                            disabled={togglingUpload === p.user_id}
                            onCheckedChange={() => handleToggleUpload(p.user_id, p.can_upload)}
                          />
                          {togglingUpload === p.user_id && <Loader2 className="h-3 w-3 animate-spin" />}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Remove */}
                  {isOwner && (
                    <div className="flex justify-end">
                      {!isParticipantOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemove(p.user_id, p.user_name)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {participants.length === 0 && (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
              No participants yet.
            </div>
          )}
        </CardContent>
      </Card>

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
                <Users className="h-3 w-3" />
                {selected.size} selected
              </motion.div>

              <div className="h-5 w-px bg-border mx-1" />

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 rounded-xl text-sm font-medium h-8"
                disabled={bulkProcessing}
                onClick={() => handleBulkUpload(true)}
              >
                {bulkProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Grant Upload
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 rounded-xl text-sm font-medium h-8"
                disabled={bulkProcessing}
                onClick={() => handleBulkUpload(false)}
              >
                {bulkProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                Revoke Upload
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 rounded-xl text-sm font-medium h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={bulkProcessing}
                onClick={handleBulkRemove}
              >
                {bulkProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Remove
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
