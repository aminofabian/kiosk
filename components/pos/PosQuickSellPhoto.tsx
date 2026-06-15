'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { resolveItemImageUrl } from '@/lib/utils/item-images';
import { toast } from 'sonner';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];

interface PosQuickSellPhotoProps {
  itemId: string;
  itemName: string;
  imageUrl?: string | null;
  variantName?: string | null;
  onImageUrlChange?: (url: string | null) => void;
  /** Fill parent height (Quick Sell card image zone). */
  fill?: boolean;
}

export function PosQuickSellPhoto({
  itemId,
  itemName,
  imageUrl,
  variantName,
  onImageUrlChange,
  fill = false,
}: PosQuickSellPhotoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null | undefined>(undefined);

  const resolvedUrl =
    localUrl !== undefined
      ? localUrl
      : resolveItemImageUrl({
          name: itemName,
          image_url: imageUrl,
          variant_name: variantName,
        });

  const uploadFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Use JPEG, PNG, WebP, or AVIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
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
        const url = result.data.imageUrl as string;
        setLocalUrl(url);
        onImageUrlChange?.(url);
        toast.success('Photo uploaded');
      } else {
        toast.error(result.message || 'Upload failed');
      }
    } catch (err) {
      console.error('POS image upload error:', err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!uploading) inputRef.current?.click();
  };

  return (
    <div
      className={`relative w-full ${fill ? 'absolute inset-0 h-full min-h-0' : 'mx-1 mt-2'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
          e.target.value = '';
        }}
      />

      {resolvedUrl ? (
        <div
          className={`relative w-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 ${
            fill ? 'h-full rounded-none' : 'aspect-[4/3] max-h-14 rounded-sm'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className={`absolute px-1 py-px bg-black/55 text-white font-semibold uppercase tracking-wide hover:bg-black/70 disabled:opacity-60 ${
              fill
                ? 'bottom-0.5 left-0.5 text-[5px] z-10'
                : 'bottom-0 right-0 text-[6px]'
            }`}
            title="Change photo"
          >
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className={`w-full flex flex-col items-center justify-center gap-1 border border-dashed border-slate-300 bg-slate-50/90 text-[9px] font-medium text-slate-500 transition-colors hover:border-[#1c6a1e] hover:text-[#1c6a1e] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-[#3cb043] ${
            fill ? 'absolute inset-0 h-full rounded-none' : 'min-h-[44px] rounded-sm'
          }`}
          title="Upload product photo"
        >
          <ImagePlus className={fill ? 'h-6 w-6' : 'w-3.5 h-3.5'} />
          {fill && <span className="text-[8px]">Add photo</span>}
        </button>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/40">
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
