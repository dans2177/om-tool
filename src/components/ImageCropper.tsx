'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Crop, SkipForward, X, Check, RotateCcw } from 'lucide-react';

interface CropperModalProps {
  images: { id: string; blobUrl: string }[];
  onComplete: (croppedBlobs: Map<string, Blob>, orderedIds: string[]) => void;
  onCancel: () => void;
}

/**
 * Minimum output dimension for cropped images.
 * Server also enforces this, but we enforce client-side to avoid
 * uploading tiny images that would need heavy up-scaling.
 */
const MIN_CROP_PX = 1080;

/**
 * Maximum output dimension. No cap — pass through at native resolution.
 * The finalize step compresses separately.
 */

/** Create a cropped image blob from a source URL + pixel crop area */
async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const outW = cropArea.width;
  const outH = cropArea.height;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, outW, outH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.92,
    );
  });
}

/** Generate a small preview data URL from a blob */
async function blobToPreview(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

type CropDecision = { type: 'cropped'; blob: Blob; preview: string } | { type: 'skipped' };

export default function ImageCropper({ images, onComplete, onCancel }: CropperModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  // Store decisions for each image (allows going back and re-doing)
  const [decisions, setDecisions] = useState<Map<string, CropDecision>>(new Map());

  // Review mode — after all images have been visited
  const [reviewing, setReviewing] = useState(false);

  // Local ordered list of images (arrow reorder happens here, no parent re-renders)
  const [orderedImages, setOrderedImages] = useState(() => [...images]);

  const currentImage = images[currentIndex];

  const cropW = croppedArea?.width ?? 0;
  const cropH = croppedArea?.height ?? 0;
  const isBelowMin = cropW > 0 && (cropW < MIN_CROP_PX || cropH < MIN_CROP_PX);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  /** Save current crop/skip and move to next or review */
  const handleNext = async (skip: boolean) => {
    setProcessing(true);
    try {
      const newDecisions = new Map(decisions);
      if (!skip && croppedArea) {
        const blob = await getCroppedBlob(currentImage.blobUrl, croppedArea);
        const preview = await blobToPreview(blob);
        newDecisions.set(currentImage.id, { type: 'cropped', blob, preview });
      } else {
        newDecisions.set(currentImage.id, { type: 'skipped' });
      }
      setDecisions(newDecisions);

      if (currentIndex === images.length - 1) {
        // All images visited — go to review
        setReviewing(true);
      } else {
        goToImage(currentIndex + 1);
      }
    } catch (err) {
      console.error('Crop failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  /** Navigate to an image index, resetting crop state */
  const goToImage = (idx: number) => {
    setCurrentIndex(idx);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
  };

  /** Go back to previous image */
  const handleBack = () => {
    if (currentIndex > 0) {
      goToImage(currentIndex - 1);
    }
  };

  /** From review, jump back to re-crop a specific image */
  const handleReEdit = (idx: number) => {
    setReviewing(false);
    goToImage(idx);
  };

  /** Move an image up/down in the local order */
  const moveImage = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    setOrderedImages(prev => {
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
      return arr;
    });
  };

  /** Final approval — build the results map and call onComplete with final order */
  const handleApprove = () => {
    const results = new Map<string, Blob>();
    for (const [id, decision] of decisions.entries()) {
      if (decision.type === 'cropped') {
        results.set(id, decision.blob);
      }
    }
    onComplete(results, orderedImages.map(img => img.id));
  };

  // ── Review screen ──────────────────────────────────────────────
  if (reviewing) {
    const croppedCount = Array.from(decisions.values()).filter((d) => d.type === 'cropped').length;
    const skippedCount = images.length - croppedCount;

    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-400" />
            <span className="text-white font-medium text-lg">Review Crops</span>
            <span className="text-white/50 text-sm">
              {croppedCount} cropped, {skippedCount} kept original
            </span>
          </div>
          <button
            onClick={onCancel}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Thumbnails grid — arrow reorderable */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-white/40 text-xs text-center mb-3">Use arrows to reorder. This order = final output order on the review page.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {orderedImages.map((img, idx) => {
              const decision = decisions.get(img.id);
              const isCropped = decision?.type === 'cropped';
              const previewSrc = isCropped ? decision.preview : img.blobUrl;

              return (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border-2 border-white/10 hover:border-white/30 transition-all">
                  <img
                    src={previewSrc}
                    alt={`Image ${idx + 1}`}
                    className="w-full aspect-video object-cover"
                  />
                  {/* Position # + arrows (top-left) */}
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                    <span className="bg-black/70 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveImage(idx, 'up'); }}
                        disabled={idx === 0}
                        className="p-0.5 rounded bg-black/60 text-white/80 hover:bg-blue-600 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveImage(idx, 'down'); }}
                        disabled={idx === orderedImages.length - 1}
                        className="p-0.5 rounded bg-black/60 text-white/80 hover:bg-blue-600 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Cropped/Original badge (top-right) */}
                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        isCropped
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-white/20 text-white/70'
                      }`}
                    >
                      {isCropped ? 'Cropped' : 'Original'}
                    </span>
                  </div>
                  {/* Re-edit button */}
                  <button
                    onClick={() => {
                      const origIdx = images.findIndex(i => i.id === img.id);
                      if (origIdx >= 0) handleReEdit(origIdx);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors"
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white text-sm font-medium bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                      <RotateCcw className="w-4 h-4" />
                      Re-crop
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approve bar */}
        <div className="px-6 py-4 bg-black/60 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={() => {
              setReviewing(false);
              goToImage(images.length - 1);
            }}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to cropping
          </button>
          <button
            onClick={handleApprove}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Approve &amp; Finalize
          </button>
        </div>
      </div>
    );
  }

  // ── Cropping screen ────────────────────────────────────────────
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
          {cropW > 0 && (
            <span
              className={`text-sm ml-3 px-2 py-0.5 rounded-full ${
                isBelowMin ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'
              }`}
            >
              {cropW} x {cropH}px
              {isBelowMin && ' (will upscale to 1080px)'}
            </span>
          )}
          {decisions.has(currentImage.id) && (
            <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
              {decisions.get(currentImage.id)!.type === 'cropped' ? 'previously cropped' : 'previously skipped'}
            </span>
          )}
        </div>
        <button
          onClick={onCancel}
          className="text-white/60 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Image dots / progress */}
      <div className="flex items-center justify-center gap-1.5 py-2 bg-black/40">
        {images.map((img, idx) => {
          const done = decisions.has(img.id);
          const active = idx === currentIndex;
          return (
            <button
              key={img.id}
              onClick={() => goToImage(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                active
                  ? 'bg-blue-500 scale-125'
                  : done
                  ? 'bg-green-500/70 hover:bg-green-400'
                  : 'bg-white/20 hover:bg-white/40'
              }`}
              title={`Image ${idx + 1}${done ? ' (done)' : ''}`}
            />
          );
        })}
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
        {/* Left: Back + Zoom */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-32 accent-blue-500"
            />
            <span className="text-white/50 text-sm w-10">{zoom.toFixed(1)}x</span>
          </div>
        </div>

        {/* Right: Skip + Crop */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNext(true)}
            disabled={processing}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-colors disabled:opacity-50"
          >
            <SkipForward className="w-4 h-4" />
            Skip
          </button>
          <button
            onClick={() => handleNext(false)}
            disabled={processing || !croppedArea}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {processing ? (
              'Processing...'
            ) : currentIndex === images.length - 1 ? (
              <>
                <Crop className="w-4 h-4" />
                Crop &amp; Review
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
