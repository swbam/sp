#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 MYSETLIST DATABASE STATUS CHECK')
console.log('=' + '='.repeat(50))

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .limit(1)
    
    if (error) {
      console.log(`❌ ${tableName}: ${error.message}`)
      return false
    }
    
    console.log(`✅ ${tableName}: EXISTS`)
    return true
  } catch (error) {
    console.log(`❌ ${tableName}: ${error.message}`)
    return false
  }
}

async function getTableCount(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.log(`❌ ${tableName} count: ${error.message}`)
      return 0
    }
    
    console.log(`📊 ${tableName}: ${count} records`)
    return count
  } catch (error) {
    console.log(`❌ ${tableName} count: ${error.message}`)
    return 0
  }
}

async function checkCoreData() {
  console.log('\n🗂️  CHECKING CORE TABLES')
  console.log('-'.repeat(30))
  
  const tables = [
    'artists',
    'venues', 
    'shows',
    'songs',
    'setlists',
    'setlist_songs',
    'votes',
    'user_artists'
  ]
  
  const results = {}
  
  for (const table of tables) {
    const exists = await checkTableExists(table)
    if (exists) {
      results[table] = await getTableCount(table)
    } else {
      results[table] = 0
    }
  }
  
  return results
}

async function checkSampleData() {
  console.log('\n🎯 CHECKING SAMPLE DATA')
  console.log('-'.repeat(30))
  
  // Check for specific sample artists
  const sampleArtists = ['Taylor Swift', 'The Weeknd', 'Billie Eilish', 'Drake', 'Radiohead']
  
  for (const artistName of sampleArtists) {
    const { data, error } = await supabase
      .from('artists')
      .select('name, followers')
      .eq('name', artistName)
      .single()
    
    if (error) {
      console.log(`❌ ${artistName}: NOT FOUND`)
    } else {
      console.log(`✅ ${artistName}: ${data.followers.toLocaleString()} followers`)
    }
  }
  
  // Check for sample shows
  const { data: shows, error: showsError } = await supabase
    .from('shows')
    .select(`
      name,
      date,
      status,
      artist:artists(name)
    `)
    .order('date', { ascending: true })
    .limit(5)
  
  if (showsError) {
    console.log(`❌ Shows: ${showsError.message}`)
  } else {
    console.log(`\n📅 SAMPLE SHOWS:`)
    shows.forEach(show => {
      console.log(`   • ${show.name} (${show.date}) - ${show.status}`)
    })
  }
  
  // Check for setlists with votes
  const { data: setlistData, error: setlistError } = await supabase
    .from('setlist_songs')
    .select(`
      upvotes,
      downvotes,
      song:songs(title),
      setlist:setlists(
        show:shows(
          name,
          artist:artists(name)
        )
      )
    `)
    .order('upvotes', { ascending: false })
    .limit(3)
  
  if (setlistError) {
    console.log(`❌ Setlist Songs: ${setlistError.message}`)
  } else {
    console.log(`\n🎵 TOP VOTED SONGS:`)
    setlistData.forEach(item => {
      const showName = item.setlist?.show?.name || 'Unknown Show'
      const songTitle = item.song?.title || 'Unknown Song'
      const netVotes = item.upvotes - item.downvotes
      console.log(`   • ${songTitle} (${showName}) - ${netVotes} net votes`)
    })
  }
}

async function checkAPIEndpoints() {
  console.log('\n🌐 CHECKING API ENDPOINTS')
  console.log('-'.repeat(30))
  
  const endpoints = [
    '/api/trending?type=shows&limit=3',
    '/api/trending?type=artists&limit=3',
    '/api/featured',
    '/api/stats',
    '/api/shows?limit=3',
    '/api/search/artists?q=Taylor'
  ]
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`)
      const data = await response.json()
      
      if (response.ok) {
        console.log(`✅ ${endpoint}: SUCCESS`)
      } else {
        console.log(`❌ ${endpoint}: ${data.error || 'FAILED'}`)
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`)
    }
  }
}

async function main() {
  try {
    const tableResults = await checkCoreData()
    await checkSampleData()
    await checkAPIEndpoints()
    
    console.log('\n📈 SUMMARY')
    console.log('=' + '='.repeat(50))
    
    const totalRecords = Object.values(tableResults).reduce((a, b) => a + b, 0)
    console.log(`📊 Total records across all tables: ${totalRecords}`)
    
    const hasData = tableResults.artists > 0 && tableResults.shows > 0 && tableResults.songs > 0
    
    if (hasData) {
      console.log('✅ DATABASE STATUS: READY')
      console.log('✅ SAMPLE DATA: PRESENT')
      console.log('✅ CORE FUNCTIONALITY: SHOULD WORK')
    } else {
      console.log('❌ DATABASE STATUS: NEEDS INITIALIZATION')
      console.log('❌ Run the init-database.sql script to populate sample data')
    }
    
    console.log('\n🚀 NEXT STEPS:')
    console.log('1. Visit http://localhost:3000 to test the homepage')
    console.log('2. Search for "Taylor Swift" to test artist search')
    console.log('3. Navigate to artist pages to test show listings')
    console.log('4. Click on shows to test voting interface')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

main()