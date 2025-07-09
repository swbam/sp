#!/usr/bin/env node

/**
 * Simple Real-time Test to Debug Connection Issues
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Real-time Subscriptions...');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false
  }
});

// Test 1: Basic connection
console.log('\n1. Testing basic connection...');
const { data: testData, error } = await supabase.from('setlist_songs').select('*').limit(1);
if (error) {
  console.error('❌ Database connection failed:', error);
} else {
  console.log('✅ Database connection successful');
}

// Test 2: Check if realtime is enabled
console.log('\n2. Setting up realtime subscription...');
const channel = supabase.channel('test-channel');

let subscriptionStatus = 'pending';
let updateReceived = false;

channel.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'setlist_songs'
  },
  (payload) => {
    console.log('📡 Real-time update received:', payload);
    updateReceived = true;
  }
);

// Monitor subscription status
channel.subscribe((status) => {
  console.log('📊 Subscription status:', status);
  subscriptionStatus = status;
});

// Wait for subscription to be ready
await new Promise(resolve => setTimeout(resolve, 2000));

if (subscriptionStatus === 'SUBSCRIBED') {
  console.log('✅ Real-time subscription established');
  
  // Test 3: Try to trigger an update
  console.log('\n3. Testing manual database update...');
  
  if (testData && testData.length > 0) {
    const testSong = testData[0];
    console.log('📝 Updating song:', testSong.id);
    
    // Try to update the song
    const { error: updateError } = await supabase
      .from('setlist_songs')
      .update({ upvotes: (testSong.upvotes || 0) + 1 })
      .eq('id', testSong.id);
    
    if (updateError) {
      console.error('❌ Update failed:', updateError);
    } else {
      console.log('✅ Update successful');
      
      // Wait for real-time update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (updateReceived) {
        console.log('✅ Real-time update received!');
      } else {
        console.log('❌ No real-time update received');
      }
    }
  } else {
    console.log('❌ No test data available');
  }
} else {
  console.log('❌ Real-time subscription failed:', subscriptionStatus);
}

await channel.unsubscribe();
console.log('\n✅ Test complete');