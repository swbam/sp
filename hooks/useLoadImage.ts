import type { Artist } from '@/types';

export const useLoadImage = (artist: Artist | null) => {
  if (!artist || !artist.image_url) {
    return '/images/music-placeholder.png';
  }

  return artist.image_url;
};
