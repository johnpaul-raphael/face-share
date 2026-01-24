import Image from 'next/image';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { photos, users } from '@/lib/data';

export default function MyPhotosPage() {
  const currentUser = users[0];
  const myPhotos = photos.filter((photo) =>
    photo.matches.some(
      (match) => match.userId === currentUser.id && match.isConfirmed
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Photos</h1>
        <p className="text-muted-foreground">
          A collection of all photos you appear in.
        </p>
      </div>
      {myPhotos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {myPhotos.map((photo) => (
            <Card key={photo.id} className="group overflow-hidden">
              <CardContent className="relative h-64 w-full p-0">
                <Image
                  src={photo.url}
                  alt={`Photo ${photo.id}`}
                  layout="fill"
                  objectFit="cover"
                  className="transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="absolute bottom-2 right-2">
                    <Button size="icon" variant="secondary">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground">
            No photos found yet. Join an event and get tagged!
          </p>
        </div>
      )}
    </div>
  );
}
