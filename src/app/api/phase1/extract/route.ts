import { NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { PDFParse } from 'pdf-parse';
import { parseOM } from '@/lib/aiParser';
import { extractImagesFromPDF } from '@/lib/imageHandler';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function sseMessage(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (event: string, data: any) => {
    await writer.write(encoder.encode(sseMessage(event, data)));
  };

  // Run extraction pipeline in background, streaming progress
  (async () => {
    try {
      const formData = await req.formData();
      const file = formData.get('pdf') as File | null;
      const notes = (formData.get('notes') as string) || '';

      if (!file) {
        await send('error', { error: 'No PDF file provided' });
        await writer.close();
        return;
      }

      await send('progress', { step: 'upload', message: `📄 Received "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)` });

      const arrayBuf = await file.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuf);

      // 1. Upload to Blob
      await send('progress', { step: 'blob', message: '☁️ Uploading PDF to cloud storage...' });
      const pdfBlob = await put(`uploads/${file.name}`, pdfBuffer, {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      await send('progress', { step: 'blob-done', message: '✅ PDF stored in cloud' });

      // 2. Extract text
      await send('progress', { step: 'text', message: '📝 Extracting text from all pages...' });
      const parser = new PDFParse({ data: pdfBuffer });
      const textResult = await parser.getText();
      const rawText = textResult.text;
      const pageCount = textResult.pages.length;
      await parser.destroy();

      if (!rawText || rawText.trim().length === 0) {
        await send('error', { error: 'Could not extract text from PDF. The document may be image-only.' });
        await writer.close();
        return;
      }

      const charCount = rawText.length.toLocaleString();
      await send('progress', { step: 'text-done', message: `✅ Text extracted — ${charCount} characters across ${pageCount} pages` });

      // 3. AI analysis
      await send('progress', { step: 'ai', message: '🤖 Sending to AI for analysis (gpt-4o-mini)...' });
      const omData = await parseOM(rawText, notes || undefined);
      await send('progress', { step: 'ai-done', message: `✅ AI complete — identified "${omData.address || 'unknown address'}"` });

      if (omData.price) {
        await send('progress', { step: 'ai-detail', message: `💰 Price: $${omData.price.toLocaleString()} | Cap Rate: ${omData.capRate ?? 'N/A'}%` });
      }
      if (omData.tenants && omData.tenants.length > 0) {
        await send('progress', { step: 'ai-tenants', message: `🏪 Tenants: ${omData.tenants.join(', ')}` });
      }
      await send('progress', { step: 'ai-type', message: `🏷️ Type: ${omData.propertyType.toUpperCase()} | ${omData.saleOrLease}` });

      // 4. Image extraction
      await send('progress', { step: 'images', message: '🖼️ Scanning PDF for embedded images...' });
      const images = await extractImagesFromPDF(
        pdfBuffer,
        omData.slug || 'unknown',
        async (count: number) => {
          await send('progress', { step: 'images-progress', message: `🖼️ Found ${count} image${count !== 1 ? 's' : ''} so far...` });
        }
      );
      await send('progress', { step: 'images-done', message: `✅ ${images.length} image${images.length !== 1 ? 's' : ''} extracted & uploaded to cloud` });

      // 5. Done
      await send('progress', { step: 'complete', message: '🎉 Extraction complete! Loading results...' });

      await send('result', {
        omData,
        images: images.map((img) => ({
          ...img,
          selected: false,
          watermark: false,
        })),
        pdfBlobUrl: pdfBlob.url,
        rawText: rawText.slice(0, 2000),
      });

      await writer.close();
    } catch (error: any) {
      console.error('Extract API error:', error);
      await send('error', { error: error.message || 'Extraction failed' });
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
