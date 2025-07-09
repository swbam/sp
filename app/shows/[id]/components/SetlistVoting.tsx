'use client';

import { useState, useEffect } from 'react';
import { VoteButton } from '@/components/VoteButton';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useRealtimeSetlist } from '@/hooks/useRealtimeSetlist';
import { useRealtimeVoting } from '@/hooks/useRealtimeVoting';
import type { SetlistSong, Song } from '@/types';
import toast from 'react-hot-toast';

interface SetlistVotingProps {
  showId: string;
  initialSongs: SetlistSong[];
  isLocked: boolean;
  artistName: string;
  artistSlug?: string;
}

export const SetlistVoting: React.FC<SetlistVotingProps> = ({
  showId,
  initialSongs,
  isLocked,
  artistName,
  artistSlug,
}) => {
  const { songs, isLoading: isRefreshing } = useRealtimeSetlist({ showId, initialSongs });
  const { vote, votingStates } = useRealtimeVoting();
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});

  // Sort songs by upvotes
  const sortedSongs = [...songs].sort((a, b) => {
    return b.upvotes - a.upvotes;
  });

  // Load user votes when songs change
  useEffect(() => {
    const loadUserVotes = async () => {
      if (songs.length === 0) return;
      
      const songIds = songs.map(song => song.id);
      try {
        const response = await fetch(`/api/votes?setlist_song_ids=${songIds.join(',')}`);
        if (response.ok) {
          const data = await response.json();
          setUserVotes(data.userVotes || {});
        }
      } catch (error) {
        console.error('Error loading user votes:', error);
      }
    };

    loadUserVotes();
  }, [songs]);

  // Load complete artist catalog when adding mode is enabled
  useEffect(() => {
    if (!isAddingMode) {
      setSearchResults([]);
      return;
    }

    const loadArtistCatalog = async () => {
      setIsSearching(true);
      try {
        // Use provided artist slug or fallback to generated slug
        const slugToUse = artistSlug || artistName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const response = await fetch(`/api/artists/${slugToUse}/catalog`);
        
        if (response.ok) {
          const data = await response.json();
          let allSongs = data.songs || [];
          
          // Filter by search query if provided
          if (searchQuery.trim()) {
            allSongs = allSongs.filter((song: Song) => 
              song.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
          }
          
          setSearchResults(allSongs);
        } else {
          console.error('Failed to load artist catalog:', response.status);
        }
      } catch (error) {
        console.error('Catalog load error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    loadArtistCatalog();
  }, [isAddingMode, searchQuery, artistName, artistSlug]);

  const handleVote = async (songId: string, voteType: 'up' | 'down') => {
    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setlist_song_id: songId,
          vote_type: voteType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to vote');
      }

      const data = await response.json();
      
      if (data.success) {
        // Update user vote state
        setUserVotes(prev => ({
          ...prev,
          [songId]: data.userVote
        }));
        
        // Update the song's vote counts locally for immediate feedback
        const { songs: currentSongs } = { songs };
        const updatedSongs = currentSongs.map(song => 
          song.id === songId 
            ? { ...song, upvotes: data.upvotes, downvotes: data.downvotes }
            : song
        );
        
        toast.success(data.userVote ? 'Voted successfully!' : 'Vote removed!');
      } else {
        throw new Error('Vote was not successful');
      }
    } catch (error: any) {
      console.error('Voting error:', error);
      toast.error(error.message || 'Failed to vote. Please try again.');
    }
  };

  const handleAddSong = async (song: Song) => {
    // Allow anonymous song addition as per PRD requirements
    setIsAddingSong(true);
    try {
      const response = await fetch(`/api/setlists/${showId}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          song_id: song.id,
          position: songs.length + 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Song addition will be handled by real-time updates
        setIsAddingMode(false);
        setSearchQuery('');
        setSearchResults([]);
        toast.success('Song added to setlist!');
      } else {
        throw new Error('Failed to add song');
      }
    } catch (error) {
      console.error('Add song error:', error);
      toast.error('Failed to add song');
    } finally {
      setIsAddingSong(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-white text-2xl font-semibold mb-2">
          Predicted Setlist
        </h2>
        <p className="text-neutral-400 text-sm">
          Vote on songs you think {artistName} will play
          {isLocked && ' • Voting is closed'}
        </p>
      </div>

      {/* Add Song Section - Anonymous users can add songs */}
      {!isLocked && (
        <div className="mb-6">
          {!isAddingMode ? (
            <Button
              onClick={() => setIsAddingMode(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-semibold"
            >
              + Add Song to Setlist
            </Button>
          ) : (
            <div className="bg-neutral-800 rounded-lg p-4">
              <div className="flex items-center gap-4 mb-4">
                <Input
                  placeholder={`Search for songs by ${artistName}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    setIsAddingMode(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded"
                >
                  Cancel
                </Button>
              </div>

              {/* Song Dropdown */}
              {isSearching && (
                <div className="text-neutral-400 text-sm">Loading songs...</div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <select
                    className="w-full bg-neutral-700 text-white border border-neutral-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    onChange={(e) => {
                      const selectedSong = searchResults.find(song => song.id === e.target.value);
                      if (selectedSong) {
                        handleAddSong(selectedSong);
                        e.target.value = '';
                      }
                    }}
                    disabled={isAddingSong}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {isAddingSong ? 'Adding song...' : 'Select a song to add'}
                    </option>
                    {searchResults.map((song) => (
                      <option key={song.id} value={song.id}>
                        {song.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <div className="text-neutral-400 text-sm">
                  No songs found. Try a different search term.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Setlist Songs */}
      {sortedSongs.length === 0 ? (
        <div className="text-center py-12 bg-neutral-800 rounded-lg">
          <div className="text-4xl mb-4">🎵</div>
          <p className="text-neutral-400 text-lg mb-2">No setlist predictions yet</p>
          <p className="text-neutral-500 text-sm">
            Be the first to predict what songs will be played!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSongs.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition"
            >
              <span className="text-neutral-400 w-8 text-center font-medium">
                {index + 1}
              </span>
              
              <div className="flex-1">
                <h4 className="text-white font-medium">{item.song?.title}</h4>
                <p className="text-neutral-400 text-sm">{item.song?.artist_name}</p>
              </div>

              <VoteButton
                upvotes={item.upvotes}
                downvotes={item.downvotes}
                onVote={(voteType) => handleVote(item.id, voteType)}
                disabled={isLocked}
                userVote={userVotes[item.id] || null}
                isLoading={votingStates[item.id] || false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};