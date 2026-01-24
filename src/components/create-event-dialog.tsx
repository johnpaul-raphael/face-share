'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { events, users } from '@/lib/data';
import type { Event } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Share2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters long.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters long.' }),
});

export function CreateEventDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Event | null>(null);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const currentUser = users[0]; // Mock current user

  function onSubmit(values: z.infer<typeof formSchema>) {
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newEventData: Event = {
      id: `event-${events.length + 1}`,
      name: values.name,
      description: values.description,
      ownerId: currentUser.id,
      participantIds: [currentUser.id],
      coverImageUrl: `https://picsum.photos/seed/${Math.random()}/600/400`,
      joinCode: joinCode,
    };
    
    // In a real app, you'd call a server action here.
    // For now, we just add it to our mock data.
    events.push(newEventData);
    setNewEvent(newEventData);

    toast({
      title: 'Event Created!',
      description: `${values.name} has been successfully created.`,
    });
    
    form.reset();
  }
  
  const handleClose = () => {
    setOpen(false);
    // A timeout to allow the dialog to close before resetting the view
    setTimeout(() => setNewEvent(null), 300);
  }
  
  const shareLink = typeof window !== 'undefined' && newEvent ? `${window.location.origin}/dashboard/events/join?code=${newEvent.joinCode}` : '';
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`Join my event "${newEvent?.name}" on FaceShare! Use this link to join: ${shareLink}`)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(o); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {!newEvent ? (
          <>
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>
                Fill in the details below to create your new event.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Summer BBQ" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="A short description of your event."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Create Event</Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Event Created!</DialogTitle>
              <DialogDescription>
                Your event has been created. Share this link with your friends to join.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
               <div className="flex items-center space-x-2">
                <Input value={shareLink} readOnly />
                <Button onClick={() => navigator.clipboard.writeText(shareLink)} variant="outline">Copy</Button>
              </div>
              <Button asChild className="w-full">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <Share2 className="mr-2 h-4 w-4" /> Share on WhatsApp
                </a>
              </Button>
            </div>
             <DialogFooter>
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
