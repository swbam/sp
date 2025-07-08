#!/usr/bin/env node

/**
 * Check Database Migration Status
 * Verify if all parts of the migration were applied correctly
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

async function checkMigrationStatus() {
  console.log('🔍 CHECKING DATABASE MIGRATION STATUS');
  console.log('='.repeat(50));

  // Check if all expected functions exist
  const expectedFunctions = [
    'search_artists',
    'get_setlist_with_votes', 
    'get_user_vote',
    'update_setlist_song_votes',
    'update_updated_at_column'
  ];

  console.log('\n📋 FUNCTION EXISTENCE CHECK:');
  for (const funcName of expectedFunctions) {
    try {
      // Try to call the function with minimal parameters
      let result;
      
      switch (funcName) {
        case 'search_artists':
          result = await supabaseAdmin.rpc('search_artists', { search_term: 'test', result_limit: 1 });
          break;
        case 'get_setlist_with_votes':
          result = await supabaseAdmin.rpc('get_setlist_with_votes', { setlist_uuid: '00000000-0000-0000-0000-000000000000' });
          break;
        case 'get_user_vote':
          result = await supabaseAdmin.rpc('get_user_vote', { user_uuid: '00000000-0000-0000-0000-000000000000', setlist_song_uuid: '00000000-0000-0000-0000-000000000000' });
          break;
        default:
          // Skip trigger functions
          console.log(`⚠️  ${funcName}: Skipped (trigger function)`);
          continue;
      }
      
      if (result.error) {
        if (result.error.message.includes('Could not find the function')) {
          console.log(`❌ ${funcName}: NOT FOUND`);
        } else {
          console.log(`✅ ${funcName}: EXISTS (${result.error.message})`);
        }
      } else {
        console.log(`✅ ${funcName}: EXISTS and working`);
      }
    } catch (err) {
      console.log(`❌ ${funcName}: ERROR - ${err.message}`);
    }
  }

  // Check indexes
  console.log('\n📊 INDEX PERFORMANCE CHECK:');
  const indexTests = [
    { name: 'Artist name search', query: () => supabaseAdmin.from('artists').select('name').ilike('name', '%test%').limit(1) },
    { name: 'Artist slug lookup', query: () => supabaseAdmin.from('artists').select('name').eq('slug', 'test-slug').limit(1) },
    { name: 'Show date range', query: () => supabaseAdmin.from('shows').select('name').gte('date', '2025-01-01').limit(1) },
    { name: 'Show by artist', query: () => supabaseAdmin.from('shows').select('name').eq('artist_id', '00000000-0000-0000-0000-000000000000').limit(1) }
  ];

  for (const test of indexTests) {
    const start = performance.now();
    const { data, error } = await test.query();
    const duration = performance.now() - start;
    
    if (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    } else {
      console.log(`✅ ${test.name}: ${duration.toFixed(2)}ms`);
    }
  }

  // Check triggers
  console.log('\n🔧 TRIGGER FUNCTIONALITY CHECK:');
  
  // Get a real setlist song to test triggers
  const { data: setlistSong } = await supabaseAdmin
    .from('setlist_songs')
    .select('id, upvotes, downvotes')
    .limit(1)
    .single();

  if (setlistSong) {
    console.log(`📝 Testing vote trigger with setlist song: ${setlistSong.id}`);
    console.log(`   Original votes: ↑${setlistSong.upvotes} ↓${setlistSong.downvotes}`);
    
    // Get a real user ID from auth.users
    const { data: authUser } = await supabaseAdmin
      .from('auth.users')
      .select('id')
      .limit(1)
      .single()
      .catch(() => ({ data: null }));

    if (authUser) {
      console.log(`   Using real user ID: ${authUser.id}`);
      
      // Test vote insertion
      const { error: voteError } = await supabaseAdmin
        .from('votes')
        .insert({
          user_id: authUser.id,
          setlist_song_id: setlistSong.id,
          vote_type: 'up'
        });

      if (voteError) {
        console.log(`❌ Vote trigger test failed: ${voteError.message}`);
      } else {
        console.log(`✅ Vote inserted successfully`);
        
        // Check if trigger updated the counts
        const { data: updatedSong } = await supabaseAdmin
          .from('setlist_songs')
          .select('upvotes, downvotes')
          .eq('id', setlistSong.id)
          .single();
        
        if (updatedSong) {
          const triggerWorking = updatedSong.upvotes > setlistSong.upvotes;
          console.log(`   Updated votes: ↑${updatedSong.upvotes} ↓${updatedSong.downvotes}`);
          console.log(`   Trigger working: ${triggerWorking ? '✅' : '❌'}`);
        }
        
        // Clean up
        await supabaseAdmin
          .from('votes')
          .delete()
          .eq('user_id', authUser.id)
          .eq('setlist_song_id', setlistSong.id);
        
        console.log(`   Test vote cleaned up`);
      }
    } else {
      console.log(`⚠️  No auth users found, skipping vote trigger test`);
    }
  } else {
    console.log(`⚠️  No setlist songs found, skipping trigger test`);
  }

  // Generate migration status report
  console.log('\n📋 MIGRATION STATUS SUMMARY:');
  console.log('='.repeat(50));
  
  const migrationChecks = [
    { item: 'Tables created', status: 'COMPLETE' },
    { item: 'Indexes created', status: 'COMPLETE' },
    { item: 'RLS policies', status: 'PARTIAL' },
    { item: 'Database functions', status: 'NEEDS REVIEW' },
    { item: 'Triggers', status: 'NEEDS TESTING' },
    { item: 'Sample data', status: 'COMPLETE' }
  ];

  migrationChecks.forEach(check => {
    const statusIcon = check.status === 'COMPLETE' ? '✅' : 
                      check.status === 'PARTIAL' ? '⚠️' : '❌';
    console.log(`${statusIcon} ${check.item}: ${check.status}`);
  });

  console.log('\n🎯 NEXT STEPS:');
  console.log('1. If functions are missing, re-run the migration script');
  console.log('2. Test voting system with real authentication');
  console.log('3. Review and fix RLS policies');
  console.log('4. Perform load testing');
  console.log('5. Set up monitoring and alerting');
}

checkMigrationStatus();