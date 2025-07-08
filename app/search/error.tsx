'use client';

import { Box } from '@/components/Box';
import { Button } from '@/components/Button';
import { useRouter } from 'next/navigation';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const Error = ({ error, reset }: ErrorProps) => {
  const router = useRouter();

  return (
    <Box className="h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-white text-xl font-semibold">
          Search temporarily unavailable
        </h2>
        <p className="text-neutral-400 text-sm max-w-md">
          We&apos;re having trouble with the search functionality. Please try again in a moment.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="text-neutral-300 text-sm cursor-pointer">
              Error details (development only)
            </summary>
            <pre className="mt-2 text-xs text-red-400 bg-neutral-800 p-2 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        
        <div className="flex gap-2 mt-6">
          <Button
            onClick={reset}
            className="bg-green-500 hover:bg-green-600"
          >
            Try Again
          </Button>
          <Button
            onClick={() => router.push('/')}
            className="bg-neutral-700 hover:bg-neutral-600"
          >
            Go Home
          </Button>
        </div>
      </div>
    </Box>
  );
};

export default Error;
