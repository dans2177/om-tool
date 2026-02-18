import { NextRequest } from 'next/server';
import { ensurePolyfills } from '@/lib/ensurePolyfills';
import { parseOM } from '@/lib/aiParser';
import { lookupBOR } from '@/lib/borLookup';

export const maxDuration = 300;
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
      // Polyfill DOM globals BEFORE loading pdf-parse / pdfjs-dist
      ensurePolyfills();
      const { PDFParse } = await import('pdf-parse');
      const { extractImagesFromPDF } = await import('@/lib/imageHandler');

      // Accept JSON body with blob URL (PDF already uploaded client-side)
      const { blobUrl, fileName, notes = '', skipImages = false } = await req.json();

      if (!blobUrl) {
        await send('error', { error: 'No blobUrl provided' });
        await writer.close();
        return;
      }

      await send('progress', { step: 'upload', message: `📄 Processing "${fileName || 'document.pdf'}"` });

      // Download the PDF from Vercel Blob
      await send('progress', { step: 'download', message: '☁️ Fetching PDF from cloud storage...' });
      const pdfRes = await fetch(blobUrl);
      if (!pdfRes.ok) {
        await send('error', { error: 'Failed to fetch PDF from blob storage' });
        await writer.close();
        return;
      }
      const arrayBuf = await pdfRes.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuf);
      await send('progress', { step: 'download-done', message: `✅ PDF loaded (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB)` });

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
      await send('progress', { step: 'ai', message: '🤖 Sending to AI for analysis (gpt-4.1)...' });
      const omData = await parseOM(rawText, notes || undefined);
      await send('progress', { step: 'ai-done', message: `✅ AI complete — identified "${omData.address?.full_address || omData.title || 'unknown address'}"` });

      if (omData.financials.price) {
        await send('progress', { step: 'ai-detail', message: `💰 Price: ${omData.financials.price_display} | Cap Rate: ${omData.financials.cap_rate_percent ?? 'N/A'}%` });
      }
      if (omData.tenants && omData.tenants.length > 0) {
        await send('progress', { step: 'ai-tenants', message: `🏪 Tenants: ${omData.tenants.join(', ')}` });
      }
      await send('progress', { step: 'ai-type', message: `🏷️ Type: ${omData.record_type.toUpperCase()} | ${omData.saleOrLease}` });

      // 3b. Broker of Record lookup
      const brokerOfRecord = lookupBOR(omData.address?.state_abbr);
      if (brokerOfRecord) {
        await send('progress', { step: 'bor', message: `🏢 Broker of Record: ${brokerOfRecord.name} (${omData.address?.state_abbr})` });
        // Remove any listing agents whose name matches the BOR
        const borNameLower = brokerOfRecord.name.toLowerCase().trim();
        omData.listing_agents = omData.listing_agents.filter(
          (a: any) => a.name?.toLowerCase().trim() !== borNameLower
        );
      }

      if (omData.listing_agents.length > 0) {
        const agentNames = omData.listing_agents.map(a => a.name).filter(Boolean).join(', ');
        await send('progress', { step: 'agents', message: `👤 Agents: ${agentNames}` });
      }

      // 4. Image extraction (optional)
      let images: any[] = [];
      if (!skipImages) {
        await send('progress', { step: 'images', message: '🖼️ Scanning PDF for embedded images...' });
        const extractedImages = await extractImagesFromPDF(
          pdfBuffer,
          omData.seo?.slug || 'unknown',
          async (count: number) => {
            await send('progress', { step: 'images-progress', message: `🖼️ Found ${count} image${count !== 1 ? 's' : ''} so far...` });
          }
        );
        images = extractedImages;
        await send('progress', { step: 'images-done', message: `✅ ${images.length} image${images.length !== 1 ? 's' : ''} extracted & uploaded to cloud` });
      } else {
        await send('progress', { step: 'images-skip', message: '⏭️ Image extraction skipped' });
      }

      // 5. Done
      await send('progress', { step: 'complete', message: '🎉 Extraction complete! Loading results...' });

      await send('result', {
        omData,
        brokerOfRecord,
        images: images.map((img) => ({
          ...img,
          selected: false,
          watermark: false,
          repPhoto: false,
        })),
        pdfBlobUrl: blobUrl,
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
