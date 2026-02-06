'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Upload, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import type { User } from '@/lib/types';

type FaceImage = {
  id: string;
  url: string;
  description: string;
  file?: File;
};

export default function ProfilePage() {

  const initialFaceImages = PlaceHolderImages.filter((img) =>
    img.id.startsWith('face-upload')
  ).map((img) => ({
    id: img.id,
    url: img.imageUrl,
    description: img.description,
  }));

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [faceImages, setFaceImages] = useState<FaceImage[]>(initialFaceImages);
  const [isUploading, setIsUploading] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Get current user (once on mount)
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const fetchUser = async () => {
      try {
        const userData = await apiClient.getCurrentUser();
        if (!cancelled) setCurrentUser(userData);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update profile
  const updateEmailAndName = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const userData = await apiClient.updateProfile(currentUser);
      setCurrentUser(userData);
      toast({
        title: 'Profile Updated!',
        description: 'Your email and name have been successfully updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update your email and name.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  const profileStatus =
    faceImages.length >= 3
      ? {
          variant: 'default',
          title: 'Profile Active',
          description: 'Your face profile is ready for automatic tagging.',
          icon: ShieldCheck,
        }
      : {
          variant: 'destructive',
          title: 'Needs More Photos',
          description: `Please upload at least ${3 - faceImages.length} more photo(s).`,
          icon: AlertTriangle,
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
              <Input
                id="name"
                value={currentUser?.name ?? ''}
                disabled={isLoading}
                onChange={(e) => setCurrentUser((prev) => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={currentUser?.email ?? ''}
                disabled={isLoading}
                onChange={(e) => setCurrentUser((prev) => prev ? { ...prev, email: e.target.value } : null)}
              />
            </div>
            <Button className="w-full" onClick={updateEmailAndName}>Save Changes</Button>
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
            <Alert variant={profileStatus.variant as 'default' | 'destructive'}>
                <profileStatus.icon className="h-4 w-4" />
                <AlertTitle>{profileStatus.title}</AlertTitle>
                <AlertDescription>{profileStatus.description}</AlertDescription>
            </Alert>
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

            <div className="flex items-center space-x-2">
              <Checkbox id="terms" checked={hasConsented} onCheckedChange={(checked) => setHasConsented(checked as boolean)} />
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I consent to the use of my photos for facial recognition.
              </label>
            </div>

            <Button
              className="w-full"
              onClick={handleUpdateProfile}
              disabled={isUploading || !hasConsented || faceImages.length < 3}
            >
              {isUploading ? 'Updating...' : 'Update Face Profile'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
