'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Share2, Check, Copy, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiClient, EventResponse } from '@/lib/api';
import { fadeInUp, fadeInScale, pageTransition } from '@/lib/animations';

const formSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
});

export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [createdEvent, setCreatedEvent] = useState<EventResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const event = await apiClient.createEvent({ name: values.name, description: values.description });
      setCreatedEvent(event);
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

  const shareLink = typeof window !== 'undefined' && createdEvent
    ? `${window.location.origin}/dashboard/events/join?code=${createdEvent.join_code}`
    : '';

  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(
    `Join my event "${createdEvent?.name}" on FaceShare! Use this link: ${shareLink}`
  )}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="max-w-xl mx-auto space-y-6"
      variants={pageTransition}
      initial="hidden"
      animate="visible"
    >
      {/* Back button */}
      <motion.button
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </motion.button>

      <AnimatePresence mode="wait">
        {!createdEvent ? (
          /* ── Form stage ── */
          <motion.div
            key="form"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold">Create New Event</h1>
              <p className="text-muted-foreground mt-1">Fill in the details to set up your photo-sharing event.</p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                      {isSubmitting
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                        : <><Plus className="mr-2 h-4 w-4" />Create Event</>
                      }
                    </Button>
                  </motion.div>
                </form>
              </Form>
            </div>
          </motion.div>
        ) : (
          /* ── Success stage ── */
          <motion.div
            key="success"
            variants={fadeInScale}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
              >
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </motion.div>
              <h1 className="text-2xl font-bold">Event Created!</h1>
              <p className="text-muted-foreground">Share the link below so others can join.</p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Join link</p>
              <div className="flex items-center gap-2">
                <Input value={shareLink} readOnly className="font-mono text-sm" />
                <Button onClick={handleCopy} variant="outline" size="icon">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button asChild className="w-full">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share on WhatsApp
                  </a>
                </Button>
              </motion.div>
            </div>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => router.push('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
