import { useState, useEffect, useCallback } from 'react';
import { useRealtime } from '@/providers/RealtimeProvider';
import type { SetlistSong } from '@/types';

interface UseRealtimeSetlistProps {
  showId: string;
  initialSongs: SetlistSong[];
}

interface UseRealtimeSetlistReturn {
  songs: SetlistSong[];
  isLoading: boolean;
  refreshSongs: () => Promise<void>;
}

export const useRealtimeSetlist = ({ 
  showId, 
  initialSongs 
}: UseRealtimeSetlistProps): UseRealtimeSetlistReturn => {
  const { subscribeToSetlistVotes } = useRealtime();
  const [songs, setSongs] = useState<SetlistSong[]>(initialSongs);
  const [isLoading, setIsLoading] = useState(false);

  // Refresh songs from API
  const refreshSongs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/shows/${showId}`);
      if (response.ok) {
        const data = await response.json();
        const setlist = data.show?.setlists?.[0];
        if (setlist?.setlist_songs) {
          setSongs(setlist.setlist_songs);
        }
      }
    } catch (error) {
      console.error('Error refreshing songs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [showId]);

  // Handle real-time updates
  const handleRealtimeUpdate = useCallback((payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    console.log('Realtime setlist update:', { eventType, newRecord, oldRecord });

    if (eventType === 'UPDATE' && newRecord) {
      // Update existing song vote counts
      setSongs(prevSongs => 
        prevSongs.map(song => 
          song.id === newRecord.id 
            ? { ...song, upvotes: newRecord.upvotes, downvotes: newRecord.downvotes }
            : song
        )
      );
    } else if (eventType === 'INSERT' && newRecord) {
      // Add new song to setlist
      setSongs(prevSongs => {
        // Check if song already exists
        const exists = prevSongs.some(song => song.id === newRecord.id);
        if (!exists) {
          // Fetch full song details
          const newSong: SetlistSong = {
            id: newRecord.id,
            setlist_id: newRecord.setlist_id,
            song_id: newRecord.song_id,
            position: newRecord.position,
            upvotes: newRecord.upvotes || 0,
            downvotes: newRecord.downvotes || 0,
            created_at: newRecord.created_at,
            song: newRecord.song
          };
          
          // Insert in correct position
          const newSongs = [...prevSongs, newSong];
          return newSongs.sort((a, b) => a.position - b.position);
        }
        return prevSongs;
      });
    } else if (eventType === 'DELETE' && oldRecord) {
      // Remove song from setlist
      setSongs(prevSongs => 
        prevSongs.filter(song => song.id !== oldRecord.id)
      );
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    // Get setlist ID from initial songs
    const setlistId = initialSongs[0]?.setlist_id;
    if (!setlistId) return;

    const unsubscribe = subscribeToSetlistVotes(setlistId, handleRealtimeUpdate);

    return unsubscribe;
  }, [subscribeToSetlistVotes, initialSongs, handleRealtimeUpdate]);

  // Update songs when initialSongs changes
  useEffect(() => {
    setSongs(initialSongs);
  }, [initialSongs]);

  return {
    songs,
    isLoading,
    refreshSongs
  };
}; 