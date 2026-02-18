'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Layers } from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFViewerProps {
  url: string;
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [mode, setMode] = useState<'embed' | 'pages'>('embed');
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const BASE_WIDTH = 500;

  // Embed mode — browser's native PDF viewer (instant, streams)
  if (mode === 'embed') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end mb-2">
          <button
            onClick={() => setMode('pages')}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            title="Switch to page-by-page view"
          >
            <Layers className="w-3.5 h-3.5" /> Page view
          </button>
        </div>
        <iframe
          src={`${url}#toolbar=1`}
          title="PDF Preview"
          className="flex-1 w-full rounded-lg border border-gray-200"
          style={{ minHeight: 600 }}
        />
      </div>
    );
  }

  // Pages mode — react-pdf with zoom + page nav
  return (
    <div className="flex flex-col h-full pdf-no-select">
      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <button
          onClick={() => setMode('embed')}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors mr-2"
          title="Switch to embedded viewer"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-[11px] text-gray-500 font-medium w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)))}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        {scale !== 1 && (
          <button
            onClick={() => setScale(1)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-0.5"
            title="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto flex justify-center bg-gray-100 rounded-lg" style={{ minHeight: 600 }}>
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex items-center justify-center text-gray-400 text-sm" style={{ minHeight: 600 }}>
              Loading PDF…
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            width={BASE_WIDTH * scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={
              <div style={{ width: BASE_WIDTH * scale, minHeight: 600 }} />
            }
          />
        </Document>
      </div>

      {numPages > 0 && (
        <div className="flex items-center justify-center gap-4 mt-3">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
