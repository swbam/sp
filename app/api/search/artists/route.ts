import { NextRequest, NextResponse } from 'next/server';
import { searchArtists } from '@/libs/ticketmaster';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { advancedCaching } from '@/libs/advanced-caching';
import { retryManager } from '@/libs/circuit-breaker';

// Force edge runtime for maximum performance
export const runtime = 'edge';

// Response compression and caching headers
const CACHE_CONFIG = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=900',
  'Content-Encoding': 'gzip',
  'X-Content-Type-Options': 'nosniff'
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Input validation schema
interface SearchValidation {
  query: string;
  limit: number;
  similarity_threshold: number;
  use_trigram: boolean;
  include_external: boolean;
}

function validateSearchInput(request: NextRequest): SearchValidation {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '20');
  const similarity_threshold = parseFloat(searchParams.get('similarity') || '0.3');
  const use_trigram = searchParams.get('trigram') !== 'false';
  const include_external = searchParams.get('external') !== 'false';

  // Validate query
  if (!query || query.trim().length === 0) {
    throw new Error('Valid search query is required');
  }

  if (query.length > 100) {
    throw new Error('Search query too long (max 100 characters)');
  }

  // Validate limit
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  // Validate similarity threshold
  if (similarity_threshold < 0.1 || similarity_threshold > 1.0) {
    throw new Error('Similarity threshold must be between 0.1 and 1.0');
  }

  return {
    query: query.trim(),
    limit,
    similarity_threshold,
    use_trigram,
    include_external
  };
}

async function searchDatabaseArtists(
  supabase: any,
  query: string,
  limit: number,
  similarity_threshold: number,
  use_trigram: boolean
): Promise<any[]> {
  const cacheKey = `search:artists:${query}:${limit}:${similarity_threshold}:${use_trigram}`;
  
  return await advancedCaching.get(
    cacheKey,
    async () => {
      const startTime = performance.now();
      
      try {
        let dbArtists;
        
        if (use_trigram) {
          // Use optimized trigram search function
          const { data, error } = await supabase.rpc('search_artists_trigram', {
            search_query: query,
            similarity_threshold,
            limit_count: limit
          });
          
          if (error) throw error;
          dbArtists = data;
        } else {
          // Fallback to basic search
          const { data, error } = await supabase
            .from('artists')
            .select(`
              id,
              name,
              slug,
              image_url,
              genres,
              followers,
              verified,
              created_at,
              updated_at
            `)
            .or(`name.ilike.%${query}%,genres.cs.["${query}"]`)
            .order('followers', { ascending: false })
            .limit(limit);
          
          if (error) throw error;
          dbArtists = data;
        }
        
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        // Log search performance
        await supabase.rpc('log_search_performance', {
          query,
          search_type: 'artists',
          user_id: null, // Will be set by middleware if authenticated
          results_count: dbArtists?.length || 0,
          response_time_ms: responseTime
        }).catch(() => {}); // Ignore logging errors
        
        return dbArtists || [];
      } catch (error) {
        console.error('Database search error:', error);
        throw error;
      }
    },
    {
      ttl: 300000, // 5 minutes
      priority: 'high',
      tags: ['search', 'artists'],
      compressed: true
    }
  );
}

async function searchExternalArtists(
  query: string,
  limit: number,
  existingArtists: any[]
): Promise<any[]> {
  const cacheKey = `external:artists:${query}:${limit}`;
  
  return await advancedCaching.get(
    cacheKey,
    async () => {
      return await retryManager.executeWithRetry(
        async () => {
          const ticketmasterArtists = await searchArtists(query);
          
          // Convert Ticketmaster results to our Artist format
          const convertedArtists = ticketmasterArtists.map(tmArtist => ({
            id: tmArtist.id,
            name: tmArtist.name,
            slug: tmArtist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            image_url: tmArtist.images?.[0]?.url || null,
            genres: tmArtist.genres || [],
            followers: 0,
            verified: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            external: true // Mark as external result
          }));
          
          // Filter out duplicates
          return convertedArtists.filter(ta => 
            !existingArtists.some(da => 
              da.name.toLowerCase() === ta.name.toLowerCase()
            )
          );
        },
        3, // max retries
        1000, // base delay
        2, // backoff multiplier
        true // jitter
      );
    },
    {
      ttl: 600000, // 10 minutes for external data
      priority: 'medium',
      tags: ['search', 'external', 'ticketmaster'],
      compressed: true
    }
  );
}

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Validate input
    const validation = validateSearchInput(request);
    const { query, limit, similarity_threshold, use_trigram, include_external } = validation;
    
    // Security: Rate limiting would be handled by middleware
    
    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Search database first
    const dbArtists = await searchDatabaseArtists(
      supabase,
      query,
      Math.floor(limit * 0.7), // Reserve 30% for external results
      similarity_threshold,
      use_trigram
    );
    
    let allArtists = dbArtists;
    
    // Search external APIs if enabled and we have capacity
    if (include_external && dbArtists.length < limit) {
      try {
        const externalArtists = await searchExternalArtists(
          query,
          limit - dbArtists.length,
          dbArtists
        );
        
        allArtists = [...dbArtists, ...externalArtists];
      } catch (error) {
        console.error('External search error:', error);
        // Continue with database results only
      }
    }
    
    // Limit final results
    const finalResults = allArtists.slice(0, limit);
    
    // Calculate response time
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    
    // Build response with metadata
    const response = {
      query,
      results: finalResults,
      total_count: finalResults.length,
      response_time_ms: responseTime,
      search_metadata: {
        used_trigram: use_trigram,
        included_external: include_external,
        similarity_threshold,
        database_results: dbArtists.length,
        external_results: finalResults.length - dbArtists.length
      }
    };
    
    // Return response with performance headers
    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...CACHE_CONFIG,
        'X-Response-Time': `${responseTime}ms`,
        'X-Search-Results': finalResults.length.toString(),
        'X-Search-Type': use_trigram ? 'trigram' : 'basic'
      }
    });
    
  } catch (error) {
    console.error('Search API error:', error);
    
    // Return structured error response
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to search for artists',
        query: request.nextUrl.searchParams.get('q'),
        response_time_ms: Math.round(performance.now() - startTime)
      },
      { 
        status: error instanceof Error && error.message.includes('required') ? 400 : 500,
        headers: {
          'X-Error': 'search-failed',
          'X-Response-Time': `${Math.round(performance.now() - startTime)}ms`
        }
      }
    );
  }
} 