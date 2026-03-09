'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Users, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { CreateEventDialog } from '@/components/create-event-dialog';
import { Badge } from '@/components/ui/badge';
import { apiClient, EventResponse } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    apiClient.listEvents()
      .then(setEvents)
      .catch(() => toast({ variant: 'destructive', title: 'Failed to load events' }))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Events</h1>
          <p className="text-muted-foreground">Events you own or have joined.</p>
        </div>
        <CreateEventDialog onCreated={(e) => setEvents((prev) => [e, ...prev])}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        </CreateEventDialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading events…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} href={`/dashboard/events/${event.id}`}>
              <Card className="flex h-full transform flex-col transition-transform duration-300 hover:scale-105 hover:shadow-xl">
                <CardHeader className="relative p-0">
                  <div className="relative h-48 w-full bg-muted flex items-center justify-center rounded-t-lg">
                    {event.cover_image_url ? (
                      <img
                        src={event.cover_image_url}
                        alt={event.name}
                        className="h-full w-full rounded-t-lg object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">No cover image</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-4">
                  <CardTitle className="mb-2 text-lg">{event.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{event.description}</CardDescription>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{event.participant_count} participants</span>
                    </div>
                    {/* owner badge based on owner_id would need current user — omit for now */}
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}

          <Card className="flex h-full min-h-[280px] items-center justify-center rounded-lg border-2 border-dashed">
            <div className="text-center">
              <CreateEventDialog onCreated={(e) => setEvents((prev) => [e, ...prev])}>
                <Button variant="ghost">
                  <Plus className="mr-2 h-4 w-4" />
                  Create a New Event
                </Button>
              </CreateEventDialog>
              <p className="mt-2 text-sm text-muted-foreground">or join an existing one.</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
