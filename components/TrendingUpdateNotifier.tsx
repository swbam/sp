'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface TrendingUpdateNotifierProps {
  onUpdate: () => void;
}

export const TrendingUpdateNotifier: React.FC<TrendingUpdateNotifierProps> = ({ onUpdate }) => {
  const [updateCount, setUpdateCount] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    let votesSubscription: any;
    let showsSubscription: any;
    let updateTimeout: NodeJS.Timeout;

    const setupSubscriptions = () => {
      // Subscribe to vote changes
      votesSubscription = supabase
        .channel('trending-updates-votes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'votes'
          },
          (payload) => {
            setUpdateCount(prev => prev + 1);
            setShowNotification(true);
            
            // Debounce the update callback
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
              onUpdate();
            }, 2000);
          }
        )
        .subscribe();

      // Subscribe to show changes
      showsSubscription = supabase
        .channel('trending-updates-shows')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shows'
          },
          (payload) => {
            setUpdateCount(prev => prev + 1);
            setShowNotification(true);
            
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
              onUpdate();
            }, 2000);
          }
        )
        .subscribe();
    };

    setupSubscriptions();

    return () => {
      clearTimeout(updateTimeout);
      if (votesSubscription) {
        supabase.removeChannel(votesSubscription);
      }
      if (showsSubscription) {
        supabase.removeChannel(showsSubscription);
      }
    };
  }, [supabase, onUpdate]);

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showNotification]);

  if (!showNotification) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
      <div className="bg-gradient-to-r from-purple-600/90 to-pink-600/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-lg border border-purple-500/30">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <div className="text-sm font-medium">
            Trending updated! {updateCount} recent changes
          </div>
          <button
            onClick={() => setShowNotification(false)}
            className="text-white/80 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};