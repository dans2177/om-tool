import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

/**
 * GET /api/phase1/properties
 * Returns a flattened snapshot suitable for the Grandview Sender Chrome Extension.
 * - ?snapshot=<blobUrl>  → load a specific snapshot by its blob URL (from "Copy Code" button)
 * - no param             → load the most recent snapshot
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const specificUrl = searchParams.get('snapshot');

    let snapUrl: string;
    let savedAt: Date | string;

    if (specificUrl) {
      // Load a specific snapshot directly by its blob URL
      snapUrl = specificUrl;
      savedAt = new Date().toISOString();
    } else {
      // Load the most recent snapshot
      const { blobs } = await list({ prefix: 'snapshots/', limit: 50 });
      const sorted = blobs
        .filter((b) => b.pathname.endsWith('.json'))
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      if (sorted.length === 0) {
        return NextResponse.json({ error: 'No snapshots found' }, { status: 404 });
      }
      snapUrl  = sorted[0].url;
      savedAt  = sorted[0].uploadedAt;
    }

    const res  = await fetch(snapUrl);
    const snap = await res.json();

    const { omData, geo, brokerOfRecord, finalImages, lockedPdfUrl, pdfBlobUrl } = snap;

    if (!omData) {
      return NextResponse.json({ error: 'Snapshot missing omData' }, { status: 500 });
    }

    // Flatten into a shape the extension can consume directly
    const payload = {
      // Identity
      title: omData.title ?? '',
      record_type: omData.record_type ?? '',
      saleOrLease: omData.saleOrLease ?? 'for-sale',

      // SEO / Yoast
      seo_title: omData.seo?.seo_title ?? omData.title ?? '',
      slug: omData.seo?.slug ?? '',
      meta_description: omData.seo?.meta_description ?? '',
      focus_keyphrase: omData.title ?? '',

      // Address
      street: [omData.address?.street_number, omData.address?.street_name]
        .filter(Boolean)
        .join(' '),
      city: omData.address?.city ?? '',
      state_abbr: omData.address?.state_abbr ?? '',
      state_full: omData.address?.state_full ?? '',
      zip: omData.address?.zip ?? '',
      full_address: omData.address?.full_address ?? '',

      // Geo
      lat: geo?.lat ?? '',
      lng: geo?.lng ?? '',

      // Financials
      price: omData.financials?.price ?? '',
      price_display: omData.financials?.price_display ?? '',
      cap_rate: omData.financials?.cap_rate_percent ?? '',
      noi: omData.financials?.noi_annual ?? '',
      price_per_sf: omData.financials?.price_per_sf ?? '',

      // Size
      gross_sqft: omData.size?.building_sf_gross ?? '',
      lot_size: omData.size?.lot_size_acres ?? '',
      units: omData.size?.units ?? '',

      // Misc
      term_remaining: omData.term_remaining ?? '',
      year_built: omData.year_built ?? '',
      year_renovated: omData.year_renovated ?? '',
      occupancy: omData.occupancy_rate_percent ?? '',
      zoning: omData.zoning ?? '',

      // Classification / subtype (take first retail_subtype for WP single-select)
      subtype: omData.classification?.retail_subtypes?.[0] ?? '',

      // Descriptions
      description_html: omData.descriptions?.internal_editor_html ?? '',
      highlights: omData.highlights ?? [],

      // Listing agents (from OMData)
      listing_agents: omData.listing_agents ?? [],

      // Broker of record
      broker: {
        name: brokerOfRecord?.name ?? '',
        company: brokerOfRecord?.company ?? '',
        license_number: brokerOfRecord?.license_number ?? '',
        firm_number: brokerOfRecord?.firm_number ?? '',
        address: brokerOfRecord?.address ?? '',
        phone: brokerOfRecord?.phone ?? '',
      },

      // Media
      final_images: finalImages ?? [],   // array of { watermarkedUrl, originalUrl, filename }
      locked_pdf_url: lockedPdfUrl ?? pdfBlobUrl ?? '',

      // Snapshot meta
      saved_at: savedAt,
      snapshot_url: snapUrl,
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('GET /api/phase1/properties error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
