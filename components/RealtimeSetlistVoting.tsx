'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SetlistSongWithDetails, Vote } from '@/types';
import { VoteButton } from './VoteButton';
import { useRealtime } from '@/providers/RealtimeProvider';
import { useRealtimeVoting } from '@/hooks/useRealtimeVoting';
import { useUser } from '@/hooks/useUser';
import { twMerge } from 'tailwind-merge';
import { BsLightning, BsFire, BsArrowUp } from 'react-icons/bs';
import { motion, AnimatePresence } from 'framer-motion';

interface RealtimeSetlistVotingProps {
  setlistId: string;
  initialSongs: SetlistSongWithDetails[];
  userVotes?: Record<string, 'up' | 'down'>;
  className?: string;
  enableAIPredictions?: boolean;
  showTrendingIndicators?: boolean;
}

interface SongVotingState {
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
  isVoting: boolean;
  trendingScore: number;
  aiPredictionScore?: number;
  recentVoteActivity: number;
}

export const RealtimeSetlistVoting: React.FC<RealtimeSetlistVotingProps> = ({
  setlistId,
  initialSongs,
  userVotes = {},
  className,
  enableAIPredictions = false,
  showTrendingIndicators = true
}) => {
  const { user } = useUser();
  const { subscribeToSetlistVotes } = useRealtime();
  const { vote, votingStates } = useRealtimeVoting();

  // Enhanced state management for real-time updates
  const [songStates, setSongStates] = useState<Record<string, SongVotingState>>(() => {
    const states: Record<string, SongVotingState> = {};
    initialSongs.forEach(song => {
      states[song.id] = {
        upvotes: song.upvotes,
        downvotes: song.downvotes,
        userVote: userVotes[song.id] || null,
        isVoting: false,
        trendingScore: 0,
        recentVoteActivity: 0
      };
    });
    return states;
  });

  const [sortedSongs, setSortedSongs] = useState(initialSongs);
  const [realtimeUpdates, setRealtimeUpdates] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');

  // Calculate trending scores based on recent activity
  const calculateTrendingScore = useCallback((song: SetlistSongWithDetails, state: SongVotingState) => {
    const score = state.upvotes - state.downvotes;
    const activityBonus = state.recentVoteActivity * 0.1;
    const positionBonus = Math.max(0, 10 - song.position) * 0.05;
    return score + activityBonus + positionBonus;
  }, []);

  // Real-time subscription effect
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (setlistId) {
      cleanup = subscribeToSetlistVotes(setlistId, (payload) => {
        console.log('Real-time update:', payload);
        
        setRealtimeUpdates(prev => prev + 1);
        
        // Handle different types of updates
        if (payload.table === 'setlist_songs') {
          const updatedSong = payload.new || payload.old;
          if (updatedSong) {
            setSongStates(prev => ({
              ...prev,
              [updatedSong.id]: {
                ...prev[updatedSong.id],
                upvotes: updatedSong.upvotes || 0,
                downvotes: updatedSong.downvotes || 0,
                recentVoteActivity: (prev[updatedSong.id]?.recentVoteActivity || 0) + 1
              }
            }));
          }
        } else if (payload.table === 'votes') {
          // Handle individual vote updates
          const vote = payload.new || payload.old;
          if (vote && user?.id === vote.user_id) {
            setSongStates(prev => ({
              ...prev,
              [vote.setlist_song_id]: {
                ...prev[vote.setlist_song_id],
                userVote: payload.eventType === 'DELETE' ? null : vote.vote_type
              }
            }));
          }
        }
      });
    }

    return () => {
      cleanup?.();
    };
  }, [setlistId, subscribeToSetlistVotes, user?.id]);

  // Sort songs by trending score
  useEffect(() => {
    const sorted = [...initialSongs].sort((a, b) => {
      const stateA = songStates[a.id];
      const stateB = songStates[b.id];
      if (!stateA || !stateB) return 0;
      
      const scoreA = calculateTrendingScore(a, stateA);
      const scoreB = calculateTrendingScore(b, stateB);
      
      return scoreB - scoreA;
    });
    
    setSortedSongs(sorted);
  }, [initialSongs, songStates, calculateTrendingScore]);

  // Vote handler with optimistic updates
  const handleVote = useCallback(async (songId: string, voteType: 'up' | 'down') => {
    if (!user) return;

    // Optimistic update
    setSongStates(prev => ({
      ...prev,
      [songId]: {
        upvotes: prev[songId]?.upvotes || 0,
        downvotes: prev[songId]?.downvotes || 0,
        userVote: prev[songId]?.userVote === voteType ? null : voteType,
        isVoting: true,
        trendingScore: prev[songId]?.trendingScore || 0,
        aiPredictionScore: prev[songId]?.aiPredictionScore,
        recentVoteActivity: prev[songId]?.recentVoteActivity || 0
      }
    }));

    try {
      await vote(songId, voteType);
    } catch (error) {
      // Revert optimistic update on error
      setSongStates(prev => ({
        ...prev,
        [songId]: {
          upvotes: prev[songId]?.upvotes || 0,
          downvotes: prev[songId]?.downvotes || 0,
          userVote: userVotes[songId] || null,
          isVoting: false,
          trendingScore: prev[songId]?.trendingScore || 0,
          aiPredictionScore: prev[songId]?.aiPredictionScore,
          recentVoteActivity: prev[songId]?.recentVoteActivity || 0
        }
      }));
    }
  }, [user, vote, userVotes]);

  // Get trending indicator for a song
  const getTrendingIndicator = useCallback((song: SetlistSongWithDetails) => {
    const state = songStates[song.id];
    if (!state || !showTrendingIndicators) return null;

    const score = calculateTrendingScore(song, state);
    
    if (score > 10) {
      return { icon: BsFire, color: 'text-orange-500', label: 'Hot' };
    } else if (score > 5) {
      return { icon: BsArrowUp, color: 'text-yellow-500', label: 'Trending' };
    } else if (state.recentVoteActivity > 5) {
      return { icon: BsLightning, color: 'text-blue-500', label: 'Active' };
    }
    
    return null;
  }, [songStates, showTrendingIndicators, calculateTrendingScore]);

  // Memoized song items for performance
  const songItems = useMemo(() => {
    return sortedSongs.map((song, index) => {
      const state = songStates[song.id];
      const trendingIndicator = getTrendingIndicator(song);
      
      if (!state) return null;

      return (
        <motion.div
          key={song.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ delay: index * 0.05 }}
          className={twMerge(
            "bg-neutral-800/50 rounded-lg p-4 border border-neutral-700",
            "hover:bg-neutral-800/70 transition-all duration-200",
            "focus-within:ring-2 focus-within:ring-green-500/50"
          )}
        >
          <div className="flex items-center justify-between gap-4">
            {/* Song Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-neutral-400 text-sm font-mono">
                  #{song.position}
                </span>
                {trendingIndicator && (
                  <div className={twMerge("flex items-center gap-1", trendingIndicator.color)}>
                    <trendingIndicator.icon size={14} />
                    <span className="text-xs font-medium">{trendingIndicator.label}</span>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-white truncate">
                {song.song?.title}
              </h3>
              <p className="text-neutral-400 text-sm truncate">
                {song.song?.artist_name}
              </p>
            </div>

            {/* Voting Controls */}
            <div className="flex items-center gap-4">
              {enableAIPredictions && state.aiPredictionScore && (
                <div className="text-center">
                  <div className="text-xs text-neutral-500">AI Score</div>
                  <div className="text-sm font-semibold text-purple-400">
                    {Math.round(state.aiPredictionScore * 100)}%
                  </div>
                </div>
              )}
              
              <VoteButton
                upvotes={state.upvotes}
                downvotes={state.downvotes}
                onVote={(type) => handleVote(song.id, type)}
                userVote={state.userVote}
                disabled={!user || state.isVoting}
                isLoading={state.isVoting || votingStates[song.id]}
                showPulse={state.recentVoteActivity > 3}
                size="md"
              />
            </div>
          </div>

          {/* Real-time Activity Indicator */}
          {state.recentVoteActivity > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="mt-2 flex items-center justify-center"
            >
              <div className="h-1 bg-green-500/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-green-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(state.recentVoteActivity * 10, 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          )}
        </motion.div>
      );
    });
  }, [sortedSongs, songStates, getTrendingIndicator, enableAIPredictions, user, handleVote, votingStates]);

  return (
    <div className={twMerge("space-y-4", className)}>
      {/* Header with Real-time Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Predicted Setlist</h2>
        <div className="flex items-center gap-2">
          <div className={twMerge(
            "w-2 h-2 rounded-full transition-colors",
            connectionStatus === 'connected' && "bg-green-500",
            connectionStatus === 'disconnected' && "bg-red-500",
            connectionStatus === 'reconnecting' && "bg-yellow-500 animate-pulse"
          )} />
          <span className="text-sm text-neutral-400">
            {realtimeUpdates} live updates
          </span>
        </div>
      </div>

      {/* Song List with Animations */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-3">
          {songItems}
        </div>
      </AnimatePresence>

      {/* Empty State */}
      {sortedSongs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-400">No songs in this setlist yet.</p>
        </div>
      )}
    </div>
  );
};