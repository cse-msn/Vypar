import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { uploadFiles, getApiError } from '@/lib/api';

/** Upload + manage product photos and videos (first image is the main/cover). */
export function MediaManager({
  images,
  videos,
  onChange,
}: {
  images: string[];
  videos: string[];
  onChange: (m: { images: string[]; videos: string[] }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      const uploaded = await uploadFiles(Array.from(list));
      const nextImages = [...images];
      const nextVideos = [...videos];
      uploaded.forEach((u) => (u.type === 'video' ? nextVideos.push(u.url) : nextImages.push(u.url)));
      onChange({ images: nextImages, videos: nextVideos });
    } catch (e) {
      toast.error(getApiError(e).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = (i: number) => onChange({ images: images.filter((_, idx) => idx !== i), videos });
  const removeVideo = (i: number) => onChange({ images, videos: videos.filter((_, idx) => idx !== i) });
  const makePrimary = (i: number) => {
    const arr = [...images];
    const [picked] = arr.splice(i, 1);
    arr.unshift(picked);
    onChange({ images: arr, videos });
  };

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} Upload photos / videos
      </Button>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, i) => (
            <div key={url} className="group relative overflow-hidden rounded-md border">
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
              <img src={url} alt="product" className="aspect-square w-full object-cover" />
              {i === 0 && <Badge className="absolute left-1 top-1 scale-90">Main</Badge>}
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => makePrimary(i)}
                  className="absolute bottom-1 left-1 rounded-full bg-black/60 p-1 text-white"
                  aria-label="Set as main"
                >
                  <Star className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {videos.map((url, i) => (
            <div key={url} className="relative overflow-hidden rounded-md border">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={url} className="w-full" controls />
              <button
                type="button"
                onClick={() => removeVideo(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Remove video"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
