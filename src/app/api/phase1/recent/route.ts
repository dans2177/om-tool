import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // List all blobs, grouped by upload folder pattern
    const { blobs } = await list({ prefix: 'uploads/', limit: 100 });

    // Each uploaded PDF is at uploads/<filename>.pdf
    // Group by slug (derive from filename)
    const recentOMs = blobs
      .filter((b) => b.pathname.endsWith('.pdf'))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map((b) => ({
        name: b.pathname.replace('uploads/', ''),
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
      }));

    return NextResponse.json({ oms: recentOMs });
  } catch (error: any) {
    console.error('Recent OMs error:', error);
    return NextResponse.json({ oms: [], error: error.message }, { status: 200 });
  }
}
