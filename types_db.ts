export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      artists: {
        Row: {
          id: string;
          spotify_id: string | null;
          name: string;
          slug: string;
          image_url: string | null;
          genres: Json;
          followers: number;
          verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          spotify_id?: string | null;
          name: string;
          slug: string;
          image_url?: string | null;
          genres?: Json;
          followers?: number;
          verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          spotify_id?: string | null;
          name?: string;
          slug?: string;
          image_url?: string | null;
          genres?: Json;
          followers?: number;
          verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          slug: string;
          city: string;
          state: string | null;
          country: string;
          capacity: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          city: string;
          state?: string | null;
          country: string;
          capacity?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          city?: string;
          state?: string | null;
          country?: string;
          capacity?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shows: {
        Row: {
          id: string;
          artist_id: string;
          venue_id: string | null;
          name: string;
          date: string;
          start_time: string | null;
          status: string;
          ticket_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          artist_id: string;
          venue_id?: string | null;
          name: string;
          date: string;
          start_time?: string | null;
          status?: string;
          ticket_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          artist_id?: string;
          venue_id?: string | null;
          name?: string;
          date?: string;
          start_time?: string | null;
          status?: string;
          ticket_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shows_artist_id_fkey';
            columns: ['artist_id'];
            referencedRelation: 'artists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shows_venue_id_fkey';
            columns: ['venue_id'];
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          }
        ];
      };
      songs: {
        Row: {
          id: string;
          title: string;
          artist_name: string;
          spotify_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          artist_name: string;
          spotify_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist_name?: string;
          spotify_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      setlists: {
        Row: {
          id: string;
          show_id: string;
          type: string;
          is_locked: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          show_id: string;
          type: string;
          is_locked?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          show_id?: string;
          type?: string;
          is_locked?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'setlists_show_id_fkey';
            columns: ['show_id'];
            referencedRelation: 'shows';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'setlists_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      setlist_songs: {
        Row: {
          id: string;
          setlist_id: string;
          song_id: string;
          position: number;
          upvotes: number;
          downvotes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          setlist_id: string;
          song_id: string;
          position: number;
          upvotes?: number;
          downvotes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          setlist_id?: string;
          song_id?: string;
          position?: number;
          upvotes?: number;
          downvotes?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'setlist_songs_setlist_id_fkey';
            columns: ['setlist_id'];
            referencedRelation: 'setlists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'setlist_songs_song_id_fkey';
            columns: ['song_id'];
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          }
        ];
      };
      votes: {
        Row: {
          id: string;
          user_id: string;
          setlist_song_id: string;
          vote_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          setlist_song_id: string;
          vote_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          setlist_song_id?: string;
          vote_type?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'votes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_setlist_song_id_fkey';
            columns: ['setlist_song_id'];
            referencedRelation: 'setlist_songs';
            referencedColumns: ['id'];
          }
        ];
      };
      user_artists: {
        Row: {
          user_id: string;
          artist_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          artist_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          artist_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_artists_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_artists_artist_id_fkey';
            columns: ['artist_id'];
            referencedRelation: 'artists';
            referencedColumns: ['id'];
          }
        ];
      };
      users: {
        Row: {
          id: string;
          avatar_url: string | null;
          billing_address: Json | null;
          full_name: string | null;
          payment_method: Json | null;
          created_at: string;
        };
        Insert: {
          id: string;
          avatar_url?: string | null;
          billing_address?: Json | null;
          full_name?: string | null;
          payment_method?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          avatar_url?: string | null;
          billing_address?: Json | null;
          full_name?: string | null;
          payment_method?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      analytics_events: {
        Row: {
          id: string;
          type: string;
          user_id: string | null;
          entity_id: string;
          entity_type: string;
          metadata: Json | null;
          timestamp: string;
          session_id: string | null;
          user_agent: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          user_id?: string | null;
          entity_id: string;
          entity_type: string;
          metadata?: Json | null;
          timestamp: string;
          session_id?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          user_id?: string | null;
          entity_id?: string;
          entity_type?: string;
          metadata?: Json | null;
          timestamp?: string;
          session_id?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_activity_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_id: string;
          entity_type: string;
          metadata: Json | null;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_id: string;
          entity_type: string;
          metadata?: Json | null;
          timestamp: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_id?: string;
          entity_type?: string;
          metadata?: Json | null;
          timestamp?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      realtime_vote_metrics: {
        Row: {
          id: string;
          setlist_song_id: string;
          user_id: string | null;
          last_vote_time: string;
          vote_count: number;
          net_votes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          setlist_song_id: string;
          user_id?: string | null;
          last_vote_time: string;
          vote_count?: number;
          net_votes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          setlist_song_id?: string;
          user_id?: string | null;
          last_vote_time?: string;
          vote_count?: number;
          net_votes?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_setlist_with_votes: {
        Args: {
          setlist_uuid: string;
        };
        Returns: {
          id: string;
          setlist_id: string;
          song_id: string;
          position: number;
          upvotes: number;
          downvotes: number;
          net_votes: number;
          song_title: string;
          song_artist: string;
          created_at: string;
        }[];
      };
      get_user_vote: {
        Args: {
          user_uuid: string;
          setlist_song_uuid: string;
        };
        Returns: string;
      };
      search_artists: {
        Args: {
          search_term: string;
          result_limit?: number;
        };
        Returns: {
          id: string;
          spotify_id: string;
          name: string;
          slug: string;
          image_url: string;
          genres: Json;
          followers: number;
          verified: boolean;
          show_count: number;
        }[];
      };
      update_setlist_song_votes: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      update_updated_at_column: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}