/**
 * PDF encryption with RESTRICTIVE permissions.
 *
 * Uses the proven crypto primitives from @pdfsmaller/pdf-encrypt-lite
 * but sets permissions to block editing, copying, and text selection.
 *
 * Empty user password = opens without a prompt.
 * Owner password = required to remove restrictions.
 *
 * NOTE: Chrome, macOS Preview, and Firefox ignore owner-only restrictions.
 * Adobe Acrobat and compliant readers WILL enforce them.
 */

import {
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFNumber,
  PDFDict,
  PDFRawStream,
} from 'pdf-lib';

import { hexToBytes, bytesToHex } from '@pdfsmaller/pdf-encrypt-lite/dist/crypto-minimal';

import {
  computeOwnerKey,
  computeEncryptionKey,
  computeUserKey,
  encryptObject,
  encryptStringsInObject,
} from '@pdfsmaller/pdf-encrypt-lite/dist/pdf-encrypt';

/**
 * PDF permission flags (bit positions 1-indexed per PDF spec):
 *   Bit 3  (4):    Print
 *   Bit 4  (8):    Modify contents
 *   Bit 5  (16):   Copy / extract text
 *   Bit 6  (32):   Add or modify annotations
 *   Bit 7-8:       Reserved (must be 1)
 *   Bit 9  (256):  Fill form fields
 *   Bit 10 (512):  Extract for accessibility
 *   Bit 11 (1024): Assemble document
 *   Bit 12 (2048): Print high quality
 *   Bit 13-32:     Reserved (must be 1)
 *
 * We allow ONLY printing. Everything else blocked.
 * Value: 0xFFFFF8C4 (signed: -1852)
 */
const RESTRICTIVE_PERMISSIONS = -1852; // 0xFFFFF8C4 as signed 32-bit

/**
 * Encrypt a PDF with restrictive permissions.
 * Mirrors the library's encryptPDF exactly, but with custom permissions.
 */
export async function encryptPDFRestricted(
  pdfBytes: Uint8Array,
  userPassword: string,
  ownerPassword: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const context = pdfDoc.context;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trailer = (context as any).trailerInfo;

  // ── Get or generate file ID ──────────────────────────────────
  let fileId: Uint8Array;
  const idArray = trailer.ID;

  if (idArray && Array.isArray(idArray) && idArray.length > 0) {
    const idString = idArray[0].toString();
    const hexStr = idString.replace(/^<|>$/g, '');
    fileId = hexToBytes(hexStr);
  } else {
    const randomBytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < 16; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    fileId = randomBytes;
    const idHex1 = PDFHexString.of(bytesToHex(fileId));
    const idHex2 = PDFHexString.of(bytesToHex(fileId));
    trailer.ID = [idHex1, idHex2];
  }

  // ── Compute keys ─────────────────────────────────────────────
  const permissions = RESTRICTIVE_PERMISSIONS;
  const ownerKey = computeOwnerKey(ownerPassword, userPassword);
  const encryptionKey = computeEncryptionKey(
    userPassword,
    ownerKey,
    permissions,
    fileId,
  );
  const userKey = computeUserKey(encryptionKey, fileId);

  // ── Encrypt all indirect objects ─────────────────────────────
  const indirectObjects = context.enumerateIndirectObjects();

  for (const [ref, obj] of indirectObjects) {
    const objectNum = ref.objectNumber;
    const generationNum = ref.generationNumber || 0;

    // Skip encryption dictionary itself
    if (obj instanceof PDFDict) {
      const filter = obj.get(PDFName.of('Filter'));
      if (filter && (filter as any).asString() === '/Standard') {
        continue;
      }
    }

    // Encrypt streams
    if (obj instanceof PDFRawStream) {
      const streamData = (obj as any).contents;
      const encrypted = encryptObject(
        streamData,
        objectNum,
        generationNum,
        encryptionKey,
      );
      (obj as any).contents = encrypted;
    }

    // Encrypt strings
    encryptStringsInObject(obj, objectNum, generationNum, encryptionKey);
  }

  // ── Create /Encrypt dictionary ───────────────────────────────
  const encryptDict = context.obj({
    Filter: PDFName.of('Standard'),
    V: PDFNumber.of(2), // Version 2 (RC4)
    R: PDFNumber.of(3), // Revision 3 (128-bit)
    Length: PDFNumber.of(128),
    P: PDFNumber.of(permissions),
    O: PDFHexString.of(bytesToHex(ownerKey)),
    U: PDFHexString.of(bytesToHex(userKey)),
  });

  const encryptRef = context.register(encryptDict);
  trailer.Encrypt = encryptRef;

  // ── Save ─────────────────────────────────────────────────────
  return await pdfDoc.save({ useObjectStreams: false });
}
