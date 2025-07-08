'use client';

import qs from 'query-string';
import useDebounce from '@/hooks/useDebounce';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Input } from './Input';

interface SearchInputProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  initialValue?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ 
  placeholder = "Search for artists, shows, or venues...",
  className = "",
  autoFocus = false,
  initialValue = ""
}) => {
  const router = useRouter();
  const [value, setValue] = useState<string>(initialValue);
  const debouncedValue = useDebounce<string>(value, 500);

  useEffect(() => {
    const query = {
      title: debouncedValue,
    };

    const url = qs.stringifyUrl({
      url: '/search',
      query: query,
    });
    
    // Only navigate if there's a value or if we're not already on the search page
    if (debouncedValue || window.location.pathname !== '/search') {
      router.push(url);
    }
  }, [debouncedValue, router]);

  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={className}
      autoFocus={autoFocus}
    />
  );
};
