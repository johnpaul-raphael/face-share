'use client';
import Image from 'next/image';
import { Download, Upload, Loader2, X, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { photos } from '@/lib/data';
import { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Photo } from '@/lib/types';
import { useParams } from 'next/navigation';


interface UploadingFile {
    file: File;
    id: string;
    progress: number;
    source: "file" | "url"
}

export default function EventGalleryPage() {
  const params = useParams();
  const eventPhotos = photos.filter((p) => p.eventId === params.id);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const prevUploadingFilesRef = useRef<UploadingFile[]>([]);

  useEffect(() => {
    prevUploadingFilesRef.current = uploadingFiles;
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    addFilesToUploadQueue(Array.from(files));
  };
  
  const addFilesToUploadQueue = (files: File[]) => {
     const newUploadingFiles: UploadingFile[] = files.map(file => ({
        file,
        id: `${file.name}-${file.lastModified}`,
        progress: 0,
        source: 'file',
    }));
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
  }

  useEffect(() => {
    // This effect is for showing the toast *after* the state has updated.
    const previouslyUploading = prevUploadingFilesRef.current;
    uploadingFiles.forEach(file => {
      const prevFile = previouslyUploading.find(f => f.id === file.id);
      if (file.progress >= 100 && (!prevFile || prevFile.progress < 100)) {
        toast({ title: "Upload complete!", description: `${file.file.name} has been uploaded.` });
      }
    });
  }, [uploadingFiles, toast]);

  useEffect(() => {
    // This effect manages the timers for upload progress simulation.
    if (uploadingFiles.length > 0) {
      const timers = uploadingFiles
        .filter(f => f.progress < 100)
        .map(file => {
          const timer = setInterval(() => {
            setUploadingFiles(prevFiles =>
              prevFiles.map(f => {
                if (f.id === file.id && f.progress < 100) {
                  const newProgress = f.progress + Math.random() * 20;
                  if (newProgress >= 100) {
                     clearInterval(timer);
                     // In a real app, you'd add the photo to the main list here
                     return { ...f, progress: 100 };
                  }
                  return { ...f, progress: newProgress };
                }
                return f;
              })
            );
          }, 500);
          return timer;
        });

      return () => {
        timers.forEach(clearInterval);
      };
    }
  }, [uploadingFiles]);
  
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

  return (
    <div className="space-y-6">
      <Card 
        className="border-2 border-dashed"
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Upload className="h-6 w-6 text-secondary-foreground" />
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
                        <span className="truncate max-w-[200px]">{uploadingFile.file.name}</span>
                        <span className="text-muted-foreground">{uploadingFile.progress.toFixed(0)}%</span>
                     </div>
                     <Progress value={uploadingFile.progress} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFileFromQueue(uploadingFile.id)}>
                      <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
         </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {eventPhotos.map((photo) => (
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
