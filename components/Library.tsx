'use client';

import Image from 'next/image';
import { TbUsers } from 'react-icons/tb';
import { AiOutlinePlus } from 'react-icons/ai';

import { useAuthModal } from '@/hooks/useAuthModal';
import { useUser } from '@/hooks/useUser';

import type { UserArtistFollow } from '@/types';

interface LibraryProps {
  followedArtists: UserArtistFollow[];
}

export const Library: React.FC<LibraryProps> = ({ followedArtists }) => {
  //* Hooks initialization
  const authModal = useAuthModal();
  const { user } = useUser();

  const onClick = () => {
    if (!user) {
      return authModal.onOpen();
    }

    // Navigate to search to follow more artists
    window.location.href = '/search';
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="inline-flex items-center gap-x-2">
          <TbUsers className="text-neutral-400" size={26} />
          <p className="text-neutral-400 font-medium text-md">Following Artists</p>
        </div>
        <AiOutlinePlus
          onClick={onClick}
          size={20}
          className="text-neutral-400 cursor-pointer hover:text-white transition"
          title="Follow more artists"
        />
      </div>
      <div className="flex flex-col gap-y-2 mt-4 px-3">
        {followedArtists.length === 0 ? (
          <div className="text-neutral-500 text-xs px-3">
            Follow artists to see their upcoming shows here
          </div>
        ) : (
          followedArtists.map((follow) => (
            <div
              key={follow.artist_id}
              className="flex items-center gap-x-3 cursor-pointer hover:bg-neutral-800 p-2 rounded-md transition"
              onClick={() => window.location.href = `/artists/${follow.artist?.slug}`}
            >
              {follow.artist?.image_url ? (
                <Image
                  className="rounded-md w-12 h-12 object-cover"
                  src={follow.artist.image_url}
                  alt={follow.artist.name}
                  width={48}
                  height={48}
                />
              ) : (
                <div className="rounded-md w-12 h-12 bg-neutral-700 flex items-center justify-center">
                  <TbUsers className="text-neutral-400" size={20} />
                </div>
              )}
              <div className="flex flex-col gap-y-1 overflow-hidden">
                <p className="text-white text-sm truncate">{follow.artist?.name}</p>
                <p className="text-neutral-400 text-xs">Artist</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
