import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VoteEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: any
  old_record?: any
}

interface VoteProcessingConfig {
  trendsUpdateThreshold: number
  popularityBoostFactor: number
  realtimeUpdateBatch: number
  alertThresholds: {
    highVoteVelocity: number
    suspiciousVoting: number
    negativeRatio: number
  }
}

const config: VoteProcessingConfig = {
  trendsUpdateThreshold: 10, // Update trends after 10 votes
  popularityBoostFactor: 1.5,
  realtimeUpdateBatch: 5,
  alertThresholds: {
    highVoteVelocity: 50, // votes per minute
    suspiciousVoting: 10, // votes from same IP in short time
    negativeRatio: 0.8 // 80% downvotes threshold
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Parse the webhook payload
    const payload = await req.json()
    console.log('Received vote event:', payload)

    const voteEvent: VoteEvent = {
      type: payload.type,
      table: payload.table,
      record: payload.record,
      old_record: payload.old_record
    }

    // Process vote event based on type
    let result
    switch (voteEvent.type) {
      case 'INSERT':
        result = await processNewVote(supabaseClient, voteEvent.record)
        break
      case 'UPDATE':
        result = await processVoteUpdate(supabaseClient, voteEvent.record, voteEvent.old_record)
        break
      case 'DELETE':
        result = await processVoteDelete(supabaseClient, voteEvent.old_record)
        break
      default:
        throw new Error(`Unsupported event type: ${voteEvent.type}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: true,
        event_type: voteEvent.type,
        processing_result: result,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Vote processing error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

async function processNewVote(supabase: any, voteRecord: any) {
  console.log('Processing new vote:', voteRecord)
  
  const results = {
    updateCounts: false,
    updateTrends: false,
    realtimeBroadcast: false,
    alertsTriggered: []
  }

  try {
    // 1. Update vote counts on setlist_songs
    const { error: updateError } = await updateVoteCounts(supabase, voteRecord.setlist_song_id, voteRecord.vote_type)
    if (updateError) throw updateError
    results.updateCounts = true

    // 2. Get updated setlist song data
    const { data: setlistSong, error: fetchError } = await supabase
      .from('setlist_songs')
      .select(`
        id,
        upvotes,
        downvotes,
        position,
        setlist:setlists!inner (
          id,
          show:shows!inner (
            id,
            name,
            date,
            artist:artists (id, name)
          )
        ),
        song:songs (id, title, artist_name)
      `)
      .eq('id', voteRecord.setlist_song_id)
      .single()

    if (fetchError || !setlistSong) {
      throw new Error('Failed to fetch setlist song data')
    }

    // 3. Calculate vote velocity and check for alerts
    const voteVelocity = await calculateVoteVelocity(supabase, voteRecord.setlist_song_id)
    const alerts = await checkVoteAlerts(supabase, voteRecord, setlistSong, voteVelocity)
    results.alertsTriggered = alerts

    // 4. Update trending metrics if threshold reached
    const shouldUpdateTrends = await shouldUpdateTrendingMetrics(supabase, setlistSong.id)
    if (shouldUpdateTrends) {
      await updateTrendingMetrics(supabase, setlistSong)
      results.updateTrends = true
    }

    // 5. Broadcast real-time updates
    await broadcastRealtimeUpdates(supabase, {
      type: 'vote_update',
      setlist_song_id: setlistSong.id,
      setlist_id: setlistSong.setlist.id,
      show_id: setlistSong.setlist.show.id,
      new_counts: {
        upvotes: setlistSong.upvotes,
        downvotes: setlistSong.downvotes
      },
      vote_velocity: voteVelocity,
      timestamp: new Date().toISOString()
    })
    results.realtimeBroadcast = true

    // 6. Log analytics event
    await logAnalyticsEvent(supabase, {
      type: 'vote',
      user_id: voteRecord.user_id,
      entity_id: voteRecord.setlist_song_id,
      entity_type: 'setlist_song',
      metadata: {
        vote_type: voteRecord.vote_type,
        show_id: setlistSong.setlist.show.id,
        artist_id: setlistSong.setlist.show.artist.id,
        vote_velocity: voteVelocity
      }
    })

  } catch (error) {
    console.error('Error processing new vote:', error)
    throw error
  }

  return results
}

async function processVoteUpdate(supabase: any, newRecord: any, oldRecord: any) {
  console.log('Processing vote update:', { newRecord, oldRecord })
  
  // Handle vote type changes (user changing their vote)
  if (newRecord.vote_type !== oldRecord.vote_type) {
    // Reverse old vote and apply new vote
    await updateVoteCounts(supabase, newRecord.setlist_song_id, oldRecord.vote_type, true) // reverse
    await updateVoteCounts(supabase, newRecord.setlist_song_id, newRecord.vote_type, false) // apply
    
    // Broadcast the change
    await broadcastRealtimeUpdates(supabase, {
      type: 'vote_change',
      setlist_song_id: newRecord.setlist_song_id,
      old_vote: oldRecord.vote_type,
      new_vote: newRecord.vote_type,
      timestamp: new Date().toISOString()
    })
  }

  return { processed: true, type: 'vote_change' }
}

async function processVoteDelete(supabase: any, deletedRecord: any) {
  console.log('Processing vote deletion:', deletedRecord)
  
  // Reverse the vote count
  await updateVoteCounts(supabase, deletedRecord.setlist_song_id, deletedRecord.vote_type, true)
  
  // Broadcast the deletion
  await broadcastRealtimeUpdates(supabase, {
    type: 'vote_removed',
    setlist_song_id: deletedRecord.setlist_song_id,
    removed_vote: deletedRecord.vote_type,
    timestamp: new Date().toISOString()
  })

  return { processed: true, type: 'vote_removal' }
}

async function updateVoteCounts(supabase: any, setlistSongId: string, voteType: string, reverse: boolean = false) {
  const modifier = reverse ? -1 : 1
  const field = voteType === 'up' ? 'upvotes' : 'downvotes'
  
  const { error } = await supabase.rpc('increment_vote_count', {
    setlist_song_id: setlistSongId,
    vote_field: field,
    increment_value: modifier
  })

  if (error) {
    throw new Error(`Failed to update vote counts: ${error.message}`)
  }
}

async function calculateVoteVelocity(supabase: any, setlistSongId: string): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  
  const { count, error } = await supabase
    .from('votes')
    .select('*', { count: 'exact' })
    .eq('setlist_song_id', setlistSongId)
    .gte('created_at', fiveMinutesAgo)

  if (error) {
    console.error('Error calculating vote velocity:', error)
    return 0
  }

  return (count || 0) / 5 // votes per minute
}

async function checkVoteAlerts(supabase: any, voteRecord: any, setlistSong: any, voteVelocity: number): Promise<string[]> {
  const alerts: string[] = []

  // High vote velocity alert
  if (voteVelocity > config.alertThresholds.highVoteVelocity) {
    alerts.push(`High vote velocity detected: ${voteVelocity} votes/minute`)
    
    // Log alert
    await supabase
      .from('system_alerts')
      .insert({
        type: 'high_vote_velocity',
        entity_id: setlistSong.id,
        entity_type: 'setlist_song',
        message: `High vote velocity: ${voteVelocity} votes/minute`,
        metadata: { vote_velocity: voteVelocity, show_id: setlistSong.setlist.show.id }
      })
  }

  // Negative ratio alert
  const totalVotes = setlistSong.upvotes + setlistSong.downvotes
  if (totalVotes > 10) { // Only check if significant votes
    const negativeRatio = setlistSong.downvotes / totalVotes
    if (negativeRatio > config.alertThresholds.negativeRatio) {
      alerts.push(`High negative vote ratio: ${Math.round(negativeRatio * 100)}%`)
    }
  }

  // Check for suspicious voting patterns (same user/IP voting multiple times rapidly)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { count: recentVotes } = await supabase
    .from('votes')
    .select('*', { count: 'exact' })
    .eq('user_id', voteRecord.user_id)
    .eq('setlist_song_id', voteRecord.setlist_song_id)
    .gte('created_at', oneMinuteAgo)

  if ((recentVotes || 0) > config.alertThresholds.suspiciousVoting) {
    alerts.push('Suspicious voting pattern detected')
  }

  return alerts
}

async function shouldUpdateTrendingMetrics(supabase: any, setlistSongId: string): Promise<boolean> {
  // Update trends every X votes
  const { data: lastUpdate } = await supabase
    .from('trending_metrics')
    .select('last_updated, vote_count')
    .eq('setlist_song_id', setlistSongId)
    .single()

  if (!lastUpdate) return true // First time

  const { count: currentVotes } = await supabase
    .from('votes')
    .select('*', { count: 'exact' })
    .eq('setlist_song_id', setlistSongId)

  return (currentVotes || 0) - (lastUpdate.vote_count || 0) >= config.trendsUpdateThreshold
}

async function updateTrendingMetrics(supabase: any, setlistSong: any) {
  // Calculate trending score based on vote velocity, recency, and total engagement
  const voteVelocity = await calculateVoteVelocity(supabase, setlistSong.id)
  const totalVotes = setlistSong.upvotes + setlistSong.downvotes
  const positiveRatio = totalVotes > 0 ? setlistSong.upvotes / totalVotes : 0.5
  
  const trendingScore = (voteVelocity * 0.4) + (totalVotes * 0.3) + (positiveRatio * 0.3)

  const { error } = await supabase
    .from('trending_metrics')
    .upsert({
      setlist_song_id: setlistSong.id,
      show_id: setlistSong.setlist.show.id,
      trending_score: trendingScore,
      vote_velocity: voteVelocity,
      total_votes: totalVotes,
      positive_ratio: positiveRatio,
      last_updated: new Date().toISOString(),
      vote_count: totalVotes
    })

  if (error) {
    console.error('Error updating trending metrics:', error)
  }
}

async function broadcastRealtimeUpdates(supabase: any, payload: any) {
  try {
    await supabase
      .channel('vote_updates')
      .send({
        type: 'broadcast',
        event: 'vote_update',
        payload
      })
  } catch (error) {
    console.error('Error broadcasting realtime updates:', error)
  }
}

async function logAnalyticsEvent(supabase: any, event: any) {
  try {
    await supabase
      .from('analytics_events')
      .insert({
        type: event.type,
        user_id: event.user_id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        timestamp: new Date().toISOString()
      })
  } catch (error) {
    console.error('Error logging analytics event:', error)
  }
}