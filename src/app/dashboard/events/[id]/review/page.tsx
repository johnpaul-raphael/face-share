import Image from 'next/image';
import { Check, Wand2, X, RefreshCw, ShieldCheck } from 'lucide-react';
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

export default function ReviewPage({ params }: { params: { id: string } }) {
  const lowConfidencePhotos = photos.filter(
    (p) =>
      p.eventId === params.id &&
      p.matches.some((m) => !m.isConfirmed)
  );
  
  const eventParticipants = users.filter(u => u.id.startsWith('user-'));

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
              .map((match, index) => {
                const matchedUser = users.find((u) => u.id === match.userId);
                return (
                  <Card key={`${photo.id}-${index}`}>
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
                            AI suggests this is:
                          </p>
                          <div className="flex items-center gap-2">
                             <Select defaultValue={matchedUser?.id}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select participant..." />
                              </SelectTrigger>
                              <SelectContent>
                                {eventParticipants.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
                       <Button variant="outline">
                        <Wand2 className="mr-2 h-4 w-4" />
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
              })
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
