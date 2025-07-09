'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';

interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  focusVisible: boolean;
  announcements: boolean;
  keyboardNavigation: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: (key: keyof AccessibilitySettings, value: boolean) => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  focusManager: {
    trapFocus: (element: HTMLElement) => () => void;
    skipToContent: () => void;
    restoreFocus: () => void;
  };
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    // Return a default context instead of throwing during build
    return {
      settings: {
        reduceMotion: false,
        highContrast: false,
        largeText: false,
        focusVisible: true,
        announcements: true,
        keyboardNavigation: true,
      },
      updateSetting: () => {},
      announce: () => {},
      focusManager: {
        trapFocus: () => () => {},
        skipToContent: () => {},
        restoreFocus: () => {},
      },
    };
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    focusVisible: true,
    announcements: true,
    keyboardNavigation: true,
  });

  const announceRef = useRef<HTMLDivElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Load settings from localStorage and system preferences
  useEffect(() => {
    setIsClient(true);
    
    const loadSettings = () => {
      try {
        if (typeof window === 'undefined') return;
        
        const savedSettings = localStorage.getItem('accessibility-settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      } catch (error) {
        console.warn('Failed to load accessibility settings:', error);
      }

      // Check system preferences - only if window is available
      try {
        if (typeof window !== 'undefined') {
          const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

          setSettings(prev => ({
            ...prev,
            reduceMotion: prefersReducedMotion,
            highContrast: prefersHighContrast,
          }));
        }
      } catch (error) {
        console.warn('Failed to check system preferences:', error);
      }
    };

    loadSettings();

    // Listen for system preference changes - only if window is available
    try {
      if (typeof window !== 'undefined') {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const contrastQuery = window.matchMedia('(prefers-contrast: high)');

        const handleMotionChange = (e: MediaQueryListEvent) => {
          setSettings(prev => ({ ...prev, reduceMotion: e.matches }));
        };

        const handleContrastChange = (e: MediaQueryListEvent) => {
          setSettings(prev => ({ ...prev, highContrast: e.matches }));
        };

        motionQuery.addEventListener('change', handleMotionChange);
        contrastQuery.addEventListener('change', handleContrastChange);

        return () => {
          motionQuery.removeEventListener('change', handleMotionChange);
          contrastQuery.removeEventListener('change', handleContrastChange);
        };
      }
    } catch (error) {
      console.warn('Failed to set up media query listeners:', error);
    }
    
    // Return empty cleanup function if no listeners were set
    return () => {};
  }, []);

  // Apply settings to document
  useEffect(() => {
    if (!isClient || typeof document === 'undefined') return;
    
    const root = document.documentElement;
    
    // Apply CSS custom properties based on settings
    root.style.setProperty('--motion-duration', settings.reduceMotion ? '0ms' : '200ms');
    root.style.setProperty('--motion-easing', settings.reduceMotion ? 'linear' : 'ease-in-out');
    
    // Apply CSS classes
    root.classList.toggle('reduce-motion', settings.reduceMotion);
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('large-text', settings.largeText);
    root.classList.toggle('focus-visible', settings.focusVisible);
    
    // Save settings to localStorage
    try {
      localStorage.setItem('accessibility-settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save accessibility settings:', error);
    }
  }, [settings, isClient]);

  // Keyboard navigation
  useEffect(() => {
    if (!isClient || typeof document === 'undefined') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!settings.keyboardNavigation) return;
      
      // Skip to content functionality
      if (e.key === 'Tab' && e.shiftKey && e.ctrlKey) {
        e.preventDefault();
        skipToContent();
      }
      
      // Escape key to close modals or return focus
      if (e.key === 'Escape') {
        restoreFocus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settings.keyboardNavigation, isClient]);

  const updateSetting = (key: keyof AccessibilitySettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.announcements || !isClient) return;
    
    if (announceRef.current) {
      announceRef.current.setAttribute('aria-live', priority);
      announceRef.current.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        if (announceRef.current) {
          announceRef.current.textContent = '';
        }
      }, 1000);
    }
  };

  const trapFocus = (element: HTMLElement) => {
    if (!isClient || typeof document === 'undefined') return () => {};
    
    const focusableElements = element.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
    );
    
    const firstFocusableElement = focusableElements[0] as HTMLElement;
    const lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    
    // Focus first element
    if (firstFocusableElement) {
      firstFocusableElement.focus();
    }

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  };

  const skipToContent = () => {
    if (!isClient || typeof document === 'undefined') return;
    
    const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
    if (mainContent) {
      (mainContent as HTMLElement).focus();
      announce('Skipped to main content');
    }
  };

  const restoreFocus = () => {
    if (!isClient || typeof document === 'undefined') return;
    
    if (lastFocusedElement.current) {
      lastFocusedElement.current.focus();
      lastFocusedElement.current = null;
    }
  };

  const focusManager = {
    trapFocus,
    skipToContent,
    restoreFocus,
  };

  const value = {
    settings,
    updateSetting,
    announce,
    focusManager,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      {/* Screen reader announcements */}
      <div
        ref={announceRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />
      
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white focus:text-black focus:no-underline"
        onFocus={() => {
          lastFocusedElement.current = document.activeElement as HTMLElement;
        }}
      >
        Skip to main content
      </a>
    </AccessibilityContext.Provider>
  );
};