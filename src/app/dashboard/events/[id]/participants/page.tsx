'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { events, users } from '@/lib/data';
import type { User } from '@/lib/types';
import { Check, X, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


export default function ParticipantsPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { toast } = useToast();

  // Find the event from mock data. In a real app this would be a fetch.
  const initialEvent = events.find((e) => e.id === eventId);
  const currentUser = users[0]; // Mock current user

  const [approvedUsers, setApprovedUsers] = useState<User[]>(() => 
    initialEvent?.participantIds
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => !!u) || []
  );

  const [pendingUsers, setPendingUsers] = useState<User[]>(() =>
    initialEvent?.pendingParticipantIds
      ?.map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => !!u) || []
  );

  if (!initialEvent) {
    return <div>Event not found</div>;
  }
  
  const isOwner = initialEvent.ownerId === currentUser.id;

  const handleApprove = (userId: string) => {
    // Update mock data
    const event = events.find(e => e.id === eventId);
    if (event) {
        if(event.pendingParticipantIds) {
           event.pendingParticipantIds = event.pendingParticipantIds.filter(id => id !== userId);
        }
        if(!event.participantIds.includes(userId)) {
           event.participantIds.push(userId);
        }
    }
    
    // Update local state for UI reactivity
    const userToApprove = pendingUsers.find(u => u.id === userId);
    if (userToApprove) {
        setPendingUsers(prev => prev.filter(u => u.id !== userId));
        setApprovedUsers(prev => [...prev, userToApprove]);
        toast({ title: 'Participant Approved', description: `${userToApprove.name} can now access the event.` });
    }
  };

  const handleDeny = (userId: string) => {
    // Update mock data
    const event = events.find(e => e.id === eventId);
    if (event?.pendingParticipantIds) {
        event.pendingParticipantIds = event.pendingParticipantIds.filter(id => id !== userId);
    }
    
    // Update local state
    const userToDeny = pendingUsers.find(u => u.id === userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
    if(userToDeny) {
        toast({ variant: 'destructive', title: 'Request Denied', description: `${userToDeny.name}'s request to join has been denied.` });
    }
  };
  
  const handleApproveAll = () => {
    const event = events.find(e => e.id === eventId);
    if (event) {
        const pendingIds = event.pendingParticipantIds || [];
        for (const id of pendingIds) {
            if (!event.participantIds.includes(id)) {
                event.participantIds.push(id);
            }
        }
        event.pendingParticipantIds = [];
    }

    setApprovedUsers(prev => [...prev, ...pendingUsers]);
    setPendingUsers([]);
    toast({ title: 'All Approved', description: `All pending requests have been approved.` });
  };

  return (
    <div className="space-y-6">
      {isOwner && pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
            <CardDescription>Review and approve users who want to join your event.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar>
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="ghost" size="icon" onClick={() => handleDeny(user.id)}><X className="h-4 w-4" /></Button>
                       <Button variant="ghost" size="icon" onClick={() => handleApprove(user.id)}><Check className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
           <CardFooter className="border-t px-6 py-4">
              <Button onClick={handleApproveAll}>
                  <UserCheck className="mr-2 h-4 w-4"/>
                  Approve All ({pendingUsers.length})
              </Button>
            </CardFooter>
        </Card>
      )}

      <Card>
        <CardHeader>
           <CardTitle>Participants</CardTitle>
           <CardDescription>These users have access to the event.</CardDescription>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedUsers.map(
                    (user) =>
                      user && (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Avatar>
                              <AvatarImage src={user.avatarUrl} alt={user.name} />
                              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {initialEvent.ownerId === user.id ? (
                              <Badge variant="default">Owner</Badge>
                            ) : (
                              <Badge variant="outline">Participant</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                  )}
                  {approvedUsers.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No participants have been approved yet.
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
