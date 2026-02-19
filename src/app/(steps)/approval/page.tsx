'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Upload, Check, Eye, X, Image as ImageIcon } from 'lucide-react';
import { useOM } from '@/context/OMContext';
import LoadingOverlay from '@/components/LoadingOverlay';
import ImageCropper from '@/components/ImageCropper';

export default function ApprovalPage() {
  const router = useRouter();
  const {
    loading, setLoading,
    loadingMessage,
    progressSteps, setProgressSteps,
    addStep,
    error, setError,
    omData,
    images, setImages,
    pdfBlobUrl,
    compress, setCompress,
    lightboxImg, setLightboxImg,
    setLockedPdfUrl, setFinalImages,
  } = useOM();

  const [showCropper, setShowCropper] = useState(false);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Redirect if no data (in useEffect to avoid setState-during-render warning)
  useEffect(() => {
    if (!omData && !loading) {
      router.push('/');
    }
  }, [omData, loading, router]);

  if (!omData) {
    return null;
  }

  const toggleSelect = (id: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, selected: !img.selected } : img))
    );
  };

  const toggleWatermark = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, watermark: !img.watermark }
          : img
      )
    );
  };



  const toggleRepPhoto = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, repPhoto: !img.repPhoto } : img
      )
    );
  };

  const uploadExtraImages = async (files: FileList) => {
    if (!omData) return;
    const slug = omData.seo?.slug || 'unknown';
    setLoading(true);
    setProgressSteps([]);
    addStep(`Uploading ${files.length} image${files.length !== 1 ? 's' : ''}...`);

    try {
      // Upload each image directly to Vercel Blob (bypasses 4.5 MB serverless limit)
      const blobUrls: { url: string; name: string }[] = [];
      for (const file of Array.from(files)) {
        const blob = await upload(`${slug}/images/${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/phase1/upload-image',
        });
        blobUrls.push({ url: blob.url, name: file.name });
      }
      addStep(`✅ ${blobUrls.length} uploaded — generating thumbnails...`);

      // Send blob URLs to the server for thumbnail generation + metadata
      const res = await fetch('/api/phase1/upload-extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, blobUrls }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      if (data.images) {
        setImages((prev) => [
          ...prev,
          ...data.images.map((img: any) => ({
            ...img,
            selected: true,
            watermark: false as const,
            repPhoto: false,
          })),
        ]);
        addStep(`✅ ${data.images.length} image${data.images.length !== 1 ? 's' : ''} ready`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload extra images');
    } finally {
      setLoading(false);
      // Reset file input so re-selecting the same files fires onChange
      if (extraInputRef.current) extraInputRef.current.value = '';
    }
  };

  const handleStartFinalize = () => {
    const selected = images.filter((i) => i.selected);
    if (selected.length === 0) return;
    setShowCropper(true);
  };

  const handleCropComplete = async (croppedBlobs: Map<string, Blob>) => {
    setShowCropper(false);

    // Build an updated images array with cropped blobUrls
    let updatedImages = [...images];

    if (croppedBlobs.size > 0) {
      setLoading(true);
      setProgressSteps([]);
      addStep(`Uploading ${croppedBlobs.size} cropped image${croppedBlobs.size !== 1 ? 's' : ''}...`);

      try {
        for (const [imageId, blob] of croppedBlobs.entries()) {
          const formData = new FormData();
          formData.append('slug', omData?.seo?.slug || 'unknown');
          formData.append('imageId', imageId);
          formData.append('file', blob, `${imageId}.jpg`);

          const res = await fetch('/api/phase1/crop-upload', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) throw new Error('Failed to upload cropped image');

          const data = await res.json();
          updatedImages = updatedImages.map((img) =>
            img.id === imageId ? { ...img, blobUrl: data.blobUrl } : img
          );
        }
        // Update state with new blobUrls
        setImages(updatedImages);
      } catch (err: any) {
        setError(err.message || 'Failed to upload cropped images');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    // Proceed with finalization using the updated images
    await doFinalize(updatedImages);
  };

  const doFinalize = async (currentImages: typeof images) => {
    setError('');
    setLoading(true);
    setProgressSteps([]);
    const selectedCount = currentImages.filter((i) => i.selected).length;
    const wmCount = currentImages.filter((i) => i.selected && i.watermark).length;
    addStep('Locking PDF with password protection...');
    addStep(
      `Processing ${selectedCount} image${selectedCount !== 1 ? 's' : ''}${
        wmCount > 0 ? ` (${wmCount} watermarked)` : ''
      }...`
    );
    if (compress) addStep('Compressing to ~80% JPEG quality...');

    try {
      const res = await fetch('/api/phase1/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: currentImages,
          pdfBlobUrl,
          slug: omData?.seo?.slug || 'unknown',
          compress,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Finalization failed');
      }

      const data = await res.json();
      setLockedPdfUrl(data.lockedPdfUrl);
      setFinalImages(data.images);
      addStep(`PDF locked & ${data.images.length} image${data.images.length !== 1 ? 's' : ''} processed`);
      addStep('All done! Loading review...');
      await new Promise((r) => setTimeout(r, 500));
      router.push('/review');
    } catch (err: any) {
      setError(err.message || 'Finalization failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = images.filter((i) => i.selected).length;

  return (
    <>
      {loading && <LoadingOverlay message={loadingMessage} fullScreen steps={progressSteps} />}

      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Select Images</h2>
              <p className="text-sm text-gray-500">
                {images.length} extracted &middot; {selectedCount} selected &middot; Click to toggle
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setImages((prev) => prev.map((img) => ({ ...img, selected: true })))}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Select all
              </button>
              <button
                onClick={() => setImages((prev) => prev.map((img) => ({ ...img, selected: false })))}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Deselect all
              </button>
              <span className="text-gray-200">|</span>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compress}
                  onChange={(e) => setCompress(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Compress (~80%)
              </label>
              <label className="cursor-pointer bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-gray-200">
                <Upload className="w-4 h-4" />
                Add more
                <input
                  ref={extraInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) uploadExtraImages(e.target.files);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Image grid */}
        {images.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No images found. Use &ldquo;Add more&rdquo; above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className={`relative bg-white rounded-2xl border-2 overflow-hidden transition-all cursor-pointer ${
                  img.selected
                    ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm'
                    : 'border-gray-100 opacity-50 hover:opacity-75 hover:border-gray-200'
                }`}
                onClick={() => toggleSelect(img.id)}
              >
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.thumbnailUrl || img.blobUrl}
                    alt={img.id}
                    className="w-full h-48 object-cover"
                    draggable={false}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const retries = Number(target.dataset.retries || '0');
                      const bust = `?t=${Date.now()}`;
                      if (retries < 3) {
                        // Retry same URL with cache-bust (CDN propagation)
                        target.dataset.retries = String(retries + 1);
                        const base = (retries === 0 ? img.thumbnailUrl : img.blobUrl) || img.blobUrl;
                        setTimeout(() => { target.src = base + bust; }, 800 * (retries + 1));
                      } else if (!target.src.includes(img.blobUrl)) {
                        // Final fallback to full-size image
                        target.src = img.blobUrl + bust;
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxImg(img.blobUrl);
                    }}
                    className="absolute bottom-2 left-2 bg-black/50 hover:bg-black/70 text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Eye className="w-3 h-3" /> View
                  </button>
                </div>
                {img.selected && (
                  <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-600">
                      <input
                        type="checkbox"
                        checked={!!img.watermark}
                        onChange={() => toggleWatermark(img.id)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      Watermark
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-600">
                      <input
                        type="checkbox"
                        checked={!!img.repPhoto}
                        onChange={() => toggleRepPhoto(img.id)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      Rep. Photo
                    </label>

                  </div>
                )}
                <div
                  className={`absolute top-2 right-2 rounded-full p-1 transition-colors ${
                    img.selected ? 'bg-blue-500 text-white' : 'bg-gray-300/60 text-white'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Finalize */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-gray-500">
                The PDF will be encrypted with password protection (print-only, no copy/edit).
              </p>
            </div>
            <button
              onClick={handleStartFinalize}
              disabled={selectedCount === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium px-8 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              Crop &amp; Finalize →
            </button>
          </div>
        </div>
      </div>

      {/* Image Cropper */}
      {showCropper && (
        <ImageCropper
          images={images.filter((i) => i.selected)}
          onComplete={handleCropComplete}
          onCancel={() => setShowCropper(false)}
        />
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="w-8 h-8" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImg}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
