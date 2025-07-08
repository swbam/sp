#!/usr/bin/env node

/**
 * Database Function Test
 * Test if search_artists function exists and fix parameter order
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

const supabaseAdmin = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function testDatabaseFunctions() {
  console.log('🔍 TESTING DATABASE FUNCTIONS');
  console.log('='.repeat(40));

  // Test 1: Try different parameter orders for search_artists
  console.log('\n1. Testing search_artists function:');
  
  // Try with proper parameter order
  try {
    const { data, error } = await supabaseAdmin
      .rpc('search_artists', {
        search_term: 'taylor',
        result_limit: 5
      });
    
    if (error) {
      console.log(`❌ search_artists error: ${error.message}`);
    } else {
      console.log(`✅ search_artists working: ${data.length} results`);
      data.forEach(artist => {
        console.log(`   - ${artist.name} (${artist.followers} followers)`);
      });
    }
  } catch (err) {
    console.log(`❌ search_artists exception: ${err.message}`);
  }

  // Test 2: Test get_setlist_with_votes function
  console.log('\n2. Testing get_setlist_with_votes function:');
  
  // Get a setlist ID first
  const { data: setlist } = await supabaseAdmin
    .from('setlists')
    .select('id')
    .limit(1)
    .single();

  if (setlist) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_setlist_with_votes', {
          setlist_uuid: setlist.id
        });
      
      if (error) {
        console.log(`❌ get_setlist_with_votes error: ${error.message}`);
      } else {
        console.log(`✅ get_setlist_with_votes working: ${data.length} songs`);
        data.slice(0, 3).forEach(song => {
          console.log(`   ${song.position}. ${song.song_title} (↑${song.upvotes} ↓${song.downvotes})`);
        });
      }
    } catch (err) {
      console.log(`❌ get_setlist_with_votes exception: ${err.message}`);
    }
  }

  // Test 3: Test get_user_vote function
  console.log('\n3. Testing get_user_vote function:');
  
  // Get a setlist song ID
  const { data: setlistSong } = await supabaseAdmin
    .from('setlist_songs')
    .select('id')
    .limit(1)
    .single();

  if (setlistSong) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_user_vote', {
          user_uuid: '00000000-0000-0000-0000-000000000000',
          setlist_song_uuid: setlistSong.id
        });
      
      if (error) {
        console.log(`❌ get_user_vote error: ${error.message}`);
      } else {
        console.log(`✅ get_user_vote working: ${data || 'null'}`);
      }
    } catch (err) {
      console.log(`❌ get_user_vote exception: ${err.message}`);
    }
  }

  // Test 4: Test voting triggers
  console.log('\n4. Testing voting triggers:');
  
  if (setlistSong) {
    // Create a proper UUID for testing
    const testUuid = crypto.randomUUID();
    
    console.log(`   Testing with UUID: ${testUuid}`);
    
    try {
      // Insert a test vote
      const { error: voteError } = await supabaseAdmin
        .from('votes')
        .insert({
          user_id: testUuid,
          setlist_song_id: setlistSong.id,
          vote_type: 'up'
        });
      
      if (voteError) {
        console.log(`❌ Vote insert error: ${voteError.message}`);
      } else {
        console.log(`✅ Vote inserted successfully`);
        
        // Check if vote count was updated
        const { data: updatedSong } = await supabaseAdmin
          .from('setlist_songs')
          .select('upvotes, downvotes')
          .eq('id', setlistSong.id)
          .single();
        
        console.log(`   Updated votes: ↑${updatedSong.upvotes} ↓${updatedSong.downvotes}`);
        
        // Clean up
        await supabaseAdmin
          .from('votes')
          .delete()
          .eq('user_id', testUuid);
        
        console.log(`   Test vote cleaned up`);
      }
    } catch (err) {
      console.log(`❌ Voting trigger test exception: ${err.message}`);
    }
  }
}

testDatabaseFunctions();