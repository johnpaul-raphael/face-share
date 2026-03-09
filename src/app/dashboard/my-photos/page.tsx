'use client';

import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { apiClient, MyPhotosGroup } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function MyPhotosPage() {
  const [groups, setGroups] = useState<MyPhotosGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    apiClient.getMyPhotos()
      .then(setGroups)
      .catch(() => toast({ variant: 'destructive', title: 'Failed to load photos' }))
      .finally(() => setIsLoading(false));
  }, []);

  const downloadImage = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok.');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast({ variant: 'destructive', title: 'Download failed' });
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading your photos…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Photos</h1>
        <p className="text-muted-foreground">All photos you appear in, organized by event.</p>
      </div>

      {groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map((group, index) => (
            <div key={group.event_id}>
              <div className="flex items-center justify-between pb-4">
                <h2 className="text-xl font-semibold">{group.event_name}</h2>
                <Button
                  variant="outline"
                  onClick={() =>
                    group.photos.forEach((p) =>
                      p.url && downloadImage(p.url, `${group.event_name.replace(/[^a-zA-Z0-9]/g, '_')}_${p.photo_id}.jpg`)
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {group.photos.map((photo) => (
                  <Card key={photo.photo_id} className="group overflow-hidden">
                    <CardContent className="relative h-64 w-full p-0">
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt={`Photo from ${group.event_name}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-muted">
                          <ImageIcon className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                      {photo.url && (
                        <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="absolute bottom-2 right-2">
                            <Button
                              size="icon"
                              variant="secondary"
                              onClick={() =>
                                downloadImage(
                                  photo.url!,
                                  `${group.event_name.replace(/[^a-zA-Z0-9]/g, '_')}_${photo.photo_id}.jpg`
                                )
                              }
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {index < groups.length - 1 && <Separator className="mt-8" />}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No Photos Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your photos will appear here once face recognition processes event photos.
          </p>
        </div>
      )}
    </div>
  );
}
