import { NextRequest, NextResponse } from 'next/server';
import { searchArtists } from '@/libs/ticketmaster';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const artists = await searchArtists(query);
    return NextResponse.json(artists);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search for artists' },
      { status: 500 }
    );
  }
} 