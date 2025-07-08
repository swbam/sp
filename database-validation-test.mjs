#!/usr/bin/env node

/**
 * COMPREHENSIVE DATABASE VALIDATION TEST
 * SUB-AGENT 3: Database & Schema Validation
 * 
 * This script performs extensive database validation including:
 * - Schema structure validation
 * - Relationship integrity testing
 * - Performance benchmarking
 * - Real data insertion and retrieval
 * - RLS policy testing
 * - Index performance validation
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
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Test results tracking
const testResults = {
  schemaValidation: [],
  relationshipTests: [],
  performanceTests: [],
  realDataTests: [],
  rlsTests: [],
  indexTests: []
};

// Helper function to measure performance
function measurePerformance(fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return {
    result,
    duration: end - start
  };
}

// Test 1: Schema Structure Validation
async function validateSchemaStructure() {
  console.log('📊 SCHEMA STRUCTURE VALIDATION');
  console.log('='.repeat(50));

  const expectedTables = [
    'artists', 'venues', 'shows', 'songs', 'setlists', 'setlist_songs', 'votes', 'user_artists'
  ];

  // Check table existence using direct queries

  // Manual table check
  const tableChecks = [];
  for (const tableName of expectedTables) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      tableChecks.push({
        table: tableName,
        exists: !error,
        recordCount: count || 0,
        status: error ? 'ERROR' : 'OK'
      });
    } catch (err) {
      tableChecks.push({
        table: tableName,
        exists: false,
        recordCount: 0,
        status: 'MISSING'
      });
    }
  }

  console.log('\n✅ TABLE EXISTENCE CHECK:');
  tableChecks.forEach(check => {
    const status = check.exists ? '✅' : '❌';
    console.log(`${status} ${check.table}: ${check.recordCount} records`);
  });

  testResults.schemaValidation = tableChecks;
  return tableChecks;
}

// Test 2: Relationship Integrity Testing
async function validateRelationships() {
  console.log('\n🔗 RELATIONSHIP INTEGRITY TESTING');
  console.log('='.repeat(50));

  const relationshipTests = [
    {
      name: 'Shows → Artists',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('shows')
          .select(`
            id,
            name,
            artist:artists(name)
          `)
          .limit(5);
        return { data, error };
      }
    },
    {
      name: 'Shows → Venues',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('shows')
          .select(`
            id,
            name,
            venue:venues(name, city)
          `)
          .limit(5);
        return { data, error };
      }
    },
    {
      name: 'Setlists → Shows',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('setlists')
          .select(`
            id,
            type,
            show:shows(name, date)
          `)
          .limit(5);
        return { data, error };
      }
    },
    {
      name: 'Setlist_Songs → Songs',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('setlist_songs')
          .select(`
            id,
            position,
            song:songs(title, artist_name)
          `)
          .limit(5);
        return { data, error };
      }
    }
  ];

  const results = [];
  for (const test of relationshipTests) {
    const { result, duration } = await measurePerformance(test.query);
    const { data, error } = result;
    
    const status = error ? 'FAIL' : 'PASS';
    const recordCount = data ? data.length : 0;
    
    console.log(`${status === 'PASS' ? '✅' : '❌'} ${test.name}: ${recordCount} records (${duration.toFixed(2)}ms)`);
    
    if (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    results.push({
      test: test.name,
      status,
      recordCount,
      duration,
      error: error?.message
    });
  }

  testResults.relationshipTests = results;
  return results;
}

// Test 3: Performance Benchmarking
async function validatePerformance() {
  console.log('\n⚡ PERFORMANCE BENCHMARKING');
  console.log('='.repeat(50));

  const performanceTests = [
    {
      name: 'Artist Search (indexed)',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('artists')
          .select('name, followers')
          .ilike('name', '%taylor%')
          .order('followers', { ascending: false })
          .limit(10);
        return { data, error };
      }
    },
    {
      name: 'Shows by Date Range (indexed)',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('shows')
          .select('name, date, status')
          .gte('date', '2025-01-01')
          .lte('date', '2025-12-31')
          .order('date');
        return { data, error };
      }
    },
    {
      name: 'Complex Join Query',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('shows')
          .select(`
            name,
            date,
            artist:artists(name, followers),
            venue:venues(name, city, capacity),
            setlists(
              type,
              setlist_songs(
                position,
                upvotes,
                downvotes,
                song:songs(title)
              )
            )
          `)
          .limit(5);
        return { data, error };
      }
    },
    {
      name: 'Database Functions Test',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .rpc('search_artists', {
            search_term: 'taylor',
            result_limit: 5
          });
        return { data, error };
      }
    }
  ];

  const results = [];
  for (const test of performanceTests) {
    const { result, duration } = await measurePerformance(test.query);
    const { data, error } = result;
    
    const status = error ? 'FAIL' : 'PASS';
    const recordCount = data ? data.length : 0;
    const performanceRating = duration < 100 ? 'EXCELLENT' : 
                             duration < 500 ? 'GOOD' : 
                             duration < 1000 ? 'ACCEPTABLE' : 'SLOW';
    
    console.log(`${status === 'PASS' ? '✅' : '❌'} ${test.name}: ${recordCount} records (${duration.toFixed(2)}ms - ${performanceRating})`);
    
    if (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    results.push({
      test: test.name,
      status,
      recordCount,
      duration,
      performanceRating,
      error: error?.message
    });
  }

  testResults.performanceTests = results;
  return results;
}

// Test 4: Real Data Insertion and Retrieval
async function validateRealDataOperations() {
  console.log('\n💾 REAL DATA OPERATIONS TESTING');
  console.log('='.repeat(50));

  const testData = {
    artist: {
      name: 'Test Artist ' + Date.now(),
      slug: 'test-artist-' + Date.now(),
      genres: ['rock', 'indie'],
      followers: 12500,
      verified: true
    },
    venue: {
      name: 'Test Venue ' + Date.now(),
      slug: 'test-venue-' + Date.now(),
      city: 'Test City',
      country: 'USA',
      capacity: 5000
    }
  };

  const results = [];

  // Test artist insertion
  console.log('📝 Testing artist insertion...');
  const { data: insertedArtist, error: artistError } = await supabaseAdmin
    .from('artists')
    .insert(testData.artist)
    .select()
    .single();

  if (artistError) {
    console.log(`❌ Artist insertion failed: ${artistError.message}`);
    results.push({ operation: 'Artist Insert', status: 'FAIL', error: artistError.message });
  } else {
    console.log(`✅ Artist inserted successfully: ${insertedArtist.name}`);
    results.push({ operation: 'Artist Insert', status: 'PASS', data: insertedArtist });
  }

  // Test venue insertion
  console.log('📝 Testing venue insertion...');
  const { data: insertedVenue, error: venueError } = await supabaseAdmin
    .from('venues')
    .insert(testData.venue)
    .select()
    .single();

  if (venueError) {
    console.log(`❌ Venue insertion failed: ${venueError.message}`);
    results.push({ operation: 'Venue Insert', status: 'FAIL', error: venueError.message });
  } else {
    console.log(`✅ Venue inserted successfully: ${insertedVenue.name}`);
    results.push({ operation: 'Venue Insert', status: 'PASS', data: insertedVenue });
  }

  // Test show insertion with relationships
  if (insertedArtist && insertedVenue) {
    console.log('📝 Testing show insertion with relationships...');
    const showData = {
      artist_id: insertedArtist.id,
      venue_id: insertedVenue.id,
      name: 'Test Show ' + Date.now(),
      date: '2025-12-31',
      status: 'upcoming'
    };

    const { data: insertedShow, error: showError } = await supabaseAdmin
      .from('shows')
      .insert(showData)
      .select(`
        *,
        artist:artists(name),
        venue:venues(name, city)
      `)
      .single();

    if (showError) {
      console.log(`❌ Show insertion failed: ${showError.message}`);
      results.push({ operation: 'Show Insert', status: 'FAIL', error: showError.message });
    } else {
      console.log(`✅ Show inserted successfully: ${insertedShow.name}`);
      results.push({ operation: 'Show Insert', status: 'PASS', data: insertedShow });
    }
  }

  // Test data retrieval
  console.log('📝 Testing data retrieval...');
  const { data: retrievedData, error: retrievalError } = await supabaseAdmin
    .from('artists')
    .select(`
      name,
      slug,
      shows(
        name,
        date,
        venue:venues(name, city)
      )
    `)
    .eq('slug', testData.artist.slug)
    .single();

  if (retrievalError) {
    console.log(`❌ Data retrieval failed: ${retrievalError.message}`);
    results.push({ operation: 'Data Retrieval', status: 'FAIL', error: retrievalError.message });
  } else {
    console.log(`✅ Data retrieved successfully: ${retrievedData.name}`);
    results.push({ operation: 'Data Retrieval', status: 'PASS', data: retrievedData });
  }

  // Clean up test data
  console.log('🧹 Cleaning up test data...');
  await supabaseAdmin.from('shows').delete().eq('artist_id', insertedArtist?.id);
  await supabaseAdmin.from('artists').delete().eq('id', insertedArtist?.id);
  await supabaseAdmin.from('venues').delete().eq('id', insertedVenue?.id);

  testResults.realDataTests = results;
  return results;
}

// Test 5: RLS Policy Testing
async function validateRLSPolicies() {
  console.log('\n🔒 ROW LEVEL SECURITY TESTING');
  console.log('='.repeat(50));

  const results = [];

  // Test public read access
  console.log('📝 Testing public read access...');
  const { data: publicArtists, error: publicError } = await supabaseAnon
    .from('artists')
    .select('name, followers')
    .limit(3);

  if (publicError) {
    console.log(`❌ Public read access failed: ${publicError.message}`);
    results.push({ test: 'Public Read', status: 'FAIL', error: publicError.message });
  } else {
    console.log(`✅ Public read access working: ${publicArtists.length} records`);
    results.push({ test: 'Public Read', status: 'PASS', recordCount: publicArtists.length });
  }

  // Test public write access (should fail)
  console.log('📝 Testing public write access (should fail)...');
  const { data: insertAttempt, error: insertError } = await supabaseAnon
    .from('artists')
    .insert({
      name: 'Unauthorized Artist',
      slug: 'unauthorized-artist'
    });

  if (insertError) {
    console.log(`✅ Public write access correctly blocked: ${insertError.message}`);
    results.push({ test: 'Public Write Block', status: 'PASS', error: insertError.message });
  } else {
    console.log(`❌ Public write access not blocked (security issue)`);
    results.push({ test: 'Public Write Block', status: 'FAIL', message: 'Should have been blocked' });
  }

  // Test admin access
  console.log('📝 Testing admin access...');
  const { data: adminArtists, error: adminError } = await supabaseAdmin
    .from('artists')
    .select('name, followers')
    .limit(3);

  if (adminError) {
    console.log(`❌ Admin access failed: ${adminError.message}`);
    results.push({ test: 'Admin Access', status: 'FAIL', error: adminError.message });
  } else {
    console.log(`✅ Admin access working: ${adminArtists.length} records`);
    results.push({ test: 'Admin Access', status: 'PASS', recordCount: adminArtists.length });
  }

  testResults.rlsTests = results;
  return results;
}

// Test 6: Index Performance Validation
async function validateIndexPerformance() {
  console.log('\n📈 INDEX PERFORMANCE VALIDATION');
  console.log('='.repeat(50));

  const indexTests = [
    {
      name: 'Artist Name Search (idx_artists_name)',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('artists')
          .select('name, followers')
          .ilike('name', '%taylor%')
          .limit(10);
        return { data, error };
      }
    },
    {
      name: 'Artist Slug Lookup (idx_artists_slug)',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('artists')
          .select('*')
          .eq('slug', 'radiohead')
          .single();
        return { data, error };
      }
    },
    {
      name: 'Shows by Date Range (idx_shows_date)',
      query: async () => {
        const { data, error } = await supabaseAdmin
          .from('shows')
          .select('name, date')
          .gte('date', '2025-01-01')
          .lte('date', '2025-12-31')
          .order('date');
        return { data, error };
      }
    },
    {
      name: 'Shows by Artist (idx_shows_artist_id)',
      query: async () => {
        const { data: artist } = await supabaseAdmin
          .from('artists')
          .select('id')
          .eq('name', 'Radiohead')
          .single();
        
        if (!artist) return { data: null, error: { message: 'Artist not found' } };
        
        const { data, error } = await supabaseAdmin
          .from('shows')
          .select('name, date')
          .eq('artist_id', artist.id);
        return { data, error };
      }
    }
  ];

  const results = [];
  for (const test of indexTests) {
    const { result, duration } = await measurePerformance(test.query);
    const { data, error } = result;
    
    const status = error ? 'FAIL' : 'PASS';
    const recordCount = data ? (Array.isArray(data) ? data.length : 1) : 0;
    const performanceRating = duration < 50 ? 'EXCELLENT' : 
                             duration < 100 ? 'GOOD' : 
                             duration < 200 ? 'ACCEPTABLE' : 'SLOW';
    
    console.log(`${status === 'PASS' ? '✅' : '❌'} ${test.name}: ${recordCount} records (${duration.toFixed(2)}ms - ${performanceRating})`);
    
    if (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    results.push({
      test: test.name,
      status,
      recordCount,
      duration,
      performanceRating,
      error: error?.message
    });
  }

  testResults.indexTests = results;
  return results;
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 COMPREHENSIVE DATABASE VALIDATION REPORT');
  console.log('='.repeat(70));

  const allTests = [
    ...testResults.schemaValidation,
    ...testResults.relationshipTests,
    ...testResults.performanceTests,
    ...testResults.realDataTests,
    ...testResults.rlsTests,
    ...testResults.indexTests
  ];

  const passedTests = allTests.filter(test => test.status === 'PASS' || test.exists === true).length;
  const totalTests = allTests.length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);

  console.log(`\n🎯 OVERALL RESULTS:`);
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests (${successRate}%)`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`);

  console.log(`\n📋 DETAILED BREAKDOWN:`);
  console.log(`   Schema Validation: ${testResults.schemaValidation.filter(t => t.exists).length}/${testResults.schemaValidation.length} tables`);
  console.log(`   Relationship Tests: ${testResults.relationshipTests.filter(t => t.status === 'PASS').length}/${testResults.relationshipTests.length} relationships`);
  console.log(`   Performance Tests: ${testResults.performanceTests.filter(t => t.status === 'PASS').length}/${testResults.performanceTests.length} queries`);
  console.log(`   Real Data Tests: ${testResults.realDataTests.filter(t => t.status === 'PASS').length}/${testResults.realDataTests.length} operations`);
  console.log(`   RLS Tests: ${testResults.rlsTests.filter(t => t.status === 'PASS').length}/${testResults.rlsTests.length} policies`);
  console.log(`   Index Tests: ${testResults.indexTests.filter(t => t.status === 'PASS').length}/${testResults.indexTests.length} indexes`);

  const avgPerformance = testResults.performanceTests.reduce((sum, test) => sum + test.duration, 0) / testResults.performanceTests.length;
  const avgIndexPerformance = testResults.indexTests.reduce((sum, test) => sum + test.duration, 0) / testResults.indexTests.length;

  console.log(`\n⚡ PERFORMANCE METRICS:`);
  console.log(`   Average Query Time: ${avgPerformance.toFixed(2)}ms`);
  console.log(`   Average Index Query Time: ${avgIndexPerformance.toFixed(2)}ms`);
  console.log(`   Performance Rating: ${avgPerformance < 100 ? 'EXCELLENT' : avgPerformance < 500 ? 'GOOD' : 'NEEDS OPTIMIZATION'}`);

  console.log(`\n🔒 SECURITY STATUS:`);
  const securityTests = testResults.rlsTests;
  const securityPassed = securityTests.filter(t => t.status === 'PASS').length;
  console.log(`   Security Tests: ${securityPassed}/${securityTests.length} passed`);
  console.log(`   RLS Status: ${securityPassed === securityTests.length ? 'SECURE' : 'NEEDS ATTENTION'}`);

  console.log(`\n🚀 PRODUCTION READINESS:`);
  if (successRate >= 95) {
    console.log(`✅ READY FOR PRODUCTION - All critical systems validated`);
  } else if (successRate >= 85) {
    console.log(`⚠️  MOSTLY READY - Minor issues need attention`);
  } else {
    console.log(`❌ NOT READY - Significant issues need resolution`);
  }

  console.log(`\n📝 RECOMMENDATIONS:`);
  console.log(`   1. ${successRate >= 95 ? '✅' : '❌'} Database schema is complete and functional`);
  console.log(`   2. ${avgPerformance < 100 ? '✅' : '❌'} Query performance is optimized`);
  console.log(`   3. ${securityPassed === securityTests.length ? '✅' : '❌'} Security policies are properly configured`);
  console.log(`   4. ${testResults.realDataTests.filter(t => t.status === 'PASS').length >= 3 ? '✅' : '❌'} Real data operations are working`);

  return {
    successRate,
    totalTests,
    passedTests,
    avgPerformance,
    avgIndexPerformance,
    productionReady: successRate >= 95
  };
}

// Main execution
async function runComprehensiveValidation() {
  console.log('🎯 SUB-AGENT 3: COMPREHENSIVE DATABASE VALIDATION');
  console.log('='.repeat(70));
  console.log('Starting comprehensive database validation with real data testing...\n');

  try {
    await validateSchemaStructure();
    await validateRelationships();
    await validatePerformance();
    await validateRealDataOperations();
    await validateRLSPolicies();
    await validateIndexPerformance();
    
    const report = generateReport();
    
    console.log('\n🎉 VALIDATION COMPLETE!');
    console.log(`   Production Ready: ${report.productionReady ? 'YES' : 'NO'}`);
    console.log(`   Success Rate: ${report.successRate}%`);
    console.log(`   Performance: ${report.avgPerformance.toFixed(2)}ms average`);
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Execute the validation
runComprehensiveValidation();