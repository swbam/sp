'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface SafeNavigationProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  replace?: boolean;
}

export const SafeNavigation: React.FC<SafeNavigationProps> = ({
  href,
  children,
  className,
  onClick,
  replace = false
}) => {
  const router = useRouter();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    try {
      // Execute custom onClick if provided
      if (onClick) {
        onClick();
      }
      
      // Navigate using Next.js router
      if (replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to window.location if router fails
      window.location.href = href;
    }
  }, [href, onClick, replace, router]);

  return (
    <div 
      className={className}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e as any);
        }
      }}
    >
      {children}
    </div>
  );
};

// Custom hook for safe navigation
export function useSafeNavigation() {
  const router = useRouter();

  const navigateTo = useCallback((href: string, replace = false) => {
    try {
      if (replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to window.location
      window.location.href = href;
    }
  }, [router]);

  const navigateBack = useCallback(() => {
    try {
      router.back();
    } catch (error) {
      console.error('Back navigation error:', error);
      // Fallback to history API
      window.history.back();
    }
  }, [router]);

  const navigateForward = useCallback(() => {
    try {
      router.forward();
    } catch (error) {
      console.error('Forward navigation error:', error);
      // Fallback to history API
      window.history.forward();
    }
  }, [router]);

  return {
    navigateTo,
    navigateBack,
    navigateForward
  };
}