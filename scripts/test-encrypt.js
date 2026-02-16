const fs = require('fs');
const { encryptPDF } = require('@pdfsmaller/pdf-encrypt-lite');
const { PDFDocument } = require('pdf-lib');

(async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  page.drawText('Test encryption', { x: 50, y: 500 });
  const pdfBytes = await doc.save();
  console.log('Original PDF size:', pdfBytes.length);

  const encrypted = await encryptPDF(pdfBytes, 'testpass', 'testpass');
  console.log('Encrypted PDF size:', encrypted.length);

  const pdfStr = Buffer.from(encrypted).toString('latin1');
  console.log('Has /Encrypt:', pdfStr.includes('/Encrypt'));
  console.log('Has /Standard:', pdfStr.includes('/Standard'));

  fs.writeFileSync('/tmp/test-encrypted.pdf', Buffer.from(encrypted));
  console.log('Written to /tmp/test-encrypted.pdf - try opening it');
})().catch(e => console.error('ERROR:', e));
