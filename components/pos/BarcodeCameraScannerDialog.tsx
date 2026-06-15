'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import { Loader2 } from 'lucide-react';

type BarcodeCameraScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with decoded text; parent should look up the product. */
  onScan: (code: string) => void;
};

const hints = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

export function BarcodeCameraScannerDialog({
  open,
  onOpenChange,
  onScan,
}: BarcodeCameraScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastHandledRef = useRef<string>('');
  const lastHandledAtRef = useRef(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stopScanner = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    readerRef.current = null;
    BrowserCodeReader.releaseAllStreams();
    const v = videoRef.current;
    if (v) {
      BrowserCodeReader.cleanVideoSource(v);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setCameraError(null);
      setStarting(false);
      lastHandledRef.current = '';
      return;
    }

    let cancelled = false;
    setCameraError(null);
    setStarting(true);

    const startTimer = window.setTimeout(() => {
      const video = videoRef.current;
      if (cancelled || !video) {
        if (!cancelled) {
          setStarting(false);
          setCameraError('Camera preview failed to start. Try again.');
        }
        return;
      }

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 500,
      });
      readerRef.current = reader;

      reader
      .decodeFromVideoDevice(undefined, video, (result, err, controls) => {
        if (cancelled) return;
        if (err && !(err instanceof NotFoundException)) {
          console.warn('Barcode scan frame error:', err);
        }
        if (!result) return;

        const text = result.getText().trim();
        if (text.length < 4) return;

        const now = Date.now();
        if (text === lastHandledRef.current && now - lastHandledAtRef.current < 1500) {
          return;
        }
        lastHandledRef.current = text;
        lastHandledAtRef.current = now;

        controls.stop();
        controlsRef.current = null;
        onScan(text);
        onOpenChange(false);
      })
        .then((controls) => {
          if (cancelled) {
            controls.stop();
            return;
          }
          controlsRef.current = controls;
          setStarting(false);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setStarting(false);
          const message =
            e instanceof Error
              ? e.message
              : typeof e === 'string'
                ? e
                : 'Could not access camera';
          if (/Permission|NotAllowed|denied/i.test(message)) {
            setCameraError('Camera permission denied. Allow camera access in your browser settings.');
          } else if (/NotFound|no.*device|DevicesNotFound/i.test(message)) {
            setCameraError('No camera found on this device.');
          } else {
            setCameraError(message);
          }
        });
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      stopScanner();
    };
  }, [open, onOpenChange, onScan, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-none border-slate-200 dark:border-slate-700 sm:max-w-md print:hidden"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
          <DialogDescription>
            Point the camera at a product barcode. Works best in good light with the rear camera.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-none bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <span className="text-sm font-medium">Starting camera…</span>
            </div>
          )}
        </div>

        {cameraError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {cameraError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            onClick={() => {
              stopScanner();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
