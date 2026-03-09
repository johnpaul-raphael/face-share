'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient, ParticipantResponse } from '@/lib/api';

export default function ParticipantsPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { toast } = useToast();

  const [participants, setParticipants] = useState<ParticipantResponse[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingUpload, setTogglingUpload] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [event, me, list] = await Promise.all([
          apiClient.getEvent(eventId),
          apiClient.getCurrentUser(),
          apiClient.listParticipants(eventId),
        ]);
        setOwnerId(event.owner_id);
        setCurrentUserId(me.id);
        setParticipants(list);
      } catch {
        toast({ variant: 'destructive', title: 'Failed to load participants' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [eventId, toast]);

  const handleRemove = async (userId: string, userName: string) => {
    try {
      await apiClient.removeParticipant(eventId, userId);
      setParticipants((prev) => prev.filter((p) => p.user_id !== userId));
      toast({ title: 'Removed', description: `${userName} has been removed from the event.` });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to remove participant' });
    }
  };

  const handleToggleUpload = async (userId: string, currentValue: boolean) => {
    setTogglingUpload(userId);
    try {
      const updated = await apiClient.setUploadPermission(eventId, userId, !currentValue);
      setParticipants((prev) =>
        prev.map((p) => (p.user_id === userId ? { ...p, can_upload: updated.can_upload } : p))
      );
      toast({
        title: updated.can_upload ? 'Upload granted' : 'Upload revoked',
        description: `${updated.user_name} can ${updated.can_upload ? 'now' : 'no longer'} upload photos.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to update upload permission' });
    } finally {
      setTogglingUpload(null);
    }
  };

  const isOwner = currentUserId === ownerId;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
          <CardDescription>
            {participants.length} {participants.length === 1 ? 'person' : 'people'} in this event.
            {isOwner && ' Toggle the Upload switch to grant or revoke photo upload permission.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {isOwner && <TableHead>Can Upload</TableHead>}
                {isOwner && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow key={p.user_id}>
                  <TableCell>
                    <Avatar>
                      <AvatarFallback>{p.user_name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{p.user_name}</TableCell>
                  <TableCell>{p.user_email}</TableCell>
                  <TableCell>
                    {p.user_id === ownerId ? (
                      <Badge variant="default">Owner</Badge>
                    ) : (
                      <Badge variant="outline">Participant</Badge>
                    )}
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      {p.user_id === ownerId ? (
                        <Badge variant="secondary">Always</Badge>
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
                    </TableCell>
                  )}
                  {isOwner && (
                    <TableCell className="text-right">
                      {p.user_id !== ownerId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(p.user_id, p.user_name)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {participants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isOwner ? 6 : 4} className="h-24 text-center text-muted-foreground">
                    No participants yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
