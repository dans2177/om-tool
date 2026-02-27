import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';

const execFileAsync = promisify(execFile);

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * POST /api/phase1/lock-pdf
 *
 * Locks & compresses a PDF using pikepdf (Python).
 * Accepts JSON: { pdfUrl, slug, ownerPassword, userPassword }
 * Returns JSON: { lockedPdfUrl, originalSize, lockedSize }
 */
export async function POST(req: NextRequest) {
  const tmpDir = join(process.cwd(), 'tmp');
  const id = randomUUID();
  const inputPath = join(tmpDir, `${id}-input.pdf`);
  const outputPath = join(tmpDir, `${id}-output.pdf`);

  try {
    const { pdfUrl, slug, ownerPassword = '', userPassword = '' } = await req.json();

    if (!pdfUrl || !slug) {
      return NextResponse.json({ error: 'Missing pdfUrl or slug' }, { status: 400 });
    }

    // Download the source PDF
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const originalSize = pdfBuffer.length;

    // Write to tmp
    await mkdir(tmpDir, { recursive: true });
    await writeFile(inputPath, pdfBuffer);

    // Run Python script
    const scriptPath = join(process.cwd(), 'scripts', 'lock-pdf.py');
    await execFileAsync('python3', [
      scriptPath,
      inputPath,
      outputPath,
      ownerPassword,
      userPassword,
    ], { timeout: 60_000 });

    // Read result
    const lockedBuffer = await readFile(outputPath);
    const lockedSize = lockedBuffer.length;

    // Upload to Vercel Blob
    const blob = await put(`${slug}/locked-om.pdf`, lockedBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return NextResponse.json({
      lockedPdfUrl: blob.url,
      originalSize,
      lockedSize,
    });
  } catch (error: any) {
    console.error('lock-pdf error:', error);
    return NextResponse.json({ error: error.message || 'PDF lock failed' }, { status: 500 });
  } finally {
    // Cleanup temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
