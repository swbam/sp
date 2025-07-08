'use client';

import { twMerge } from 'tailwind-merge';

import { usePathname } from 'next/navigation';

import { useMemo } from 'react';
import { HiHome } from 'react-icons/hi';
import { BiSearch } from 'react-icons/bi';
import { FaCalendarAlt } from 'react-icons/fa';

import { Box } from './Box';
import { SidebarItem } from './SidebarItem';
import { Library } from './Library';

//* Declaring the type for the Sidebar component's properties
interface SidebarProps {
  children: React.ReactNode;
}

//* Sidebar component using React Function Component with SidebarProps
export const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  //* Using Next.js usePathname hook to get the current URL path
  const pathname = usePathname();

  //* Defining sidebar routes with useMemo hook for performance optimization
  const routes = useMemo(
    () => [
      {
        icon: HiHome,
        label: 'Home',
        active: pathname === '/',
        href: '/',
      },
      {
        icon: BiSearch,
        label: 'Search Artists',
        active: pathname === '/search',
        href: '/search',
      },
      {
        icon: FaCalendarAlt,
        label: 'Shows',
        active: pathname.startsWith('/shows'),
        href: '/shows',
      },
    ],
    [pathname]
  );

  return (
    <div className="flex h-full">
      <div className="hidden md:flex flex-col gap-y-2 bg-black h-full w-[300px] p-2">
        <Box>
          <div className="flex flex-col gap-y-4 px-5 py-4">
            {routes.map((item) => (
              <SidebarItem key={item.label} {...item} />
            ))}
          </div>
        </Box>
        <Box className="overflow-y-auto h-full">
          <Library followedArtists={[]} />
        </Box>
      </div>
      <main className="h-full flex-1 overflow-y-auto py-2">{children}</main>
    </div>
  );
};
