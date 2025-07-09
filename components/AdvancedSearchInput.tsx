'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useDebounce from '@/hooks/useDebounce';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BiSearch, 
  BiX, 
  BiFilter, 
  BiMicrophone,
  BiHistory,
  BiTrendingUp,
  BiChevronDown
} from 'react-icons/bi';
import { FaSpotify, FaCalendar, FaMapMarkerAlt } from 'react-icons/fa';
import type { Artist, Show, Venue } from '@/types';

interface SearchResult {
  type: 'artist' | 'show' | 'venue' | 'suggestion';
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  metadata?: any;
}

interface SearchFilters {
  type: 'all' | 'artists' | 'shows' | 'venues';
  genre?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  location?: string;
  verified?: boolean;
}

interface AdvancedSearchInputProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  initialValue?: string;
  initialFilters?: Partial<SearchFilters>;
  onResultSelect?: (result: SearchResult) => void;
  showFilters?: boolean;
  showVoiceSearch?: boolean;
  showHistory?: boolean;
  enableAutocomplete?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const AdvancedSearchInput: React.FC<AdvancedSearchInputProps> = ({
  placeholder = "Search artists, shows, venues...",
  className,
  autoFocus = false,
  initialValue = "",
  initialFilters = {},
  onResultSelect,
  showFilters = true,
  showVoiceSearch = true,
  showHistory = true,
  enableAutocomplete = true,
  size = 'md'
}) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [value, setValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    ...initialFilters
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const debouncedValue = useDebounce(value, 300);

  // Size configurations
  const sizeConfig = {
    sm: {
      input: 'h-10 text-sm px-4',
      button: 'h-8 w-8',
      icon: 16,
      dropdown: 'max-h-64'
    },
    md: {
      input: 'h-12 text-base px-4',
      button: 'h-10 w-10',
      icon: 20,
      dropdown: 'max-h-80'
    },
    lg: {
      input: 'h-14 text-lg px-6',
      button: 'h-12 w-12',
      icon: 24,
      dropdown: 'max-h-96'
    }
  };

  const config = sizeConfig[size];

  // Load recent and trending searches on mount
  useEffect(() => {
    const recent = localStorage.getItem('recent-searches');
    if (recent) {
      setRecentSearches(JSON.parse(recent).slice(0, 5));
    }

    // Fetch trending searches
    fetchTrendingSearches();
  }, []);

  const fetchTrendingSearches = async () => {
    try {
      const response = await fetch('/api/search/trending');
      if (response.ok) {
        const data = await response.json();
        setTrendingSearches(data.queries || []);
      }
    } catch (error) {
      console.error('Failed to fetch trending searches:', error);
    }
  };

  // Search function with multiple types
  const searchResults = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        type: filters.type,
        ...(filters.genre && { genre: filters.genre }),
        ...(filters.location && { location: filters.location }),
        ...(filters.verified && { verified: 'true' })
      });

      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      
      // Transform results to unified format
      const searchResults: SearchResult[] = [];
      
      if (data.artists) {
        searchResults.push(...data.artists.map((artist: Artist) => ({
          type: 'artist' as const,
          id: artist.id,
          title: artist.name,
          subtitle: artist.genres.join(', '),
          image: artist.image_url,
          metadata: { verified: artist.verified, followers: artist.followers }
        })));
      }

      if (data.shows) {
        searchResults.push(...data.shows.map((show: Show) => ({
          type: 'show' as const,
          id: show.id,
          title: show.name,
          subtitle: `${show.artist?.name} • ${new Date(show.date).toLocaleDateString()}`,
          image: show.artist?.image_url,
          metadata: { date: show.date, venue: show.venue?.name }
        })));
      }

      if (data.venues) {
        searchResults.push(...data.venues.map((venue: Venue) => ({
          type: 'venue' as const,
          id: venue.id,
          title: venue.name,
          subtitle: `${venue.city}, ${venue.country}`,
          metadata: { capacity: venue.capacity, location: `${venue.city}, ${venue.country}` }
        })));
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Debounced search effect
  useEffect(() => {
    if (debouncedValue && enableAutocomplete) {
      searchResults(debouncedValue);
      setIsOpen(true);
    } else {
      setResults([]);
      if (!debouncedValue) setIsOpen(false);
    }
  }, [debouncedValue, searchResults, enableAutocomplete]);

  // Voice search functionality
  const startVoiceSearch = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setValue(transcript);
        inputRef.current?.focus();
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.start();
    }
  }, []);

  // Save search to history
  const saveSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recent-searches', JSON.stringify(newRecent));
  }, [recentSearches]);

  // Handle result selection
  const handleResultSelect = useCallback((result: SearchResult) => {
    saveSearch(value);
    setIsOpen(false);
    setSelectedIndex(-1);
    
    if (onResultSelect) {
      onResultSelect(result);
    } else {
      // Default navigation behavior
      switch (result.type) {
        case 'artist':
          router.push(`/artists/${result.id}`);
          break;
        case 'show':
          router.push(`/shows/${result.id}`);
          break;
        case 'venue':
          router.push(`/venues/${result.id}`);
          break;
      }
    }
  }, [value, saveSearch, onResultSelect, router]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < results.length - 1 ? prev + 1 : -1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > -1 ? prev - 1 : results.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultSelect(results[selectedIndex]!);
        } else if (value.trim()) {
          saveSearch(value);
          router.push(`/search?q=${encodeURIComponent(value)}`);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, results, selectedIndex, handleResultSelect, value, saveSearch, router]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get result icon
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'artist': return FaSpotify;
      case 'show': return FaCalendar;
      case 'venue': return FaMapMarkerAlt;
      default: return BiSearch;
    }
  };

  // Show suggestions when focused but no value
  const showSuggestions = isOpen && !value && (recentSearches.length > 0 || trendingSearches.length > 0);
  const showResults = isOpen && (results.length > 0 || isLoading);

  return (
    <div className={twMerge("relative w-full", className)} ref={dropdownRef}>
      {/* Main Input Container */}
      <div className="relative">
        {/* Search Input */}
        <div className={twMerge(
          "flex items-center bg-neutral-800 border border-neutral-700 rounded-lg",
          "focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500/20",
          "transition-all duration-200"
        )}>
          <BiSearch className="ml-3 text-neutral-400" size={config.icon} />
          
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={twMerge(
              "flex-1 bg-transparent text-white placeholder-neutral-400",
              "focus:outline-none border-none",
              config.input
            )}
            autoComplete="off"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            role="combobox"
            aria-label="Search"
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-1 pr-2">
            {value && (
              <button
                onClick={() => setValue('')}
                className={twMerge(
                  "flex items-center justify-center rounded-full",
                  "text-neutral-400 hover:text-white transition-colors",
                  config.button
                )}
                aria-label="Clear search"
              >
                <BiX size={config.icon} />
              </button>
            )}

            {showVoiceSearch && 'webkitSpeechRecognition' in window && (
              <button
                onClick={startVoiceSearch}
                disabled={isListening}
                className={twMerge(
                  "flex items-center justify-center rounded-full",
                  "text-neutral-400 hover:text-white transition-colors",
                  "disabled:animate-pulse disabled:text-red-500",
                  config.button
                )}
                aria-label="Voice search"
              >
                <BiMicrophone size={config.icon} />
              </button>
            )}

            {showFilters && (
              <button
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={twMerge(
                  "flex items-center justify-center rounded-full",
                  "text-neutral-400 hover:text-white transition-colors",
                  showFiltersPanel && "text-green-500",
                  config.button
                )}
                aria-label="Search filters"
              >
                <BiFilter size={config.icon} />
              </button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFiltersPanel && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={twMerge(
                "absolute top-full left-0 right-0 mt-2 z-50",
                "bg-neutral-800 border border-neutral-700 rounded-lg p-4",
                "shadow-xl shadow-black/50"
              )}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search Type */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Search Type
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                  >
                    <option value="all">All</option>
                    <option value="artists">Artists</option>
                    <option value="shows">Shows</option>
                    <option value="venues">Venues</option>
                  </select>
                </div>

                {/* Genre Filter */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Genre
                  </label>
                  <input
                    type="text"
                    value={filters.genre || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
                    placeholder="e.g. Rock, Pop, Jazz..."
                    className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white placeholder-neutral-400"
                  />
                </div>

                {/* Location Filter */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={filters.location || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. New York, London..."
                    className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white placeholder-neutral-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={filters.verified || false}
                    onChange={(e) => setFilters(prev => ({ ...prev, verified: e.target.checked }))}
                    className="rounded border-neutral-600 bg-neutral-700 text-green-500 focus:ring-green-500"
                  />
                  Verified artists only
                </label>

                <button
                  onClick={() => setFilters({ type: 'all' })}
                  className="text-sm text-green-500 hover:text-green-400 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dropdown Results */}
      <AnimatePresence>
        {(showSuggestions || showResults) && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={twMerge(
              "absolute top-full left-0 right-0 mt-2 z-40",
              "bg-neutral-800 border border-neutral-700 rounded-lg",
              "shadow-xl shadow-black/50 overflow-hidden",
              config.dropdown
            )}
          >
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent" />
                <span className="ml-2 text-neutral-400">Searching...</span>
              </div>
            )}

            {/* Search Results */}
            {results.length > 0 && !isLoading && (
              <div className="overflow-y-auto">
                {results.map((result, index) => {
                  const Icon = getResultIcon(result.type);
                  const isSelected = index === selectedIndex;
                  
                  return (
                    <motion.button
                      key={`${result.type}-${result.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleResultSelect(result)}
                      className={twMerge(
                        "w-full flex items-center gap-3 p-3 text-left",
                        "hover:bg-neutral-700 transition-colors",
                        "focus:bg-neutral-700 focus:outline-none",
                        isSelected && "bg-neutral-700"
                      )}
                    >
                      {result.image ? (
                        <img
                          src={result.image}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
                          <Icon size={16} className="text-neutral-400" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {result.title}
                          </span>
                          {result.metadata?.verified && (
                            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </div>
                        {result.subtitle && (
                          <p className="text-sm text-neutral-400 truncate">
                            {result.subtitle}
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-neutral-500 capitalize">
                        {result.type}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Recent & Trending Suggestions */}
            {showSuggestions && (
              <div className="overflow-y-auto">
                {recentSearches.length > 0 && (
                  <div className="p-3 border-b border-neutral-700">
                    <div className="flex items-center gap-2 mb-2">
                      <BiHistory size={16} className="text-neutral-400" />
                      <span className="text-sm font-medium text-neutral-300">Recent</span>
                    </div>
                    {recentSearches.map((search, index) => (
                      <button
                        key={search}
                        onClick={() => setValue(search)}
                        className="block w-full text-left px-2 py-1 text-sm text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                )}

                {trendingSearches.length > 0 && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <BiTrendingUp size={16} className="text-neutral-400" />
                      <span className="text-sm font-medium text-neutral-300">Trending</span>
                    </div>
                    {trendingSearches.map((search, index) => (
                      <button
                        key={search}
                        onClick={() => setValue(search)}
                        className="block w-full text-left px-2 py-1 text-sm text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};