import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { 
  createEdgeAPIRoute,
  dynamicDataFetcher,
  EDGE_ROUTE_CONFIGS,
  edgePerformanceMonitor
} from '@/libs/edge-optimization';
import { showApiMiddleware, isValidUUID } from '@/libs/auth-middleware';

// Force edge runtime for maximum performance
export const runtime = 'edge';

// Optimized GET handler using edge optimization
const getShowHandler = createEdgeAPIRoute(
  async (request: NextRequest) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const showId = pathParts[pathParts.length - 1];

    // Apply middleware for UUID validation and optional auth
    const middlewareResponse = await showApiMiddleware(request);
    if (middlewareResponse) {
      throw new Error('Middleware validation failed');
    }

    // Validate UUID format (redundant check, but good for safety)
    if (!isValidUUID(showId)) {
      throw new Error('Invalid show ID format');
    }

    // Use edge data fetcher with ISR caching
    const result = await dynamicDataFetcher.fetch(
      `show:${showId}`,
      async () => {
        const supabase = createRouteHandlerClient({ cookies });

        // Get show with full details including setlists
        const { data: show, error } = await supabase
          .from('shows')
          .select(`
            id,
            name,
            date,
            start_time,
            status,
            ticket_url,
            created_at,
            updated_at,
            artist:artists (
              id,
              name,
              slug,
              image_url,
              genres,
              followers,
              verified
            ),
            venue:venues (
              id,
              name,
              slug,
              city,
              state,
              country,
              capacity
            ),
            setlists (
              id,
              type,
              is_locked,
              created_at,
              setlist_songs (
                id,
                position,
                upvotes,
                downvotes,
                song:songs (
                  id,
                  title,
                  artist_name,
                  spotify_id
                )
              )
            )
          `)
          .eq('id', showId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            const notFoundError = new Error('Show not found');
            (notFoundError as any).status = 404;
            throw notFoundError;
          }
          console.error('Show fetch error:', error);
          throw error;
        }

        // Sort setlist songs by position
        if (show.setlists) {
          show.setlists = show.setlists.map(setlist => ({
            ...setlist,
            setlist_songs: setlist.setlist_songs?.sort((a, b) => a.position - b.position) || []
          }));
        }

        return { show };
      },
      {
        revalidate: 300, // 5 minutes
        tags: ['shows', `show:${showId}`],
        maxAge: 300,
        staleWhileRevalidate: 900
      }
    );

    // Record performance metrics
    edgePerformanceMonitor.recordRequest(
      `shows/${showId}`,
      0, // Will be calculated by the wrapper
      false,
      result.cached
    );

    return result.data;
  },
  {
    ...EDGE_ROUTE_CONFIGS.DYNAMIC,
    validation: async (request: NextRequest) => {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const showId = pathParts[pathParts.length - 1];
      return isValidUUID(showId);
    }
  }
);

export const GET = getShowHandler;

// Optimized PATCH handler using edge optimization
const patchShowHandler = createEdgeAPIRoute(
  async (request: NextRequest) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const showId = pathParts[pathParts.length - 1];

    // Apply middleware for UUID validation and authentication
    const middlewareResponse = await showApiMiddleware(request);
    if (middlewareResponse) {
      throw new Error('Middleware validation failed');
    }

    // Get auth context from middleware
    const authContextHeader = request.headers.get('X-Auth-Context');
    const authContext = authContextHeader ? JSON.parse(authContextHeader) : null;
    
    if (!authContext?.isAuthenticated) {
      const authError = new Error('Authentication required');
      (authError as any).status = 401;
      throw authError;
    }

    // Parse request body
    let updateData;
    try {
      updateData = await request.json();
    } catch (error) {
      const parseError = new Error('Invalid request body');
      (parseError as any).status = 400;
      throw parseError;
    }

    // Validate update data (basic validation)
    if (!updateData || typeof updateData !== 'object') {
      const validationError = new Error('Invalid update data');
      (validationError as any).status = 400;
      throw validationError;
    }

    // Perform the update
    const supabase = createRouteHandlerClient({ cookies });

    const { data: show, error } = await supabase
      .from('shows')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', showId)
      .select(`
        id,
        name,
        date,
        start_time,
        status,
        ticket_url,
        created_at,
        updated_at,
        artist:artists (
          id,
          name,
          slug,
          image_url,
          verified
        ),
        venue:venues (
          id,
          name,
          city,
          state,
          country
        )
      `)
      .single();

    if (error) {
      console.error('Show update error:', error);
      throw error;
    }

    // Invalidate cache after successful update
    await dynamicDataFetcher.invalidateByTags([`show:${showId}`, 'shows']);

    return { show };
  },
  {
    ...EDGE_ROUTE_CONFIGS.USER_SPECIFIC, // Don't cache user-specific operations
    validation: async (request: NextRequest) => {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const showId = pathParts[pathParts.length - 1];
      return isValidUUID(showId);
    }
  }
);

export const PATCH = patchShowHandler;