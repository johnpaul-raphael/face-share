'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { Image, ShieldCheck, Users, Loader2, Copy, Check, LogOut, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient, EventDetailResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const basePath = `/dashboard/events/${eventId}`;

  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleCopyCode = () => {
    if (!event) return;
    navigator.clipboard.writeText(event.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveEvent = async () => {
    if (!currentUserId) return;
    setIsLeaving(true);
    try {
      await apiClient.leaveEvent(eventId, currentUserId);
      router.push('/dashboard');
    } catch {
      setIsLeaving(false);
    }
  };

  useEffect(() => {
    Promise.all([
      apiClient.getEvent(eventId),
      apiClient.getCurrentUser(),
    ])
      .then(([ev, me]) => {
        setEvent(ev);
        setCurrentUserId(me.id);
      })
      .catch(() => { })
      .finally(() => setIsLoading(false));
  }, [eventId]);

  const isOwner = event?.owner_id === currentUserId;

  const navItems = [
    { href: basePath, label: 'Gallery', icon: Image },
    ...(isOwner ?
      [{ href: `${basePath}/review`, label: 'Review', icon: ShieldCheck },
      { href: `${basePath}/participants`, label: 'Participants', icon: Users },] : []),
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Event not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <div className="flex items-center gap-3 flex-wrap justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-bold">{event.name}</h1>
            {isOwner && (
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-sm font-mono font-semibold tracking-widest hover:bg-muted/80 transition-colors"
                title="Click to copy join code"
              >
                {event.join_code}
                {copied
                  ? <Check className="h-3.5 w-3.5 text-green-500" />
                  : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </button>
            )}
          </div>

          {/* Leave Event — participants only, not the owner */}
          {!isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive">
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Leave Event
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will lose access to all photos in <strong>{event.name}</strong>. You can rejoin using the join code.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLeaveEvent}
                    disabled={isLeaving}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isLeaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Leave Event
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <p className="text-muted-foreground">{event.description}</p>
      </div>
      <div className="mb-4 border-b overflow-x-auto">
        <nav className="-mb-px flex space-x-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium',
                pathname === item.href || (item.href !== basePath && pathname.startsWith(item.href))
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-600'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
