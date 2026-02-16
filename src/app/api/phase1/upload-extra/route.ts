import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const slug = (formData.get('slug') as string) || 'unknown';
    const files = formData.getAll('images') as File[];

    if (!files.length) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    const uploaded: {
      id: string;
      blobUrl: string;
      thumbnailUrl: string;
      width: number;
      height: number;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      const filename = `${slug}/images/extra-${Date.now()}-${i}.png`;
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: file.type || 'image/png',
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      // Generate thumbnail
      const thumbBuffer = await sharp(buffer)
        .resize({ width: 200 })
        .jpeg({ quality: 60 })
        .toBuffer();
      const thumbFilename = `${slug}/images/extra-thumb-${Date.now()}-${i}.jpg`;
      const thumbBlob = await put(thumbFilename, thumbBuffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      uploaded.push({
        id: `extra-${Date.now()}-${i}`,
        blobUrl: blob.url,
        thumbnailUrl: thumbBlob.url,
        width: 0,
        height: 0,
      });
    }

    return NextResponse.json({ images: uploaded });
  } catch (error: any) {
    console.error('Upload-extra API error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
