import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface UseRealtimeVotingProps {
  onVoteSuccess?: (songId: string) => void;
}

interface UseRealtimeVotingReturn {
  votingStates: Record<string, boolean>;
  vote: (songId: string, voteType: 'up' | 'down') => Promise<void>;
}

export const useRealtimeVoting = ({ 
  onVoteSuccess 
}: UseRealtimeVotingProps = {}): UseRealtimeVotingReturn => {
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});

  const vote = useCallback(async (songId: string, voteType: 'up' | 'down') => {
    // Set loading state
    setVotingStates(prev => ({ ...prev, [songId]: true }));

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
        // Call success callback
        onVoteSuccess?.(songId);
        
        // Show success message
        toast.success('Voted successfully!');
      } else {
        throw new Error('Vote was not successful');
      }
    } catch (error: any) {
      console.error('Voting error:', error);
      toast.error(error.message || 'Failed to vote. Please try again.');
    } finally {
      // Clear loading state
      setVotingStates(prev => ({ ...prev, [songId]: false }));
    }
  }, [onVoteSuccess]);

  return {
    votingStates,
    vote
  };
}; 