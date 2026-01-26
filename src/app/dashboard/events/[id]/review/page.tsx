'use client';

import Image from 'next/image';
import { Check, Wand2, X, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { photos, users } from '@/lib/data';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Photo, User } from '@/lib/types';


function ReviewCard({ photo, matchIndex }: { photo: Photo; matchIndex: number }) {
  const { toast } = useToast();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedRecipientIds, setSuggestedRecipientIds] = useState<string[]>([]);
  const match = photo.matches[matchIndex];
  
  const eventParticipants = users.filter(u => photo.eventId === 'event-1' ? u.id.startsWith('user-') : u.id.startsWith('user-'));

  const matchedUser = users.find((u) => u.id === match.userId);
  
  const handleGetSuggestions = async () => {
    setIsSuggesting(true);
    setSuggestedRecipientIds([]);
    toast({
      title: 'Getting AI Suggestions...',
      description: 'Please wait while we analyze the photo.',
    });

    // Simulate calling an AI flow
    setTimeout(() => {
        // Mock response: suggest 2 random participants who are not the currently matched user
        const otherParticipants = eventParticipants.filter(p => p.id !== matchedUser?.id);
        const suggestions = otherParticipants.sort(() => 0.5 - Math.random()).slice(0, 2);
        
        if (suggestions.length > 0) {
             setSuggestedRecipientIds(suggestions.map(u => u.id));
             toast({
                title: 'Suggestions Ready!',
                description: 'We found some potential matches for you to review.',
            });
        } else {
             toast({
                variant: 'destructive',
                title: 'No suggestions found.',
            });
        }
        setIsSuggesting(false);
    }, 2000);
  };
  
  const sortedParticipants = [...eventParticipants].sort((a, b) => {
    const aIsSuggested = suggestedRecipientIds.includes(a.id);
    const bIsSuggested = suggestedRecipientIds.includes(b.id);
    if (aIsSuggested && !bIsSuggested) return -1;
    if (!aIsSuggested && bIsSuggested) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Match</CardTitle>
        <CardDescription>
          Photo uploaded by {users.find(u => u.id === photo.uploaderId)?.name || 'Unknown'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <Image
            src={photo.url}
            alt={`Photo ${photo.id}`}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex items-center gap-4 rounded-lg border p-4">
          <Avatar className="h-16 w-16 border-2 border-primary">
            <AvatarImage src={match.faceImageUrl} />
            <AvatarFallback>
              <RefreshCw className="animate-spin" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <p className="text-sm text-muted-foreground">
              {suggestedRecipientIds.length > 0 ? "AI suggests it could be one of these:" : (match.userId ? "AI suggests this is:" : "Who is this?")}
            </p>
            <div className="flex items-center gap-2">
               <Select defaultValue={matchedUser?.id}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select participant..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedParticipants.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                        {p.name} {suggestedRecipientIds.includes(p.id) && '✨'}
                    </SelectItem>
                  ))}
                  <SelectItem value="remove">Not a participant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="secondary">Confidence: {(match.confidence * 100).toFixed(0)}%</Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
         <Button variant="outline" onClick={handleGetSuggestions} disabled={isSuggesting}>
            {isSuggesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Wand2 className="mr-2 h-4 w-4" />
            )}
          Get Suggestions
        </Button>
        <div className="flex gap-2">
          <Button variant="destructive">
            <X className="mr-2 h-4 w-4" /> Remove
          </Button>
          <Button>
            <Check className="mr-2 h-4 w-4" /> Approve
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}


export default function ReviewPage({ params }: { params: { id: string } }) {
  const lowConfidencePhotos = photos.filter(
    (p) =>
      p.eventId === params.id &&
      p.matches.some((m) => !m.isConfirmed)
  );

  return (
    <div className="space-y-6">
       <div>
        <h2 className="text-xl font-bold">Manual Review</h2>
        <p className="text-muted-foreground">
          Review photos with low-confidence matches to ensure correct delivery.
        </p>
      </div>
      {lowConfidencePhotos.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {lowConfidencePhotos.map((photo) =>
            photo.matches
              .filter((m) => !m.isConfirmed)
              .map((_, index) => (
                <ReviewCard key={`${photo.id}-${index}`} photo={photo} matchIndex={index} />
              ))
          )}
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
          <div className="text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No Reviews Needed</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              All photos have high-confidence matches.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
