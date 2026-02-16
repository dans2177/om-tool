import { put } from '@vercel/blob';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';
import fs from 'fs';
// @ts-expect-error — no types for this lightweight lib
import { md5, RC4, hexToBytes, bytesToHex } from '@pdfsmaller/pdf-encrypt-lite/dist/crypto-minimal';
// @ts-expect-error
import { computeOwnerKey, computeUserKey, computeEncryptionKey, encryptObject, encryptStringsInObject } from '@pdfsmaller/pdf-encrypt-lite/dist/pdf-encrypt';
import { PDFName, PDFHexString, PDFNumber, PDFDict, PDFRawStream } from 'pdf-lib';

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
 * Lock a PDF with real RC4-128 encryption using @pdfsmaller/pdf-encrypt-lite primitives.
 * Permissions: print (high-res) + accessibility only.
 * No copy, no edit, no highlight, no annotations.
 * User password is empty (anyone can open/view/print).
 * Owner password required to change permissions.
 */
export async function lockPDF(
  pdfBuffer: Buffer,
  ownerPassword: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const context = pdfDoc.context;
  const trailer = context.trailerInfo;
  const idArray = (trailer as any).ID;

  let fileId: Uint8Array;
  if (idArray && Array.isArray(idArray) && idArray.length > 0) {
    const idString = idArray[0].toString();
    const hexStr = idString.replace(/^<|>$/g, '');
    fileId = hexToBytes(hexStr);
  } else {
    fileId = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(fileId);
    } else {
      for (let i = 0; i < 16; i++) fileId[i] = Math.floor(Math.random() * 256);
    }
    const idHex1 = PDFHexString.of(bytesToHex(fileId));
    const idHex2 = PDFHexString.of(bytesToHex(fileId));
    (trailer as any).ID = [idHex1, idHex2];
  }

  // PDF permission flags (revision 3, 128-bit RC4):
  //   Bits 1-2: reserved (0)
  //   Bit  3 (4):    Print                 — YES
  //   Bit  4 (8):    Modify                — NO
  //   Bit  5 (16):   Copy/extract          — NO
  //   Bit  6 (32):   Annotations/forms     — NO
  //   Bits 7-8:      must be 1             — 0xC0
  //   Bit  9 (256):  Fill forms            — NO
  //   Bit 10 (512):  Accessibility extract — YES
  //   Bit 11 (1024): Assemble              — NO
  //   Bit 12 (2048): Print high quality    — YES
  //   Bits 13-32:    must be 1             — 0xFFFFF000
  const permissions = (0xFFFFF0C0 | 4 | 512 | 2048) | 0;  // = 0xFFFFFAC4 signed = -1340

  const ownerKey = computeOwnerKey(ownerPassword, '');
  const encryptionKey = computeEncryptionKey('', ownerKey, permissions, fileId);
  const userKey = computeUserKey(encryptionKey, fileId);

  // Encrypt all indirect objects
  const indirectObjects = context.enumerateIndirectObjects();
  for (const [ref, obj] of indirectObjects) {
    const objectNum = ref.objectNumber;
    const generationNum = ref.generationNumber || 0;

    if (obj instanceof PDFDict) {
      const filter = obj.get(PDFName.of('Filter'));
      if (filter instanceof PDFName && filter.decodeText() === 'Standard') continue;
    }

    if (obj instanceof PDFRawStream) {
      const streamData = (obj as any).contents;
      const encrypted = encryptObject(streamData, objectNum, generationNum, encryptionKey);
      (obj as any).contents = encrypted;
    }

    encryptStringsInObject(obj, objectNum, generationNum, encryptionKey);
  }

  // Create /Encrypt dictionary
  const encryptDict = context.obj({
    Filter: PDFName.of('Standard'),
    V: PDFNumber.of(2),
    R: PDFNumber.of(3),
    Length: PDFNumber.of(128),
    P: PDFNumber.of(permissions),
    O: PDFHexString.of(bytesToHex(ownerKey)),
    U: PDFHexString.of(bytesToHex(userKey)),
  });

  const encryptRef = context.register(encryptDict);
  (trailer as any).Encrypt = encryptRef;

  const encryptedBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(encryptedBytes);
}
