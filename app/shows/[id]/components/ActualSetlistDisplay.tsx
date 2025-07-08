'use client';

import { useState, useEffect } from 'react';
import { FaCheckCircle, FaClock, FaMusic } from 'react-icons/fa';
import type { SetlistSong } from '@/types';

interface ActualSetlistDisplayProps {
  showId: string;
  artistName?: string;
  showDate?: string;
}

export const ActualSetlistDisplay: React.FC<ActualSetlistDisplayProps> = ({
  showId,
  artistName,
  showDate
}) => {
  const [actualSetlist, setActualSetlist] = useState<SetlistSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    const loadActualSetlist = async () => {
      try {
        // Try to get actual setlist from our database first
        const response = await fetch(`/api/setlists?show_id=${showId}&type=actual`);
        const data = await response.json();

        if (data.setlist?.setlist_songs?.length > 0) {
          setActualSetlist(data.setlist.setlist_songs);
          setAccuracy(data.setlist.accuracy_score);
        } else if (artistName && showDate) {
          // Fallback: Try to fetch from Setlist.fm
          const setlistFmResponse = await fetch(
            `/api/setlists/import?artist=${encodeURIComponent(artistName)}&date=${showDate}&show_id=${showId}`
          );
          
          if (setlistFmResponse.ok) {
            const importedData = await setlistFmResponse.json();
            if (importedData.setlist?.setlist_songs) {
              setActualSetlist(importedData.setlist.setlist_songs);
              setAccuracy(importedData.accuracy_score);
            }
          }
        }
      } catch (error) {
        console.error('Error loading actual setlist:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadActualSetlist();
  }, [showId, artistName, showDate]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-neutral-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-neutral-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-neutral-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (actualSetlist.length === 0) {
    return (
      <div className="text-center py-8">
        <FaClock className="mx-auto text-neutral-500 text-4xl mb-4" />
        <h3 className="text-white text-lg font-semibold mb-2">
          Actual Setlist Not Available
        </h3>
        <p className="text-neutral-400 text-sm mb-4">
          The actual setlist for this show hasn&apos;t been documented yet.
        </p>
        {artistName && (
          <p className="text-neutral-500 text-xs">
            We&apos;ll automatically import the setlist from Setlist.fm once it becomes available.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Accuracy Score */}
      {accuracy !== null && (
        <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
          <div className="flex items-center gap-3">
            <FaCheckCircle className="text-green-500" />
            <div>
              <h4 className="text-white font-semibold">Prediction Accuracy</h4>
              <p className="text-neutral-400 text-sm">
                {accuracy}% of predicted songs were actually played
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actual Setlist */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <FaMusic className="text-emerald-500" />
          <h4 className="text-white font-semibold">Songs Performed</h4>
          <span className="text-neutral-400 text-sm">({actualSetlist.length} songs)</span>
        </div>

        {actualSetlist.map((song, index) => (
          <div
            key={song.id}
            className="flex items-center gap-4 p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            {/* Position */}
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {song.position || index + 1}
              </span>
            </div>

            {/* Song Info */}
            <div className="flex-grow min-w-0">
              <h5 className="text-white font-medium truncate">
                {song.song?.title || 'Unknown Song'}
              </h5>
              {song.notes && (
                <p className="text-neutral-400 text-xs mt-1">
                  {song.notes}
                </p>
              )}
            </div>

            {/* Play Time */}
            {song.play_time && (
              <div className="flex-shrink-0 text-neutral-400 text-xs">
                {new Date(song.play_time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}

            {/* Played Indicator */}
            <div className="flex-shrink-0">
              {song.is_played ? (
                <FaCheckCircle className="text-green-500" />
              ) : (
                <FaClock className="text-neutral-500" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Source Attribution */}
      <div className="text-center text-neutral-500 text-xs mt-6 pt-4 border-t border-neutral-800">
        Setlist data sourced from Setlist.fm and user contributions
      </div>
    </div>
  );
}; 