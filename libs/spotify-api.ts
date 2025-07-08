export const runtime = 'nodejs';

class SpotifyAPI {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID!;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Spotify API credentials are required');
    }
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`Failed to get Spotify access token: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute early

    return this.accessToken!;
  }

  private async makeRequest(endpoint: string) {
    const token = await this.getAccessToken();
    
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.statusText}`);
    }

    return response.json();
  }

  async searchArtists(query: string, limit = 20) {
    const data = await this.makeRequest(`/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`);
    return data.artists.items;
  }

  async getArtist(artistId: string) {
    return this.makeRequest(`/artists/${artistId}`);
  }

  async getArtistTopTracks(artistId: string, market = 'US') {
    const data = await this.makeRequest(`/artists/${artistId}/top-tracks?market=${market}`);
    return data.tracks;
  }

  async getArtistAlbums(artistId: string, limit = 20) {
    const data = await this.makeRequest(`/artists/${artistId}/albums?limit=${limit}&include_groups=album,single`);
    return data.items;
  }

  async getAlbumTracks(albumId: string) {
    const data = await this.makeRequest(`/albums/${albumId}/tracks`);
    return data.items;
  }

  async searchTracks(query: string, artist?: string, limit = 20) {
    let searchQuery = query;
    if (artist) {
      searchQuery = `track:"${query}" artist:"${artist}"`;
    }
    
    const data = await this.makeRequest(`/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit}`);
    return data.tracks.items;
  }

  async getPopularArtists(genre?: string) {
    // Get featured playlists to find popular artists
    const data = await this.makeRequest('/browse/featured-playlists?limit=20');
    const playlistIds = data.playlists.items.map((p: any) => p.id);
    
    // For now, search for popular artists by genre or general terms
    const searchTerms = genre ? [genre] : ['pop', 'rock', 'hip hop', 'electronic', 'indie'];
    const allArtists = [];
    
    for (const term of searchTerms.slice(0, 3)) { // Limit to avoid rate limits
      const artists = await this.searchArtists(term, 10);
      allArtists.push(...artists);
    }
    
    // Remove duplicates and sort by popularity
    const uniqueArtists = allArtists.filter((artist, index, self) => 
      index === self.findIndex(a => a.id === artist.id)
    );
    
    return uniqueArtists.sort((a, b) => b.popularity - a.popularity);
  }

  // Convert Spotify artist data to our database format
  transformArtistForDB(spotifyArtist: any) {
    return {
      spotify_id: spotifyArtist.id,
      name: spotifyArtist.name,
      slug: this.createSlug(spotifyArtist.name),
      image_url: spotifyArtist.images?.[0]?.url || null,
      genres: spotifyArtist.genres || [],
      followers: spotifyArtist.followers?.total || 0,
      verified: spotifyArtist.followers?.total > 100000, // Consider artists with 100k+ followers as verified
    };
  }

  // Convert Spotify track data to our database format
  transformTrackForDB(spotifyTrack: any) {
    return {
      spotify_id: spotifyTrack.id,
      title: spotifyTrack.name,
      artist_name: spotifyTrack.artists?.[0]?.name || 'Unknown Artist',
    };
  }

  private createSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export const spotifyAPI = new SpotifyAPI(); 