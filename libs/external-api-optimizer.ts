/**
 * External API Optimization Layer
 * Advanced caching, circuit breakers, and retry mechanisms for Ticketmaster & Spotify APIs
 */

import { CircuitBreaker, RetryManager } from './circuit-breaker';
import { advancedCaching } from './advanced-caching';

// API Configuration
export interface APIConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  circuitBreakerConfig: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringWindow: number;
    halfOpenMaxCalls: number;
    errorTypes: string[];
  };
  rateLimitConfig: {
    requestsPerSecond: number;
    burstLimit: number;
  };
}

// Ticketmaster API Configuration
const TICKETMASTER_CONFIG: APIConfig = {
  baseUrl: 'https://app.ticketmaster.com/discovery/v2',
  apiKey: process.env.TICKETMASTER_API_KEY || '',
  timeout: 5000,
  retryAttempts: 3,
  retryDelay: 1000,
  circuitBreakerConfig: {
    failureThreshold: 5,
    resetTimeout: 30000,
    monitoringWindow: 60000,
    halfOpenMaxCalls: 3,
    errorTypes: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '429', '500', '502', '503', '504']
  },
  rateLimitConfig: {
    requestsPerSecond: 5,
    burstLimit: 10
  }
};

// Spotify API Configuration
const SPOTIFY_CONFIG: APIConfig = {
  baseUrl: 'https://api.spotify.com/v1',
  apiKey: process.env.SPOTIFY_CLIENT_ID || '',
  timeout: 3000,
  retryAttempts: 2,
  retryDelay: 500,
  circuitBreakerConfig: {
    failureThreshold: 3,
    resetTimeout: 15000,
    monitoringWindow: 60000,
    halfOpenMaxCalls: 2,
    errorTypes: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '429', '500', '502', '503']
  },
  rateLimitConfig: {
    requestsPerSecond: 10,
    burstLimit: 20
  }
};

// Rate Limiter Implementation
class RateLimiter {
  private requests: number[] = [];
  private lastBurst: number = 0;
  private burstCount: number = 0;

  constructor(
    private requestsPerSecond: number,
    private burstLimit: number
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    
    // Clean up old requests (older than 1 second)
    this.requests = this.requests.filter(timestamp => now - timestamp < 1000);
    
    // Check burst limit
    if (now - this.lastBurst > 1000) {
      this.burstCount = 0;
      this.lastBurst = now;
    }
    
    // Check if we can make a request
    if (this.requests.length >= this.requestsPerSecond || this.burstCount >= this.burstLimit) {
      // Calculate delay needed
      const oldestRequest = this.requests[0];
      const delay = oldestRequest ? (oldestRequest + 1000) - now : 100;
      
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.acquire(); // Retry after delay
      }
    }
    
    // Add request timestamp
    this.requests.push(now);
    this.burstCount++;
  }
}

// Enhanced HTTP Client with Circuit Breaker and Retry
class EnhancedHTTPClient {
  private circuitBreaker: CircuitBreaker;
  private retryManager: RetryManager;
  private rateLimiter: RateLimiter;

