import Image from 'next/image';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { events, users } from '@/lib/data';
import { CreateEventDialog } from '@/components/create-event-dialog';

export default function DashboardPage() {
  const currentUser = users[0]; // Mock current user
  const userEvents = events.filter((event) =>
    event.participantIds.includes(currentUser.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {currentUser.name}!</h1>
          <p className="text-muted-foreground">Here are your ongoing events.</p>
        </div>
        <CreateEventDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        </CreateEventDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {userEvents.map((event) => (
          <Link key={event.id} href={`/dashboard/events/${event.id}`}>
            <Card className="flex h-full transform flex-col transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <CardHeader className="p-0">
                <div className="relative h-48 w-full">
                  <Image
                    src={event.coverImageUrl}
                    alt={event.name}
                    fill
                    className="rounded-t-lg object-cover"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4">
                <CardTitle className="mb-2 text-lg">{event.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {event.description}
                </CardDescription>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{event.participantIds.length} participants</span>
                  </div>
                  {event.ownerId === currentUser.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      Owner
                    </span>
                  )}
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
         <Card className="flex h-full min-h-[280px] items-center justify-center rounded-lg border-2 border-dashed">
          <div className="text-center">
            <CreateEventDialog>
              <Button variant="ghost">
                <Plus className="mr-2 h-4 w-4" />
                Create a New Event
              </Button>
            </CreateEventDialog>
            <p className="mt-2 text-sm text-muted-foreground">or join an existing one.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
