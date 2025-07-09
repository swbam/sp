'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import type { Artist, Show, SetlistSongWithDetails } from '@/types';

// Performance optimized state interfaces
interface VotingState {
  votes: Record<string, { type: 'up' | 'down'; timestamp: number }>;
  pendingVotes: Record<string, { type: 'up' | 'down'; retryCount: number }>;
  isVoting: Record<string, boolean>;
  optimisticUpdates: Record<string, { upvotes: number; downvotes: number }>;
}

interface CacheState {
  artists: Record<string, { data: Artist; timestamp: number; ttl: number }>;
  shows: Record<string, { data: Show; timestamp: number; ttl: number }>;
  setlists: Record<string, { data: SetlistSongWithDetails[]; timestamp: number; ttl: number }>;
  searchResults: Record<string, { data: any; timestamp: number; ttl: number }>;
}

interface UIState {
  sidebarOpen: boolean;
  currentTheme: 'dark' | 'light';
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: number;
    read: boolean;
  }>;
  realtimeConnections: Record<string, boolean>;
  performanceMetrics: {
    lastRenderTime: number;
    totalRenderCount: number;
    avgRenderTime: number;
    memoryUsage: number;
  };
}

interface AppState {
  voting: VotingState;
  cache: CacheState;
  ui: UIState;
}

// Store actions interface
interface AppActions {
  // Voting actions
  setVote: (songId: string, type: 'up' | 'down') => void;
  clearVote: (songId: string) => void;
  setPendingVote: (songId: string, type: 'up' | 'down') => void;
  clearPendingVote: (songId: string) => void;
  setVotingState: (songId: string, isVoting: boolean) => void;
  updateOptimisticVotes: (songId: string, upvotes: number, downvotes: number) => void;
  
  // Cache actions
  setCachedArtist: (id: string, artist: Artist, ttl?: number) => void;
  setCachedShow: (id: string, show: Show, ttl?: number) => void;
  setCachedSetlist: (id: string, setlist: SetlistSongWithDetails[], ttl?: number) => void;
  setCachedSearchResults: (query: string, results: any, ttl?: number) => void;
  getCachedData: <T>(key: string, collection: keyof CacheState) => T | null;
  clearExpiredCache: () => void;
  clearCache: () => void;
  
  // UI actions
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setRealtimeConnection: (channel: string, connected: boolean) => void;
  updatePerformanceMetrics: (metrics: Partial<UIState['performanceMetrics']>) => void;
  
  // Utility actions
  resetStore: () => void;
  getStoreSize: () => number;
  exportState: () => string;
  importState: (state: string) => void;
}

// Default state
const defaultState: AppState = {
  voting: {
    votes: {},
    pendingVotes: {},
    isVoting: {},
    optimisticUpdates: {}
  },
  cache: {
    artists: {},
    shows: {},
    setlists: {},
    searchResults: {}
  },
  ui: {
    sidebarOpen: false,
    currentTheme: 'dark',
    notifications: [],
    realtimeConnections: {},
    performanceMetrics: {
      lastRenderTime: 0,
      totalRenderCount: 0,
      avgRenderTime: 0,
      memoryUsage: 0
    }
  }
};

