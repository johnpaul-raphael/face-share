'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { Upload, Trash2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { users } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';

type FaceImage = {
  id: string;
  url: string;
  description: string;
  file?: File;
};

export default function ProfilePage() {
  const currentUser = users[0];
  const initialFaceImages = PlaceHolderImages.filter((img) =>
    img.id.startsWith('face-upload')
  ).map((img) => ({
    id: img.id,
    url: img.imageUrl,
    description: img.description,
  }));

  const [faceImages, setFaceImages] = useState<FaceImage[]>(initialFaceImages);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages: FaceImage[] = Array.from(files).map((file) => ({
      id: `new-${file.name}-${Date.now()}`,
      url: URL.createObjectURL(file),
      description: file.name,
      file,
    }));

    setFaceImages((prev) => [...prev, ...newImages]);
    toast({
      title: 'Images Selected',
      description: `${files.length} image(s) ready to be uploaded.`,
    });
  };

  const handleRemoveImage = (id: string) => {
    const imageToRemove = faceImages.find((img) => img.id === id);
    if (imageToRemove && imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    setFaceImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleUpdateProfile = () => {
    setIsUploading(true);
    toast({
      title: 'Updating Profile...',
      description: 'Your face profile is being updated.',
    });
    // Simulate network request
    setTimeout(() => {
      setIsUploading(false);
      toast({
        title: 'Profile Updated!',
        description: 'Your face profile has been successfully updated.',
      });
    }, 2000);
  };

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
                      src={image.url}
                      alt={image.description}
                      fill
                      className="rounded-lg object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveImage(image.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleUpdateProfile}
              disabled={isUploading}
            >
              {isUploading ? 'Updating...' : 'Update Face Profile'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
