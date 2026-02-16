'use client';

import { useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { FileUp, Upload, Download, Check, X, Image as ImageIcon } from 'lucide-react';
import LoadingOverlay from '@/components/LoadingOverlay';
import type { OMData, ExtractedImage, FinalizedImage, GeoResult } from '@/types';
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

type Step = 'upload' | 'approval' | 'review';

export default function HomePage() {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');

  // Upload state
  const [notes, setNotes] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extraction state
  const [omData, setOmData] = useState<OMData | null>(null);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [geo, setGeo] = useState<GeoResult | null>(null);

  // Approval state
  const [compress, setCompress] = useState(true);
  const [password, setPassword] = useState('');

  // Final state
  const [lockedPdfUrl, setLockedPdfUrl] = useState('');
  const [finalImages, setFinalImages] = useState<FinalizedImage[]>([]);

  // React Hook Form for editing OM data
  const { register, handleSubmit, reset, getValues } = useForm<OMData>();

  // ─── UPLOAD ─────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }

      setError('');
      setLoading(true);
      setLoadingMessage('Uploading & extracting text, images, and AI analysis...');

      try {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('notes', notes);

        const res = await fetch('/api/phase1/extract', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Extraction failed');
        }

        const data = await res.json();
        setOmData(data.omData);
        setImages(data.images);
        setPdfBlobUrl(data.pdfBlobUrl);
        reset(data.omData);

        // Geocode the address
        if (data.omData.address) {
          setLoadingMessage('Geocoding address...');
          try {
            const geoRes = await fetch('/api/phase1/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: data.omData.address }),
            });
            const geoData = await geoRes.json();
            if (geoData.lat && geoData.lng) {
              setGeo(geoData);
            }
          } catch {
            // Non-critical, continue
          }
        }

        setStep('approval');
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [notes, reset]
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

  // ─── IMAGE APPROVAL ────────────────────────────────────
  const toggleSelect = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, selected: !img.selected } : img
      )
    );
  };

  const toggleWatermark = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, watermark: !img.watermark } : img
      )
    );
  };

  const uploadExtraImages = async (files: FileList) => {
    if (!omData) return;
    setLoading(true);
    setLoadingMessage('Uploading additional images...');

    try {
      const formData = new FormData();
      formData.append('slug', omData.slug);
      Array.from(files).forEach((f) => formData.append('images', f));

      const res = await fetch('/api/phase1/upload-extra', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.images) {
        setImages((prev) => [
          ...prev,
          ...data.images.map((img: any) => ({
            ...img,
            selected: true,
            watermark: false,
          })),
        ]);
      }
    } catch {
      setError('Failed to upload extra images');
    } finally {
      setLoading(false);
    }
  };

  // ─── FINALIZE ───────────────────────────────────────────
  const handleFinalize = async () => {
    if (!password) {
      setError('Please enter a password for PDF locking.');
      return;
    }

    setError('');
    setLoading(true);
    setLoadingMessage('Locking PDF & processing images...');

    try {
      const res = await fetch('/api/phase1/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          pdfBlobUrl,
          password,
          slug: omData?.slug || 'unknown',
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
      // Update OM data from form
      setOmData(getValues());
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Finalization failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {loading && <LoadingOverlay message={loadingMessage} fullScreen />}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">OM Tool</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span
              className={`px-3 py-1 rounded-full ${
                step === 'upload'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100'
              }`}
            >
              1. Upload
            </span>
            <span
              className={`px-3 py-1 rounded-full ${
                step === 'approval'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100'
              }`}
            >
              2. Images
            </span>
            <span
              className={`px-3 py-1 rounded-full ${
                step === 'review'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100'
              }`}
            >
              3. Review
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 1: UPLOAD ── */}
        {step === 'upload' && (
          <div className="max-w-xl mx-auto">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}
            >
              <FileUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-1">Upload OM</p>
              <p className="text-sm text-gray-500">
                Drag & drop a PDF here, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onFileSelect}
                className="hidden"
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any context or notes about this OM..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* ── STEP 2: IMAGE APPROVAL ── */}
        {step === 'approval' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Image Approval
                </h2>
                <p className="text-sm text-gray-500">
                  {images.length} images extracted. Select which to include.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={compress}
                    onChange={(e) => setCompress(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Compress all (~80% JPEG)
                </label>

                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload more
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) uploadExtraImages(e.target.files);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {images.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">
                  No images found in PDF. Use &ldquo;Upload more&rdquo; to add images manually.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`relative bg-white rounded-xl border-2 overflow-hidden transition-colors ${
                      img.selected
                        ? 'border-blue-500'
                        : 'border-gray-200 opacity-50'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.blobUrl}
                      alt={img.id}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-3 space-y-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={img.selected}
                          onChange={() => toggleSelect(img.id)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        Include
                      </label>
                      {img.selected && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={img.watermark}
                            onChange={() => toggleWatermark(img.id)}
                            className="rounded border-gray-300 text-blue-600"
                          />
                          Watermark this?
                        </label>
                      )}
                    </div>
                    {img.selected && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF Lock Password
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to lock the PDF..."
                className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                This password will be used to restrict the PDF (print-only, no copy).
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleFinalize}
                disabled={!password}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium px-8 py-3 rounded-lg transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: REVIEW ── */}
        {step === 'review' && omData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Downloads */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Downloads
              </h2>
              <div className="space-y-3">
                <a
                  href={lockedPdfUrl}
                  download="locked-om.pdf"
                  className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Download className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      Locked PDF
                    </p>
                    <p className="text-xs text-red-500">Print-only, password protected</p>
                  </div>
                </a>

                {finalImages.map((img, i) => (
                  <div key={i} className="space-y-1">
                    <a
                      href={img.originalUrl}
                      download={img.filename}
                      className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Download className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">
                        {img.filename}
                      </span>
                    </a>
                    {img.watermarkedUrl && (
                      <a
                        href={img.watermarkedUrl}
                        download={`watermarked-${img.filename}`}
                        className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors ml-4"
                      >
                        <Download className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          watermarked-{img.filename}
                        </span>
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {geo && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-400 mb-1">Geocoded Location</p>
                  <p className="text-sm text-gray-700">
                    {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
                  </p>
                </div>
              )}
            </div>

            {/* Middle: Editable Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-y-auto max-h-[80vh]">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Property Details
              </h2>
              <form onSubmit={handleSubmit((data) => setOmData(data))} className="space-y-4">
                <Field label="Address" name="address" register={register} />
                <Field label="Price" name="price" register={register} type="number" />
                <Field label="Cap Rate" name="capRate" register={register} type="number" step="0.01" />
                <Field label="NOI" name="noi" register={register} type="number" />
                <Field label="Sq Ft" name="sqFt" register={register} type="number" />
                <Field label="Year Built" name="yearBuilt" register={register} type="number" />
                <Field label="Zoning" name="zoning" register={register} />
                <Field label="Slug" name="slug" register={register} />

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Property Type
                  </label>
                  <select
                    {...register('propertyType')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="stnl">STNL</option>
                    <option value="mf">Multifamily</option>
                    <option value="retail">Retail</option>
                    <option value="office">Office</option>
                    <option value="industrial">Industrial</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Sale or Lease
                  </label>
                  <select
                    {...register('saleOrLease')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="for-sale">For Sale</option>
                    <option value="for-lease">For Lease</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Tenants (comma-separated)
                  </label>
                  <input
                    {...register('tenants')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Highlights (one per line)
                  </label>
                  <textarea
                    {...register('highlights')}
                    rows={5}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </form>
            </div>

            {/* Right: PDF Viewer */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-hidden">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                PDF Preview
              </h2>
              <div className="h-[70vh]">
                <PDFViewer url={pdfBlobUrl} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Field component ──────────────────────────────────────
function Field({
  label,
  name,
  register,
  type = 'text',
  step,
}: {
  label: string;
  name: string;
  register: any;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      <input
        {...register(name)}
        type={type}
        step={step}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
