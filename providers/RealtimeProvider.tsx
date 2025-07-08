'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/types_db';

interface RealtimeContextType {
  isConnected: boolean;
  subscribeToSetlistVotes: (setlistId: string, callback: (payload: any) => void) => () => void;
  subscribeToAllVotes: (callback: (payload: any) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};

interface RealtimeProviderProps {
  children: React.ReactNode;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [supabase] = useState(() => createClientComponentClient<Database>());
  const [channels, setChannels] = useState<Map<string, RealtimeChannel>>(new Map());

  useEffect(() => {
    // Monitor connection status
    const checkConnection = () => {
      // For now, assume connected - Supabase handles reconnection automatically
      setIsConnected(true);
    };

    // Initial check
    checkConnection();
  }, [supabase]);

  const subscribeToSetlistVotes = (setlistId: string, callback: (payload: any) => void) => {
    const channelName = `setlist_votes_${setlistId}`;
    
    // Remove existing channel if any
    const existingChannel = channels.get(channelName);
    if (existingChannel) {
      existingChannel.unsubscribe();
      channels.delete(channelName);
    }

    // Create new channel
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'setlist_songs',
          filter: `setlist_id=eq.${setlistId}`
        },
        (payload) => {
          console.log('Setlist vote update:', payload);
          callback(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `setlist_song_id=in.(select id from setlist_songs where setlist_id='${setlistId}')`
        },
        (payload) => {
          console.log('Individual vote update:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log(`Setlist ${setlistId} subscription status:`, status);
      });

    // Store channel
    setChannels(prev => new Map(prev.set(channelName, channel)));

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
      setChannels(prev => {
        const newMap = new Map(prev);
        newMap.delete(channelName);
        return newMap;
      });
    };
  };

  const subscribeToAllVotes = (callback: (payload: any) => void) => {
    const channelName = 'all_votes';
    
    // Remove existing channel if any
    const existingChannel = channels.get(channelName);
    if (existingChannel) {
      existingChannel.unsubscribe();
      channels.delete(channelName);
    }

    // Create new channel for all vote updates
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'setlist_songs'
        },
        (payload) => {
          console.log('Global setlist song update:', payload);
          callback(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes'
        },
        (payload) => {
          console.log('Global vote update:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('Global votes subscription status:', status);
      });

    // Store channel
    setChannels(prev => new Map(prev.set(channelName, channel)));

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
      setChannels(prev => {
        const newMap = new Map(prev);
        newMap.delete(channelName);
        return newMap;
      });
    };
  };

  // Cleanup all channels on unmount
  useEffect(() => {
    return () => {
      channels.forEach(channel => channel.unsubscribe());
    };
  }, []);

  const value: RealtimeContextType = {
    isConnected,
    subscribeToSetlistVotes,
    subscribeToAllVotes
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}; 