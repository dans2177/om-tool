/**
 * Test that our restricted encryption produces a valid encrypted PDF
 * with the correct permissions value (-1852 = print only).
 */
const { PDFDocument } = require('pdf-lib');
const {
  computeOwnerKey,
  computeEncryptionKey,
  computeUserKey,
  encryptObject,
  encryptStringsInObject,
} = require('@pdfsmaller/pdf-encrypt-lite/dist/pdf-encrypt');
const { hexToBytes, bytesToHex } = require('@pdfsmaller/pdf-encrypt-lite/dist/crypto-minimal');

// Import pdf-lib types needed
const { PDFName, PDFHexString, PDFNumber, PDFDict, PDFRawStream } = require('pdf-lib');

async function main() {
  // Create a minimal PDF
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  page.drawText('Test PDF - should be print-only');
  const pdfBytes = await doc.save();
  console.log('Original PDF size:', pdfBytes.length);

  // ── Encrypt with restrictive permissions ──
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const context = pdfDoc.context;
  const trailer = context.trailerInfo;

  // Get file ID
  let fileId;
  const idArray = trailer.ID;
  if (idArray && Array.isArray(idArray) && idArray.length > 0) {
    const idString = idArray[0].toString();
    const hexStr = idString.replace(/^<|>$/g, '');
    fileId = hexToBytes(hexStr);
  } else {
    fileId = new Uint8Array(16);
    for (let i = 0; i < 16; i++) fileId[i] = Math.floor(Math.random() * 256);
    trailer.ID = [PDFHexString.of(bytesToHex(fileId)), PDFHexString.of(bytesToHex(fileId))];
  }

  // RESTRICTIVE permissions
  const permissions = 0xFFFFF8C4;
  const userPassword = '';
  const ownerPassword = 'MATTHEWS-TEST';

  const ownerKey = computeOwnerKey(ownerPassword, userPassword);
  const encryptionKey = computeEncryptionKey(userPassword, ownerKey, permissions, fileId);
  const userKey = computeUserKey(encryptionKey, fileId);

  // Encrypt objects
  const indirectObjects = context.enumerateIndirectObjects();
  for (const [ref, obj] of indirectObjects) {
    const objectNum = ref.objectNumber;
    const generationNum = ref.generationNumber || 0;
    if (obj instanceof PDFDict) {
      const filter = obj.get(PDFName.of('Filter'));
      if (filter && filter.asString && filter.asString() === '/Standard') continue;
    }
    if (obj instanceof PDFRawStream) {
      obj.contents = encryptObject(obj.contents, objectNum, generationNum, encryptionKey);
    }
    encryptStringsInObject(obj, objectNum, generationNum, encryptionKey);
  }

  // Create encrypt dict
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
  trailer.Encrypt = encryptRef;

  const encryptedBytes = await pdfDoc.save({ useObjectStreams: false });
  console.log('Encrypted PDF size:', encryptedBytes.length);

  // Verify
  const content = Buffer.from(encryptedBytes).toString('binary');
  console.log('Has /Encrypt:', content.includes('/Encrypt'));
  console.log('Has /Standard:', content.includes('/Standard'));

  // Check P value in output
  const pMatch = content.match(/\/P\s+(-?\d+)/);
  if (pMatch) {
    const pValue = parseInt(pMatch[1]);
    console.log('P value found:', pValue);
    console.log('P matches expected (-1852):', pValue === (permissions | 0));
  }

  // Verify permission bits
  const P = permissions;
  console.log('\n── Permission Flags ──');
  console.log('Print:', (P >> 2) & 1 ? 'YES' : 'NO');
  console.log('Modify:', (P >> 3) & 1 ? 'YES' : 'NO');
  console.log('Copy/Extract:', (P >> 4) & 1 ? 'YES' : 'NO');
  console.log('Annotations:', (P >> 5) & 1 ? 'YES' : 'NO');
  console.log('Fill forms:', (P >> 8) & 1 ? 'YES' : 'NO');
  console.log('Accessibility:', (P >> 9) & 1 ? 'YES' : 'NO');
  console.log('Assemble:', (P >> 10) & 1 ? 'YES' : 'NO');
  console.log('HQ Print:', (P >> 11) & 1 ? 'YES' : 'NO');

  // Write to file for manual testing
  const fs = require('fs');
  fs.writeFileSync('scripts/test-restricted.pdf', encryptedBytes);
  console.log('\nWrote scripts/test-restricted.pdf — open in Adobe Acrobat to verify restrictions');
}

main().catch(console.error);
