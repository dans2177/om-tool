import { put } from '@vercel/blob';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import path from 'path';
import fs from 'fs';
import { encryptPDFRestricted } from '@/lib/pdfEncrypt';
import { ensurePolyfills } from '@/lib/ensurePolyfills';

export interface ExtractedImageInfo {
  id: string;
  blobUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

/**
 * Extract all embedded images from a PDF buffer using pdfjs-dist.
 * Pulls raw XObject images from each page.
 */
export async function extractImagesFromPDF(
  pdfBuffer: Buffer,
  slug: string,
  onProgress?: (count: number) => Promise<void>
): Promise<ExtractedImageInfo[]> {
  // Polyfill DOM globals BEFORE loading pdfjs-dist
  ensurePolyfills();

  // Pre-load the worker onto globalThis so pdfjs-dist finds it on the main
  // thread and never tries to dynamically import pdf.worker.mjs (which is
  // missing from Vercel's serverless bundle).
  if (!(globalThis as any).pdfjsWorker) {
    const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs') as any;
    (globalThis as any).pdfjsWorker = workerModule;
  }

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as any;

  const images: ExtractedImageInfo[] = [];

  // Load with pdf-lib to find image XObjects
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();

  // Load with pdfjs-dist for rendering
  const uint8 = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdfJsDoc = await loadingTask.promise;

  let imgIndex = 0;
  const seenHashes = new Set<string>();

  // Collect raw image data from all pages first, then batch-upload
  interface RawImage { jpgBuffer: Buffer; w: number; h: number; idx: number; }
  const pending: RawImage[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfJsDoc.getPage(pageNum);
    const ops = await page.getOperatorList();

    for (let i = 0; i < ops.fnArray.length; i++) {
      if (
        ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject ||
        ops.fnArray[i] === pdfjsLib.OPS.paintXObject
      ) {
        const imgName = ops.argsArray[i][0];
        try {
          const imgData = await page.objs.get(imgName) as any;
          if (!imgData || !imgData.data) continue;

          const w = imgData.width;
          const h = imgData.height;

          // Skip tiny images (icons, dots, logos etc.)
          if (w < 80 || h < 80) continue;

          // Quick content hash to deduplicate identical images
          const sample = imgData.data.slice(0, 512);
          let hash = 0;
          for (let j = 0; j < sample.length; j++) hash = ((hash << 5) - hash + sample[j]) | 0;
          const key = `${w}x${h}-${hash}`;
          if (seenHashes.has(key)) continue;
          seenHashes.add(key);

          let jpgBuffer: Buffer;

          if (imgData.data.length === w * h * 4) {
            jpgBuffer = await sharp(Buffer.from(imgData.data), {
              raw: { width: w, height: h, channels: 4 },
            }).jpeg({ quality: 85 }).toBuffer();
          } else if (imgData.data.length === w * h * 3) {
            jpgBuffer = await sharp(Buffer.from(imgData.data), {
              raw: { width: w, height: h, channels: 3 },
            }).jpeg({ quality: 85 }).toBuffer();
          } else {
            continue;
          }

          pending.push({ jpgBuffer, w, h, idx: imgIndex++ });
        } catch {
          continue;
        }
      }
    }

    page.cleanup();
  }

  // Batch-upload in parallel (10 at a time)
  const BATCH = 10;
  for (let b = 0; b < pending.length; b += BATCH) {
    const batch = pending.slice(b, b + BATCH);
    const results = await Promise.all(
      batch.map(async ({ jpgBuffer, w, h, idx }) => {
        const [blob, thumbBlob] = await Promise.all([
          put(`${slug}/images/extracted-${idx}.jpg`, jpgBuffer, {
            access: 'public', contentType: 'image/jpeg',
            addRandomSuffix: false, allowOverwrite: true,
          }),
          sharp(jpgBuffer).resize({ width: 200 }).jpeg({ quality: 60 }).toBuffer()
            .then((tb) => put(`${slug}/images/thumb-${idx}.jpg`, tb, {
              access: 'public', contentType: 'image/jpeg',
              addRandomSuffix: false, allowOverwrite: true,
            })),
        ]);
        return { id: `img-${idx}`, blobUrl: blob.url, thumbnailUrl: thumbBlob.url, width: w, height: h };
      })
    );
    images.push(...results);
    if (onProgress) await onProgress(images.length);
  }

  return images;
}

/**
 * Compress an image to JPEG at given quality.
 * Handles raw pixel data and gracefully falls back for unsupported formats.
 */
export async function compressImage(
  imageBuffer: Buffer,
  quality: number = 80
): Promise<Buffer> {
  try {
    return await sharp(imageBuffer).jpeg({ quality }).toBuffer();
  } catch (err: any) {
    if (err?.message?.includes('unsupported image format')) {
      console.warn('compressImage: unsupported format, attempting raw RGBA decode…', {
        bufferLength: imageBuffer.length,
        header: imageBuffer.slice(0, 16).toString('hex'),
      });
      // Return original buffer as-is rather than crashing the whole finalize
      return imageBuffer;
    }
    throw err;
  }
}

/**
 * Apply a watermark (logo overlay) to an image.
 * Logo is read from public/logo.png.
 */
export async function watermarkImage(
  imageBuffer: Buffer,
): Promise<Buffer> {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');

  // Check if logo exists
  if (!fs.existsSync(logoPath)) {
    // If no logo, return original with a text-based watermark
    const metadata = await sharp(imageBuffer).metadata();
    const w = metadata.width || 800;
    const h = metadata.height || 600;
    const fontSize = Math.max(16, Math.floor(w / 30));

    const fillColor = 'rgba(255,255,255,0.6)';
    const svgText = `<svg width="${w}" height="${h}">
      <text x="${w / 2}" y="${h - 30}" font-size="${fontSize}" fill="${fillColor}"
        text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-weight="bold">
        CONFIDENTIAL
      </text>
    </svg>`;

    return sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgText), gravity: 'southeast' }])
      .toBuffer();
  }

  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || 800;
  const imgHeight = metadata.height || 600;

  // Resize logo to ~25% of image width
  const logoWidth = Math.floor(imgWidth * 0.25);
  let logoBuffer = await sharp(logoPath)
    .resize({ width: logoWidth })
    .ensureAlpha(0.5)
    .toBuffer();

  // Add padding around the logo so it doesn't touch the image edges
  const padding = Math.max(10, Math.floor(imgWidth * 0.03));
  const logoMeta = await sharp(logoBuffer).metadata();
  logoBuffer = await sharp(logoBuffer)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  return sharp(imageBuffer)
    .composite([{ input: logoBuffer, gravity: 'southeast' }])
    .toBuffer();
}

