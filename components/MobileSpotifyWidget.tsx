'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import { OptimizedIcon } from './LazyIcons';
import { useDebounce } from '@/hooks/useDebounce';
import Image from 'next/image';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
    external_urls: {
      spotify: string;
    };
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  popularity: number;
  duration_ms: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers: {
    total: number;
  };
  images: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  external_urls: {
    spotify: string;
  };
}

interface MobileSpotifyWidgetProps {
  artistName: string;
  className?: string;
  maxResults?: number;
  autoSearch?: boolean;
  onTrackSelect?: (track: SpotifyTrack) => void;
  onArtistSelect?: (artist: SpotifyArtist) => void;
  mode?: 'tracks' | 'artist' | 'both';
}

export const MobileSpotifyWidget: React.FC<MobileSpotifyWidgetProps> = ({
  artistName,
  className,
  maxResults = 10,
  autoSearch = true,
  onTrackSelect,
  onArtistSelect,
  mode = 'both'
}) => {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [artist, setArtist] = useState<SpotifyArtist | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(artistName);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'artist'>('tracks');
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const searchSpotify = useCallback(async (term: string) => {
    if (!term.trim()) {
      setTracks([]);
      setArtist(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(term)}&type=${mode === 'both' ? 'track,artist' : mode === 'tracks' ? 'track' : 'artist'}&limit=${maxResults}`);
      
      if (!response.ok) {
        throw new Error('Failed to search Spotify');
      }

      const data = await response.json();
      
      if (mode === 'tracks' || mode === 'both') {
        setTracks(data.tracks?.items || []);
      }
      
      if (mode === 'artist' || mode === 'both') {
        setArtist(data.artists?.items?.[0] || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search Spotify');
      setTracks([]);
      setArtist(null);
    } finally {
      setLoading(false);
    }
  }, [maxResults, mode]);

  useEffect(() => {
    if (autoSearch && debouncedSearchTerm) {
      searchSpotify(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, searchSpotify, autoSearch]);

  useEffect(() => {
    if (artistName && artistName !== searchTerm) {
      setSearchTerm(artistName);
    }
  }, [artistName, searchTerm]);

  const handleTrackSelect = (track: SpotifyTrack) => {
    onTrackSelect?.(track);
  };

  const handleArtistSelect = (artist: SpotifyArtist) => {
    onArtistSelect?.(artist);
  };

  const handlePlayPreview = (track: SpotifyTrack) => {
    if (!track.preview_url) return;

    if (playingTrack === track.id) {
      // Stop current track
      audioRef.current?.pause();
      setPlayingTrack(null);
    } else {
      // Play new track
      if (audioRef.current) {
        audioRef.current.src = track.preview_url;
        audioRef.current.play();
        setPlayingTrack(track.id);
      }
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFollowers = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const TrackCard = ({ track }: { track: SpotifyTrack }) => {
    const albumImage = track.album.images?.[2] || track.album.images?.[1] || track.album.images?.[0];
    const isPlaying = playingTrack === track.id;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={twMerge(
          "bg-neutral-800 rounded-lg p-3 cursor-pointer transition-all duration-200",
          "hover:bg-neutral-700 hover:shadow-lg",
          "border border-neutral-700 hover:border-neutral-600",
          "active:scale-95 active:bg-neutral-600"
        )}
        onClick={() => handleTrackSelect(track)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTrackSelect(track);
          }
        }}
        aria-label={`Select ${track.name} by ${track.artists.map(a => a.name).join(', ')}`}
      >
        <div className="flex items-center space-x-3">
          {/* Album Art */}
          <div className="relative flex-shrink-0">
            {albumImage ? (
              <Image
                src={albumImage.url}
                alt={`${track.album.name} album cover`}
                width={48}
                height={48}
                className="rounded-md"
              />
            ) : (
              <div className="w-12 h-12 bg-neutral-700 rounded-md flex items-center justify-center">
                <OptimizedIcon 
                  iconSet="lucide" 
                  iconName="Music" 
                  size={20} 
                  className="text-neutral-400" 
                />
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white truncate text-sm">
              {track.name}
            </h3>
            <p className="text-xs text-neutral-400 truncate">
              {track.artists.map(artist => artist.name).join(', ')}
            </p>
            <p className="text-xs text-neutral-500 truncate">
              {track.album.name}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {track.preview_url && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPreview(track);
                }}
                className="p-1 rounded-full hover:bg-neutral-600 transition-colors"
                aria-label={isPlaying ? "Pause preview" : "Play preview"}
              >
                <OptimizedIcon 
                  iconSet="lucide" 
                  iconName={isPlaying ? "Pause" : "Play"} 
                  size={16} 
                  className="text-green-400" 
                />
              </button>
            )}
            
            <span className="text-xs text-neutral-500">
              {formatDuration(track.duration_ms)}
            </span>
            
            <a
              href={track.external_urls.spotify}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-full hover:bg-neutral-600 transition-colors"
              aria-label="Open in Spotify"
            >
              <OptimizedIcon 
                iconSet="fa" 
                iconName="FaSpotify" 
                size={16} 
                className="text-green-400" 
              />
            </a>
          </div>
        </div>
      </motion.div>
    );
  };

  const ArtistCard = ({ artist }: { artist: SpotifyArtist }) => {
    const artistImage = artist.images?.[1] || artist.images?.[0];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={twMerge(
          "bg-neutral-800 rounded-lg p-4 cursor-pointer transition-all duration-200",
          "hover:bg-neutral-700 hover:shadow-lg",
          "border border-neutral-700 hover:border-neutral-600",
          "active:scale-95 active:bg-neutral-600"
        )}
        onClick={() => handleArtistSelect(artist)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleArtistSelect(artist);
          }
        }}
        aria-label={`Select artist ${artist.name}`}
      >
        <div className="flex items-center space-x-4">
          {/* Artist Image */}
          <div className="relative flex-shrink-0">
            {artistImage ? (
              <Image
                src={artistImage.url}
                alt={`${artist.name} artist image`}
                width={64}
                height={64}
                className="rounded-full"
              />
            ) : (
              <div className="w-16 h-16 bg-neutral-700 rounded-full flex items-center justify-center">
                <OptimizedIcon 
                  iconSet="lucide" 
                  iconName="User" 
                  size={24} 
                  className="text-neutral-400" 
                />
              </div>
            )}
          </div>

          {/* Artist Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">
              {artist.name}
            </h3>
            
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-xs text-neutral-400">
                {formatFollowers(artist.followers.total)} followers
              </span>
              <span className="text-xs text-neutral-400">
                {artist.popularity}% popularity
              </span>
            </div>
            
            {artist.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {artist.genres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="px-2 py-1 bg-neutral-700 text-xs text-neutral-300 rounded-full"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Spotify Link */}
          <a
            href={artist.external_urls.spotify}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-full hover:bg-neutral-600 transition-colors"
            aria-label="Open in Spotify"
          >
            <OptimizedIcon 
              iconSet="fa" 
              iconName="FaSpotify" 
              size={20} 
              className="text-green-400" 
            />
          </a>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={twMerge(
      "bg-neutral-900 rounded-lg border border-neutral-700",
      "shadow-lg",
      className
    )}>
      {/* Hidden audio element for previews */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingTrack(null)}
        preload="none"
      />

      {/* Header */}
      <div className="p-4 border-b border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <OptimizedIcon 
              iconSet="fa" 
              iconName="FaSpotify" 
              size={20} 
              className="text-green-400" 
            />
            <h2 className="text-lg font-semibold text-white">
              Spotify
            </h2>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-full hover:bg-neutral-800 transition-colors"
            aria-label={isExpanded ? "Collapse Spotify widget" : "Expand Spotify widget"}
          >
            <OptimizedIcon 
              iconSet="lucide" 
              iconName={isExpanded ? "ChevronUp" : "ChevronDown"} 
              size={20} 
              className="text-neutral-400" 
            />
          </button>
        </div>

        {/* Search Input */}
        <div className="mt-3 relative">
          <div className="relative">
            <OptimizedIcon 
              iconSet="lucide" 
              iconName="Search" 
              size={16} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" 
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tracks and artists..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <OptimizedIcon 
                  iconSet="lucide" 
                  iconName="Loader" 
                  size={16} 
                  className="text-neutral-400 animate-spin" 
                />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        {mode === 'both' && (
          <div className="mt-3 flex space-x-2">
            <button
              onClick={() => setActiveTab('tracks')}
              className={twMerge(
                "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'tracks' 
                  ? "bg-green-600 text-white" 
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              )}
            >
              Tracks
            </button>
            <button
              onClick={() => setActiveTab('artist')}
              className={twMerge(
                "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'artist' 
                  ? "bg-green-600 text-white" 
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              )}
            >
              Artist
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <OptimizedIcon 
                      iconSet="lucide" 
                      iconName="AlertCircle" 
                      size={16} 
                      className="text-red-400" 
                    />
                    <span className="text-sm text-red-400">{error}</span>
                  </div>
                </div>
              )}

              {/* Tracks Tab */}
              {(mode === 'tracks' || (mode === 'both' && activeTab === 'tracks')) && (
                <div className="space-y-3">
                  {tracks.length === 0 && !loading && !error && (
                    <div className="text-center py-8">
                      <OptimizedIcon 
                        iconSet="lucide" 
                        iconName="Music" 
                        size={48} 
                        className="text-neutral-600 mx-auto mb-3" 
                      />
                      <p className="text-neutral-400 text-sm">
                        No tracks found for &quot;{searchTerm}&quot;
                      </p>
                    </div>
                  )}

                  <AnimatePresence>
                    {tracks.map((track) => (
                      <TrackCard key={track.id} track={track} />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Artist Tab */}
              {(mode === 'artist' || (mode === 'both' && activeTab === 'artist')) && (
                <div>
                  {!artist && !loading && !error && (
                    <div className="text-center py-8">
                      <OptimizedIcon 
                        iconSet="lucide" 
                        iconName="User" 
                        size={48} 
                        className="text-neutral-600 mx-auto mb-3" 
                      />
                      <p className="text-neutral-400 text-sm">
                        No artist found for &quot;{searchTerm}&quot;
                      </p>
                    </div>
                  )}

                  {artist && (
                    <ArtistCard artist={artist} />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};