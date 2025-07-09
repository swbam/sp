import { createClient } from '@supabase/supabase-js'

/**
 * Global teardown for MySetlist E2E tests
 * Cleans up test data and performs final verification
 */

async function globalTeardown() {
  console.log('🧹 MySetlist E2E Testing - Global Teardown')
  
  try {
    // Clean up test data
    await cleanupTestData()
    
    // Verify application state
    await verifyFinalState()
    
    console.log('✅ Global teardown completed successfully')
    
  } catch (error) {
    console.warn('⚠️ Global teardown had issues:', error.message)
    // Don't fail the entire test suite on teardown issues
  }
}

async function cleanupTestData() {
  console.log('🗑️ Cleaning up test data...')
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('ℹ️  Supabase credentials not available - skipping cleanup')
      return
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Delete test artists (cascading deletes will handle related data)
    const { data: testArtists } = await supabase
      .from('artists')
      .select('id, name')
      .or('name.ilike.%test%,name.ilike.%e2e%,name.ilike.%playwright%')
    
    if (testArtists && testArtists.length > 0) {
      const artistIds = testArtists.map(artist => artist.id)
      
      const { error: deleteError } = await supabase
        .from('artists')
        .delete()
        .in('id', artistIds)
      
      if (deleteError) {
        console.warn('⚠️ Could not delete test artists:', deleteError.message)
      } else {
        console.log(`✅ Cleaned up ${testArtists.length} test artists`)
      }
    }
    
    // Clean up any test votes
    const { error: votesError } = await supabase
      .from('votes')
      .delete()
      .like('setlist_song_id', '%test%')
    
    if (votesError) {
      console.warn('⚠️ Could not clean up test votes:', votesError.message)
    } else {
      console.log('✅ Cleaned up test votes')
    }
    
    // Clean up any test songs
    const { error: songsError } = await supabase
      .from('songs')
      .delete()
      .or('title.ilike.%test%,artist_name.ilike.%test%')
    
    if (songsError) {
      console.warn('⚠️ Could not clean up test songs:', songsError.message)
    } else {
      console.log('✅ Cleaned up test songs')
    }
    
  } catch (error) {
    console.warn('⚠️ Data cleanup had issues:', error.message)
  }
}

async function verifyFinalState() {
  console.log('🔍 Verifying final application state...')
  
  try {
    const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    // Basic health check
    const response = await fetch(baseURL)
    
    if (response.ok) {
      console.log('✅ Application still responding after tests')
    } else {
      console.warn('⚠️ Application may be in degraded state after tests')
    }
    
    // Check database connectivity
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      const { data, error } = await supabase
        .from('artists')
        .select('id')
        .limit(1)
      
      if (!error) {
        console.log('✅ Database connectivity verified')
      } else {
        console.warn('⚠️ Database connectivity issues detected')
      }
    }
    
  } catch (error) {
    console.warn('⚠️ Final state verification had issues:', error.message)
  }
}

export default globalTeardown