// Performance optimized store with multiple middleware layers
export const usePerformanceOptimizedStore = create<AppState & AppActions>()(
  subscribeWithSelector(
    persist(
      immer(
        devtools(
          (set, get) => ({
            ...defaultState,
            
            // Voting actions
            setVote: (songId: string, type: 'up' | 'down') => {
              set((state) => {
                state.voting.votes[songId] = { type, timestamp: Date.now() };
                delete state.voting.pendingVotes[songId];
                state.voting.isVoting[songId] = false;
              });
            },
            
            clearVote: (songId: string) => {
              set((state) => {
                delete state.voting.votes[songId];
                delete state.voting.optimisticUpdates[songId];
              });
            },
            
            setPendingVote: (songId: string, type: 'up' | 'down') => {
              set((state) => {
                state.voting.pendingVotes[songId] = { type, retryCount: 0 };
                state.voting.isVoting[songId] = true;
              });
            },
            
            clearPendingVote: (songId: string) => {
              set((state) => {
                delete state.voting.pendingVotes[songId];
                state.voting.isVoting[songId] = false;
              });
            },
            
            setVotingState: (songId: string, isVoting: boolean) => {
              set((state) => {
                state.voting.isVoting[songId] = isVoting;
              });
            },
            
            updateOptimisticVotes: (songId: string, upvotes: number, downvotes: number) => {
              set((state) => {
                state.voting.optimisticUpdates[songId] = { upvotes, downvotes };
              });
            },
            
            // Cache actions with automatic expiration
            setCachedArtist: (id: string, artist: Artist, ttl = 5 * 60 * 1000) => {
              set((state) => {
                state.cache.artists[id] = {
                  data: artist,
                  timestamp: Date.now(),
                  ttl
                };
              });
            },
            
            setCachedShow: (id: string, show: Show, ttl = 5 * 60 * 1000) => {
              set((state) => {
                state.cache.shows[id] = {
                  data: show,
                  timestamp: Date.now(),
                  ttl
                };
              });
            },
            
            setCachedSetlist: (id: string, setlist: SetlistSongWithDetails[], ttl = 2 * 60 * 1000) => {
              set((state) => {
                state.cache.setlists[id] = {
                  data: setlist,
                  timestamp: Date.now(),
                  ttl
                };
              });
            },
            
            setCachedSearchResults: (query: string, results: any, ttl = 10 * 60 * 1000) => {
              set((state) => {
                state.cache.searchResults[query] = {
                  data: results,
                  timestamp: Date.now(),
                  ttl
                };
              });
            },
            
            getCachedData: <T>(key: string, collection: keyof CacheState): T | null => {
              const cached = get().cache[collection][key];
              if (!cached) return null;
              
              const isExpired = Date.now() - cached.timestamp > cached.ttl;
              if (isExpired) {
                // Remove expired item
                set((state) => {
                  delete state.cache[collection][key];
                });
                return null;
              }
              
              return cached.data as T;
            },
            
            clearExpiredCache: () => {
              set((state) => {
                const now = Date.now();
                
                // Clear expired items from all collections
                Object.keys(state.cache).forEach((collection) => {
                  const cacheCollection = state.cache[collection as keyof CacheState];
                  Object.keys(cacheCollection).forEach((key) => {
                    const item = cacheCollection[key];
                    if (item && now - item.timestamp > item.ttl) {
                      delete cacheCollection[key];
                    }
                  });
                });
              });
            },
            
            clearCache: () => {
              set((state) => {
                state.cache = {
                  artists: {},
                  shows: {},
                  setlists: {},
                  searchResults: {}
                };
              });
            },
            
            // UI actions
            setSidebarOpen: (open: boolean) => {
              set((state) => {
                state.ui.sidebarOpen = open;
              });
            },
            
            setTheme: (theme: 'dark' | 'light') => {
              set((state) => {
                state.ui.currentTheme = theme;
              });
            },
            
            addNotification: (notification) => {
              set((state) => {
                state.ui.notifications.unshift({
                  ...notification,
                  id: Math.random().toString(36).substring(2, 9),
                  timestamp: Date.now(),
                  read: false
                });
                
                // Keep only latest 50 notifications
                if (state.ui.notifications.length > 50) {
                  state.ui.notifications = state.ui.notifications.slice(0, 50);
                }
              });
            },
            
            markNotificationRead: (id: string) => {
              set((state) => {
                const notification = state.ui.notifications.find(n => n.id === id);
                if (notification) {
                  notification.read = true;
                }
              });
            },
            
            clearNotifications: () => {
              set((state) => {
                state.ui.notifications = [];
              });
            },
            
            setRealtimeConnection: (channel: string, connected: boolean) => {
              set((state) => {
                state.ui.realtimeConnections[channel] = connected;
              });
            },
            
            updatePerformanceMetrics: (metrics) => {
              set((state) => {
                state.ui.performanceMetrics = {
                  ...state.ui.performanceMetrics,
                  ...metrics
                };
              });
            },
            
            // Utility actions
            resetStore: () => {
              set(() => ({ ...defaultState }));
            },
            
            getStoreSize: () => {
              const state = get();
              return new Blob([JSON.stringify(state)]).size;
            },
            
            exportState: () => {
              const state = get();
              return JSON.stringify(state, null, 2);
            },
            
            importState: (stateString: string) => {
              try {
                const importedState = JSON.parse(stateString);
                set(() => ({ ...importedState }));
              } catch (error) {
                console.error('Failed to import state:', error);
              }
            }
          }),
          {
            name: 'mysetlist-store',
            serialize: { options: true },
          }
        )
      ),
      {
        name: 'mysetlist-storage',
        partialize: (state) => ({
          // Only persist certain parts of the state
          voting: {
            votes: state.voting.votes,
            pendingVotes: state.voting.pendingVotes
          },
          ui: {
            sidebarOpen: state.ui.sidebarOpen,
            currentTheme: state.ui.currentTheme,
            notifications: state.ui.notifications.slice(0, 10) // Only persist recent notifications
          }
        }),
        version: 1,
        migrate: (persistedState: any, version: number) => {
          // Handle state migrations between versions
          if (version < 1) {
            // Migration logic for version 1
            return {
              ...persistedState,
              ui: {
                ...persistedState.ui,
                performanceMetrics: defaultState.ui.performanceMetrics
              }
            };
          }
          return persistedState;
        }
      }
    )
  )
);

