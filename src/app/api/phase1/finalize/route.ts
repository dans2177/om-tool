import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import {
  downloadImage,
  compressImage,
  watermarkImage,
  lockPDF,
} from '@/lib/imageHandler';

export const maxDuration = 120;
export const maxBodySize = '50mb';
export const dynamic = 'force-dynamic';

interface ImageInput {
  id: string;
  blobUrl: string;
  selected: boolean;
  watermark: false | 'white' | 'black';
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
    const pdfResponse = await fetch(pdfBlobUrl);
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
    }[] = [];

    for (let i = 0; i < selectedImages.length; i++) {
      const img = selectedImages[i];
      let imgBuffer = await downloadImage(img.blobUrl);

      // Compress if requested
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

      if (img.watermark) {
        let watermarked = await watermarkImage(imgBuffer, img.watermark);
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

      finalImages.push({
        originalUrl: originalBlob.url,
        watermarkedUrl,
        filename: `image-${i}.${ext}`,
      });
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
