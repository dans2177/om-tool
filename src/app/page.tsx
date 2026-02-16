'use client';

import { useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { FileUp, Upload, Download, Check, X, Image as ImageIcon, Eye, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import LoadingOverlay from '@/components/LoadingOverlay';
import type { ProgressStep } from '@/components/LoadingOverlay';
import type { OMData, ExtractedImage, FinalizedImage, GeoResult } from '@/types';
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

type Step = 'upload' | 'approval' | 'review';

export default function HomePage() {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
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
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Final state
  const [lockedPdfUrl, setLockedPdfUrl] = useState('');
  const [finalImages, setFinalImages] = useState<FinalizedImage[]>([]);

  // React Hook Form for editing OM data
  const { register, handleSubmit, reset, getValues } = useForm<OMData>();

  // ─── UPLOAD ─────────────────────────────────────────────
  const addStep = useCallback((message: string) => {
    setProgressSteps((prev) => [...prev, { message, timestamp: new Date() }]);
    setLoadingMessage(message);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }

      setError('');
      setLoading(true);
      setProgressSteps([]);
      addStep('📤 Sending PDF to server...');

      try {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('notes', notes);

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
        setImages(resultData.images);
        setPdfBlobUrl(resultData.pdfBlobUrl);
        reset(resultData.omData);

        // Geocode
        if (resultData.omData.address) {
          addStep('📍 Geocoding address...');
          try {
            const geoRes = await fetch('/api/phase1/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: resultData.omData.address }),
            });
            const geoData = await geoRes.json();
            if (geoData.lat && geoData.lng) {
              setGeo(geoData);
              addStep(`✅ Geocoded: ${geoData.lat.toFixed(4)}, ${geoData.lng.toFixed(4)}`);
            }
          } catch {
            addStep('⚠️ Geocoding skipped');
          }
        }

        addStep('🚀 Ready! Transitioning to image approval...');
        await new Promise((r) => setTimeout(r, 800)); // brief pause to read
        setStep('approval');
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [notes, reset, addStep]
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
    setProgressSteps([]);
    const selectedCount = images.filter((i) => i.selected).length;
    const wmCount = images.filter((i) => i.selected && i.watermark).length;
    addStep('🔒 Locking PDF with password...');
    addStep(`🖼️ Processing ${selectedCount} image${selectedCount !== 1 ? 's' : ''}${wmCount > 0 ? ` (${wmCount} watermarked)` : ''}...`);
    if (compress) addStep('🗜️ Compressing to ~80% JPEG quality...');

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
      addStep(`✅ PDF locked & ${data.images.length} image${data.images.length !== 1 ? 's' : ''} processed`);
      addStep('🎉 All done! Loading review...');
      await new Promise((r) => setTimeout(r, 600));
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
      {loading && <LoadingOverlay message={loadingMessage} fullScreen steps={progressSteps} />}

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

      <main className={`mx-auto py-8 ${step === 'review' ? 'px-4 max-w-full' : 'px-6 max-w-7xl'}`}>
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
                  {images.length} images extracted &middot; {images.filter(i => i.selected).length} selected. Click images to select.
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
                <span className="text-gray-300">|</span>
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
                    className={`relative bg-white rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
                      img.selected
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 opacity-60 hover:opacity-80 hover:border-gray-300'
                    }`}
                    onClick={() => toggleSelect(img.id)}
                  >
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.blobUrl}
                        alt={img.id}
                        className="w-full h-48 object-cover"
                        draggable={false}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setLightboxImg(img.blobUrl); }}
                        className="absolute bottom-2 left-2 bg-black/60 hover:bg-black/80 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                    </div>
                    {img.selected && (
                      <div
                        className="p-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={img.watermark}
                            onChange={() => toggleWatermark(img.id)}
                            className="rounded border-gray-300 text-blue-600"
                          />
                          Watermark this?
                        </label>
                      </div>
                    )}
                    <div className={`absolute top-2 right-2 rounded-full p-1 transition-colors ${
                      img.selected
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300/70 text-white'
                    }`}>
                      <Check className="w-3 h-3" />
                    </div>
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

            {/* Lightbox Modal */}
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
          </div>
        )}

        {/* ── STEP 3: REVIEW ── */}
        {step === 'review' && omData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Image Previews + Downloads */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-y-auto max-h-[90vh]">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Images &amp; Downloads
              </h2>

              {/* Image Preview Gallery */}
              {finalImages.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Image Previews</p>
                  <div className="grid grid-cols-2 gap-2">
                    {finalImages.map((img, i) => (
                      <div
                        key={`preview-${i}`}
                        className="relative group rounded-lg overflow-hidden border border-gray-200 cursor-pointer"
                        onClick={() => setLightboxImg(img.originalUrl)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.originalUrl}
                          alt={img.filename}
                          className="w-full h-24 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[10px] text-gray-500 truncate px-1 py-0.5">{img.filename}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Downloads */}
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Downloads</p>
              <div className="space-y-2">
                <a
                  href={lockedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
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
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Download className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 truncate">
                        {img.filename}
                      </span>
                    </a>
                    {img.watermarkedUrl && (
                      <a
                        href={img.watermarkedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors ml-4"
                      >
                        <Download className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 truncate">
                          WM-{img.filename}
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
            <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-y-auto max-h-[90vh]">
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

                {/* Rich Highlights Editor */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Highlights
                  </label>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          document.execCommand('formatBlock', false, 'h1');
                        }}
                        className="px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 transition-colors"
                        title="Heading"
                      >
                        H1
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          document.execCommand('formatBlock', false, 'h2');
                        }}
                        className="px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 transition-colors"
                        title="Subheading"
                      >
                        H2
                      </button>
                      <div className="w-px h-4 bg-gray-300 mx-1" />
                      <button
                        type="button"
                        onClick={() => {
                          document.execCommand('insertUnorderedList', false);
                        }}
                        className="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors"
                        title="Bullet List"
                      >
                        &bull; List
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          document.execCommand('insertOrderedList', false);
                        }}
                        className="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors"
                        title="Numbered List"
                      >
                        1. List
                      </button>
                      <div className="w-px h-4 bg-gray-300 mx-1" />
                      <button
                        type="button"
                        onClick={() => {
                          document.execCommand('bold', false);
                        }}
                        className="px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 transition-colors"
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          document.execCommand('italic', false);
                        }}
                        className="px-2 py-1 text-xs italic rounded hover:bg-gray-200 transition-colors"
                        title="Italic"
                      >
                        I
                      </button>
                    </div>
                    {/* Editable Area */}
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="min-h-[120px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:text-sm"
                      dangerouslySetInnerHTML={{
                        __html: (() => {
                          const h = getValues('highlights');
                          if (!h || (Array.isArray(h) && h.length === 0)) return '';
                          // If it's already HTML (string with tags)
                          const str = Array.isArray(h) ? h.join('\n') : String(h);
                          if (str.includes('<')) return str;
                          // Convert plain text lines to HTML list
                          const lines = str.split('\n').filter(Boolean);
                          return '<ul>' + lines.map(l => `<li>${l}</li>`).join('') + '</ul>';
                        })(),
                      }}
                      onBlur={(e) => {
                        // Save HTML content back to form as single-element array
                        const el = e.currentTarget;
                        const value = [el.innerHTML];
                        const event = { target: { name: 'highlights', value } };
                        register('highlights').onChange(event as unknown as React.ChangeEvent);
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Use the toolbar to format. Supports headings, lists, bold, italic.</p>
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
            <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden flex flex-col">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                PDF Preview
              </h2>
              <div className="flex-1 min-h-0" style={{ height: '85vh' }}>
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
