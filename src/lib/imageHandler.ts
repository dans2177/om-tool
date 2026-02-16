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
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as any;

  const images: ExtractedImageInfo[] = [];

  // Load with pdf-lib to find image XObjects
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();

  // Load with pdfjs-dist for rendering
  const uint8 = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8, useSystemFonts: true });
  const pdfJsDoc = await loadingTask.promise;

  let imgIndex = 0;

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

          // Skip tiny images (icons, dots, etc.)
          if (w < 50 || h < 50) continue;

          let pngBuffer: Buffer;

          if (imgData.data.length === w * h * 4) {
            // RGBA data
            pngBuffer = await sharp(Buffer.from(imgData.data), {
              raw: { width: w, height: h, channels: 4 },
            })
              .png()
              .toBuffer();
          } else if (imgData.data.length === w * h * 3) {
            // RGB data
            pngBuffer = await sharp(Buffer.from(imgData.data), {
              raw: { width: w, height: h, channels: 3 },
            })
              .png()
              .toBuffer();
          } else {
            continue;
          }

          const filename = `${slug}/images/extracted-${imgIndex}.png`;
          const blob = await put(filename, pngBuffer, {
            access: 'public',
            contentType: 'image/png',
            addRandomSuffix: false,
            allowOverwrite: true,
          });

          // Generate thumbnail (200px wide) for fast previews
          const thumbBuffer = await sharp(pngBuffer)
            .resize({ width: 200 })
            .jpeg({ quality: 60 })
            .toBuffer();
          const thumbFilename = `${slug}/images/thumb-${imgIndex}.jpg`;
          const thumbBlob = await put(thumbFilename, thumbBuffer, {
            access: 'public',
            contentType: 'image/jpeg',
            addRandomSuffix: false,
            allowOverwrite: true,
          });

          images.push({
            id: `img-${imgIndex}`,
            blobUrl: blob.url,
            thumbnailUrl: thumbBlob.url,
            width: w,
            height: h,
          });
          imgIndex++;
          if (onProgress) await onProgress(imgIndex);
        } catch {
          // Skip images that can't be decoded
          continue;
        }
      }
    }

    page.cleanup();
  }

  return images;
}

/**
 * Compress an image to JPEG at given quality.
 */
export async function compressImage(
  imageBuffer: Buffer,
  quality: number = 80
): Promise<Buffer> {
  return sharp(imageBuffer).jpeg({ quality }).toBuffer();
}

/**
 * Apply a watermark (logo overlay) to an image.
 * Logo is read from public/logo.png.
 */
export async function watermarkImage(
  imageBuffer: Buffer,
  color: 'white' | 'black' = 'white'
): Promise<Buffer> {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');

  // Check if logo exists
  if (!fs.existsSync(logoPath)) {
    // If no logo, return original with a text-based watermark
    const metadata = await sharp(imageBuffer).metadata();
    const w = metadata.width || 800;
    const h = metadata.height || 600;
    const fontSize = Math.max(16, Math.floor(w / 30));

    const fillColor = color === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    const svgText = `<svg width="${w}" height="${h}">
      <text x="${w / 2}" y="${h - 30}" font-size="${fontSize}" fill="${fillColor}"
        text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">
        CONFIDENTIAL
      </text>
    </svg>`;

    return sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgText), gravity: 'southeast' }])
      .toBuffer();
  }

  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || 800;

  // Resize logo to ~25% of image width
  const logoWidth = Math.floor(imgWidth * 0.25);
  let logoBuffer = await sharp(logoPath)
    .resize({ width: logoWidth })
    .ensureAlpha(0.5)
    .toBuffer();

  // If black watermark requested, invert the logo colors
  if (color === 'black') {
    logoBuffer = await sharp(logoBuffer).negate({ alpha: false }).toBuffer();
  }

  return sharp(imageBuffer)
    .composite([{ input: logoBuffer, gravity: 'southeast' }])
    .toBuffer();
}

/**
 * Download image from a blob URL and return as Buffer.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
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
