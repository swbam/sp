'use client';

import { useEffect } from 'react';
import Image from 'next/image';

import { useRouter } from 'next/navigation';

import { useUser } from '@/hooks/useUser';

export const AccountContent = () => {
  const router = useRouter();
  const { isLoading, user } = useUser();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [isLoading, user, router]);

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
            
            <div className="mt-6">
              <h2 className="text-white text-lg font-medium mb-2">MySetlist Activity</h2>
              <div className="space-y-2 text-sm text-neutral-400">
                <p>• Follow your favorite artists to see their upcoming shows</p>
                <p>• Vote on predicted setlists for concerts</p>
                <p>• Discover new artists and shows in your area</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
