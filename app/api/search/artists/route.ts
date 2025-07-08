import { NextRequest, NextResponse } from 'next/server';

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  if (!TICKETMASTER_API_KEY) {
    return NextResponse.json({ error: 'Ticketmaster API key not configured' }, { status: 500 });
  }

  try {
    // Search Ticketmaster for artists
    const ticketmasterUrl = `${TICKETMASTER_BASE_URL}/attractions.json?keyword=${encodeURIComponent(query)}&classificationName=music&apikey=${TICKETMASTER_API_KEY}&size=20`;
    
    const response = await fetch(ticketmasterUrl);
    
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }

    const data = await response.json();
    
    const artists = data._embedded?.attractions?.map((attraction: any) => ({
      id: attraction.id,
      name: attraction.name,
      image_url: attraction.images?.[0]?.url || '/images/music-placeholder.png',
      genres: attraction.classifications?.map((c: any) => c.genre?.name).filter(Boolean) || [],
      ticketmaster_id: attraction.id,
      source: 'ticketmaster'
    })) || [];

    return NextResponse.json({ artists });
  } catch (error) {
    console.error('Artist search error:', error);
    return NextResponse.json(
      { error: 'Failed to search for artists' },
      { status: 500 }
    );
  }
} 