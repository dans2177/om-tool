import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

/**
 * POST /api/phase1/upload-pdf-server
 * Server-side fallback for PDF uploads when the client-upload flow fails
 * (e.g. local dev where Vercel can't reach the localhost callback URL).
 *
 * Accepts multipart FormData with:
 *   - file: the PDF File
 *   - filename: original filename
 */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const filename = (formData.get('filename') as string) || 'upload.pdf';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const blob = await put(`uploads/${filename}`, buffer, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error: any) {
    console.error('Server PDF upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 },
    );
  }
}
