import createQpdf from '@neslinesli93/qpdf-wasm';
import { PDFDocument } from 'pdf-lib';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(__dirname, '../node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm');

// Create a valid PDF with pdf-lib
const doc = await PDFDocument.create();
doc.addPage([612, 792]);
doc.setTitle('Test Document');
doc.setAuthor('Test Author');
const pdfBytes = await doc.save();
console.log('Created test PDF:', pdfBytes.length, 'bytes');

const qpdf = await createQpdf({
  locateFile: () => wasmPath,
  noInitialRun: true,
  print: (t) => console.log('[qpdf]', t),
  printErr: (t) => console.error('[qpdf-err]', t),
});

qpdf.FS.writeFile('/test.pdf', new Uint8Array(pdfBytes));

const code = qpdf.callMain([
  '--encrypt', '', 'TEST123', '128',
  '--use-aes=y',
  '--print=full', '--modify=none', '--extract=n', '--annotate=n',
  '--', '/test.pdf', '/out.pdf',
]);

console.log('Exit code:', code);
if (code === 0) {
  const result = qpdf.FS.readFile('/out.pdf');
  console.log('Encrypted size:', result.length, 'bytes');
  console.log('Starts with:', Buffer.from(result.slice(0, 20)).toString());
} else {
  console.error('Encryption failed');
}
