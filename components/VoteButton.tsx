'use client';

import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';
import { useState, useEffect } from 'react';

interface VoteButtonProps {
  upvotes: number;
  downvotes?: number;
  onVote: (type: 'up' | 'down') => void;
  disabled?: boolean;
  userVote?: 'up' | 'down' | null;
  className?: string;
  isLoading?: boolean;
  showPulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  upvotes,
  downvotes = 0,
  onVote,
  disabled = false,
  userVote = null,
  className,
  isLoading = false,
  showPulse = false,
  size = 'md'
}) => {
  const [pendingVote, setPendingVote] = useState<'up' | 'down' | null>(null);
  const [animateScore, setAnimateScore] = useState(false);
  const [previousScore, setPreviousScore] = useState(upvotes - downvotes);
  
  const score = upvotes - downvotes;

  // Size configurations for responsive design
  const sizeConfig = {
    sm: {
      button: 'px-1.5 py-0.5 min-h-[32px] min-w-[32px]', // WCAG AA touch target
      icon: 10,
      text: 'text-xs',
      score: 'text-xs min-w-[24px]',
      gap: 'gap-1'
    },
    md: {
      button: 'px-2 py-1 min-h-[44px] min-w-[44px]', // WCAG AA touch target
      icon: 12,
      text: 'text-sm',
      score: 'text-sm min-w-[30px]',
      gap: 'gap-2'
    },
    lg: {
      button: 'px-3 py-2 min-h-[48px] min-w-[48px]', // Enhanced touch target
      icon: 14,
      text: 'text-base',
      score: 'text-base min-w-[36px]',
      gap: 'gap-3'
    }
  };

  const config = sizeConfig[size];

  // Animate score changes
  useEffect(() => {
    if (score !== previousScore) {
      setAnimateScore(true);
      const timer = setTimeout(() => {
        setAnimateScore(false);
        setPreviousScore(score);
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [score, previousScore]);

  const handleVote = async (type: 'up' | 'down') => {
    if (disabled || isLoading) return;
    
    setPendingVote(type);
    try {
      await onVote(type);
    } finally {
      setPendingVote(null);
    }
  };

  const getButtonClasses = (type: 'up' | 'down') => {
    const baseClasses = [
      'flex items-center justify-center rounded-full transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      config.button,
      config.gap
    ];

    if (userVote === type) {
      baseClasses.push(
        type === 'up' 
          ? 'bg-green-600 text-white focus:ring-green-500 shadow-lg shadow-green-500/25' 
          : 'bg-red-600 text-white focus:ring-red-500 shadow-lg shadow-red-500/25'
      );
    } else {
      baseClasses.push(
        'text-neutral-400 hover:text-white hover:bg-neutral-700',
        type === 'up' 
          ? 'hover:bg-green-600/20 focus:ring-green-500' 
          : 'hover:bg-red-600/20 focus:ring-red-500'
      );
    }

    if (pendingVote === type || isLoading) {
      baseClasses.push('animate-pulse');
    }

    if (showPulse && userVote !== type) {
      baseClasses.push('animate-bounce');
    }

    return twMerge(...baseClasses);
  };

  const getIconClasses = (type: 'up' | 'down') => {
    const baseClasses = ['transition-transform duration-200'];
    
    if (userVote === type) {
      baseClasses.push('text-white scale-110');
    } else {
      baseClasses.push('text-neutral-400 group-hover:text-white');
    }

    if (pendingVote === type) {
      baseClasses.push('animate-spin');
    }

    return twMerge(...baseClasses);
  };

  return (
    <div 
      className={twMerge("flex items-center", config.gap, className)}
      role="group"
      aria-label="Vote on this song"
    >
      {/* Upvote Button */}
      <button
        onClick={() => handleVote('up')}
        disabled={disabled || isLoading}
        className={getButtonClasses('up')}
        aria-label={userVote === 'up' ? "Remove upvote" : "Upvote this song"}
        aria-pressed={userVote === 'up'}
        type="button"
      >
        <FaThumbsUp 
          size={config.icon} 
          className={getIconClasses('up')}
          aria-hidden="true"
        />
        <span className={twMerge(config.text, "font-medium sr-only sm:not-sr-only")}>
          {upvotes}
        </span>
      </button>

      {/* Score Display with Animation */}
      <div
        className={twMerge(
          "font-semibold text-center transition-all duration-300",
          config.score,
          score > 0 && "text-green-400",
          score < 0 && "text-red-400", 
          score === 0 && "text-neutral-400",
          animateScore && "scale-125 animate-pulse"
        )}
        aria-live="polite"
        aria-label={`Score: ${score > 0 ? '+' : ''}${score}`}
      >
        {score > 0 ? `+${score}` : score}
      </div>

      {/* Downvote Button */}
      <button
        onClick={() => handleVote('down')}
        disabled={disabled || isLoading}
        className={getButtonClasses('down')}
        aria-label={userVote === 'down' ? "Remove downvote" : "Downvote this song"}
        aria-pressed={userVote === 'down'}
        type="button"
      >
        <FaThumbsDown 
          size={config.icon} 
          className={getIconClasses('down')}
          aria-hidden="true"
        />
        <span className={twMerge(config.text, "font-medium sr-only sm:not-sr-only")}>
          {downvotes}
        </span>
      </button>
    </div>
  );
}; 