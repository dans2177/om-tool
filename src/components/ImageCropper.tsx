'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { ChevronRight, Crop, SkipForward, X } from 'lucide-react';

interface CropperModalProps {
  images: { id: string; blobUrl: string }[];
  onComplete: (croppedBlobs: Map<string, Blob>) => void;
  onCancel: () => void;
}

/** Create a cropped image blob from a source URL + pixel crop area */
async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.92
    );
  });
}

export default function ImageCropper({ images, onComplete, onCancel }: CropperModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [results] = useState<Map<string, Blob>>(new Map());
  const [processing, setProcessing] = useState(false);

  const currentImage = images[currentIndex];
  const isLast = currentIndex === images.length - 1;

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleNext = async (skip: boolean) => {
    setProcessing(true);
    try {
      if (!skip && croppedArea) {
        const blob = await getCroppedBlob(currentImage.blobUrl, croppedArea);
        results.set(currentImage.id, blob);
      }
      // skip means keep original — don't add to results map

      if (isLast) {
        onComplete(results);
      } else {
        setCurrentIndex((i) => i + 1);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedArea(null);
      }
    } catch (err) {
      console.error('Crop failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/60">
        <div className="flex items-center gap-3">
          <Crop className="w-5 h-5 text-white/70" />
          <span className="text-white font-medium">
            Crop Image {currentIndex + 1} of {images.length}
          </span>
          <span className="text-white/50 text-sm ml-2">16:9 aspect ratio</span>
        </div>
        <button
          onClick={onCancel}
          className="text-white/60 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Crop area */}
      <div className="flex-1 relative">
        <Cropper
          image={currentImage.blobUrl}
          crop={crop}
          zoom={zoom}
          aspect={16 / 9}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid
          style={{
            containerStyle: { background: '#0a0a0a' },
          }}
        />
      </div>

      {/* Bottom controls */}
      <div className="px-6 py-4 bg-black/60 flex items-center justify-between">
        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-sm">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-40 accent-blue-500"
          />
          <span className="text-white/50 text-sm w-10">{zoom.toFixed(1)}×</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNext(true)}
            disabled={processing}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-colors disabled:opacity-50"
          >
            <SkipForward className="w-4 h-4" />
            Skip (keep original)
          </button>
          <button
            onClick={() => handleNext(false)}
            disabled={processing || !croppedArea}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {processing ? (
              'Processing...'
            ) : isLast ? (
              <>
                <Crop className="w-4 h-4" />
                Crop &amp; Finalize
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                Crop &amp; Next
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
