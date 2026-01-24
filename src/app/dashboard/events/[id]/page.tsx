import Image from 'next/image';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { photos } from '@/lib/data';

export default function EventGalleryPage({
  params,
}: {
  params: { id: string };
}) {
  const eventPhotos = photos.filter((p) => p.eventId === params.id);

  return (
    <div className="space-y-6">
      <Card className="border-2 border-dashed">
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Upload className="h-6 w-6 text-secondary-foreground" />
          </div>
          <h3 className="text-lg font-medium">Upload Photos</h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop your event photos here, or click to browse.
          </p>
          <Button className="mt-4">Browse Files</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {eventPhotos.map((photo) => (
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
    </div>
  );
}
