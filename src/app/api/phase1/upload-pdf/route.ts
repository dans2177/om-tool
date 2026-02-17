import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

/**
 * POST /api/phase1/upload-pdf
 * Server-side handler for Vercel Blob client uploads.
 * This generates a client token so the browser can upload PDFs directly
 * to Vercel Blob storage, bypassing the 4.5MB serverless body limit.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB max
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // no-op — required by the SDK but we don't need it
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error('Upload token error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 400 },
    );
  }
}
