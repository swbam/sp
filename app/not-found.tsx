import { Box } from '@/components/Box';
import { Button } from '@/components/Button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Box className="h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-6xl mb-4">🎵</div>
        <h2 className="text-white text-2xl font-semibold">
          Page Not Found
        </h2>
        <p className="text-neutral-400 text-sm max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        
        <div className="flex gap-2 mt-6 justify-center">
          <Link href="/">
            <Button className="bg-green-500 hover:bg-green-600">
              Go Home
            </Button>
          </Link>
          <Link href="/search">
            <Button className="bg-neutral-700 hover:bg-neutral-600">
              Search Artists
            </Button>
          </Link>
        </div>
      </div>
    </Box>
  );
}