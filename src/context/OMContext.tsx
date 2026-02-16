'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { OMData, ExtractedImage, FinalizedImage, GeoResult } from '@/types';
import type { ProgressStep } from '@/components/LoadingOverlay';

interface OMContextType {
  // Loading
  loading: boolean;
  setLoading: (v: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (v: string) => void;
  progressSteps: ProgressStep[];
  setProgressSteps: React.Dispatch<React.SetStateAction<ProgressStep[]>>;
  addStep: (message: string) => void;

  // Error
  error: string;
  setError: (v: string) => void;

  // Upload
  notes: string;
  setNotes: (v: string) => void;

  // Extraction
  omData: OMData | null;
  setOmData: (v: OMData | null) => void;
  images: ExtractedImage[];
  setImages: React.Dispatch<React.SetStateAction<ExtractedImage[]>>;
  pdfBlobUrl: string;
  setPdfBlobUrl: (v: string) => void;
  geo: GeoResult | null;
  setGeo: (v: GeoResult | null) => void;

  // Approval
  compress: boolean;
  setCompress: (v: boolean) => void;
  password: string;
  setPassword: (v: string) => void;
  lightboxImg: string | null;
  setLightboxImg: (v: string | null) => void;

  // Final
  lockedPdfUrl: string;
  setLockedPdfUrl: (v: string) => void;
  finalImages: FinalizedImage[];
  setFinalImages: (v: FinalizedImage[]) => void;

  // Reset for new OM
  resetAll: () => void;
}

const OMContext = createContext<OMContextType | null>(null);

export function OMProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [error, setError] = useState('');

  const [notes, setNotes] = useState('');

  const [omData, setOmData] = useState<OMData | null>(null);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [geo, setGeo] = useState<GeoResult | null>(null);

  const [compress, setCompress] = useState(true);
  const [password, setPassword] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const [lockedPdfUrl, setLockedPdfUrl] = useState('');
  const [finalImages, setFinalImages] = useState<FinalizedImage[]>([]);

  const addStep = useCallback((message: string) => {
    setProgressSteps((prev) => [...prev, { message, timestamp: new Date() }]);
    setLoadingMessage(message);
  }, []);

  const resetAll = useCallback(() => {
    setLoading(false);
    setLoadingMessage('');
    setProgressSteps([]);
    setError('');
    setNotes('');
    setOmData(null);
    setImages([]);
    setPdfBlobUrl('');
    setGeo(null);
    setCompress(true);
    setPassword('');
    setLightboxImg(null);
    setLockedPdfUrl('');
    setFinalImages([]);
  }, []);

  return (
    <OMContext.Provider
      value={{
        loading, setLoading,
        loadingMessage, setLoadingMessage,
        progressSteps, setProgressSteps, addStep,
        error, setError,
        notes, setNotes,
        omData, setOmData,
        images, setImages,
        pdfBlobUrl, setPdfBlobUrl,
        geo, setGeo,
        compress, setCompress,
        password, setPassword,
        lightboxImg, setLightboxImg,
        lockedPdfUrl, setLockedPdfUrl,
        finalImages, setFinalImages,
        resetAll,
      }}
    >
      {children}
    </OMContext.Provider>
  );
}

export function useOM() {
  const ctx = useContext(OMContext);
  if (!ctx) throw new Error('useOM must be used within OMProvider');
  return ctx;
}
