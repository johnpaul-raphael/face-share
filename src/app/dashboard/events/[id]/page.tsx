'use client';
import Image from 'next/image';
import { Download, Upload, Loader2, X, FileImage, Trash2, Eye, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { photos } from '@/lib/data';
import { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Photo } from '@/lib/types';
import { useParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UploadingFile {
    file: File;
    id: string;
    progress: number;
}

interface StagedPhoto {
    id: string;
    url: string;
    file: File;
}

export default function EventGalleryPage() {
  const params = useParams();
  const [publishedPhotos, setPublishedPhotos] = useState<Photo[]>(() => photos.filter((p) => p.eventId === params.id));
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<StagedPhoto | Photo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    // This effect manages the upload simulation and moves files to the staging area.
    if (uploadingFiles.length === 0) return;

    const timers = uploadingFiles
      .filter(f => f.progress < 100)
      .map(file => {
        const timer = setInterval(() => {
          setUploadingFiles(prevFiles => {
            const currentFile = prevFiles.find(f => f.id === file.id);
            if (!currentFile || currentFile.progress >= 100) {
              clearInterval(timer);
              return prevFiles;
            }

            const newProgress = currentFile.progress + Math.random() * 30;

            if (newProgress >= 100) {
              clearInterval(timer);
              
              const newStagedPhoto = { id: currentFile.id, file: currentFile.file, url: URL.createObjectURL(currentFile.file) };
              setStagedPhotos(prevStaged => [...prevStaged, newStagedPhoto]);
              
              toast({ title: "Ready for review", description: `${currentFile.file.name} is uploaded.` });
              
              return prevFiles.filter(f => f.id !== currentFile.id);
            }
            
            return prevFiles.map(f => f.id === currentFile.id ? { ...f, progress: newProgress } : f);
          });
        }, 500);
        return timer;
      });

    return () => timers.forEach(clearInterval);
  }, [uploadingFiles, toast]);
  
  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
        stagedPhotos.forEach(p => URL.revokeObjectURL(p.url));
    }
  }, []);

  const addFilesToUploadQueue = (files: File[]) => {
     const newUploadingFiles: UploadingFile[] = files.map(file => ({
        file,
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        progress: 0,
    }));
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    addFilesToUploadQueue(Array.from(files));
    if (event.target) {
        event.target.value = ''; // Reset input to allow re-uploading the same file
    }
  };

  const removeFileFromQueue = (id: string) => {
      setUploadingFiles(prev => prev.filter(f => f.id !== id));
  }
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      addFilesToUploadQueue(Array.from(files));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleRemoveStagedPhoto = (id: string) => {
    const photoToRemove = stagedPhotos.find(p => p.id === id);
    if (photoToRemove) {
      URL.revokeObjectURL(photoToRemove.url);
    }
    setStagedPhotos(prev => prev.filter(p => p.id !== id));
  };
  
  const handlePublish = () => {
    const newPhotosForProcessing: Photo[] = stagedPhotos.map((sp, i) => ({
      id: `photo-${Date.now()}-${i}`,
      eventId: params.id as string,
      uploaderId: 'user-1', // Mock current user
      url: sp.url, // In real app, this would be a permanent URL from cloud storage
      uploadedAt: new Date().toISOString(),
      matches: [],
      isProcessing: true,
    }));

    photos.unshift(...newPhotosForProcessing);
    setPublishedPhotos(prev => [...newPhotosForProcessing, ...prev]);

    toast({
        title: "Photos Published!",
        description: `${stagedPhotos.length} photos are now being processed.`
    });
    
    setStagedPhotos([]);
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!viewingPhoto} onOpenChange={(isOpen) => !isOpen && setViewingPhoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Photo Preview</DialogTitle>
          </DialogHeader>
          {viewingPhoto && (
             <div className="relative mt-4 h-[70vh] w-full">
                <Image src={viewingPhoto.url} alt="Full size preview" fill className="object-contain" />
             </div>
          )}
        </DialogContent>
      </Dialog>
    
      <Card 
        className="border-2 border-dashed bg-secondary/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <CardContent className="p-6 text-center">
         <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*"
            className="hidden"
          />
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Upload Photos</h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop your event photos here, or click to browse.
          </p>
          <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>Browse Files</Button>
        </CardContent>
      </Card>
      
      {uploadingFiles.length > 0 && (
         <Card>
            <CardHeader>
                <CardTitle>Uploading Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadingFiles.map(uploadingFile => (
                <div key={uploadingFile.id} className="flex items-center gap-4">
                  <FileImage className="h-8 w-8 text-muted-foreground" />
                  <div className="w-full space-y-1">
                     <div className="flex justify-between text-sm">
                        <span className="truncate max-w-[200px] md:max-w-xs">{uploadingFile.file.name}</span>
                        <span className="text-muted-foreground">{uploadingFile.progress.toFixed(0)}%</span>
                     </div>
                     <Progress value={uploadingFile.progress} className="h-2" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFileFromQueue(uploadingFile.id)}>
                      <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
         </Card>
      )}
      
      {stagedPhotos.length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle>Review & Publish</CardTitle>
                <CardDescription>Review your uploaded photos before making them public for processing.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {stagedPhotos.map(photo => (
                <Card key={photo.id} className="group overflow-hidden">
                    <CardContent className="relative aspect-square w-full p-0">
                         <Image
                            src={photo.url}
                            alt={`Staged photo ${photo.id}`}
                            fill
                            className="object-cover"
                        />
                         <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-2">
                            <Button size="icon" variant="secondary" onClick={() => setViewingPhoto(photo)}>
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="destructive" onClick={() => handleRemoveStagedPhoto(photo.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                         </div>
                    </CardContent>
                </Card>
              ))}
            </CardContent>
            <CardFooter>
                <Button onClick={handlePublish} className="w-full sm:w-auto ml-auto">
                    <Send className="mr-2 h-4 w-4" />
                    Publish {stagedPhotos.length} Photos
                </Button>
            </CardFooter>
        </Card>
      )}

      <div>
        <h2 className="text-xl font-bold mb-4">Published Photos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {publishedPhotos.map((photo) => (
            <Card key={photo.id} className="group overflow-hidden">
                <CardContent className="relative h-64 w-full p-0">
                <Image
                    src={photo.url}
                    alt={`Photo ${photo.id}`}
                    fill
                    className={cn(
                        "object-cover transition-transform duration-300 group-hover:scale-110",
                        photo.isProcessing && "filter grayscale"
                    )}
                />
                {photo.isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="mt-2 text-sm">Processing...</p>
                    </div>
                )}
                <div className={cn(
                    "absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100",
                    photo.isProcessing && "hidden"
                    )}>
                    <div className="absolute bottom-2 right-2 flex gap-2">
                        <Button size="icon" variant="secondary" onClick={() => setViewingPhoto(photo)}>
                           <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="secondary">
                           <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                </CardContent>
            </Card>
            ))}
            {publishedPhotos.length === 0 && stagedPhotos.length === 0 && uploadingFiles.length === 0 && (
                 <div className="col-span-full flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
                    <div className="text-center">
                        <FileImage className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">No Photos Yet</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                        Upload some photos to get started!
                        </p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