// Performance monitoring hook
export const usePerformanceMonitor = () => {
  const updateMetrics = usePerformanceOptimizedStore(state => state.updatePerformanceMetrics);
  
  const measureRender = (renderTime: number) => {
    const current = usePerformanceOptimizedStore.getState().ui.performanceMetrics;
    const totalCount = current.totalRenderCount + 1;
    const avgTime = (current.avgRenderTime * current.totalRenderCount + renderTime) / totalCount;
    
    updateMetrics({
      lastRenderTime: renderTime,
      totalRenderCount: totalCount,
      avgRenderTime: avgTime,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
    });
  };
  
  return { measureRender };
};

// Cache management hook
export const useCacheManager = () => {
  const clearExpiredCache = usePerformanceOptimizedStore(state => state.clearExpiredCache);
  const clearCache = usePerformanceOptimizedStore(state => state.clearCache);
  const getStoreSize = usePerformanceOptimizedStore(state => state.getStoreSize);
  
  // Auto-cleanup expired cache every 5 minutes
  if (typeof window !== 'undefined') {
    setInterval(() => {
      clearExpiredCache();
      
      // Clear cache if it gets too large (> 5MB)
      if (getStoreSize() > 5 * 1024 * 1024) {
        clearCache();
      }
    }, 5 * 60 * 1000);
  }
  
  return {
    clearExpiredCache,
    clearCache,
    getStoreSize
  };
};

// Selective state subscription hooks for better performance
export const useVotingState = () => usePerformanceOptimizedStore(state => state.voting);
export const useCacheState = () => usePerformanceOptimizedStore(state => state.cache);
export const useUIState = () => usePerformanceOptimizedStore(state => state.ui);

// Specific selectors to avoid unnecessary re-renders
export const useIsVoting = (songId: string) => usePerformanceOptimizedStore(
  state => state.voting.isVoting[songId] || false
);

export const useUserVote = (songId: string) => usePerformanceOptimizedStore(
  state => state.voting.votes[songId]?.type || null
);

export const useOptimisticVotes = (songId: string) => usePerformanceOptimizedStore(
  state => state.voting.optimisticUpdates[songId]
);

export const useNotifications = () => usePerformanceOptimizedStore(
  state => state.ui.notifications
);

export const useRealtimeConnection = (channel: string) => usePerformanceOptimizedStore(
  state => state.ui.realtimeConnections[channel] || false
);