  constructor(
    private name: string,
    private config: APIConfig
  ) {
    this.circuitBreaker = new CircuitBreaker(name, config.circuitBreakerConfig);
    this.retryManager = new RetryManager();
    this.rateLimiter = new RateLimiter(
      config.rateLimitConfig.requestsPerSecond,
      config.rateLimitConfig.burstLimit
    );
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    cacheOptions?: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<T> {
    const cacheKey = `${this.name}:${endpoint}:${JSON.stringify(options)}`;
    
    // Try cache first if caching is enabled
    if (cacheOptions) {
      const cached = await advancedCaching.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Execute with rate limiting, circuit breaker, and retry
    const result = await this.circuitBreaker.execute(async () => {
      return await this.retryManager.executeWithRetry(
        async () => {
          // Apply rate limiting
          await this.rateLimiter.acquire();
          
          // Build URL
          const url = endpoint.startsWith('http') ? endpoint : `${this.config.baseUrl}${endpoint}`;
          
          // Build request options
          const requestOptions: RequestInit = {
            method: 'GET',
            headers: {
              'User-Agent': 'MySetlist/1.0',
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...options.headers
            },
            ...options,
            signal: AbortSignal.timeout(this.config.timeout)
          };

          // Add API key based on service
          if (this.name === 'ticketmaster') {
            const url_with_key = new URL(url);
            url_with_key.searchParams.set('apikey', this.config.apiKey);
            
            const response = await fetch(url_with_key.toString(), requestOptions);
            
            if (!response.ok) {
              throw new Error(`${this.name} API error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
          } else if (this.name === 'spotify') {
            // Spotify uses Bearer token authentication
            const token = await this.getSpotifyToken();
            requestOptions.headers = {
              ...requestOptions.headers,
              'Authorization': `Bearer ${token}`
            };
            
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
              throw new Error(`${this.name} API error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
          }
          
          throw new Error(`Unknown service: ${this.name}`);
        },
        this.config.retryAttempts,
        this.config.retryDelay,
        2, // backoff multiplier
        true // jitter
      );
    });

    // Cache result if caching is enabled
    if (cacheOptions) {
      await advancedCaching.set(cacheKey, result, cacheOptions);
    }

    return result;
  }

  private async getSpotifyToken(): Promise<string> {
    const tokenCacheKey = 'spotify:access_token';
    
    return await advancedCaching.get(
      tokenCacheKey,
      async () => {
        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${this.config.apiKey}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`
          },
          body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
          throw new Error(`Spotify token error: ${response.status}`);
        }

        const data = await response.json();
        return data.access_token;
      },
      {
        ttl: 3300000, // 55 minutes (tokens expire in 1 hour)
        priority: 'critical',
        tags: ['spotify', 'auth']
      }
    );
  }

  getStats() {
    return {
      circuitBreaker: this.circuitBreaker.getStats(),
      name: this.name,
      config: this.config
    };
  }
}

// Initialize HTTP clients
export const ticketmasterClient = new EnhancedHTTPClient('ticketmaster', TICKETMASTER_CONFIG);
export const spotifyClient = new EnhancedHTTPClient('spotify', SPOTIFY_CONFIG);

// Enhanced Ticketmaster API Functions
export interface TicketmasterArtist {
  id: string;
  name: string;
  images: Array<{
    url: string;
    ratio: string;
    width: number;
    height: number;
  }>;
  genres: string[];
  url: string;
  externalLinks?: {
    spotify?: string;
    musicbrainz?: string;
    homepage?: string;
  };
}

export interface TicketmasterEvent {
  id: string;
  name: string;
  type: string;
  url: string;
  locale: string;
  images: Array<{
    url: string;
    ratio: string;
    width: number;
    height: number;
  }>;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
      dateTime?: string;
    };
    status: {
      code: string;
    };
  };
  _embedded?: {
    venues?: Array<{
      id: string;
      name: string;
      type: string;
      url: string;
      locale: string;
      images: Array<{
        url: string;
        ratio: string;
        width: number;
        height: number;
      }>;
      city: {
        name: string;
      };
      state?: {
        name: string;
        stateCode: string;
      };
      country: {
        name: string;
        countryCode: string;
      };
      address: {
        line1: string;
        line2?: string;
      };
      location: {
        longitude: string;
        latitude: string;
      };
      markets: Array<{
        name: string;
        id: string;
      }>;
      dmas: Array<{
        id: number;
      }>;
      timezone: string;
      accessibleSeatingDetail?: string;
      generalInfo?: {
        generalRule?: string;
        childRule?: string;
      };
      upcomingEvents: {
        ticketmaster: number;
        _total: number;
        _filtered: number;
      };
      _links: {
        self: {
          href: string;
        };
      };
    }>;
    attractions?: TicketmasterArtist[];
  };
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
  seatmap?: {
    staticUrl: string;
  };
  accessibility?: {
    ticketLimit?: number;
    info?: string;
  };
  ticketLimit?: {
    info?: string;
  };
  ageRestrictions?: {
    legalAgeEnforced?: boolean;
    childRule?: string;
  };
  ticketing?: {
    safeTix?: {
      enabled?: boolean;
    };
  };
  _links: {
    self: {
      href: string;
    };
    attractions?: Array<{
      href: string;
    }>;
    venues?: Array<{
      href: string;
    }>;
  };
}

export async function searchArtistsOptimized(
  query: string,
  options: {
    limit?: number;
    page?: number;
    countryCode?: string;
    includeSpotify?: boolean;
  } = {}
): Promise<TicketmasterArtist[]> {
  const { limit = 20, page = 0, countryCode = 'US', includeSpotify = false } = options;
  
  if (!query.trim()) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      keyword: query,
      classificationName: 'music',
      size: limit.toString(),
      page: page.toString(),
      countryCode,
      sort: 'relevance,desc'
    });

    const response = await ticketmasterClient.request<any>(
      `/attractions.json?${params.toString()}`,
      {},
      {
        ttl: 300000, // 5 minutes
        priority: 'high',
        tags: ['ticketmaster', 'artists', 'search']
      }
    );

    if (!response._embedded?.attractions) {
      return [];
    }

    let artists: TicketmasterArtist[] = response._embedded.attractions.map((attraction: any) => ({
      id: attraction.id,
      name: attraction.name,
      images: attraction.images || [],
      genres: attraction.classifications?.[0]?.genre?.name 
        ? [attraction.classifications[0].genre.name]
        : [],
      url: attraction.url,
      externalLinks: attraction.externalLinks || {}
    }));

    // Optionally enhance with Spotify data
    if (includeSpotify) {
      artists = await enhanceArtistsWithSpotifyData(artists);
    }

    return artists;
  } catch (error) {
    console.error('Ticketmaster search error:', error);
    return [];
  }
}

export async function searchEventsOptimized(
  artistId: string,
  options: {
    limit?: number;
    page?: number;
    countryCode?: string;
    startDateTime?: string;
    endDateTime?: string;
  } = {}
): Promise<TicketmasterEvent[]> {
  const { limit = 50, page = 0, countryCode = 'US', startDateTime, endDateTime } = options;

  try {
    const params = new URLSearchParams({
      attractionId: artistId,
      size: limit.toString(),
      page: page.toString(),
      countryCode,
      sort: 'date,asc'
    });

    if (startDateTime) {
      params.set('startDateTime', startDateTime);
    }
    if (endDateTime) {
      params.set('endDateTime', endDateTime);
    }

    const response = await ticketmasterClient.request<any>(
      `/events.json?${params.toString()}`,
      {},
      {
        ttl: 600000, // 10 minutes
        priority: 'high',
        tags: ['ticketmaster', 'events', 'artist']
      }
    );

    if (!response._embedded?.events) {
      return [];
    }

    return response._embedded.events;
  } catch (error) {
    console.error('Ticketmaster events search error:', error);
    return [];
  }
}

// Enhanced Spotify API Functions
export interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  genres: string[];
  popularity: number;
  followers: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
    release_date: string;
  };
  popularity: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

export async function searchSpotifyArtists(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    market?: string;
  } = {}
): Promise<SpotifyArtist[]> {
  const { limit = 20, offset = 0, market = 'US' } = options;

  try {
    const params = new URLSearchParams({
      q: query,
      type: 'artist',
      limit: limit.toString(),
      offset: offset.toString(),
      market
    });

    const response = await spotifyClient.request<any>(
      `/search?${params.toString()}`,
      {},
      {
        ttl: 300000, // 5 minutes
        priority: 'high',
        tags: ['spotify', 'artists', 'search']
      }
    );

    return response.artists?.items || [];
  } catch (error) {
    console.error('Spotify search error:', error);
    return [];
  }
}

export async function getSpotifyArtistTopTracks(
  artistId: string,
  market: string = 'US'
): Promise<SpotifyTrack[]> {
  try {
    const response = await spotifyClient.request<any>(
      `/artists/${artistId}/top-tracks?market=${market}`,
      {},
      {
        ttl: 3600000, // 1 hour
        priority: 'medium',
        tags: ['spotify', 'tracks', 'artist']
      }
    );

    return response.tracks || [];
  } catch (error) {
    console.error('Spotify top tracks error:', error);
    return [];
  }
}

export async function getSpotifyArtistAlbums(
  artistId: string,
  options: {
    includeGroups?: string[];
    market?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  const { 
    includeGroups = ['album', 'single'], 
    market = 'US', 
    limit = 50, 
    offset = 0 
  } = options;

  try {
    const params = new URLSearchParams({
      include_groups: includeGroups.join(','),
      market,
      limit: limit.toString(),
      offset: offset.toString()
    });

    const response = await spotifyClient.request<any>(
      `/artists/${artistId}/albums?${params.toString()}`,
      {},
      {
        ttl: 1800000, // 30 minutes
        priority: 'medium',
        tags: ['spotify', 'albums', 'artist']
      }
    );

    return response.items || [];
  } catch (error) {
    console.error('Spotify albums error:', error);
    return [];
  }
}

// Cross-platform enhancement functions
async function enhanceArtistsWithSpotifyData(artists: TicketmasterArtist[]): Promise<TicketmasterArtist[]> {
  const enhancedArtists = await Promise.allSettled(
    artists.map(async (artist) => {
      try {
        const spotifyResults = await searchSpotifyArtists(artist.name, { limit: 1 });
        
        if (spotifyResults.length > 0) {
          const spotifyArtist = spotifyResults[0];
          
          return {
            ...artist,
            genres: [...new Set([...artist.genres, ...spotifyArtist.genres])],
            externalLinks: {
              ...artist.externalLinks,
              spotify: spotifyArtist.external_urls.spotify
            },
            followers: spotifyArtist.followers.total,
            popularity: spotifyArtist.popularity
          };
        }
        
        return artist;
      } catch (error) {
        console.error(`Error enhancing artist ${artist.name}:`, error);
        return artist;
      }
    })
  );

  return enhancedArtists
    .filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<TicketmasterArtist>).value);
}

// Health check functions
export async function checkExternalAPIHealth(): Promise<{
  ticketmaster: boolean;
  spotify: boolean;
  responseTime: {
    ticketmaster: number;
    spotify: number;
  };
}> {
  const healthCheck = {
    ticketmaster: false,
    spotify: false,
    responseTime: {
      ticketmaster: 0,
      spotify: 0
    }
  };

  // Check Ticketmaster
  try {
    const start = Date.now();
    await ticketmasterClient.request('/attractions.json?size=1', {}, { ttl: 0 });
    healthCheck.ticketmaster = true;
    healthCheck.responseTime.ticketmaster = Date.now() - start;
  } catch (error) {
    console.error('Ticketmaster health check failed:', error);
  }

  // Check Spotify
  try {
    const start = Date.now();
    await spotifyClient.request('/search?q=test&type=artist&limit=1', {}, { ttl: 0 });
    healthCheck.spotify = true;
    healthCheck.responseTime.spotify = Date.now() - start;
  } catch (error) {
    console.error('Spotify health check failed:', error);
  }

  return healthCheck;
}

// Export stats for monitoring
export function getAPIStats() {
  return {
    ticketmaster: ticketmasterClient.getStats(),
    spotify: spotifyClient.getStats()
  };
}

// Export cache management
export async function clearExternalAPICache() {
  await advancedCaching.clearByTags(['ticketmaster', 'spotify']);
}

export async function warmupExternalAPICache() {
  // Warmup common searches
  const commonSearches = ['taylor swift', 'drake', 'billie eilish', 'ed sheeran'];
  
  const warmupPromises = commonSearches.map(async (query) => {
    try {
      await searchArtistsOptimized(query, { limit: 5 });
      await searchSpotifyArtists(query, { limit: 5 });
    } catch (error) {
      console.error(`Warmup failed for ${query}:`, error);
    }
  });

  await Promise.allSettled(warmupPromises);
}