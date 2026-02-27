import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import {
  downloadImage,
  compressImage,
  watermarkImage,
  repRenderingWatermark,
} from '@/lib/imageHandler';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface ImageInput {
  id: string;
  blobUrl: string;
  selected: boolean;
  watermark: boolean;
  repRendering?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      images,
      pdfBlobUrl,
      slug,
      compress,
    }: {
      images: ImageInput[];
      pdfBlobUrl: string;
      slug: string;
      compress: boolean;
    } = body;

    const password = process.env.MARKETING_PDF_LOCK_PASSWORD || 'Matthews841';

    // 1. Lock & compress the PDF via Python pikepdf (preserves links & formatting)
    const vercelUrl = process.env.VERCEL_URL;
    const protocol = vercelUrl?.includes('localhost') ? 'http' : 'https';
    const baseUrl = vercelUrl
      ? `${protocol}://${vercelUrl}`
      : `http://localhost:3000`;

    const lockResponse = await fetch(`${baseUrl}/api/phase1/lock-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfUrl: pdfBlobUrl,
        slug,
        ownerPassword: password,
        userPassword: '',
      }),
    });

    if (!lockResponse.ok) {
      const errBody = await lockResponse.json().catch(() => ({ error: 'PDF lock request failed' }));
      throw new Error(errBody.error || `PDF lock failed (${lockResponse.status})`);
    }

    const lockResult = await lockResponse.json();
    const lockedPdfUrl: string = lockResult.lockedPdfUrl;

    console.log(
      `PDF locked & compressed: ${lockResult.originalSize} → ${lockResult.lockedSize} bytes`
    );

    // 2. Process selected images
    const selectedImages = images.filter((img) => img.selected);
    const finalImages: {
      originalUrl: string;
      watermarkedUrl?: string;
      rrUrl?: string;
      filename: string;
      hasWatermark: boolean;
      hasRepRendering: boolean;
    }[] = [];

    // Process images in parallel batches of 5
    const BATCH = 5;
    for (let b = 0; b < selectedImages.length; b += BATCH) {
      const batch = selectedImages.slice(b, b + BATCH);
      const batchResults = await Promise.all(
        batch.map(async (img, batchIdx) => {
          const i = b + batchIdx;
          console.log(`Finalize image ${i}: blobUrl=${img.blobUrl}, id=${img.id}`);
          let imgBuffer = await downloadImage(img.blobUrl);
          console.log(`Finalize image ${i}: downloaded ${imgBuffer.length} bytes, header=${imgBuffer.slice(0, 4).toString('hex')}`);

          let originalBuffer = compress
            ? await compressImage(imgBuffer, 80)
            : imgBuffer;

          const ext = compress ? 'jpg' : 'png';
          const contentType = compress ? 'image/jpeg' : 'image/png';
          const originalFilename = `${slug}/final/image-${i}.${ext}`;

          const originalBlob = await put(originalFilename, originalBuffer, {
            access: 'public',
            contentType,
            addRandomSuffix: false,
            allowOverwrite: true,
          });

          let watermarkedUrl: string | undefined;
          let rrUrl: string | undefined;

          // ALL selected images get Matthews logo watermark.
          // RR (Representative Rendering) is the optional toggle:
          //   - RR version: image + "Representative Rendering" text (internal)
          //   - WM version: image + Matthews logo + "Representative Rendering" text (3rd party)
          // Non-RR: WM version = image + Matthews logo only
          if (img.repRendering) {
            // RR version: "Representative Rendering" text overlay only
            let rrBuffer = await repRenderingWatermark(imgBuffer);
            if (compress) rrBuffer = await compressImage(rrBuffer, 80);
            const rrFilename = `${slug}/final/image-${i}-rr.${ext}`;
            const rrBlob = await put(rrFilename, rrBuffer, {
              access: 'public',
              contentType,
              addRandomSuffix: false,
              allowOverwrite: true,
            });
            rrUrl = rrBlob.url;

            // WM version: Matthews logo + "Representative Rendering" text (for third parties)
            let wmBuffer = await watermarkImage(imgBuffer);
            wmBuffer = await repRenderingWatermark(wmBuffer);
            if (compress) wmBuffer = await compressImage(wmBuffer, 80);
            const wmFilename = `${slug}/final/image-${i}-watermarked.${ext}`;
            const wmBlob = await put(wmFilename, wmBuffer, {
              access: 'public',
              contentType,
              addRandomSuffix: false,
              allowOverwrite: true,
            });
            watermarkedUrl = wmBlob.url;
          } else {
            // WM only: Matthews logo watermark (always applied)
            let watermarked = await watermarkImage(imgBuffer);
            if (compress) watermarked = await compressImage(watermarked, 80);
            const wmFilename = `${slug}/final/image-${i}-watermarked.${ext}`;
            const wmBlob = await put(wmFilename, watermarked, {
              access: 'public',
              contentType,
              addRandomSuffix: false,
              allowOverwrite: true,
            });
            watermarkedUrl = wmBlob.url;
          }

          return {
            originalUrl: originalBlob.url,
            watermarkedUrl,
            rrUrl,
            filename: `image-${i}.${ext}`,
            hasWatermark: true,
            hasRepRendering: !!img.repRendering,
          };
        })
      );
      finalImages.push(...batchResults);
    }

    // 3. Clean up unselected original blobs (fire-and-forget)
    const unselectedImages = images.filter((img) => !img.selected);
    if (unselectedImages.length > 0) {
      Promise.all(
        unselectedImages.map((img) =>
          del(img.blobUrl).catch(() => {})
        )
      ).catch(() => {});
    }

    return NextResponse.json({
      lockedPdfUrl: lockedPdfUrl,
      images: finalImages,
    });
  } catch (error: any) {
    console.error('Finalize API error:', error);
    return NextResponse.json(
      { error: error.message || 'Finalization failed' },
      { status: 500 }
    );
  }
}
