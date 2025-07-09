'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { twMerge } from 'tailwind-merge';
import { OptimizedIcon } from './LazyIcons';

// WCAG 2.1 AA compliance utility functions
export const wcagUtils = {
  // Calculate contrast ratio between two colors
  contrastRatio: (color1: string, color2: string): number => {
    const getLuminance = (hex: string): number => {
      const rgb = parseInt(hex.replace('#', ''), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      
      const sRGB = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      
      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    };
    
    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  },
  
  // Check if contrast meets WCAG AA standards
  meetsWCAGAA: (color1: string, color2: string): boolean => {
    return wcagUtils.contrastRatio(color1, color2) >= 4.5;
  },
  
  // Check if contrast meets WCAG AAA standards
  meetsWCAGAAA: (color1: string, color2: string): boolean => {
    return wcagUtils.contrastRatio(color1, color2) >= 7;
  }
};

// Accessibility announcement component
export const AccessibilityAnnouncement: React.FC<{ message: string; priority?: 'polite' | 'assertive' }> = ({ 
  message, 
  priority = 'polite' 
}) => {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};

// Skip link component for keyboard navigation
export const SkipLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {children}
    </a>
  );
};

// Focus trap utility for modals and dialogs
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
      
      if (e.key === 'Escape') {
        // Let parent handle escape
        e.stopPropagation();
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);
  
  return containerRef;
};

// Accessible button component with enhanced keyboard support
export const AccessibleButton: React.FC<{
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  className?: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}> = ({
  onClick,
  onKeyDown,
  disabled = false,
  ariaLabel,
  ariaPressed,
  ariaExpanded,
  className,
  children,
  variant = 'primary',
  size = 'md'
}) => {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-neutral-700 text-white hover:bg-neutral-600 focus:ring-neutral-500",
    ghost: "text-neutral-400 hover:text-white hover:bg-neutral-800 focus:ring-neutral-500"
  };
  
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm rounded-md",
    md: "px-4 py-2 text-base rounded-lg",
    lg: "px-6 py-3 text-lg rounded-lg"
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
    onKeyDown?.(e);
  };
  
  return (
    <button
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      className={twMerge(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </button>
  );
};

// Accessible form field with proper labeling
export const AccessibleFormField: React.FC<{
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}> = ({ id, label, error, required, helpText, children }) => {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-white"
      >
        {label}
        {required && <span className="text-red-400 ml-1" aria-label="required">*</span>}
      </label>
      
      <div className="relative">
        {children}
        
        {helpText && (
          <p id={helpId} className="text-xs text-neutral-400 mt-1">
            {helpText}
          </p>
        )}
        
        {error && (
          <p id={errorId} className="text-xs text-red-400 mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

// High contrast mode toggle
export const HighContrastToggle: React.FC = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);
  
  useEffect(() => {
    const saved = localStorage.getItem('highContrast');
    if (saved === 'true') {
      setIsHighContrast(true);
      document.documentElement.classList.add('high-contrast');
    }
  }, []);
  
  const toggleHighContrast = () => {
    const newState = !isHighContrast;
    setIsHighContrast(newState);
    localStorage.setItem('highContrast', newState.toString());
    
    if (newState) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  };
  
  return (
    <AccessibleButton
      onClick={toggleHighContrast}
      ariaLabel={`Turn ${isHighContrast ? 'off' : 'on'} high contrast mode`}
      ariaPressed={isHighContrast}
      variant="ghost"
      size="sm"
      className="fixed top-4 right-4 z-50"
    >
      <OptimizedIcon 
        iconSet="lucide" 
        iconName={isHighContrast ? "Eye" : "EyeOff"} 
        size={20} 
      />
      <span className="sr-only">
        {isHighContrast ? 'Turn off high contrast' : 'Turn on high contrast'}
      </span>
    </AccessibleButton>
  );
};

// Reduce motion preference detection
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  return prefersReducedMotion;
};

// Accessible progress indicator
export const AccessibleProgress: React.FC<{
  value: number;
  max?: number;
  label?: string;
  className?: string;
}> = ({ value, max = 100, label, className }) => {
  const percentage = Math.round((value / max) * 100);
  
  return (
    <div className={twMerge("w-full", className)}>
      {label && (
        <div className="flex justify-between text-sm text-neutral-400 mb-1">
          <span>{label}</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="w-full bg-neutral-800 rounded-full h-2"
      >
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="sr-only">{percentage}% complete</span>
    </div>
  );
};

// Accessible tooltip
export const AccessibleTooltip: React.FC<{
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
  
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };
  
  const showTooltip = isVisible || isFocused;
  
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <div
        aria-describedby={showTooltip ? tooltipId : undefined}
        tabIndex={0}
      >
        {children}
      </div>
      
      {showTooltip && (
        <div
          id={tooltipId}
          role="tooltip"
          className={twMerge(
            "absolute z-50 px-2 py-1 text-sm text-white bg-neutral-800 rounded-md shadow-lg border border-neutral-700",
            positionClasses[position]
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

// Accessible card component with proper focus management
export const AccessibleCard: React.FC<{
  onClick?: () => void;
  href?: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  focusable?: boolean;
}> = ({ onClick, href, className, children, ariaLabel, focusable = true }) => {
  const baseClasses = "block rounded-lg border border-neutral-700 bg-neutral-800 transition-all duration-200 hover:border-neutral-600 hover:bg-neutral-700";
  const focusClasses = "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900";
  
  if (href) {
    return (
      <a
        href={href}
        className={twMerge(baseClasses, focusable && focusClasses, className)}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }
  
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={twMerge(baseClasses, focusable && focusClasses, "w-full text-left", className)}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }
  
  return (
    <div
      className={twMerge(baseClasses, className)}
      role={focusable ? "button" : undefined}
      tabIndex={focusable ? 0 : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
};