import { Upload, Trash2, Wand2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { users } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Textarea } from '@/components/ui/textarea';

export default function ProfilePage() {
  const currentUser = users[0];
  const faceImages = PlaceHolderImages.filter((img) =>
    img.id.startsWith('face-upload')
  );

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue={currentUser.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={currentUser.email} />
            </div>
            <Button className="w-full">Save Changes</Button>
          </CardContent>
        </Card>
      </div>
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Face Profile</CardTitle>
            <CardDescription>
              Upload 3-5 clear photos of your face to enable automatic photo
              tagging.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Your Face Profile Images</Label>
              <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
                {faceImages.map((image) => (
                  <div key={image.id} className="group relative aspect-square">
                    <Image
                      src={image.imageUrl}
                      alt={image.description}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-lg"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed">
                  <Button variant="ghost" size="icon" className="h-12 w-12">
                    <Upload className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </div>
             <div className="space-y-4 rounded-lg border bg-accent/20 p-4">
              <h3 className="font-semibold text-foreground">AI Prompt Generator</h3>
              <p className="text-sm text-muted-foreground">Describe yourself, and let AI generate a detailed prompt to find the best images for your profile.</p>
              <Textarea placeholder="e.g., A man in his 30s with short brown hair, glasses, and a beard." />
              <Button variant="secondary">
                <Wand2 className="mr-2 h-4 w-4" /> Generate Prompt
              </Button>
            </div>
            <Button className="w-full">Update Face Profile</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
