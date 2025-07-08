import { NextResponse } from 'next/server';
import { spotifyAPI } from '@/libs/spotify-api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Testing Spotify API connection...');
    
    // Test 1: Try to get access token
    console.log('Spotify Client ID:', process.env.SPOTIFY_CLIENT_ID ? 'Present' : 'Missing');
    console.log('Spotify Client Secret:', process.env.SPOTIFY_CLIENT_SECRET ? 'Present' : 'Missing');
    
    // Test 2: Search for a very popular artist
    console.log('Attempting to search for Taylor Swift...');
    const taylorResults = await spotifyAPI.searchArtists('Taylor Swift', 1);
    console.log('Taylor Swift search results:', taylorResults);
    
    // Test 3: Search for another popular artist
    console.log('Attempting to search for Drake...');
    const drakeResults = await spotifyAPI.searchArtists('Drake', 1);
    console.log('Drake search results:', drakeResults);
    
    // Test 4: Get popular artists by genre
    console.log('Attempting to get popular pop artists...');
    const popArtists = await spotifyAPI.getPopularArtists('pop');
    console.log('Pop artists results count:', popArtists.length);
    
    return NextResponse.json({
      success: true,
      tests: {
        credentials: {
          clientId: !!process.env.SPOTIFY_CLIENT_ID,
          clientSecret: !!process.env.SPOTIFY_CLIENT_SECRET
        },
        taylorSwift: {
          count: taylorResults.length,
          first: taylorResults[0] || null
        },
        drake: {
          count: drakeResults.length,
          first: drakeResults[0] || null
        },
        popularPop: {
          count: popArtists.length,
          first: popArtists[0] || null
        }
      }
    });

  } catch (error) {
    console.error('Spotify API test failed:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 