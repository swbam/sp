'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BiSearch } from 'react-icons/bi';
import { Input } from '@/components/Input';

interface HeroSearchProps {
  className?: string;
}

export const HeroSearch: React.FC<HeroSearchProps> = ({ className }) => {
  const [searchValue, setSearchValue] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/search?title=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto px-6 ${className || ''}`}>
      <div className="text-center mb-8">
        <h1 className="text-white text-5xl sm:text-6xl lg:text-7xl font-bold mb-4">
          MySetlist
        </h1>
        <p className="text-neutral-300 text-lg sm:text-xl mb-8">
          Discover concerts, predict setlists, and vote on your favorite songs
        </p>
      </div>
      
      <form onSubmit={handleSearch} className="relative">
        <div className="relative group">
          <BiSearch 
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 z-10" 
            size={24} 
          />
          <Input
            type="text"
            placeholder="Search for artists, shows, or venues..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="
              w-full 
              pl-12 
              pr-4 
              py-4 
              text-lg 
              bg-neutral-800/80 
              border-neutral-600 
              rounded-full 
              text-white 
              placeholder-neutral-400
              focus:bg-neutral-800
              focus:border-emerald-500
              focus:ring-2
              focus:ring-emerald-500/20
              backdrop-blur-sm
              transition-all
              duration-200
            "
          />
          <button
            type="submit"
            className="
              absolute 
              right-2 
              top-1/2 
              transform 
              -translate-y-1/2 
              bg-emerald-600 
              hover:bg-emerald-500 
              text-white 
              px-6 
              py-2 
              rounded-full 
              transition-colors
              duration-200
              font-medium
            "
          >
            Search
          </button>
        </div>
      </form>
      
      <div className="flex flex-wrap justify-center gap-3 mt-6">
        <button
          onClick={() => router.push('/search')}
          className="
            bg-neutral-800/60 
            hover:bg-neutral-700/60 
            text-neutral-300 
            px-4 
            py-2 
            rounded-full 
            text-sm 
            transition-colors
            backdrop-blur-sm
          "
        >
          Browse All Artists
        </button>
        <button
          onClick={() => router.push('/shows')}
          className="
            bg-neutral-800/60 
            hover:bg-neutral-700/60 
            text-neutral-300 
            px-4 
            py-2 
            rounded-full 
            text-sm 
            transition-colors
            backdrop-blur-sm
          "
        >
          Upcoming Shows
        </button>
        <button
          onClick={() => router.push('/account')}
          className="
            bg-neutral-800/60 
            hover:bg-neutral-700/60 
            text-neutral-300 
            px-4 
            py-2 
            rounded-full 
            text-sm 
            transition-colors
            backdrop-blur-sm
          "
        >
          My Following
        </button>
      </div>
    </div>
  );
};