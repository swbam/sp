// MySetlist Type Definitions

export interface UserDetails {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Artist {
  id: string;
  spotify_id?: string;
  name: string;
  slug: string;
  image_url?: string;
  genres: string[];
  followers: number;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  city: string;
  state?: string;
  country: string;
  capacity?: number;
  created_at: string;
}

export interface Show {
  id: string;
  artist_id: string;
  venue_id: string;
  name: string;
  date: string;
  start_time?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  ticket_url?: string;
  created_at: string;
  updated_at: string;
  // Relations
  artist?: Artist;
  venue?: Venue;
}

export interface Song {
  id: string;
  title: string;
  artist_name: string;
  spotify_id?: string;
  created_at: string;
}

export interface Setlist {
  id: string;
  show_id: string;
  type: 'predicted' | 'actual';
  is_locked: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Relations
  show?: Show;
  songs?: SetlistSong[];
}

export interface SetlistSong {
  id: string;
  setlist_id: string;
  song_id: string;
  position: number;
  upvotes: number;
  notes?: string; // For actual setlists: "acoustic", "cover", "new song"
  is_played?: boolean; // For actual setlists
  play_time?: string; // For actual setlists
  created_at: string;
  // Relations
  song?: Song;
}

export interface Vote {
  id: string;
  user_id: string;
  setlist_song_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface UserArtistFollow {
  user_id: string;
  artist_id: string;
  created_at: string;
  // Relations
  artist?: Artist;
}

// Extended types with relations
export interface ShowWithDetails extends Show {
  artist: Artist;
  venue: Venue;
  setlists?: Setlist[];
}

export interface SetlistWithSongs extends Setlist {
  songs: SetlistSong[];
  show: Show;
}

export interface SetlistSongWithDetails extends SetlistSong {
  song: Song;
}
