'use client';

import { twMerge } from 'tailwind-merge';
import { BiWifi, BiRefresh, BiHome, BiSearch } from 'react-icons/bi';
import { FaMusic } from 'react-icons/fa';

export function OfflineContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Offline Icon with Animation */}
        <div className="relative">
          <div className="w-24 h-24 mx-auto bg-neutral-800 rounded-full flex items-center justify-center relative">
            <BiWifi 
              size={48} 
              className="text-neutral-500"
            />
            {/* Animated "X" overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-0.5 bg-red-500 transform rotate-45 animate-pulse" />
              <div className="w-16 h-0.5 bg-red-500 transform -rotate-45 animate-pulse absolute" />
            </div>
          </div>
          
          {/* Pulse animation around icon */}
          <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full border-2 border-red-500/30 animate-ping" />
        </div>

        {/* Main Message */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-white">
            You&apos;re Offline
          </h1>
          <p className="text-lg text-neutral-300">
            MySetlist is not available right now. Check your internet connection and try again.
          </p>
        </div>

        {/* Feature List - What works offline */}
        <div className="bg-neutral-800/50 rounded-lg p-6 border border-neutral-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FaMusic size={20} className="text-green-500" />
            Available Offline
          </h2>
          <ul className="space-y-3 text-sm text-neutral-300">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Recently viewed artists and shows</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Cached search results</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Your voting history</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span>Votes will sync when you&apos;re back online</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className={twMerge(
              "w-full flex items-center justify-center gap-3 px-6 py-4",
              "bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg",
              "transition-colors duration-200",
              "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
            )}
            aria-label="Try to reconnect"
          >
            <BiRefresh size={20} />
            Try Again
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => window.history.back()}
              className={twMerge(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3",
                "bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white",
                "rounded-lg transition-colors duration-200",
                "focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
              )}
              aria-label="Go back to previous page"
            >
              <span>Go Back</span>
            </button>

            <a
              href="/"
              className={twMerge(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3",
                "bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white",
                "rounded-lg transition-colors duration-200",
                "focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
              )}
              aria-label="Go to home page"
            >
              <BiHome size={16} />
              <span>Home</span>
            </a>
          </div>
        </div>

        {/* Connection Status */}
        <div className="space-y-2">
          <p className="text-sm text-neutral-500">
            Connection Status: <span className="text-red-400 font-medium">Offline</span>
          </p>
          <p className="text-xs text-neutral-600">
            MySetlist will automatically reconnect when your internet is restored
          </p>
        </div>

        {/* Tips for offline usage */}
        <details className="text-left">
          <summary className="text-sm text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
            Offline Usage Tips
          </summary>
          <div className="mt-3 space-y-2 text-xs text-neutral-500">
            <p>• Your votes are saved locally and will sync automatically when you reconnect</p>
            <p>• Previously viewed content remains available offline</p>
            <p>• Use the browser&apos;s back button to navigate to cached pages</p>
            <p>• Search results from your recent activity are still accessible</p>
          </div>
        </details>
      </div>
    </div>
  );
}