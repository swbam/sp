import { beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types_db'

// Integration test setup for MySetlist
// This setup provides real Supabase connections for integration tests

let supabaseClient: ReturnType<typeof createClient<Database>>

beforeAll(async () => {
  console.log('🔗 Setting up integration test environment...')
  
  // Use real Supabase URL for integration tests but with test database
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eotvxxipggnqxonvzkks.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key'
  
  supabaseClient = createClient<Database>(supabaseUrl, supabaseKey)
  
  // Verify connection
  try {
    const { data, error } = await supabaseClient.from('artists').select('id').limit(1)
    if (error) {
      console.warn('⚠️ Supabase connection issue in tests:', error.message)
    } else {
      console.log('✅ Supabase connection verified for integration tests')
    }
  } catch (err) {
    console.warn('⚠️ Could not verify Supabase connection:', err)
  }
})

beforeEach(() => {
  // Reset any test data if needed
  vi.clearAllTimers()
})

afterAll(() => {
  console.log('🧹 Cleaning up integration test environment...')
})

// Helper functions for integration tests
export const getTestSupabaseClient = () => supabaseClient

export const createTestArtist = async (overrides = {}) => {
  const testArtist = {
    name: `Test Artist ${Date.now()}`,
    slug: `test-artist-${Date.now()}`,
    image_url: 'https://example.com/test.jpg',
    genres: ['rock', 'pop'],
    followers: 1000,
    verified: false,
    ...overrides
  }
  
  const { data, error } = await supabaseClient
    .from('artists')
    .insert(testArtist)
    .select()
    .single()
    
  if (error) throw error
  return data
}

export const createTestShow = async (artistId: string, overrides = {}) => {
  const testShow = {
    artist_id: artistId,
    name: `Test Show ${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    status: 'upcoming' as const,
    ...overrides
  }
  
  const { data, error } = await supabaseClient
    .from('shows')
    .insert(testShow)
    .select()
    .single()
    
  if (error) throw error
  return data
}

export const createTestSetlist = async (showId: string, overrides = {}) => {
  const testSetlist = {
    show_id: showId,
    type: 'predicted' as const,
    is_locked: false,
    ...overrides
  }
  
  const { data, error } = await supabaseClient
    .from('setlists')
    .insert(testSetlist)
    .select()
    .single()
    
  if (error) throw error
  return data
}

export const cleanupTestData = async (tableName: string, ids: string[]) => {
  if (ids.length === 0) return
  
  await supabaseClient
    .from(tableName as any)
    .delete()
    .in('id', ids)
}