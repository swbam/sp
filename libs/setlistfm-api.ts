class SetlistFMAPI {
  private apiKey: string;
  private baseUrl = 'https://api.setlist.fm/rest/1.0';

  constructor() {
    this.apiKey = process.env.SETLISTFM_API_KEY!;
    
    if (!this.apiKey) {
      throw new Error('Setlist.fm API key is required');
    }
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': this.apiKey,
        'User-Agent': 'MySetlist/1.0.0 (https://mysetlist.app)'
      }
    });

    if (!response.ok) {
      throw new Error(`Setlist.fm API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async searchArtist(artistName: string): Promise<any> {
    const encodedName = encodeURIComponent(artistName);
    return this.makeRequest(`/search/artists?artistName=${encodedName}&p=1&sort=relevance`);
  }

  async getArtistSetlists(artistMbid: string, page: number = 1): Promise<any> {
    return this.makeRequest(`/artist/${artistMbid}/setlists?p=${page}`);
  }

  async getSetlist(setlistId: string): Promise<any> {
    return this.makeRequest(`/setlist/${setlistId}`);
  }

  async searchSetlists(options: {
    artistName?: string;
    cityName?: string;
    venueName?: string;
    year?: number;
    page?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.artistName) params.append('artistName', options.artistName);
    if (options.cityName) params.append('cityName', options.cityName);
    if (options.venueName) params.append('venueName', options.venueName);
    if (options.year) params.append('year', options.year.toString());
    params.append('p', (options.page || 1).toString());

    return this.makeRequest(`/search/setlists?${params.toString()}`);
  }

  async getVenue(venueId: string): Promise<any> {
    return this.makeRequest(`/venue/${venueId}`);
  }

  // Transform Setlist.fm data to our database format
  transformSetlistForDB(setlistData: any): any {
    const sets = setlistData.sets?.set || [];
    const songs = sets.flatMap((set: any, setIndex: number) => 
      (set.song || []).map((song: any, songIndex: number) => ({
        title: song.name,
        position: (setIndex * 20) + songIndex + 1, // Simple positioning
        notes: song.info || null,
        is_played: true
      }))
    );

    return {
      external_id: setlistData.id,
      imported_from: 'setlist.fm',
      songs,
      venue_name: setlistData.venue?.name,
      event_date: setlistData.eventDate,
      artist_name: setlistData.artist?.name
    };
  }

  // Get recent setlists for an artist
  async getRecentSetlists(artistName: string, limit: number = 5): Promise<any[]> {
    try {
      const artistSearch = await this.searchArtist(artistName);
      
      if (artistSearch.artist && artistSearch.artist.length > 0) {
        const artist = artistSearch.artist[0];
        const setlists = await this.getArtistSetlists(artist.mbid);
        
        return setlists.setlist?.slice(0, limit) || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching recent setlists:', error);
      return [];
    }
  }
}

export const setlistfmAPI = new SetlistFMAPI();
export default SetlistFMAPI; 