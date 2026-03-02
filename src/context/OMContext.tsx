'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { OMData, ExtractedImage, FinalizedImage, GeoResult, BrokerOfRecord } from '@/types';
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
  setOmData: React.Dispatch<React.SetStateAction<OMData | null>>;
  images: ExtractedImage[];
  setImages: React.Dispatch<React.SetStateAction<ExtractedImage[]>>;
  pdfBlobUrl: string;
  setPdfBlobUrl: (v: string) => void;
  geo: GeoResult | null;
  setGeo: (v: GeoResult | null) => void;
  brokerOfRecord: BrokerOfRecord | null;
  setBrokerOfRecord: (v: BrokerOfRecord | null) => void;

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

  // Snapshot tracking
  snapshotUrl: string | null;
  setSnapshotUrl: (v: string | null) => void;

  // Reset for new OM
  resetAll: () => void;

  // Snapshot save/restore
  saveSnapshot: () => Promise<string | null>;
  updateSnapshot: (snapshotUrl: string) => Promise<string | null>;
  restoreSnapshot: (snapshotUrl: string) => Promise<boolean>;
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
  const [brokerOfRecord, setBrokerOfRecord] = useState<BrokerOfRecord | null>(null);

  const [compress, setCompress] = useState(true);
  const [password, setPassword] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const [lockedPdfUrl, setLockedPdfUrl] = useState('');
  const [finalImages, setFinalImages] = useState<FinalizedImage[]>([]);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

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
    setBrokerOfRecord(null);
    setCompress(true);
    setPassword('');
    setLightboxImg(null);
    setLockedPdfUrl('');
    setFinalImages([]);
    setSnapshotUrl(null);
  }, []);

  const saveSnapshot = useCallback(async (): Promise<string | null> => {
    if (!omData) return null;
    try {
      const res = await fetch('/api/phase1/recent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          omData,
          pdfBlobUrl,
          geo,
          brokerOfRecord,
          finalImages,
          lockedPdfUrl,
          images,
        }),
      });
      const data = await res.json();
      return data.snapshotUrl ?? null;
    } catch (e) {
      console.error('Failed to save snapshot:', e);
      return null;
    }
  }, [omData, pdfBlobUrl, geo, brokerOfRecord, finalImages, lockedPdfUrl, images]);

  const updateSnapshot = useCallback(async (snapshotUrl: string): Promise<string | null> => {
    if (!omData) return null;
    try {
      const res = await fetch('/api/phase1/recent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotUrl,
          omData,
          pdfBlobUrl,
          geo,
          brokerOfRecord,
          finalImages,
          lockedPdfUrl,
          images,
        }),
      });
      const data = await res.json();
      return data.snapshotUrl ?? null;
    } catch (e) {
      console.error('Failed to update snapshot:', e);
      return null;
    }
  }, [omData, pdfBlobUrl, geo, brokerOfRecord, finalImages, lockedPdfUrl, images]);

  const restoreSnapshot = useCallback(async (snapshotUrl: string): Promise<boolean> => {
    try {
      const res = await fetch(snapshotUrl);
      if (!res.ok) return false;
      const data = await res.json();
      if (data.omData) setOmData(data.omData);
      if (data.pdfBlobUrl) setPdfBlobUrl(data.pdfBlobUrl);
      if (data.geo) setGeo(data.geo);
      if (data.brokerOfRecord) setBrokerOfRecord(data.brokerOfRecord);
      if (data.finalImages) setFinalImages(data.finalImages);
      if (data.lockedPdfUrl) setLockedPdfUrl(data.lockedPdfUrl);
      if (data.images) setImages(data.images);
      setSnapshotUrl(snapshotUrl);
      return true;
    } catch (e) {
      console.error('Failed to restore snapshot:', e);
      return false;
    }
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
        brokerOfRecord, setBrokerOfRecord,
        compress, setCompress,
        password, setPassword,
        lightboxImg, setLightboxImg,
        lockedPdfUrl, setLockedPdfUrl,
        finalImages, setFinalImages,
        snapshotUrl, setSnapshotUrl,
        resetAll,
        saveSnapshot,
        updateSnapshot,
        restoreSnapshot,
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
