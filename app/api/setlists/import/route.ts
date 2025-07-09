import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { setlistfmAPI } from '@/libs/setlistfm-api';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';



export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const date = searchParams.get('date');
  const showId = searchParams.get('show_id');

  if (!artist || !date || !showId) {
    return NextResponse.json({ 
      error: 'artist, date, and show_id are required' 
    }, { status: 400 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Check if actual setlist already exists
    const { data: existingSetlist } = await supabase
      .from('setlists')
      .select('id')
      .eq('show_id', showId)
      .eq('type', 'actual')
      .single();

    if (existingSetlist) {
      return NextResponse.json({ 
        message: 'Actual setlist already exists',
        setlist_id: existingSetlist.id 
      });
    }

    // Search for setlists on Setlist.fm
    const setlists = await setlistfmAPI.searchSetlists({
      artistName: artist,
      year: new Date(date).getFullYear()
    });

    if (!setlists.setlist || setlists.setlist.length === 0) {
      return NextResponse.json({ 
        message: 'No setlists found on Setlist.fm',
        setlist: null 
      });
    }

    // Find the closest matching setlist by date
    const targetDate = new Date(date);
    let bestMatch = null;
    let smallestDateDiff = Infinity;

    for (const setlist of setlists.setlist) {
      const setlistDate = new Date(setlist.eventDate);
      const dateDiff = Math.abs(targetDate.getTime() - setlistDate.getTime());
      
      if (dateDiff < smallestDateDiff) {
        smallestDateDiff = dateDiff;
        bestMatch = setlist;
      }
    }

    if (!bestMatch || !bestMatch.sets?.set?.length) {
      return NextResponse.json({ 
        message: 'No matching setlist with songs found',
        setlist: null 
      });
    }

    // Transform and import the setlist
    const transformedData = setlistfmAPI.transformSetlistForDB(bestMatch);
    
    // Create actual setlist in our database
    const { data: newSetlist, error: setlistError } = await supabase
      .from('setlists')
      .insert({
        show_id: showId,
        type: 'actual',
        is_locked: true,
        external_id: transformedData.external_id,
        imported_from: transformedData.imported_from
      })
      .select('id')
      .single();

    if (setlistError) {
      throw new Error(`Failed to create setlist: ${setlistError.message}`);
    }

    // Import songs and create setlist_songs
    const setlistSongs = [];
    let accuracy = 0;
    let totalPredictedSongs = 0;

    // Get predicted setlist for accuracy calculation
    const { data: predictedSetlist } = await supabase
      .from('setlists')
      .select(`
        setlist_songs (
          song:songs (title)
        )
      `)
      .eq('show_id', showId)
      .eq('type', 'predicted')
      .single();

    const predictedSongTitles = predictedSetlist?.setlist_songs?.map(
      (ss: any) => ss.song?.title?.toLowerCase()
    ) || [];
    totalPredictedSongs = predictedSongTitles.length;

    for (const songData of transformedData.songs) {
      // Find or create song
      let songId = null;
      
      const { data: existingSong } = await supabase
        .from('songs')
        .select('id')
        .eq('title', songData.title)
        .eq('artist_name', artist)
        .single();

      if (existingSong) {
        songId = existingSong.id;
      } else {
        const { data: newSong, error: songError } = await supabase
          .from('songs')
          .insert({
            title: songData.title,
            artist_name: artist
          })
          .select('id')
          .single();

        if (!songError && newSong) {
          songId = newSong.id;
        }
      }

      if (songId) {
        // Check if this song was predicted
        const wasPredicted = predictedSongTitles.includes(songData.title.toLowerCase());
        if (wasPredicted) accuracy++;

        const { data: setlistSong } = await supabase
          .from('setlist_songs')
          .insert({
            setlist_id: newSetlist.id,
            song_id: songId,
            position: songData.position,
            notes: songData.notes,
            is_played: songData.is_played,
            upvotes: 0,
            downvotes: 0
          })
          .select(`
            id,
            position,
            upvotes,
            downvotes,
            notes,
            is_played,
            song:songs (
              id,
              title,
              artist_name,
              spotify_id
            )
          `)
          .single();

        if (setlistSong) {
          setlistSongs.push({
            ...setlistSong,
            setlist_id: newSetlist.id,
            song_id: songId,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    // Calculate and update accuracy score
    const accuracyPercentage = totalPredictedSongs > 0 
      ? Math.round((accuracy / totalPredictedSongs) * 100) 
      : 0;

    await supabase
      .from('setlists')
      .update({ accuracy_score: accuracyPercentage })
      .eq('id', newSetlist.id);

    return NextResponse.json({
      message: 'Setlist imported successfully',
      setlist: {
        id: newSetlist.id,
        setlist_songs: setlistSongs,
        accuracy_score: accuracyPercentage
      },
      source: 'setlist.fm',
      imported_songs: setlistSongs.length
    });

  } catch (error) {
    console.error('Setlist import error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Import failed' 
    }, { status: 500 });
  }
} 