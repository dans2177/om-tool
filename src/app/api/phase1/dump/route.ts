import { NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/phase1/dump
 * Wipes ALL blobs from Vercel Blob storage.
 */
export async function DELETE() {
  try {
    let deletedCount = 0;
    let cursor: string | undefined;

    // Paginate through all blobs and delete them
    do {
      const result = await list({ cursor, limit: 100 });
      
      if (result.blobs.length === 0) break;

      await Promise.all(
        result.blobs.map((blob) => del(blob.url))
      );

      deletedCount += result.blobs.length;
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      message: `Deleted ${deletedCount} file${deletedCount !== 1 ? 's' : ''} from storage.`,
    });
  } catch (error: any) {
    console.error('Dump API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to dump database' },
      { status: 500 }
    );
  }
}
