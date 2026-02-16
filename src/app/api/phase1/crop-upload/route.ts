import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const maxDuration = 60;
export const maxBodySize = '50mb';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const slug = formData.get('slug') as string;
    const imageId = formData.get('imageId') as string;
    const file = formData.get('file') as File;

    if (!slug || !imageId || !file) {
      return NextResponse.json({ error: 'Missing slug, imageId, or file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${slug}/cropped-${imageId}.jpg`;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return NextResponse.json({ blobUrl: blob.url });
  } catch (error: any) {
    console.error('Crop upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
