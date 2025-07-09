#!/usr/bin/env node

/**
 * Debug Real-time Configuration Issues
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Debugging Real-time Configuration...');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  }
});

// Test connection to different tables and operations
async function testTable(tableName) {
  console.log(`\n📊 Testing table: ${tableName}`);
  
  const channel = supabase.channel(`test-${tableName}`);
  
  let subscriptionReady = false;
  let updateReceived = false;
  
  // Set up the subscription
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: tableName
    },
    (payload) => {
      console.log(`📡 ${tableName} update:`, payload);
      updateReceived = true;
    }
  );
  
  // Monitor subscription status
  const subscriptionPromise = new Promise((resolve) => {
    channel.subscribe((status) => {
      console.log(`📊 ${tableName} subscription status:`, status);
      if (status === 'SUBSCRIBED') {
        subscriptionReady = true;
        resolve();
      }
    });
  });
  
  // Wait for subscription
  await subscriptionPromise;
  
  if (subscriptionReady) {
    console.log(`✅ ${tableName} subscription ready`);
    
    // Test getting data
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`❌ ${tableName} query failed:`, error);
    } else if (data && data.length > 0) {
      console.log(`📝 ${tableName} has data, testing update...`);
      
      // Try to update
      const record = data[0];
      let updateData = {};
      
      if (tableName === 'setlist_songs') {
        updateData = { upvotes: (record.upvotes || 0) + 1 };
      } else if (tableName === 'shows') {
        updateData = { updated_at: new Date().toISOString() };
      } else if (tableName === 'artists') {
        updateData = { updated_at: new Date().toISOString() };
      }
      
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', record.id);
      
      if (updateError) {
        console.error(`❌ ${tableName} update failed:`, updateError);
      } else {
        console.log(`✅ ${tableName} update successful`);
        
        // Wait for real-time update
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (updateReceived) {
          console.log(`✅ ${tableName} real-time update received!`);
        } else {
          console.log(`❌ ${tableName} no real-time update received`);
        }
      }
    } else {
      console.log(`❌ ${tableName} no data available`);
    }
  } else {
    console.log(`❌ ${tableName} subscription failed`);
  }
  
  await channel.unsubscribe();
  return { table: tableName, subscriptionReady, updateReceived };
}

// Test all relevant tables
const tables = ['setlist_songs', 'votes', 'shows', 'artists'];
const results = [];

for (const table of tables) {
  const result = await testTable(table);
  results.push(result);
}

console.log('\n📋 SUMMARY:');
results.forEach(result => {
  const status = result.subscriptionReady ? '✅' : '❌';
  const updates = result.updateReceived ? '✅' : '❌';
  console.log(`${status} ${result.table}: Subscription ${updates} Updates`);
});

console.log('\n✅ Debug test complete');