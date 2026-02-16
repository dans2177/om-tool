import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { PDFParse } from 'pdf-parse';
import { parseOM } from '@/lib/aiParser';
import { extractImagesFromPDF } from '@/lib/imageHandler';

export const maxDuration = 120; // Allow up to 2 minutes for large PDFs
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const notes = (formData.get('notes') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuf);

    // 1. Upload original PDF to Vercel Blob
    const pdfBlob = await put(`uploads/${file.name}`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    // 2. Extract ALL text from PDF (no page limits)
    const parser = new PDFParse({ data: pdfBuffer });
    const textResult = await parser.getText();
    const rawText = textResult.text;
    await parser.destroy();

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. The document may be image-only.' },
        { status: 400 }
      );
    }

    // 3. Send to OpenAI for structured extraction
    const omData = await parseOM(rawText, notes || undefined);

    // 4. Extract all embedded images
    const images = await extractImagesFromPDF(pdfBuffer, omData.slug || 'unknown');

    return NextResponse.json({
      omData,
      images: images.map((img) => ({
        ...img,
        selected: true,
        watermark: false,
      })),
      pdfBlobUrl: pdfBlob.url,
      rawText: rawText.slice(0, 2000), // Send first 2k chars for reference
    });
  } catch (error: any) {
    console.error('Extract API error:', error);
    return NextResponse.json(
      { error: error.message || 'Extraction failed' },
      { status: 500 }
    );
  }
}
