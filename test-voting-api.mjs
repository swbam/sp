#!/usr/bin/env node

/**
 * Test the voting API endpoints to verify they work correctly
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

console.log('🎯 Testing Voting API Endpoints...');

// Test 1: Get test data
console.log('\n1. Getting test data...');
const { data: testData, error } = await supabase
  .from('setlist_songs')
  .select('id, upvotes, downvotes, song:songs(title, artist_name)')
  .limit(1);

if (error || !testData?.length) {
  console.error('❌ No test data available:', error);
  process.exit(1);
}

const testSong = testData[0];
console.log(`✅ Test song: ${testSong.song.title} by ${testSong.song.artist_name}`);
console.log(`   Current votes: ${testSong.upvotes} up, ${testSong.downvotes} down`);

// Test 2: Test upvote API
console.log('\n2. Testing upvote API...');
const upvoteResponse = await fetch(`${BASE_URL}/api/votes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    setlist_song_id: testSong.id,
    vote_type: 'up'
  })
});

const upvoteResult = await upvoteResponse.json();
console.log('Upvote response:', upvoteResult);

if (upvoteResponse.ok) {
  console.log('✅ Upvote API working');
} else {
  console.error('❌ Upvote API failed:', upvoteResult);
}

// Test 3: Test downvote API
console.log('\n3. Testing downvote API...');
const downvoteResponse = await fetch(`${BASE_URL}/api/votes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    setlist_song_id: testSong.id,
    vote_type: 'down'
  })
});

const downvoteResult = await downvoteResponse.json();
console.log('Downvote response:', downvoteResult);

if (downvoteResponse.ok) {
  console.log('✅ Downvote API working');
} else {
  console.error('❌ Downvote API failed:', downvoteResult);
}

// Test 4: Verify database updates
console.log('\n4. Verifying database updates...');
const { data: updatedData, error: updateError } = await supabase
  .from('setlist_songs')
  .select('id, upvotes, downvotes')
  .eq('id', testSong.id)
  .single();

if (updateError) {
  console.error('❌ Database verification failed:', updateError);
} else {
  console.log(`✅ Updated votes: ${updatedData.upvotes} up, ${updatedData.downvotes} down`);
  console.log(`   Change: +${updatedData.upvotes - testSong.upvotes} up, +${updatedData.downvotes - testSong.downvotes} down`);
}

// Test 5: Test vote counts GET endpoint
console.log('\n5. Testing vote counts GET endpoint...');
const voteCountsResponse = await fetch(`${BASE_URL}/api/votes?setlist_song_ids=${testSong.id}`);
const voteCountsResult = await voteCountsResponse.json();

console.log('Vote counts response:', voteCountsResult);

if (voteCountsResponse.ok) {
  console.log('✅ Vote counts GET endpoint working');
} else {
  console.error('❌ Vote counts GET endpoint failed:', voteCountsResult);
}

// Test 6: Test realtime votes endpoint
console.log('\n6. Testing realtime votes endpoint...');
const realtimeResponse = await fetch(`${BASE_URL}/api/realtime/votes?setlist_id=${testSong.setlist_id || 'test'}`);
const realtimeResult = await realtimeResponse.json();

console.log('Realtime response:', realtimeResult);

if (realtimeResponse.ok) {
  console.log('✅ Realtime votes endpoint working');
} else {
  console.error('❌ Realtime votes endpoint failed:', realtimeResult);
}

console.log('\n✅ API test complete');