'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { resolveItemImageUrl } from '@/lib/utils/item-images';
import { toPublicImageUrl } from '@/lib/storage/backblaze';
import { toast } from 'sonner';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];

interface ItemImageUploadProps {
  itemId?: string;
  itemName?: string;
  imageUrl?: string | null;
  onImageUrlChange?: (url: string | null) => void;
  /** When creating a new item, stash file until the item is saved */
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
  compact?: boolean;
}

export function ItemImageUpload({
  itemId,
  itemName,
  imageUrl,
  onImageUrlChange,
  pendingFile,
  onPendingFileChange,
  compact,
}: ItemImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const previewUrl =
    localPreview ||
    toPublicImageUrl(imageUrl) ||
    (itemName ? resolveItemImageUrl({ name: itemName, image_url: null }) : null) ||
    (pendingFile ? URL.createObjectURL(pendingFile) : null);

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Use JPEG, PNG, WebP, or AVIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    if (!itemId) {
      onPendingFileChange?.(file);
      setLocalPreview(URL.createObjectURL(file));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/items/${itemId}/image`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (result.success && result.data?.imageUrl) {
        onImageUrlChange?.(result.data.imageUrl);
        setLocalPreview(result.data.imageUrl);
        toast.success('Product image uploaded');
      } else {
        toast.error(result.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!itemId) {
      onPendingFileChange?.(null);
      setLocalPreview(null);
      return;
    }

    setUploading(true);
    try {
      const res = await fetch(`/api/items/${itemId}/image`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        onImageUrlChange?.(null);
        setLocalPreview(null);
        toast.success('Image removed');
      } else {
        toast.error(result.message || 'Failed to remove image');
      }
    } catch (err) {
      console.error('Image delete error:', err);
      toast.error('Failed to remove image');
    } finally {
      setUploading(false);
    }
  };

  const previewSize = compact ? 'w-20 h-20' : 'w-full sm:w-40 h-40';

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      <Label className={compact ? 'text-sm font-semibold' : 'text-base font-semibold'}>
        Product photo
      </Label>
      {!compact && (
        <p className="text-sm text-muted-foreground -mt-1">
          Shown on Quick Sell and the POS catalog. JPEG, PNG, WebP, or AVIF · max 5MB.
        </p>
      )}

      <div className={`flex gap-3 items-center ${compact ? '' : 'items-start'}`}>
        <div
          className={`relative shrink-0 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-hidden ${previewSize}`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={itemName ? `${itemName} photo` : 'Product'}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-0.5 p-1 text-center">
              <ImagePlus className={`${compact ? 'w-5 h-5' : 'w-8 h-8'} opacity-50`} />
              {!compact && <span className="text-xs">No photo</span>}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className={`flex ${compact ? 'flex-row flex-wrap gap-1.5' : 'flex-col gap-2'} flex-1`}>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className={compact ? 'h-8 text-xs' : 'justify-start'}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 mr-1.5" />
            )}
            {previewUrl ? 'Replace' : 'Upload'}
          </Button>
          {(previewUrl || pendingFile) && (
            <Button
              type="button"
              variant="ghost"
              size={compact ? 'sm' : 'default'}
              className={`${compact ? 'h-8 text-xs' : 'justify-start'} text-red-600 hover:text-red-700 hover:bg-red-50`}
              disabled={uploading}
              onClick={() => void handleRemove()}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Remove
            </Button>
          )}
          {!itemId && pendingFile && !compact && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Photo will upload when you save the product.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Upload a pending file after item creation (call from ItemForm). */
export async function uploadPendingItemImage(itemId: string, file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/items/${itemId}/image`, {
    method: 'POST',
    body: formData,
  });
  const result = await res.json();
  if (result.success && result.data?.imageUrl) {
    return result.data.imageUrl as string;
  }
  throw new Error(result.message || 'Failed to upload image');
}
