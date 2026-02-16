'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, X, Clock, ExternalLink, Trash2, ImagePlus } from 'lucide-react';
import { useOM } from '@/context/OMContext';
import LoadingOverlay from '@/components/LoadingOverlay';

interface RecentOM {
  name: string;
  url: string;
  uploadedAt: string;
  size: number;
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
    setOmData, setImages, setPdfBlobUrl, setGeo,
    resetAll,
  } = useOM();

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [recentOMs, setRecentOMs] = useState<RecentOM[]>([]);
  const [dumping, setDumping] = useState(false);
  const [extractImages, setExtractImages] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);

  // Load recent OMs on first render
  useEffect(() => {
    fetch('/api/phase1/recent')
      .then((r) => r.json())
      .then((data) => {
        if (data.oms) setRecentOMs(data.oms);
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
        setRecentOMs([]);
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

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }

      setError('');
      setLoading(true);
      setProgressSteps([]);
      addStep('Sending PDF to server...');

      try {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('notes', notes);
        if (!extractImages) {
          formData.append('skipImages', 'true');
        }

        const res = await fetch('/api/phase1/extract', {
          method: 'POST',
          body: formData,
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
              } else if (eventType === 'error') {
                throw new Error(data.error);
              }
            }
          }
        }

        if (!resultData) throw new Error('No result received from server');

        setOmData(resultData.omData);
        setPdfBlobUrl(resultData.pdfBlobUrl);

        // If user uploaded images directly, upload those to blob storage
        let allImages = resultData.images || [];
        if (uploadedImages.length > 0) {
          addStep(`Uploading ${uploadedImages.length} image${uploadedImages.length !== 1 ? 's' : ''}...`);
          const imgFormData = new FormData();
          imgFormData.append('slug', resultData.omData.slug || 'unknown');
          uploadedImages.forEach((f) => imgFormData.append('images', f));

          const imgRes = await fetch('/api/phase1/upload-extra', {
            method: 'POST',
            body: imgFormData,
          });
          const imgData = await imgRes.json();
          if (imgData.images) {
            const extras = imgData.images.map((img: any) => ({
              ...img,
              selected: true,
              watermark: false as const,
            }));
            allImages = [...allImages, ...extras];
            addStep(`✅ ${extras.length} image${extras.length !== 1 ? 's' : ''} uploaded`);
          }
        }

        setImages(allImages);

        // Geocode
        if (resultData.omData.address) {
          addStep('Geocoding address...');
          try {
            const geoRes = await fetch('/api/phase1/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: resultData.omData.address }),
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
        router.push('/approval');
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [notes, extractImages, uploadedImages, addStep, setError, setLoading, setProgressSteps, setOmData, setImages, setPdfBlobUrl, setGeo, router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

          {/* Direct image upload */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <ImagePlus className="w-4 h-4" />
              Upload Images Directly
            </button>
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
                    className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-2.5 py-1.5 rounded-lg"
                  >
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <button
                      onClick={() =>
                        setUploadedImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent OMs */}
        {recentOMs.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent OMs</h3>
            </div>
            <div className="space-y-2">
              {recentOMs.slice(0, 10).map((om) => {
                const name = om.name;
                return (
                  <a
                    key={om.name}
                    href={om.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-gray-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-red-400">PDF</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(om.uploadedAt).toLocaleDateString()} &middot; {formatSize(om.size)}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </a>
                );
              })}
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
