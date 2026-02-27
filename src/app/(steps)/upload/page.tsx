'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { FileUp, X, Clock, Trash2, ImagePlus, RotateCcw } from 'lucide-react';
import { useOM } from '@/context/OMContext';
import LoadingOverlay from '@/components/LoadingOverlay';

interface RecentSnapshot {
  title: string;
  address: string;
  pdfBlobUrl: string;
  savedAt: string;
  snapshotUrl: string;
}

export default function UploadPage() {
  const router = useRouter();
  const {
    loading, setLoading,
    loadingMessage,
    progressSteps, setProgressSteps,
    addStep,
    error, setError,
    notes, setNotes,
    setOmData, setImages, setPdfBlobUrl, setGeo, setBrokerOfRecord,
    resetAll,
    saveSnapshot,
    restoreSnapshot,
  } = useOM();

  const [dragOver, setDragOver] = useState(false);
  const [imageDragOver, setImageDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [recentSnapshots, setRecentSnapshots] = useState<RecentSnapshot[]>([]);
  const [dumping, setDumping] = useState(false);
  const [restoringIdx, setRestoringIdx] = useState<number | null>(null);
  const [extractImages, setExtractImages] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);

  // Load recent snapshots on first render
  useEffect(() => {
    fetch('/api/phase1/recent')
      .then((r) => r.json())
      .then((data) => {
        if (data.snapshots) setRecentSnapshots(data.snapshots);
      })
      .catch(() => {});
  }, []);

  const handleDump = async () => {
    if (!confirm('This will delete ALL uploaded OMs and images from blob storage. Are you sure?')) return;
    setDumping(true);
    try {
      const res = await fetch('/api/phase1/dump', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRecentSnapshots([]);
        resetAll();
        alert(`Wiped ${data.deleted} files from storage.`);
      } else {
        alert(data.error || 'Dump failed');
      }
    } catch {
      alert('Failed to dump database');
    } finally {
      setDumping(false);
    }
  };

  /** Store the PDF without processing — user clicks "Process" when ready. */
  const stagePdf = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    setError('');
    setPendingPdf(file);
  }, [setError]);

  const handleFile = useCallback(
    async (file: File) => {
      setError('');
      setLoading(true);
      setProgressSteps([]);
      addStep('Uploading PDF to cloud storage...');

      try {
        // 1. Upload PDF to Vercel Blob
        //    Try client upload first (works on Vercel, bypasses 4.5MB limit).
        //    Falls back to server upload for local dev where the callback URL
        //    (localhost) is unreachable by Vercel's infrastructure.
        let blobUrl: string;
        try {
          const blob = await upload(`uploads/${file.name}`, file, {
            access: 'public',
            handleUploadUrl: '/api/phase1/upload-pdf',
          });
          blobUrl = blob.url;
        } catch {
          // Fallback: server-side upload via FormData
          const fd = new FormData();
          fd.append('file', file);
          fd.append('filename', file.name);
          const upRes = await fetch('/api/phase1/upload-pdf-server', {
            method: 'POST',
            body: fd,
          });
          if (!upRes.ok) throw new Error('PDF upload failed');
          const upData = await upRes.json();
          blobUrl = upData.url;
        }

        addStep('✅ PDF uploaded — starting extraction...');

        // 2. Call extract API with the blob URL (small JSON body)
        const res = await fetch('/api/phase1/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blobUrl,
            fileName: file.name,
            notes,
            skipImages: !extractImages,
          }),
        });

        if (!res.ok || !res.body) {
          const text = await res.text();
          try {
            const errData = JSON.parse(text);
            throw new Error(errData.error || 'Extraction failed');
          } catch {
            throw new Error('Extraction failed');
          }
        }

        // Read SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let resultData: any = null;
        let streamedImages: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'progress') {
                addStep(data.message);
              } else if (eventType === 'result') {
                resultData = data;
              } else if (eventType === 'images') {
                // Images arrive after the result event
                streamedImages = [...streamedImages, ...(data.images || [])];
                addStep(`🖼️ ${streamedImages.length} images ready`);
              } else if (eventType === 'error') {
                throw new Error(data.error);
              }
            }
          }
        }

        if (!resultData) throw new Error('No result received from server');

        setOmData(resultData.omData);
        setPdfBlobUrl(resultData.pdfBlobUrl);
        if (resultData.brokerOfRecord) {
          setBrokerOfRecord(resultData.brokerOfRecord);
        }

        // Merge images: result may have empty array, streamed images arrive separately
        let allImages = [...(resultData.images || []), ...streamedImages];
        if (uploadedImages.length > 0) {
          const slug = resultData.omData.seo?.slug || 'unknown';
          addStep(`Uploading ${uploadedImages.length} image${uploadedImages.length !== 1 ? 's' : ''}...`);

          // Upload each image directly to Vercel Blob (bypasses 4.5 MB limit)
          const blobUrls: { url: string; name: string }[] = [];
          for (const imgFile of uploadedImages) {
            const imgBlob = await upload(`${slug}/images/${imgFile.name}`, imgFile, {
              access: 'public',
              handleUploadUrl: '/api/phase1/upload-image',
            });
            blobUrls.push({ url: imgBlob.url, name: imgFile.name });
          }

          // Send blob URLs to server for thumbnail generation
          const imgRes = await fetch('/api/phase1/upload-extra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, blobUrls }),
          });
          const imgData = await imgRes.json();
          if (imgData.images) {
            const extras = imgData.images.map((img: any) => ({
              ...img,
              selected: true,
              watermark: true as const,
              repRendering: false,
            }));
            allImages = [...allImages, ...extras];
            addStep(`✅ ${extras.length} image${extras.length !== 1 ? 's' : ''} uploaded`);
          }
        }

        setImages(allImages);

        // Geocode
        if (resultData.omData.address?.full_address) {
          addStep('Geocoding address...');
          try {
            const geoRes = await fetch('/api/phase1/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: resultData.omData.address.full_address }),
            });
            const geoData = await geoRes.json();
            if (geoData.lat && geoData.lng) {
              setGeo(geoData);
              addStep(`Geocoded: ${geoData.lat.toFixed(4)}, ${geoData.lng.toFixed(4)}`);
            }
          } catch {
            addStep('Geocoding skipped');
          }
        }

        addStep('Ready! Moving to image approval...');
        await new Promise((r) => setTimeout(r, 600));

        // Auto-save snapshot
        router.push('/approval');
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [notes, extractImages, uploadedImages, addStep, setError, setLoading, setProgressSteps, setOmData, setImages, setPdfBlobUrl, setGeo, setBrokerOfRecord, router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) stagePdf(file);
    },
    [stagePdf]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) stagePdf(file);
    },
    [stagePdf]
  );

  return (
    <>
      {loading && <LoadingOverlay message={loadingMessage} fullScreen steps={progressSteps} />}

      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Upload an OM</h2>
          <p className="text-sm text-gray-500 mb-6">Drop a PDF below to extract property data, images, and more.</p>

          {!pendingPdf ? (
            /* ── Drop zone (no file staged yet) ── */
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center">
                <FileUp className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-base font-medium text-gray-700 mb-1">
                Drop your PDF here
              </p>
              <p className="text-sm text-gray-400">or click to browse files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            /* ── File staged — show controls, then "Process" button ── */
            <>
              <div className="border-2 border-blue-200 bg-blue-50/40 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileUp className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{pendingPdf.name}</p>
                  <p className="text-xs text-gray-400">{(pendingPdf.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setPendingPdf(null); setUploadedImages([]); }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Notes */}
              <div className="mt-5">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Add context about this OM..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                />
              </div>

              {/* Extract images toggle */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={extractImages}
                  onClick={() => setExtractImages(!extractImages)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    extractImages ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      extractImages ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600">
                  Extract images from PDF
                </span>
              </div>

              {/* Direct image upload — drag & drop zone */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Property Photos <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
                  onDragLeave={() => setImageDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setImageDragOver(false);
                    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                    if (files.length) setUploadedImages((prev) => [...prev, ...files]);
                  }}
                  onClick={() => imageInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    imageDragOver
                      ? 'border-emerald-400 bg-emerald-50/50 scale-[1.01]'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <ImagePlus className={`w-5 h-5 ${imageDragOver ? 'text-emerald-500' : 'text-emerald-400'}`} />
                  </div>
                  <p className="text-sm font-medium text-gray-600">Drop images here</p>
                  <p className="text-xs text-gray-400 mt-0.5">or click to browse — JPG, PNG, WebP</p>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setUploadedImages((prev) => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                  className="hidden"
                />
                {uploadedImages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uploadedImages.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1.5 rounded-lg"
                      >
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-emerald-400 hover:text-emerald-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Process button */}
              <button
                type="button"
                onClick={() => handleFile(pendingPdf)}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Process PDF →
              </button>
            </>
          )}
        </div>

        {/* Recent snapshots */}
        {recentSnapshots.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent OMs</h3>
            </div>
            <div className="space-y-2">
              {recentSnapshots.slice(0, 10).map((snap, idx) => (
                <button
                  key={snap.snapshotUrl}
                  type="button"
                  disabled={restoringIdx !== null}
                  onClick={async () => {
                    setRestoringIdx(idx);
                    try {
                      const ok = await restoreSnapshot(snap.snapshotUrl);
                      setRestoringIdx(null);
                      router.push(ok ? '/review' : '/');
                    } catch {
                      setRestoringIdx(null);
                      router.push('/');
                    }
                  }}
                  className="w-full flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-blue-200 hover:shadow-sm transition-all group text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    {restoringIdx === idx ? (
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{snap.title}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {snap.address && <>{snap.address} &middot; </>}
                      {new Date(snap.savedAt).toLocaleDateString()} {new Date(snap.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase">Restore</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dump Storage */}
        <div className="mt-10 pt-6 border-t border-gray-100">
          <button
            onClick={handleDump}
            disabled={dumping}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            {dumping ? 'Dumping…' : 'Dump Storage'}
          </button>
          <p className="text-xs text-gray-400 mt-1">Delete all uploaded OMs and images from blob storage.</p>
        </div>
      </div>
    </>
  );
}