/**
 * Apply a "Representative Photo" text watermark to the bottom-left of an image.
 * Stacks with the logo watermark (bottom-right).
 *
 * Uses sharp's Pango-based text rendering instead of SVG to avoid
 * librsvg font-availability and feDropShadow filter issues on Vercel
 * serverless (Amazon Linux).
 */
export async function repPhotoWatermark(
  imageBuffer: Buffer,
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const w = metadata.width || 800;
  const h = metadata.height || 600;
  const fontSize = Math.max(14, Math.floor(w / 40));

  const pangoMarkup = `<span font_weight="bold" font="${fontSize}">Representative Photo</span>`;

  // Render the shadow layer (offset by 1px)
  const shadowText = await sharp({
    text: {
      text: pangoMarkup,
      font: 'sans-serif',
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer();

  // Tint shadow to the shadow color with reduced opacity
  const shadowTinted = await sharp(shadowText)
    .ensureAlpha()
    .tint({ r: 0, g: 0, b: 0 })
    .png()
    .toBuffer();

  // Render the main text layer
  const mainText = await sharp({
    text: {
      text: pangoMarkup,
      font: 'sans-serif',
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer();

  const mainTinted = await sharp(mainText)
    .ensureAlpha()
    .tint({ r: 255, g: 255, b: 255 })
    .png()
    .toBuffer();

  const textMeta = await sharp(mainTinted).metadata();
  const textW = textMeta.width || 200;
  const textH = textMeta.height || 30;

  // Build a small canvas with shadow + text composited
  const padding = 20;
  const canvasW = textW + padding * 2 + 2; // +2 for shadow offset
  const canvasH = textH + padding * 2 + 2;

  const textOverlay = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadowTinted, left: padding + 1, top: padding + 1 },
      { input: mainTinted, left: padding, top: padding },
    ])
    .png()
    .toBuffer();

  // Place at bottom-left of the original image
  const left = 0;
  const top = Math.max(0, h - canvasH);

  return sharp(imageBuffer)
    .composite([{ input: textOverlay, left, top }])
    .toBuffer();
}

/**
 * Download image from a blob URL and return as Buffer.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1500;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (response.status === 404 && attempt < MAX_RETRIES) {
      console.warn(`downloadImage 404 on attempt ${attempt}/${MAX_RETRIES}, retrying in ${RETRY_DELAY_MS}ms: ${url}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Failed to download image (${response.status}): ${url}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('text/html')) {
      throw new Error(`Expected image but got HTML from: ${url}`);
    }
    const arrayBuf = await response.arrayBuffer();
    if (arrayBuf.byteLength === 0) {
      throw new Error(`Empty response body from: ${url}`);
    }
    return Buffer.from(arrayBuf);
  }

  // Should never reach here, but satisfy TypeScript
  throw new Error(`Failed to download image after ${MAX_RETRIES} retries: ${url}`);
}

/**
 * Lock a PDF with restrictive permissions.
 * Empty user password = opens without prompting.
 * Owner password = restricts editing/copying in compliant viewers.
 *
 * Permissions: print only. Blocks modify, copy, text selection, annotations.
 * NOTE: Chrome/Preview ignore owner-only restrictions by design.
 * Adobe Acrobat and other compliant readers WILL enforce them.
 */
export async function lockPDF(
  pdfBuffer: Buffer,
  ownerPassword: string
): Promise<Buffer> {
  const pdfBytes = new Uint8Array(pdfBuffer);
  const encrypted = await encryptPDFRestricted(pdfBytes, '', ownerPassword);
  return Buffer.from(encrypted);
}
