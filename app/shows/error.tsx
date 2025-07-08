'use client';

import { useEffect } from 'react';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';

export default function ShowsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Shows page error:', error);
  }, [error]);

  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header>
        <div className="mb-2">
          <h1 className="text-white text-3xl font-semibold">
            Something went wrong
          </h1>
        </div>
      </Header>

      <div className="px-6 pb-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-neutral-400 text-lg mb-2">
            Unable to load shows
          </p>
          <p className="text-neutral-500 text-sm mb-6">
            There was an error loading the shows page.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={reset}
              className="bg-white text-black px-6 py-2 w-auto hover:bg-neutral-200"
            >
              Try Again
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
              className="bg-neutral-700 text-white px-6 py-2 w-auto hover:bg-neutral-600"
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}