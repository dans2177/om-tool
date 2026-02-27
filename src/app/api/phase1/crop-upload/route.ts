import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import sharp from 'sharp';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const slug = formData.get('slug') as string;
    const imageId = formData.get('imageId') as string;
    const file = formData.get('file') as File;

    if (!slug || !imageId || !file) {
      return NextResponse.json({ error: 'Missing slug, imageId, or file' }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Light JPEG compress — no resize restrictions, finalize handles final compression
    const compressed = await sharp(rawBuffer)
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    const filename = `${slug}/cropped-${imageId}.jpg`;

    const blob = await put(filename, compressed, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: true,
    });

    console.log(`crop-upload: saved ${compressed.length} bytes → ${blob.url}`);

    // Verify blob is immediately accessible before returning URL
    const check = await fetch(blob.url, { method: 'HEAD', cache: 'no-store' });
    if (!check.ok) {
      console.warn(`crop-upload: blob check returned ${check.status} for ${blob.url}, waiting 1s and retrying...`);
      await new Promise((r) => setTimeout(r, 1000));
      const recheck = await fetch(blob.url, { method: 'HEAD', cache: 'no-store' });
      if (!recheck.ok) {
        console.error(`crop-upload: blob still not accessible (${recheck.status}) for ${blob.url}`);
      }
    }

    return NextResponse.json({ blobUrl: blob.url });
  } catch (error: any) {
    console.error('Crop upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
