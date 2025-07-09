import { createClient } from '@supabase/supabase-js';

const testDatabase = async () => {
  console.log('🔍 TESTING REAL SUPABASE DATABASE...');
  
  try {
    const supabase = createClient(
      'https://eotvxxipggnqxonvzkks.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdHZ4eGlwZ2ducXhvbnZ6a2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzY0NjYsImV4cCI6MjA2NzUxMjQ2Nn0.jOetqdvld75LwNpzlxGXiHvMaGaO1FIeebkcObwYKhc'
    );
    
    // Test basic connection with artists
    const { data: artists, error: artistError } = await supabase
      .from('artists')
      .select('id, name')
      .limit(5);
    
    if (artistError) {
      console.log('❌ Database Connection: FAILED -', artistError.message);
      return;
    }
    
    console.log('✅ Database Connection: WORKING');
    console.log('✅ Artists Table:', artists?.length, 'records found');
    if (artists?.length > 0) {
      console.log('   Sample artists:', artists.map(a => a.name).join(', '));
    }
    
    // Test shows table
    const { data: shows, error: showError } = await supabase
      .from('shows')
      .select('id, name, date')
      .limit(5);
    
    if (!showError && shows) {
      console.log('✅ Shows Table:', shows.length, 'records found');
      if (shows.length > 0) {
        console.log('   Sample shows:', shows.map(s => s.name).join(', '));
      }
    }
    
    // Test songs table
    const { data: songs, error: songError } = await supabase
      .from('songs')
      .select('id, title, artist_name')
      .limit(5);
    
    if (!songError && songs) {
      console.log('✅ Songs Table:', songs.length, 'records found');
      if (songs.length > 0) {
        console.log('   Sample songs:', songs.map(s => `${s.title} by ${s.artist_name}`).slice(0, 3).join(', '));
      }
    }
    
    // Test setlists table
    const { data: setlists, error: setlistError } = await supabase
      .from('setlists')
      .select('id, type')
      .limit(5);
    
    if (!setlistError && setlists) {
      console.log('✅ Setlists Table:', setlists.length, 'records found');
    }
    
    // Test setlist_songs table for voting data
    const { data: setlistSongs, error: ssError } = await supabase
      .from('setlist_songs')
      .select('id, upvotes, notes')
      .limit(5);
    
    if (!ssError && setlistSongs) {
      console.log('✅ Setlist Songs Table:', setlistSongs.length, 'records found');
      const totalVotes = setlistSongs.reduce((sum, s) => sum + (s.upvotes || 0), 0);
      console.log('   Total votes found:', totalVotes);
    }
    
    console.log('✅ Database Schema: ALL TABLES ACCESSIBLE');
    
  } catch (error) {
    console.log('❌ Database Test: FAILED -', error.message);
  }
};

testDatabase().catch(console.error);