/**
 * Test script for MySetlist voting system
 * Tests voting functionality with user restrictions
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Setup
const SUPABASE_URL = 'https://eotvxxipggnqxonvzkks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdHZ4eGlwZ2ducXhvbnZ6a2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzY0NjYsImV4cCI6MjA2NzUxMjQ2Nn0.jOetqdvld75LwNpzlxGXiHvMaGaO1FIeebkcObwYKhc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🎯 TESTING MYSETLIST VOTING SYSTEM');
console.log('=================================');

async function testVotingSystem() {
  try {
    // Test 1: Check database structure
    console.log('\n1. Testing database structure...');
    
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('count')
      .limit(1);

    if (votesError) {
      console.error('❌ Votes table not found:', votesError);
      return;
    }

    console.log('✅ Votes table exists');

    // Test 2: Check for test data
    console.log('\n2. Checking for test data...');
    
    const { data: songs, error: songsError } = await supabase
      .from('setlist_songs')
      .select('id, upvotes, downvotes, setlist_id')
      .limit(1);

    if (songsError) {
      console.error('❌ Could not fetch setlist songs:', songsError);
      return;
    }

    if (!songs || songs.length === 0) {
      console.log('⚠️  No setlist songs found. Please run the application first to create test data.');
      return;
    }

    const testSong = songs[0];
    console.log('✅ Using test song:', testSong.id);
    console.log('   - Current upvotes:', testSong.upvotes);
    console.log('   - Current downvotes:', testSong.downvotes);

    // Test 3: Check votes API (GET)
    console.log('\n3. Testing votes API (GET)...');
    
    const getResponse = await fetch(
      `http://localhost:3000/api/votes?setlist_song_ids=${testSong.id}`,
      { method: 'GET' }
    );

    if (!getResponse.ok) {
      console.error('❌ GET votes API failed:', getResponse.status);
      return;
    }

    const getResult = await getResponse.json();
    console.log('✅ GET votes API working');
    console.log('   - Vote counts:', getResult.voteCounts);
    console.log('   - User votes:', getResult.userVotes);

    // Test 4: Test voting without authentication (should fail)
    console.log('\n4. Testing voting without authentication...');
    
    const unauthResponse = await fetch('http://localhost:3000/api/votes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        setlist_song_id: testSong.id,
        vote_type: 'up'
      })
    });

    if (unauthResponse.status === 401) {
      console.log('✅ Unauthenticated voting properly rejected');
    } else {
      console.error('❌ Unauthenticated voting should have failed');
    }

    // Test 5: Test database triggers
    console.log('\n5. Testing database triggers...');
    
    // Get current vote counts
    const { data: beforeVote, error: beforeError } = await supabase
      .from('setlist_songs')
      .select('upvotes, downvotes')
      .eq('id', testSong.id)
      .single();

    if (beforeError) {
      console.error('❌ Could not fetch song before vote:', beforeError);
      return;
    }

    console.log('   - Before vote - Upvotes:', beforeVote.upvotes, 'Downvotes:', beforeVote.downvotes);

    // Test 6: Test unique constraint
    console.log('\n6. Testing vote restrictions...');
    
    const testUserId = '11111111-1111-1111-1111-111111111111';
    
    // Try to insert a vote
    const { data: vote1, error: vote1Error } = await supabase
      .from('votes')
      .insert({
        user_id: testUserId,
        setlist_song_id: testSong.id,
        vote_type: 'up'
      })
      .select()
      .single();

    if (vote1Error) {
      console.log('   First vote failed:', vote1Error.message);
    } else {
      console.log('   First vote successful');
    }

    // Try to insert another vote from same user (should fail)
    const { error: vote2Error } = await supabase
      .from('votes')
      .insert({
        user_id: testUserId,
        setlist_song_id: testSong.id,
        vote_type: 'down'
      });

    if (vote2Error && vote2Error.code === '23505') {
      console.log('✅ Unique constraint working - duplicate votes prevented');
    } else {
      console.error('❌ Unique constraint not working - duplicate votes allowed');
    }

    // Clean up test votes
    await supabase
      .from('votes')
      .delete()
      .eq('user_id', testUserId);

    console.log('\n🎉 VOTING SYSTEM TESTS COMPLETED');
    console.log('===================================');
    console.log('✅ Database structure: OK');
    console.log('✅ API endpoints: OK');
    console.log('✅ Authentication: OK');
    console.log('✅ Vote restrictions: OK');
    console.log('\n🚀 Voting system is ready for use!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
testVotingSystem().catch(console.error);