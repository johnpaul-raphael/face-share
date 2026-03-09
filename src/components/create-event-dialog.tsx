'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Share2 } from 'lucide-react';
import { apiClient, EventResponse } from '@/lib/api';

const formSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters long.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters long.' }),
});

interface Props {
  children: React.ReactNode;
  onCreated?: (event: EventResponse) => void;
}

export function CreateEventDialog({ children, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<EventResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const event = await apiClient.createEvent({ name: values.name, description: values.description });
      setCreatedEvent(event);
      onCreated?.(event);
      toast({ title: 'Event Created!', description: `${values.name} has been successfully created.` });
      form.reset();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to create event',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => setCreatedEvent(null), 300);
  };

  const shareLink = typeof window !== 'undefined' && createdEvent
    ? `${window.location.origin}/dashboard/events/join?code=${createdEvent.join_code}`
    : '';
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`Join my event "${createdEvent?.name}" on FaceShare! Use this link: ${shareLink}`)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(o); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {!createdEvent ? (
          <>
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>Fill in the details to create your event.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control} name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Summer BBQ" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control} name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea placeholder="A short description of your event." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating…' : 'Create Event'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Event Created!</DialogTitle>
              <DialogDescription>Share this link so others can join.</DialogDescription>
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
              <Button variant="secondary" onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
