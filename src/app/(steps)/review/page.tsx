'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Download, ZoomIn, X, ArrowLeft } from 'lucide-react';
import { useOM } from '@/context/OMContext';
import type { OMData } from '@/types';
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

export default function ReviewPage() {
  const router = useRouter();
  const {
    omData, setOmData,
    pdfBlobUrl,
    geo,
    lockedPdfUrl,
    finalImages,
    lightboxImg, setLightboxImg,
    resetAll,
    loading,
  } = useOM();

  const { register, handleSubmit, getValues } = useForm<OMData>({
    defaultValues: omData || undefined,
  });

  // Redirect if no data
  if (!omData) {
    if (typeof window !== 'undefined' && !loading) {
      router.push('/');
    }
    return null;
  }

  const startNewOM = () => {
    resetAll();
    router.push('/');
  };

  return (
    <>
      <div className="px-4 max-w-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={startNewOM}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            New OM
          </button>
          {omData.address && (
            <h2 className="text-base font-semibold text-gray-800">{omData.address}</h2>
          )}
          <div />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Images & Downloads */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-y-auto max-h-[88vh]">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Images &amp; Downloads
            </h3>

            {/* Image gallery */}
            {finalImages.length > 0 && (
              <div className="mb-5">
                <div className="grid grid-cols-2 gap-2">
                  {finalImages.map((img, i) => (
                    <div
                      key={`preview-${i}`}
                      className="relative group rounded-xl overflow-hidden border border-gray-100 cursor-pointer"
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
                      <p className="text-[10px] text-gray-400 truncate px-2 py-1">{img.filename}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Downloads */}
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Downloads</p>
            <div className="space-y-2">
              {lockedPdfUrl && (
                <a
                  href={lockedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100/80 transition-colors"
                >
                  <Download className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-red-700">Locked PDF</p>
                    <p className="text-xs text-red-400">Print-only, password protected</p>
                  </div>
                </a>
              )}

              {finalImages.map((img, i) => (
                <div key={i} className="space-y-1">
                  <a
                    href={img.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100/80 transition-colors"
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-700 truncate">{img.filename}</span>
                  </a>
                  {img.watermarkedUrl && (
                    <a
                      href={img.watermarkedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100/80 transition-colors ml-4"
                    >
                      <Download className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-700 truncate">
                        WM-{img.filename}
                      </span>
                    </a>
                  )}
                </div>
              ))}
            </div>

            {geo && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">Geocoded</p>
                <p className="text-sm text-gray-600 font-mono">
                  {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
                </p>
              </div>
            )}
          </div>

          {/* Middle: Editable Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-y-auto max-h-[88vh]">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Property Details
            </h3>
            <form onSubmit={handleSubmit((data) => setOmData(data))} className="space-y-3.5">
              <Field label="Address" name="address" register={register} />
              <Field label="Price" name="price" register={register} type="number" />
              <Field label="Cap Rate" name="capRate" register={register} type="number" step="0.01" />
              <Field label="NOI" name="noi" register={register} type="number" />
              <Field label="Sq Ft" name="sqFt" register={register} type="number" />
              <Field label="Year Built" name="yearBuilt" register={register} type="number" />
              <Field label="Zoning" name="zoning" register={register} />
              <Field label="Slug" name="slug" register={register} />

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Property Type</label>
                <select
                  {...register('propertyType')}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Sale or Lease</label>
                <select
                  {...register('saleOrLease')}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option value="for-sale">For Sale</option>
                  <option value="for-lease">For Lease</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tenants</label>
                <input
                  {...register('tenants')}
                  placeholder="Comma-separated"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>

              {/* Rich Highlights Editor */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Highlights</label>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-100">
                    <button type="button" onClick={() => document.execCommand('formatBlock', false, 'h1')} className="px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 transition-colors" title="Heading">H1</button>
                    <button type="button" onClick={() => document.execCommand('formatBlock', false, 'h2')} className="px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 transition-colors" title="Subheading">H2</button>
                    <div className="w-px h-4 bg-gray-200 mx-0.5" />
                    <button type="button" onClick={() => document.execCommand('insertUnorderedList', false)} className="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors" title="Bullet List">&bull; List</button>
                    <button type="button" onClick={() => document.execCommand('insertOrderedList', false)} className="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors" title="Numbered List">1. List</button>
                    <div className="w-px h-4 bg-gray-200 mx-0.5" />
                    <button type="button" onClick={() => document.execCommand('bold', false)} className="px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 transition-colors" title="Bold">B</button>
                    <button type="button" onClick={() => document.execCommand('italic', false)} className="px-2 py-1 text-xs italic rounded hover:bg-gray-200 transition-colors" title="Italic">I</button>
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-[100px] max-h-[180px] overflow-y-auto px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:text-sm"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const h = getValues('highlights');
                        if (!h || (Array.isArray(h) && h.length === 0)) return '';
                        const str = Array.isArray(h) ? h.join('\n') : String(h);
                        if (str.includes('<')) return str;
                        const lines = str.split('\n').filter(Boolean);
                        return '<ul>' + lines.map((l) => `<li>${l}</li>`).join('') + '</ul>';
                      })(),
                    }}
                    onBlur={(e) => {
                      const value = [e.currentTarget.innerHTML];
                      const event = { target: { name: 'highlights', value } };
                      register('highlights').onChange(event as unknown as React.ChangeEvent);
                    }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Toolbar: headings, lists, bold, italic</p>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                Save Changes
              </button>
            </form>
          </div>

          {/* Right: PDF Viewer */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              PDF Preview
            </h3>
            <div className="flex-1 min-h-0" style={{ height: '82vh' }}>
              <PDFViewer url={pdfBlobUrl} />
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button onClick={() => setLightboxImg(null)} className="absolute top-4 right-4 text-white/80 hover:text-white">
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
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        {...register(name)}
        type={type}
        step={step}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
      />
    </div>
  );
}
