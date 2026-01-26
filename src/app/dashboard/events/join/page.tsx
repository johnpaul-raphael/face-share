'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { events, users } from '@/lib/data';
import type { Event } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

function JoinEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [joinCode, setJoinCode] = useState('');
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  const currentUser = users[0]; // Mock current user

  useEffect(() => {
    const codeFromParams = searchParams.get('code');
    if (codeFromParams) {
      const upperCode = codeFromParams.toUpperCase();
      setJoinCode(upperCode);
      findAndSetEvent(upperCode);
    } else {
      setIsLoading(false);
      setEvent(null);
      setJoinCode('');
    }
  }, [searchParams]);

  const findAndSetEvent = (code: string) => {
    setIsLoading(true);
    setError(null);
    // Simulate API call
    setTimeout(() => {
      const foundEvent = events.find((e) => e.joinCode === code);
      if (foundEvent) {
        setEvent(foundEvent);
      } else {
        setError('Event not found. Please check the code and try again.');
        setEvent(null);
        router.replace('/dashboard/events/join');
      }
      setIsLoading(false);
    }, 500);
  };
  
  const handleCodeSubmit = () => {
      if(joinCode.length === 6){
          router.push(`/dashboard/events/join?code=${joinCode}`);
      }
  }

  const handleJoinOrGoToEvent = () => {
    if (!event) return;

    if (event.participantIds.includes(currentUser.id)) {
      router.push(`/dashboard/events/${event.id}`);
      return;
    }
    
    if (event.pendingParticipantIds?.includes(currentUser.id)) {
      toast({
        title: 'Request Already Sent',
        description: 'You have already requested to join this event. The owner will review it soon.',
      });
      return;
    }

    setIsJoining(true);
    
    setTimeout(() => {
      const eventToUpdate = events.find(e => e.id === event.id);
      if (eventToUpdate) {
        if (!eventToUpdate.pendingParticipantIds) {
          eventToUpdate.pendingParticipantIds = [];
        }
        if (!eventToUpdate.pendingParticipantIds.includes(currentUser.id)) {
            eventToUpdate.pendingParticipantIds.push(currentUser.id);
        }
      }

      toast({
        title: 'Request Sent!',
        description: `Your request to join "${event.name}" has been sent for approval.`,
      });

      router.push(`/dashboard`);
    }, 1000);
  };
  
  if (isLoading) {
     return (
       <div className="flex w-full items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
       </div>
     )
  }

  if (event) {
    const isAlreadyParticipant = event.participantIds.includes(currentUser.id);
    const hasRequested = event.pendingParticipantIds?.includes(currentUser.id);

    const getButtonText = () => {
        if (isAlreadyParticipant) return 'Go to Event';
        if (hasRequested) return 'Request Sent';
        return 'Request to Join Event';
    }

    return (
       <div className="flex w-full items-center justify-center">
        <div className="w-full max-w-md">
            <Card className="overflow-hidden">
                <div className="relative h-48 w-full">
                    <Image src={event.coverImageUrl} alt={event.name} fill className="object-cover" />
                </div>
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                  <CardDescription>{event.description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        You've been invited by <span className="font-semibold">{users.find(u => u.id === event.ownerId)?.name || 'the event owner'}</span> to join this event.
                    </p>
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-4 p-4">
                <Button onClick={handleJoinOrGoToEvent} disabled={isJoining || hasRequested}>
                    {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {getButtonText()}
                </Button>
                <Button variant="ghost" onClick={() => router.push('/dashboard/events/join')}>
                    Try a different code
                </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full items-center justify-center">
      <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Join an Event</CardTitle>
              <CardDescription>
                Enter the 6-character event code you received to join.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-code">Event Code</Label>
                <Input
                  id="join-code"
                  placeholder="e.g. INNO24"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && joinCode.length === 6) {
                      handleCodeSubmit();
                    }
                  }}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-4">
               <Button onClick={handleCodeSubmit} disabled={joinCode.length < 6}>
                 Find Event
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Go back to Dashboard
                </Link>
              </Button>
            </CardFooter>
          </Card>
      </div>
    </div>
  );
}


export default function JoinEventPageWrapper() {
  return (
    <Suspense>
      <JoinEventPage />
    </Suspense>
  )
}
