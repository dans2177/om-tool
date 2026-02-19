import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

/**
 * POST /api/phase1/upload-extra
 *
 * Accepts EITHER:
 *   A) FormData with `slug` + `images` files  (legacy / local dev)
 *   B) JSON body  `{ slug, blobUrls: [{ url, name }] }`  (client-side blob uploads)
 *
 * Mode B bypasses the 4.5 MB serverless body limit because the images
 * were already uploaded to Vercel Blob on the client.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // ── Mode B: JSON with pre-uploaded blob URLs ──
    if (contentType.includes('application/json')) {
      const { slug, blobUrls } = (await req.json()) as {
        slug: string;
        blobUrls: { url: string; name: string }[];
      };

      if (!blobUrls?.length) {
        return NextResponse.json({ error: 'No images provided' }, { status: 400 });
      }

      const uploaded: {
        id: string;
        blobUrl: string;
        thumbnailUrl: string;
        width: number;
        height: number;
      }[] = [];

      for (let i = 0; i < blobUrls.length; i++) {
        const { url } = blobUrls[i];

        // Download from blob to generate thumbnail + get dimensions
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());

        const metadata = await sharp(buffer).metadata();

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
          blobUrl: url,
          thumbnailUrl: thumbBlob.url,
          width: metadata.width || 0,
          height: metadata.height || 0,
        });
      }

      return NextResponse.json({ images: uploaded });
    }

    // ── Mode A: FormData with raw file uploads (original behaviour) ──
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
