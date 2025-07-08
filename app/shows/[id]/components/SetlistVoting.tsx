'use client';

import { useState, useEffect } from 'react';
import { VoteButton } from '@/components/VoteButton';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useUser } from '@/hooks/useUser';
import type { SetlistSongWithDetails, Song } from '@/types';
import toast from 'react-hot-toast';

interface SetlistVotingProps {
  showId: string;
  initialSongs: SetlistSongWithDetails[];
  isLocked: boolean;
  artistName: string;
}

export const SetlistVoting: React.FC<SetlistVotingProps> = ({
  showId,
  initialSongs,
  isLocked,
  artistName,
}) => {
  const { user } = useUser();
  const [songs, setSongs] = useState<SetlistSongWithDetails[]>(initialSongs);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingSong, setIsAddingSong] = useState(false);

  // Sort songs by vote score
  const sortedSongs = [...songs].sort((a, b) => {
    const scoreA = a.upvotes - a.downvotes;
    const scoreB = b.upvotes - b.downvotes;
    return scoreB - scoreA;
  });

  // Search for songs
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchSongs = async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/songs/search?q=${encodeURIComponent(searchQuery)}&artist=${encodeURIComponent(artistName)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.songs || []);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchSongs, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, artistName]);

  const handleVote = async (songId: string, voteType: 'up' | 'down') => {
    // Allow anonymous voting as per PRD requirements
    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setlist_song_id: songId,
          vote_type: voteType === 'up' ? 'upvote' : 'downvote',
        }),
      });

      if (response.ok) {
        // Update local state optimistically
        setSongs(prevSongs =>
          prevSongs.map(song => {
            if (song.id === songId) {
              // Calculate new vote counts based on the vote type
              let newUpvotes = song.upvotes;
              let newDownvotes = song.downvotes;
              
              if (voteType === 'up') {
                newUpvotes += 1;
              } else {
                newDownvotes += 1;
              }

              return {
                ...song,
                upvotes: newUpvotes,
                downvotes: newDownvotes,
              };
            }
            return song;
          })
        );
        toast.success('Vote recorded!');
      } else {
        throw new Error('Vote failed');
      }
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Failed to submit vote');
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
        const newSetlistSong: SetlistSongWithDetails = {
          id: data.id,
          setlist_id: data.setlist_id,
          song_id: song.id,
          position: data.position,
          upvotes: 0,
          downvotes: 0,
          created_at: data.created_at,
          song: song,
        };

        setSongs(prev => [...prev, newSetlistSong]);
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

              {/* Search Results */}
              {isSearching && (
                <div className="text-neutral-400 text-sm">Searching...</div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-3 bg-neutral-700 rounded hover:bg-neutral-600 transition"
                    >
                      <div>
                        <p className="text-white font-medium">{song.title}</p>
                        <p className="text-neutral-400 text-sm">{song.artist_name}</p>
                      </div>
                      <Button
                        onClick={() => handleAddSong(song)}
                        disabled={isAddingSong}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm"
                      >
                        {isAddingSong ? 'Adding...' : 'Add'}
                      </Button>
                    </div>
                  ))}
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
                onVote={(type) => handleVote(item.id, type)}
                disabled={isLocked}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};