import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import {
  downloadImage,
  compressImage,
  watermarkImage,
  repPhotoWatermark,
  lockPDF,
} from '@/lib/imageHandler';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface ImageInput {
  id: string;
  blobUrl: string;
  selected: boolean;
  watermark: boolean;
  repPhoto?: boolean;
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

    const password = process.env.MARKETING_PDF_LOCK_PASSWORD || 'MATTHEWS-TEST';

    // 1. Lock the PDF
    const pdfResponse = await fetch(pdfBlobUrl, { cache: 'no-store' });
    const pdfArrayBuf = await pdfResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuf);

    const lockedPdf = await lockPDF(pdfBuffer, password);
    const lockedBlob = await put(`${slug}/locked-om.pdf`, lockedPdf, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // 2. Process selected images
    const selectedImages = images.filter((img) => img.selected);
    const finalImages: {
      originalUrl: string;
      watermarkedUrl?: string;
      filename: string;
      hasWatermark: boolean;
      hasRepPhoto: boolean;
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

          if (img.watermark || img.repPhoto) {
            let watermarked = imgBuffer;

            if (img.watermark) {
              watermarked = await watermarkImage(watermarked);
            }

            if (img.repPhoto) {
              watermarked = await repPhotoWatermark(watermarked);
            }

            if (compress) {
              watermarked = await compressImage(watermarked, 80);
            }

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
            filename: `image-${i}.${ext}`,
            hasWatermark: !!img.watermark,
            hasRepPhoto: !!img.repPhoto,
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
      lockedPdfUrl: lockedBlob.url,
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
