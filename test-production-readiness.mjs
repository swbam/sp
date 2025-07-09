#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('🎯 PRODUCTION READINESS VALIDATION TEST')
console.log('=======================================')

let passedTests = 0
let totalTests = 0

function test(description, fn) {
  totalTests++
  console.log(`\n🔍 Testing: ${description}`)
  
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.then(() => {
        console.log('✅ PASSED')
        passedTests++
      }).catch(error => {
        console.log(`❌ FAILED: ${error.message}`)
      })
    } else {
      console.log('✅ PASSED')
      passedTests++
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`)
  }
}

// Test 1: Database Connection
await test('Database Connection', async () => {
  const { data, error } = await supabase.from('artists').select('count').limit(1)
  if (error) throw error
  if (!data) throw new Error('No data returned')
})

// Test 2: Artists Query Performance
await test('Artists Query Performance', async () => {
  const start = Date.now()
  const { data, error } = await supabase
    .from('artists')
    .select('id, name, image_url')
    .limit(10)
  
  const duration = Date.now() - start
  if (error) throw error
  if (duration > 1000) throw new Error(`Query too slow: ${duration}ms`)
  console.log(`   Performance: ${duration}ms`)
})

// Test 3: API Endpoint - Search Artists
await test('Search Artists API', async () => {
  const response = await fetch('http://localhost:3000/api/search/artists?q=test')
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  const data = await response.json()
  if (data.error) throw new Error(data.error)
})

// Test 4: API Endpoint - Invalid UUID handling
await test('Invalid UUID Handling', async () => {
  const response = await fetch('http://localhost:3000/api/shows/invalid-uuid')
  if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`)
  const data = await response.json()
  if (!data.error) throw new Error('Should return error for invalid UUID')
})

// Test 5: API Endpoint - Invalid search query
await test('Invalid Search Query Handling', async () => {
  const response = await fetch('http://localhost:3000/api/search/artists?q=')
  if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`)
  const data = await response.json()
  if (!data.error) throw new Error('Should return error for empty query')
})

// Test 6: Environment Variables
await test('Environment Variables Configuration', async () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!process.env.TICKETMASTER_API_KEY) throw new Error('Missing TICKETMASTER_API_KEY')
  if (!process.env.SPOTIFY_CLIENT_ID) throw new Error('Missing SPOTIFY_CLIENT_ID')
})

// Test 7: Database Schema Validation
await test('Database Schema Validation', async () => {
  const tables = ['artists', 'venues', 'shows', 'songs', 'setlists', 'setlist_songs', 'votes']
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) throw new Error(`Table ${table} not accessible: ${error.message}`)
  }
})

// Test 8: Authentication System
await test('Authentication System', async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(`Auth error: ${error.message}`)
  // Should not error even if no session
})

// Test 9: Real-time Functionality
await test('Real-time Configuration', async () => {
  const channel = supabase
    .channel('test-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, (payload) => {})
  
  const status = await channel.subscribe()
  if (status !== 'SUBSCRIBED') throw new Error('Could not subscribe to real-time channel')
  
  await channel.unsubscribe()
})

// Test 10: Performance Monitoring
await test('Performance Monitoring System', async () => {
  // Check if performance monitoring components exist
  const fs = await import('fs')
  if (!fs.existsSync('./components/ProductionPerformanceMonitor.tsx')) {
    throw new Error('Performance monitoring component missing')
  }
  if (!fs.existsSync('./components/WebVitalsMonitor.tsx')) {
    throw new Error('Web vitals monitor component missing')
  }
})

// Final Results
console.log('\n🎯 PRODUCTION READINESS ASSESSMENT')
console.log('==================================')
console.log(`✅ Passed: ${passedTests}/${totalTests} tests`)
console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`)

const passRate = (passedTests / totalTests) * 100
console.log(`📊 Pass Rate: ${passRate.toFixed(1)}%`)

if (passRate >= 90) {
  console.log('\n🚀 PRODUCTION READY - Application meets production standards')
} else if (passRate >= 70) {
  console.log('\n⚠️  NEARLY READY - Minor issues need addressing')
} else {
  console.log('\n❌ NOT READY - Critical issues must be resolved')
}

console.log('\n🏁 Production readiness validation complete')