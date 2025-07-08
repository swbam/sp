class TicketmasterAPI {
  private apiKey: string;
  private baseUrl = 'https://app.ticketmaster.com/discovery/v2';

  constructor() {
    this.apiKey = process.env.TICKETMASTER_API_KEY!;
    
    if (!this.apiKey) {
      throw new Error('Ticketmaster API key is required');
    }
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}) {
    const searchParams = new URLSearchParams({
      apikey: this.apiKey,
      ...params
    });

    const response = await fetch(`${this.baseUrl}${endpoint}?${searchParams}`);

    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.statusText}`);
    }

    return response.json();
  }

  async searchEvents(options: {
    keyword?: string;
    city?: string;
    stateCode?: string;
    countryCode?: string;
    startDateTime?: string;
    endDateTime?: string;
    size?: number;
    page?: number;
    classificationName?: string;
  } = {}) {
    const params: Record<string, string> = {
      size: (options.size || 200).toString(),
      page: (options.page || 0).toString(),
    };

    if (options.keyword) params.keyword = options.keyword;
    if (options.city) params.city = options.city;
    if (options.stateCode) params.stateCode = options.stateCode;
    if (options.countryCode) params.countryCode = options.countryCode;
    if (options.startDateTime) params.startDateTime = options.startDateTime;
    if (options.endDateTime) params.endDateTime = options.endDateTime;
    if (options.classificationName) params.classificationName = options.classificationName;

    return this.makeRequest('/events.json', params);
  }

  async getMusicEvents(options: {
    city?: string;
    stateCode?: string;
    countryCode?: string;
    startDate?: string;
    size?: number;
  } = {}) {
    return this.searchEvents({
      ...options,
      classificationName: 'Music',
      startDateTime: options.startDate || new Date().toISOString(),
    });
  }

  async getEvent(eventId: string) {
    return this.makeRequest(`/events/${eventId}.json`);
  }

  async searchVenues(options: {
    keyword?: string;
    city?: string;
    stateCode?: string;
    countryCode?: string;
    size?: number;
  } = {}) {
    const params: Record<string, string> = {
      size: (options.size || 20).toString(),
    };

    if (options.keyword) params.keyword = options.keyword;
    if (options.city) params.city = options.city;
    if (options.stateCode) params.stateCode = options.stateCode;
    if (options.countryCode) params.countryCode = options.countryCode;

    return this.makeRequest('/venues.json', params);
  }

  async getVenue(venueId: string) {
    return this.makeRequest(`/venues/${venueId}.json`);
  }

  // Transform Ticketmaster event data to our database format
  transformEventForDB(tmEvent: any) {
    const venue = tmEvent._embedded?.venues?.[0];
    const artist = tmEvent._embedded?.attractions?.[0];
    
    return {
      ticketmaster_id: tmEvent.id,
      name: tmEvent.name,
      date: tmEvent.dates?.start?.localDate,
      start_time: tmEvent.dates?.start?.localTime,
      status: this.mapEventStatus(tmEvent.dates?.status?.code),
      ticket_url: tmEvent.url,
      min_price: tmEvent.priceRanges?.[0]?.min,
      max_price: tmEvent.priceRanges?.[0]?.max,
      artist_name: artist?.name,
      venue_data: venue ? this.transformVenueForDB(venue) : null,
    };
  }

  // Transform Ticketmaster venue data to our database format
  transformVenueForDB(tmVenue: any) {
    const address = tmVenue.address || {};
    const city = tmVenue.city || {};
    const state = tmVenue.state || {};
    const country = tmVenue.country || {};

    return {
      ticketmaster_id: tmVenue.id,
      name: tmVenue.name,
      slug: this.createSlug(tmVenue.name),
      city: city.name || address.line1 || 'Unknown',
      state: state.stateCode || state.name,
      country: country.countryCode || country.name || 'Unknown',
      capacity: tmVenue.capacity,
      timezone: tmVenue.timezone,
    };
  }

  private mapEventStatus(statusCode: string): 'upcoming' | 'ongoing' | 'completed' | 'cancelled' {
    switch (statusCode) {
      case 'onsale':
      case 'offsale':
        return 'upcoming';
      case 'cancelled':
      case 'postponed':
        return 'cancelled';
      default:
        return 'upcoming';
    }
  }

  private createSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export const ticketmasterAPI = new TicketmasterAPI(); 