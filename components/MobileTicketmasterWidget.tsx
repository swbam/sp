'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import { OptimizedIcon } from './LazyIcons';
import { useDebounce } from '@/hooks/useDebounce';

interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
    };
  };
  priceRanges?: Array<{
    min: number;
    max: number;
    currency: string;
  }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      city: { name: string };
      state?: { name: string };
      country: { name: string };
    }>;
  };
  images?: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  status?: {
    code: string;
  };
  sales?: {
    public?: {
      startDateTime: string;
      endDateTime: string;
    };
  };
}

interface MobileTicketmasterWidgetProps {
  artistName: string;
  className?: string;
  maxResults?: number;
  autoSearch?: boolean;
  onEventSelect?: (event: TicketmasterEvent) => void;
}

export const MobileTicketmasterWidget: React.FC<MobileTicketmasterWidgetProps> = ({
  artistName,
  className,
  maxResults = 10,
  autoSearch = true,
  onEventSelect
}) => {
  const [events, setEvents] = useState<TicketmasterEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(artistName);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TicketmasterEvent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const searchEvents = useCallback(async (term: string) => {
    if (!term.trim()) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ticketmaster/events?keyword=${encodeURIComponent(term)}&size=${maxResults}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [maxResults]);

  useEffect(() => {
    if (autoSearch && debouncedSearchTerm) {
      searchEvents(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, searchEvents, autoSearch]);

  useEffect(() => {
    if (artistName && artistName !== searchTerm) {
      setSearchTerm(artistName);
    }
  }, [artistName, searchTerm]);

  const handleEventSelect = (event: TicketmasterEvent) => {
    setSelectedEvent(event);
    onEventSelect?.(event);
  };

  const formatPrice = (priceRanges?: Array<{ min: number; max: number; currency: string }>) => {
    if (!priceRanges || priceRanges.length === 0) return null;
    
    const price = priceRanges[0];
    if (price.min === price.max) {
      return `${price.currency} ${price.min}`;
    }
    return `${price.currency} ${price.min} - ${price.max}`;
  };

  const formatDate = (dateString: string, timeString?: string) => {
    const date = new Date(dateString + (timeString ? `T${timeString}` : ''));
    return {
      date: date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      time: timeString ? date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      }) : null
    };
  };

  const getEventStatus = (event: TicketmasterEvent) => {
    const now = new Date();
    const eventDate = new Date(event.dates.start.localDate);
    
    if (event.status?.code === 'onsale') {
      return { status: 'On Sale', color: 'text-green-400' };
    }
    
    if (event.sales?.public?.startDateTime) {
      const saleStart = new Date(event.sales.public.startDateTime);
      if (now < saleStart) {
        return { status: 'Pre-Sale', color: 'text-yellow-400' };
      }
    }
    
    if (eventDate < now) {
      return { status: 'Past Event', color: 'text-neutral-500' };
    }
    
    return { status: 'Available', color: 'text-blue-400' };
  };

  const EventCard = ({ event }: { event: TicketmasterEvent }) => {
    const venue = event._embedded?.venues?.[0];
    const { date, time } = formatDate(event.dates.start.localDate, event.dates.start.localTime);
    const price = formatPrice(event.priceRanges);
    const eventStatus = getEventStatus(event);

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
        onClick={() => handleEventSelect(event)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleEventSelect(event);
          }
        }}
        aria-label={`View details for ${event.name}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate text-sm mb-1">
              {event.name}
            </h3>
            {venue && (
              <p className="text-xs text-neutral-400 truncate">
                {venue.name}, {venue.city.name}
                {venue.state && `, ${venue.state.name}`}
              </p>
            )}
          </div>
          <div className="ml-3 flex-shrink-0">
            <OptimizedIcon 
              iconSet="lucide" 
              iconName="ExternalLink" 
              size={16} 
              className="text-neutral-400" 
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-xs">
              <div className="text-white font-medium">{date}</div>
              {time && <div className="text-neutral-400">{time}</div>}
            </div>
            <div className={twMerge("text-xs font-medium", eventStatus.color)}>
              {eventStatus.status}
            </div>
          </div>
          
          {price && (
            <div className="text-xs text-neutral-300 font-medium">
              {price}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={twMerge(
        "bg-neutral-900 rounded-lg border border-neutral-700",
        "shadow-lg",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <OptimizedIcon 
              iconSet="lucide" 
              iconName="Ticket" 
              size={20} 
              className="text-blue-400" 
            />
            <h2 className="text-lg font-semibold text-white">
              Tickets
            </h2>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-full hover:bg-neutral-800 transition-colors"
            aria-label={isExpanded ? "Collapse tickets" : "Expand tickets"}
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
              placeholder="Search for events..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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

              {events.length === 0 && !loading && !error && (
                <div className="text-center py-8">
                  <OptimizedIcon 
                    iconSet="lucide" 
                    iconName="Calendar" 
                    size={48} 
                    className="text-neutral-600 mx-auto mb-3" 
                  />
                  <p className="text-neutral-400 text-sm">
                    No events found for &quot;{searchTerm}&quot;
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <AnimatePresence>
                  {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </AnimatePresence>
              </div>

              {events.length > 0 && (
                <div className="mt-4 text-center">
                  <a
                    href={`https://www.ticketmaster.com/search?q=${encodeURIComponent(searchTerm)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center space-x-1"
                  >
                    <span>View all on Ticketmaster</span>
                    <OptimizedIcon 
                      iconSet="lucide" 
                      iconName="ExternalLink" 
                      size={12} 
                    />
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};