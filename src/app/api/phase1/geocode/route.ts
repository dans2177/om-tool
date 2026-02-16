import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'No address provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENCAGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENCAGE_API_KEY not configured' },
        { status: 500 }
      );
    }

    const encoded = encodeURIComponent(address);
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encoded}&key=${apiKey}&limit=1&no_annotations=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      return NextResponse.json({ lat, lng });
    }

    return NextResponse.json({ lat: null, lng: null });
  } catch (error: any) {
    console.error('Geocode API error:', error);
    return NextResponse.json(
      { error: error.message || 'Geocoding failed' },
      { status: 500 }
    );
  }
}
