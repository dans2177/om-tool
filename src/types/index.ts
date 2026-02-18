/* ── Record type / property classification enum ── */
export type RecordType =
  | 'stnl'
  | 'sc'
  | 'industrial'
  | 'mf'
  | 'leasing'
  | 'hc'
  | 'hospitality'
  | 'self-storage'
  | 'land'
  | 'office'
  | 'mixed-use'
  | 'manufactured-housing';

export const RECORD_TYPES: { value: RecordType; label: string }[] = [
  { value: 'stnl', label: 'Single Tenant / Retail' },
  { value: 'sc', label: 'Shopping Center / Multi-Tenant' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'mf', label: 'Multifamily / Apartments' },
  { value: 'leasing', label: 'Leasing' },
  { value: 'hc', label: 'Healthcare' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'self-storage', label: 'Self Storage' },
  { value: 'land', label: 'Land' },
  { value: 'office', label: 'Office' },
  { value: 'mixed-use', label: 'Mixed-Use' },
  { value: 'manufactured-housing', label: 'Manufactured Housing' },
];

/* ── Sub-interfaces ── */

export interface OMAddress {
  street_number: string | null;
  street_name: string | null;
  city: string | null;
  state_abbr: string | null;
  state_full: string | null;
  zip: string | null;
  full_address: string | null;
}

export interface OMSEO {
  seo_title: string | null;
  slug: string | null;
  meta_description: string | null;
}

export interface OMFinancials {
  price: number | null;
  price_display: string | null;
  cap_rate_percent: number | null;
  noi_annual: number | null;
  price_per_sf: number | null;
}

export interface OMSize {
  building_sf_gross: number | null;
  lot_size_acres: number | null;
  units: number | null;
}

export interface OMClassification {
  retail_types: RecordType[];
  retail_subtypes: string[];
}

export interface OMAgent {
  name: string | null;
  email: string | null;
  license_number: string | null;
  phone: string | null;
  role: string | null;
}

export interface OMMultiSiteVariant {
  site: string;
  value: string | null;
}

export interface OMDescriptions {
  internal_editor_html: string | null;
  public_multi_site_variants: OMMultiSiteVariant[];
  crazy_header: string | null;
}

export interface OMLoopNet {
  highlights_tags: string[];
  formatted_tags_string: string | null;
}

export interface OMLeasingOnly {
  space_title: string | null;
  rate: string | null;
  property_type: string | null;
}

export interface OMAudit {
  missing_fields: string[];
  assumptions: string[];
  extracted_from: {
    om_pages_used: string[];
    sections_used: string[];
  };
}

export interface BrokerOfRecord {
  name: string;
  company: string;
  license_number: string;
  firm_number: string;
  address: string;
  phone: string;
}

/* ── Main OMData ── */

export interface OMData {
  /* Top-level identity */
  record_type: RecordType;
  title: string | null;
  saleOrLease: 'for-sale' | 'for-lease';

  /* Structured sub-objects */
  address: OMAddress;
  seo: OMSEO;
  financials: OMFinancials;
  size: OMSize;
  classification: OMClassification;
  listing_agents: OMAgent[];
  descriptions: OMDescriptions;
  loopnet: OMLoopNet;
  leasing_only: OMLeasingOnly;
  audit: OMAudit;

  /* Scalar fields */
  tenants: string[];
  highlights: string[];
  loopnet_highlights: string[];
  term_remaining: string | null;
  occupancy_rate_percent: number | null;
  year_built: number | null;
  year_renovated: number | null;
  zoning: string | null;
}

/* ── Other interfaces (unchanged) ── */

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
  watermark: false | 'white' | 'black';
  repPhoto: boolean;
}

export interface FinalizedImage {
  originalUrl: string;
  watermarkedUrl?: string;
  filename: string;
  hasWatermark: boolean;
  hasRepPhoto: boolean;
}

export interface ExtractionResult {
  omData: OMData;
  brokerOfRecord: BrokerOfRecord | null;
  images: ExtractedImage[];
  pdfBlobUrl: string;
  rawText: string;
}

export interface FinalizeResult {
  lockedPdfUrl: string;
  images: FinalizedImage[];
}
