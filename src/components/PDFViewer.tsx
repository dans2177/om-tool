'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFViewerProps {
  url: string;
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);

  return (
    <div className="flex flex-col h-full pdf-no-select">
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
            width={500}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={
              <div style={{ width: 500, minHeight: 600 }} />
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
