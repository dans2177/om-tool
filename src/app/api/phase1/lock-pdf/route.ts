import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { encryptPDFRestricted } from '@/lib/pdfEncrypt';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * POST /api/phase1/lock-pdf
 *
 * Locks & compresses a PDF using JS-based encryption (works on Vercel serverless).
 * Accepts JSON: { pdfUrl, slug, ownerPassword, userPassword }
 * Returns JSON: { lockedPdfUrl, originalSize, lockedSize }
 */
export async function POST(req: NextRequest) {
  try {
    const { pdfUrl, slug, ownerPassword = '', userPassword = '' } = await req.json();

    if (!pdfUrl || !slug) {
      return NextResponse.json({ error: 'Missing pdfUrl or slug' }, { status: 400 });
    }

    // Download the source PDF
    const pdfResponse = await fetch(pdfUrl, { cache: 'no-store' });
    if (!pdfResponse.ok) throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const originalSize = pdfBuffer.length;

    // Encrypt with restrictive permissions (JS — works on Vercel)
    const encryptedBytes = await encryptPDFRestricted(
      new Uint8Array(pdfBuffer),
      userPassword,
      ownerPassword,
    );
    const lockedSize = encryptedBytes.length;

    // Upload to Vercel Blob
    const blob = await put(`${slug}/locked-om.pdf`, Buffer.from(encryptedBytes), {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: true,
    });

    return NextResponse.json({
      lockedPdfUrl: blob.url,
      originalSize,
      lockedSize,
    });
  } catch (error: any) {
    console.error('lock-pdf error:', error);
    return NextResponse.json({ error: error.message || 'PDF lock failed' }, { status: 500 });
  }
}
