import { NextRequest, NextResponse } from 'next/server';
import { list, put, del } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export interface OMSnapshot {
  title: string;
  address: string;
  pdfBlobUrl: string;
  savedAt: string;
  snapshotUrl: string; // blob URL of the JSON snapshot
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'snapshots/', limit: 50 });

    const snapshots: OMSnapshot[] = [];
    for (const b of blobs.filter(b => b.pathname.endsWith('.json')).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())) {
      try {
        const res = await fetch(b.url);
        const data = await res.json();
        snapshots.push({
          title: data.omData?.title || 'Untitled',
          address: data.omData?.address?.full_address || '',
          pdfBlobUrl: data.pdfBlobUrl || '',
          savedAt: b.uploadedAt instanceof Date ? b.uploadedAt.toISOString() : String(b.uploadedAt),
          snapshotUrl: b.url,
        });
      } catch {
        // skip malformed snapshots
      }
    }

    return NextResponse.json({ snapshots });
  } catch (error: any) {
    console.error('Recent snapshots error:', error);
    return NextResponse.json({ snapshots: [], error: error.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { omData, pdfBlobUrl, geo, brokerOfRecord, finalImages, lockedPdfUrl, images } = body;

    if (!omData) {
      return NextResponse.json({ error: 'No omData provided' }, { status: 400 });
    }

    const slug = omData.seo?.slug || 'unknown';
    const ts = Date.now();
    const pathname = `snapshots/${slug}-${ts}.json`;

    const snapshot = { omData, pdfBlobUrl, geo, brokerOfRecord, finalImages, lockedPdfUrl, images };

    const blob = await put(pathname, JSON.stringify(snapshot), {
      access: 'public',
      contentType: 'application/json',
    });

    return NextResponse.json({ success: true, snapshotUrl: blob.url });
  } catch (error: any) {
    console.error('Save snapshot error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { snapshotUrl } = await req.json();
    if (snapshotUrl) {
      await del(snapshotUrl);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
