'use client';

import { useEffect } from 'react';
import { Button } from '@/components/Button';

export default function TrendingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Trending page error:', error);
  }, [error]);

  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-2xl font-bold text-white mb-4">
          Something went wrong with trending data
        </h2>
        <p className="text-neutral-400 mb-8 max-w-md">
          We&apos;re having trouble loading the trending shows and artists. 
          Please try again or check back later.
        </p>
        <div className="flex gap-4">
          <Button onClick={reset} className="bg-purple-600 hover:bg-purple-700">
            Try Again
          </Button>
          <Button 
            onClick={() => window.location.href = '/'}
            className="bg-neutral-600 hover:bg-neutral-700"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}