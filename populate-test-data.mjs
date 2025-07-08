#!/usr/bin/env node

/**
 * Populate Database with Test Data
 * 
 * Creates comprehensive test data for MySetlist voting system testing
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

async function populateTestData() {
  console.log('🌱 Populating MySetlist Database with Test Data...\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Create test venues
    console.log('🏟️  Creating test venues...');
    const venues = [
      {
        name: 'Madison Square Garden',
        slug: 'madison-square-garden',
        city: 'New York',
        state: 'NY', 
        country: 'USA',
        capacity: 20789
      },
      {
        name: 'Red Rocks Amphitheatre',
        slug: 'red-rocks-amphitheatre', 
        city: 'Morrison',
        state: 'CO',
        country: 'USA',
        capacity: 9545
      },
      {
        name: 'Hollywood Bowl',
        slug: 'hollywood-bowl',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        capacity: 17500
      },
      {
        name: 'The O2 Arena',
        slug: 'the-o2-arena',
        city: 'London',
        state: null,
        country: 'UK',
        capacity: 20000
      }
    ];

    const { data: createdVenues, error: venueError } = await supabase
      .from('venues')
      .insert(venues)
      .select();

    if (venueError) {
      console.error('❌ Failed to create venues:', venueError.message);
      return;
    }
    console.log(`✅ Created ${createdVenues.length} venues`);

    // 2. Create test artists
    console.log('\n🎤 Creating test artists...');
    const artists = [
      {
        name: 'Radiohead',
        slug: 'radiohead',
        image_url: 'https://i.scdn.co/image/ab6761610000e5eba03696716c9ee605006047fd',
        genres: ['alternative rock', 'experimental rock', 'art rock'],
        followers: 8500000,
        verified: true
      },
      {
        name: 'Taylor Swift',
        slug: 'taylor-swift',
        image_url: 'https://i.scdn.co/image/ab6761610000e5eb859e4fdcae2e75c19a5e5827',
        genres: ['pop', 'country', 'folk'],
        followers: 45000000,
        verified: true
      },
      {
        name: 'The Strokes',
        slug: 'the-strokes',
        image_url: 'https://i.scdn.co/image/ab6761610000e5eb4e06f0d7ac9a9b0b4c5e3c7a',
        genres: ['indie rock', 'alternative rock', 'garage rock'],
        followers: 2800000,
        verified: true
      },
      {
        name: 'Arctic Monkeys',
        slug: 'arctic-monkeys',
        image_url: 'https://i.scdn.co/image/ab6761610000e5eb7db4b2d9c1c2c8c8c4c4c4c4',
        genres: ['indie rock', 'alternative rock', 'brit rock'],
        followers: 15000000,
        verified: true
      }
    ];

    const { data: createdArtists, error: artistError } = await supabase
      .from('artists')
      .insert(artists)
      .select();

    if (artistError) {
      console.error('❌ Failed to create artists:', artistError.message);
      return;
    }
    console.log(`✅ Created ${createdArtists.length} artists`);

    // 3. Create test songs
    console.log('\n🎵 Creating test songs...');
    const songs = [
      // Radiohead songs
      { title: 'Paranoid Android', artist_name: 'Radiohead', spotify_id: '6LgJqWIgXOJBLP1E5gg0mg' },
      { title: 'Karma Police', artist_name: 'Radiohead', spotify_id: '63OQupATfueTdZMWTxW03A' },
      { title: 'No Surprises', artist_name: 'Radiohead', spotify_id: '7AzIoLKOy3l2ADrxYlLPZm' },
      { title: 'Creep', artist_name: 'Radiohead', spotify_id: '70LcF31zb1H0PyJoS1Sx1r' },
      { title: 'Everything In Its Right Place', artist_name: 'Radiohead', spotify_id: '3ZkLlBxP9QZ7D8S9T1Y4aQ' },
      
      // Taylor Swift songs
      { title: 'Shake It Off', artist_name: 'Taylor Swift', spotify_id: '0cqRj7pUJDkTCEsJkx8snD' },
      { title: 'Love Story', artist_name: 'Taylor Swift', spotify_id: '1vrd6UOGamcKNGnSHJQlSt' },
      { title: 'Anti-Hero', artist_name: 'Taylor Swift', spotify_id: '0V3wPSX9ygBnCm8psDIegu' },
      { title: 'Blank Space', artist_name: 'Taylor Swift', spotify_id: '1p80LdxRV74UKvL8gnD7ky' },
      
      // The Strokes songs
      { title: 'Last Nite', artist_name: 'The Strokes', spotify_id: '3jBrgEZIHEVzvFGPU1sI8i' },
      { title: 'Reptilia', artist_name: 'The Strokes', spotify_id: '7AQim7LbXURra2K2dWPPcE' },
      { title: 'The Modern Age', artist_name: 'The Strokes', spotify_id: '1h6Cn3P4NGpJFjhwzeOG50' },
      
      // Arctic Monkeys songs  
      { title: 'Do I Wanna Know?', artist_name: 'Arctic Monkeys', spotify_id: '5FVd6KXrgO9B3JPmC8OPst' },
      { title: 'R U Mine?', artist_name: 'Arctic Monkeys', spotify_id: '1LMBYkfxl8GRqfTckN3KLz' },
      { title: '505', artist_name: 'Arctic Monkeys', spotify_id: '0BxE4FqsDD1Ot4YuBXwn3h' }
    ];

    const { data: createdSongs, error: songError } = await supabase
      .from('songs')
      .insert(songs)
      .select();

    if (songError) {
      console.error('❌ Failed to create songs:', songError.message);
      return;
    }
    console.log(`✅ Created ${createdSongs.length} songs`);

    // 4. Create test shows
    console.log('\n🎫 Creating test shows...');
    const shows = [
      {
        artist_id: createdArtists.find(a => a.slug === 'radiohead').id,
        venue_id: createdVenues.find(v => v.slug === 'madison-square-garden').id,
        name: 'Radiohead: OK Computer Anniversary Tour',
        date: '2025-08-15',
        start_time: '20:00:00',
        status: 'upcoming',
        ticket_url: 'https://www.ticketmaster.com/radiohead-tickets'
      },
      {
        artist_id: createdArtists.find(a => a.slug === 'taylor-swift').id,
        venue_id: createdVenues.find(v => v.slug === 'red-rocks-amphitheatre').id,
        name: 'Taylor Swift: The Eras Tour',
        date: '2025-07-22',
        start_time: '19:30:00',
        status: 'upcoming',
        ticket_url: 'https://www.ticketmaster.com/taylor-swift-tickets'
      },
      {
        artist_id: createdArtists.find(a => a.slug === 'the-strokes').id,
        venue_id: createdVenues.find(v => v.slug === 'hollywood-bowl').id,
        name: 'The Strokes Summer Concert',
        date: '2025-09-10',
        start_time: '21:00:00',
        status: 'upcoming'
      }
    ];

    const { data: createdShows, error: showError } = await supabase
      .from('shows')
      .insert(shows)
      .select();

    if (showError) {
      console.error('❌ Failed to create shows:', showError.message);
      return;
    }
    console.log(`✅ Created ${createdShows.length} shows`);

    // 5. Create test setlists
    console.log('\n📋 Creating test setlists...');
    const setlists = createdShows.map(show => ({
      show_id: show.id,
      type: 'predicted',
      is_locked: false
    }));

    const { data: createdSetlists, error: setlistError } = await supabase
      .from('setlists')
      .insert(setlists)
      .select();

    if (setlistError) {
      console.error('❌ Failed to create setlists:', setlistError.message);
      return;
    }
    console.log(`✅ Created ${createdSetlists.length} setlists`);

    // 6. Add songs to setlists
    console.log('\n🎶 Adding songs to setlists...');
    
    // Radiohead setlist
    const radiohreadShow = createdShows.find(s => s.name.includes('Radiohead'));
    const radioheadSetlist = createdSetlists.find(s => s.show_id === radiohreadShow.id);
    const radioheadSongs = createdSongs.filter(s => s.artist_name === 'Radiohead');
    
    const radioheadSetlistSongs = radioheadSongs.map((song, index) => ({
      setlist_id: radioheadSetlist.id,
      song_id: song.id,
      position: index + 1,
      upvotes: Math.floor(Math.random() * 25) + 5, // 5-30 upvotes
      downvotes: Math.floor(Math.random() * 8) + 1  // 1-8 downvotes
    }));

    // Taylor Swift setlist
    const taylorShow = createdShows.find(s => s.name.includes('Taylor Swift'));
    const taylorSetlist = createdSetlists.find(s => s.show_id === taylorShow.id);
    const taylorSongs = createdSongs.filter(s => s.artist_name === 'Taylor Swift');
    
    const taylorSetlistSongs = taylorSongs.map((song, index) => ({
      setlist_id: taylorSetlist.id,
      song_id: song.id,
      position: index + 1,
      upvotes: Math.floor(Math.random() * 40) + 10, // 10-50 upvotes
      downvotes: Math.floor(Math.random() * 5) + 1   // 1-5 downvotes
    }));

    // The Strokes setlist
    const strokesShow = createdShows.find(s => s.name.includes('Strokes'));
    const strokesSetlist = createdSetlists.find(s => s.show_id === strokesShow.id);
    const strokesSongs = createdSongs.filter(s => s.artist_name === 'The Strokes');
    
    const strokesSetlistSongs = strokesSongs.map((song, index) => ({
      setlist_id: strokesSetlist.id,
      song_id: song.id,
      position: index + 1,
      upvotes: Math.floor(Math.random() * 15) + 3, // 3-18 upvotes
      downvotes: Math.floor(Math.random() * 6) + 1  // 1-6 downvotes
    }));

    const allSetlistSongs = [...radioheadSetlistSongs, ...taylorSetlistSongs, ...strokesSetlistSongs];

    const { data: createdSetlistSongs, error: setlistSongError } = await supabase
      .from('setlist_songs')
      .insert(allSetlistSongs)
      .select();

    if (setlistSongError) {
      console.error('❌ Failed to create setlist songs:', setlistSongError.message);
      return;
    }
    console.log(`✅ Created ${createdSetlistSongs.length} setlist songs with voting data`);

    // Final verification
    console.log('\n🔍 Verifying created data...');
    
    const { data: finalCheck } = await supabase
      .from('shows')
      .select(`
        name,
        date,
        artist:artists(name),
        venue:venues(name, city),
        setlists(
          type,
          setlist_songs(
            position,
            upvotes,
            downvotes,
            song:songs(title)
          )
        )
      `);

    console.log('\n📊 Created Data Summary:');
    finalCheck.forEach(show => {
      console.log(`🎫 ${show.artist.name} at ${show.venue.name} (${show.date})`);
      const setlist = show.setlists[0];
      if (setlist) {
        console.log(`   📋 Predicted setlist with ${setlist.setlist_songs.length} songs:`);
        setlist.setlist_songs.slice(0, 3).forEach(ss => {
          console.log(`     ${ss.position}. ${ss.song.title} (↑${ss.upvotes} ↓${ss.downvotes})`);
        });
        if (setlist.setlist_songs.length > 3) {
          console.log(`     ... and ${setlist.setlist_songs.length - 3} more songs`);
        }
      }
    });

    console.log('\n🎉 Test data population completed successfully!');
    console.log('\n📋 What was created:');
    console.log(`✅ ${createdVenues.length} venues in major cities`);
    console.log(`✅ ${createdArtists.length} popular artists`);
    console.log(`✅ ${createdSongs.length} songs across different artists`);
    console.log(`✅ ${createdShows.length} upcoming shows`);
    console.log(`✅ ${createdSetlists.length} predicted setlists`);
    console.log(`✅ ${createdSetlistSongs.length} votable setlist songs`);
    
    console.log('\n🎯 Ready for Testing:');
    console.log('1. ✅ Database has realistic test data');
    console.log('2. ✅ Voting infrastructure is populated');
    console.log('3. ✅ Multiple shows available for testing');
    console.log('4. ✅ Songs have initial vote counts for testing');

  } catch (error) {
    console.error('❌ Failed to populate test data:', error.message);
  }
}

populateTestData();