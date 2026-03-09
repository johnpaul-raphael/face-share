'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, Loader2, UserX } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient, PhotoResponse } from '@/lib/api';

export default function ReviewPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { toast } = useToast();

  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getEventPhotos(eventId)
      // Show processed photos where no participant face was matched
      .then((all) => setPhotos(all.filter((p) => !p.is_processing && p.match_count === 0)))
      .catch(() => toast({ variant: 'destructive', title: 'Failed to load photos' }))
      .finally(() => setIsLoading(false));
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Manual Review</h2>
        <p className="text-muted-foreground">
          Photos where no participant face was automatically recognized. These photos are not visible to any participant yet.
        </p>
      </div>

      {photos.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <UnmatchedPhotoCard key={photo.photo_id} photo={photo} />
          ))}
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
          <div className="text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No Unmatched Photos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              All processed photos have been matched to participants, or no photos have been processed yet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function UnmatchedPhotoCard({ photo }: { photo: PhotoResponse }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserX className="h-4 w-4 text-muted-foreground" />
          Unmatched Photo
        </CardTitle>
        <CardDescription>
          <Badge variant="outline">No face match found</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {photo.url ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
            <img
              src={photo.url}
              alt={`Photo ${photo.photo_id}`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">No preview</p>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Uploaded {photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleDateString() : 'recently'}
        </p>
      </CardContent>
    </Card>
  );
}
