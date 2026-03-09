'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { apiClient, EventResponse } from '@/lib/api';

function JoinEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [joinCode, setJoinCode] = useState('');
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const codeFromParams = searchParams.get('code');
    if (codeFromParams) {
      const upperCode = codeFromParams.toUpperCase();
      setJoinCode(upperCode);
      previewEvent(upperCode);
    }
  }, [searchParams]);

  const previewEvent = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Join immediately (auto-approved) — if already joined, error is handled below
      const result = await apiClient.joinEvent(code);
      setEvent(result.event);
      router.push(`/dashboard/events/${result.event.id}`);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('already a participant')) {
        // Try to get event details anyway by calling listEvents
        const events = await apiClient.listEvents().catch(() => []);
        const found = events.find((e) => e.join_code?.toUpperCase() === code);
        if (found) {
          router.push(`/dashboard/events/${found.id}`);
          return;
        }
        toast({ title: 'Already joined', description: 'You are already part of this event.' });
        router.push('/dashboard');
      } else {
        setError('Event not found. Please check the code and try again.');
        setEvent(null);
        router.replace('/dashboard/events/join');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = () => {
    if (joinCode.length === 6) {
      router.push(`/dashboard/events/join?code=${joinCode}`);
    }
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    setIsJoining(true);
    try {
      const result = await apiClient.joinEvent(joinCode);
      toast({ title: 'Joined!', description: `You have joined "${result.event.name}".` });
      router.push(`/dashboard/events/${result.event.id}`);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to join',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (event) {
    return (
      <div className="flex w-full items-center justify-center">
        <div className="w-full max-w-md">
          <Card className="overflow-hidden">
            <div className="relative h-48 w-full bg-muted flex items-center justify-center">
              {event.cover_image_url ? (
                <img src={event.cover_image_url} alt={event.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-muted-foreground text-sm">No cover image</span>
              )}
            </div>
            <CardHeader>
              <CardTitle>{event.name}</CardTitle>
              <CardDescription>{event.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Created by <span className="font-semibold">{event.owner_name}</span>
              </p>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-4 p-4">
              <Button onClick={handleJoin} disabled={isJoining}>
                {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join Event
              </Button>
              <Button variant="ghost" onClick={() => router.push('/dashboard/events/join')}>
                Try a different code
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Join an Event</CardTitle>
            <CardDescription>Enter the 6-character event code you received.</CardDescription>
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
                onKeyDown={(e) => { if (e.key === 'Enter' && joinCode.length === 6) handleCodeSubmit(); }}
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
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
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
  );
}
