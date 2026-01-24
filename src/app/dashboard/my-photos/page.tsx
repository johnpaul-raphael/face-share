'use client';

import Image from 'next/image';
import { Download, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { photos, users, events } from '@/lib/data';
import type { Event, Photo } from '@/lib/types';

type PhotosByEvent = {
  [eventId: string]: {
    event: Event;
    photos: Photo[];
  };
};

export default function MyPhotosPage() {
  const currentUser = users[0]; // Mock current user

  // Helper to download an image. In a real app, this might be a server-side utility.
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
    } catch (e) {
      console.error('Could not download image.', e);
      // Here you could show a toast to the user.
    }
  };

  const handleDownloadAll = (photosToDownload: Photo[]) => {
    // This will trigger multiple downloads, which the browser might prompt the user to allow.
    photosToDownload.forEach((photo) => {
      const event = events.find((e) => e.id === photo.eventId);
      const eventName = event
        ? event.name.replace(/[^a-zA-Z0-9]/g, '_')
        : 'event';
      downloadImage(photo.url, `${eventName}_${photo.id}.jpg`);
    });
  };

  const myPhotos = photos.filter((photo) =>
    photo.matches.some(
      (match) => match.userId === currentUser.id && match.isConfirmed
    )
  );

  const photosByEvent = myPhotos.reduce((acc, photo) => {
    const event = events.find((e) => e.id === photo.eventId);
    if (event) {
      if (!acc[event.id]) {
        acc[event.id] = {
          event: event,
          photos: [],
        };
      }
      acc[event.id].photos.push(photo);
    }
    return acc;
  }, {} as PhotosByEvent);

  const eventIds = Object.keys(photosByEvent);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Photos</h1>
        <p className="text-muted-foreground">
          A collection of all photos you appear in, organized by event.
        </p>
      </div>

      {eventIds.length > 0 ? (
        <div className="space-y-8">
          {eventIds.map((eventId, index) => {
            const { event, photos: eventPhotos } = photosByEvent[eventId];
            return (
              <div key={eventId}>
                <div className="flex items-center justify-between pb-4">
                  <h2 className="text-xl font-semibold">{event.name}</h2>
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadAll(eventPhotos)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download All
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {eventPhotos.map((photo) => (
                    <Card key={photo.id} className="group overflow-hidden">
                      <CardContent className="relative h-64 w-full p-0">
                        <Image
                          src={photo.url}
                          alt={`Photo from ${event.name}`}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="absolute bottom-2 right-2">
                            <Button
                              size="icon"
                              variant="secondary"
                              onClick={() => {
                                const eventName = event.name.replace(
                                  /[^a-zA-Z0-9]/g,
                                  '_'
                                );
                                downloadImage(
                                  photo.url,
                                  `${eventName}_${photo.id}.jpg`
                                );
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {index < eventIds.length - 1 && (
                  <Separator className="mt-8" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No Photos Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your photos will appear here once you're tagged in an event.
          </p>
        </div>
      )}
    </div>
  );
}
