// Re-export optimized functions for backward compatibility
export { 
  searchArtistsOptimized as searchArtists,
  searchEventsOptimized as searchEvents,
  ticketmasterClient,
  type TicketmasterArtist,
  type TicketmasterEvent,
  checkExternalAPIHealth,
  getAPIStats,
  clearExternalAPICache,
  warmupExternalAPICache
} from './external-api-optimizer';

// Legacy function for backward compatibility
export async function searchArtistsLegacy(query: string): Promise<TicketmasterArtist[]> {
  const { searchArtistsOptimized } = await import('./external-api-optimizer');
  return searchArtistsOptimized(query);
}

// Enhanced search with better defaults
export async function searchArtistsEnhanced(
  query: string,
  options: {
    limit?: number;
    includeSpotify?: boolean;
    countryCode?: string;
  } = {}
): Promise<TicketmasterArtist[]> {
  const { searchArtistsOptimized } = await import('./external-api-optimizer');
  
  return searchArtistsOptimized(query, {
    limit: options.limit || 20,
    includeSpotify: options.includeSpotify || false,
    countryCode: options.countryCode || 'US'
  });
}

// Types for backward compatibility
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
  followers?: number;
  popularity?: number;
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
    venues?: Array<any>;
    attractions?: TicketmasterArtist[];
  };
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
} 