export interface OMData {
  address: string;
  price: number | null;
  capRate: number | null;
  noi: number | null;
  sqFt: number | null;
  yearBuilt: number | null;
  zoning: string | null;
  tenants: string[];
  propertyType: 'stnl' | 'mf' | 'retail' | 'office' | 'industrial' | 'other';
  saleOrLease: 'for-sale' | 'for-lease';
  slug: string;
  highlights: string[];
}

export interface GeoResult {
  lat: number;
  lng: number;
}

export interface ExtractedImage {
  id: string;
  blobUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  selected: boolean;
  watermark: boolean;
}

export interface FinalizedImage {
  originalUrl: string;
  watermarkedUrl?: string;
  filename: string;
}

export interface ExtractionResult {
  omData: OMData;
  images: ExtractedImage[];
  pdfBlobUrl: string;
  rawText: string;
}

export interface FinalizeResult {
  lockedPdfUrl: string;
  images: FinalizedImage[];
}
