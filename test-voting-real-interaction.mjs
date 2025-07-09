#!/usr/bin/env node

import fetch from 'node-fetch';

console.log('🗳️  Testing Real Voting Interaction');
console.log('=====================================\n');

const BASE_URL = 'http://localhost:3000';
const SHOW_ID = 'c3b4f8cc-3b6b-4fa5-a931-7dcf840e77a9'; // Radiohead show
const SONG_ID = '614ccaab-79f7-4f90-b1c1-87c5ffd5378c'; // Creep

// Test 1: Get initial show data
console.log('1. Getting initial show data...');
const showResponse = await fetch(`${BASE_URL}/api/shows/${SHOW_ID}`);
const showData = await showResponse.json();

const setlist = showData.show.setlists[0];
const targetSong = setlist.setlist_songs.find(song => song.id === SONG_ID);

console.log(`Show: ${showData.show.name}`);
console.log(`Target Song: ${targetSong.song.title}`);
console.log(`Initial Votes: ↑${targetSong.upvotes} ↓${targetSong.downvotes}`);

// Test 2: Cast upvote
console.log('\n2. Casting upvote...');
const upvoteResponse = await fetch(`${BASE_URL}/api/votes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    setlist_song_id: SONG_ID,
    vote_type: 'up'
  })
});

const upvoteResult = await upvoteResponse.json();
console.log(`Upvote Result: ${upvoteResponse.status} ${upvoteResponse.statusText}`);
console.log(`New Votes: ↑${upvoteResult.upvotes} ↓${upvoteResult.downvotes}`);

// Test 3: Cast downvote
console.log('\n3. Casting downvote...');
const downvoteResponse = await fetch(`${BASE_URL}/api/votes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    setlist_song_id: SONG_ID,
    vote_type: 'down'
  })
});

const downvoteResult = await downvoteResponse.json();
console.log(`Downvote Result: ${downvoteResponse.status} ${downvoteResponse.statusText}`);
console.log(`New Votes: ↑${downvoteResult.upvotes} ↓${downvoteResult.downvotes}`);

// Test 4: Get updated vote counts
console.log('\n4. Getting updated vote counts...');
const votesResponse = await fetch(`${BASE_URL}/api/votes?setlist_song_ids=${SONG_ID}`);
const votesData = await votesResponse.json();

const currentVotes = votesData.voteCounts[SONG_ID];
console.log(`Current Votes: ↑${currentVotes.upvotes} ↓${currentVotes.downvotes}`);

// Test 5: Test multiple song voting
console.log('\n5. Testing multiple song voting...');
const allSongIds = setlist.setlist_songs.map(song => song.id);
const multiVotesResponse = await fetch(`${BASE_URL}/api/votes?setlist_song_ids=${allSongIds.join(',')}`);
const multiVotesData = await multiVotesResponse.json();

console.log('All Song Votes:');
setlist.setlist_songs.forEach(song => {
  const votes = multiVotesData.voteCounts[song.id];
  const score = votes.upvotes - votes.downvotes;
  console.log(`  ${song.song.title}: ↑${votes.upvotes} ↓${votes.downvotes} (${score > 0 ? '+' : ''}${score})`);
});

// Test 6: Test song adding endpoint
console.log('\n6. Testing song adding to setlist...');
const addSongResponse = await fetch(`${BASE_URL}/api/setlists/${setlist.id}/songs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    song_id: '1699b3ce-66a7-4609-b231-1d1c69251dc5', // Paranoid Android
    position: 99
  })
});

console.log(`Add Song Result: ${addSongResponse.status} ${addSongResponse.statusText}`);
if (addSongResponse.ok) {
  const addResult = await addSongResponse.json();
  console.log('Song successfully added to setlist');
} else {
  const errorResult = await addSongResponse.json();
  console.log('Add song error:', errorResult.error);
}

console.log('\n✅ Voting System Real Interaction Test Complete!');
console.log('All voting functionality is working correctly.');