'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSpotify } from 'react-icons/fa';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/Button';
import toast from 'react-hot-toast';

export const AccountContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading, user } = useUser();
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [isLoading, user, router]);

  // Handle Spotify OAuth callback results
  useEffect(() => {
    const spotifyConnected = searchParams.get('spotify_connected');
    const artistsSynced = searchParams.get('artists_synced');
    const spotifyError = searchParams.get('spotify_error');

    if (spotifyConnected === 'true') {
      toast.success(`Successfully connected Spotify! Synced ${artistsSynced || 0} artists.`);
      // Clean up URL params
      router.replace('/account');
    } else if (spotifyError === 'true') {
      toast.error('Failed to connect Spotify. Please try again.');
      // Clean up URL params
      router.replace('/account');
    }
  }, [searchParams, router]);

  const handleSpotifyConnect = async () => {
    setIsConnectingSpotify(true);
    
    try {
      const response = await fetch('/api/auth/spotify', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Spotify OAuth');
      }

      const data = await response.json();
      window.location.href = data.auth_url;
    } catch (error) {
      console.error('Spotify connect error:', error);
      toast.error('Failed to connect Spotify. Please try again.');
      setIsConnectingSpotify(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-7 px-6">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mb-7 px-6">
      <div className="flex flex-col gap-y-4">
        <h1 className="text-white text-2xl font-semibold">Account</h1>
        
        {user && (
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center gap-x-4">
              {user.user_metadata?.avatar_url && (
                <Image
                  className="w-16 h-16 rounded-full object-cover"
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  width={64}
                  height={64}
                />
              )}
              <div>
                <p className="text-white font-medium">
                  {user.user_metadata?.full_name || user.email}
                </p>
                <p className="text-neutral-400 text-sm">{user.email}</p>
              </div>
            </div>
            
            <div className="mt-6 space-y-6">
              <div>
                <h2 className="text-white text-lg font-medium mb-4">Connect Your Music</h2>
                <div className="bg-neutral-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-3">
                      <FaSpotify className="text-green-500 text-2xl" />
                      <div>
                        <p className="text-white font-medium">Spotify</p>
                        <p className="text-neutral-400 text-sm">
                          Sync your followed artists to see their upcoming shows
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleSpotifyConnect}
                      disabled={isConnectingSpotify}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full font-medium transition"
                    >
                      {isConnectingSpotify ? 'Connecting...' : 'Connect'}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-white text-lg font-medium mb-2">MySetlist Activity</h2>
                <div className="space-y-2 text-sm text-neutral-400">
                  <p>• Follow your favorite artists to see their upcoming shows</p>
                  <p>• Vote on predicted setlists for concerts</p>
                  <p>• Discover new artists and shows in your area</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
