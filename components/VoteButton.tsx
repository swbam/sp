'use client';

import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';

interface VoteButtonProps {
  upvotes: number;
  downvotes?: number;
  onVote: (type: 'up' | 'down') => void;
  disabled?: boolean;
  userVote?: 'up' | 'down' | null;
  className?: string;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  upvotes,
  downvotes = 0,
  onVote,
  disabled = false,
  userVote = null,
  className
}) => {
  const score = upvotes - downvotes;

  return (
    <div className={twMerge("flex items-center gap-2", className)}>
      {/* Upvote Button */}
      <button
        onClick={() => onVote('up')}
        disabled={disabled}
        className={twMerge(
          "flex items-center gap-1 px-2 py-1 rounded-full transition-colors",
          "hover:bg-neutral-700",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          userVote === 'up' 
            ? "bg-green-600 text-white" 
            : "text-neutral-400 hover:text-white"
        )}
        title={userVote === 'up' ? "Remove upvote" : "Upvote this song"}
      >
        <FaThumbsUp 
          size={12} 
          className={userVote === 'up' ? "text-white" : "text-neutral-400"} 
        />
        <span className="text-xs font-medium">
          {upvotes}
        </span>
      </button>

      {/* Score Display */}
      <span className={twMerge(
        "text-sm font-semibold min-w-[30px] text-center",
        score > 0 && "text-green-400",
        score < 0 && "text-red-400",
        score === 0 && "text-neutral-400"
      )}>
        {score > 0 ? `+${score}` : score}
      </span>

      {/* Downvote Button */}
      <button
        onClick={() => onVote('down')}
        disabled={disabled}
        className={twMerge(
          "flex items-center gap-1 px-2 py-1 rounded-full transition-colors",
          "hover:bg-neutral-700",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          userVote === 'down' 
            ? "bg-red-600 text-white" 
            : "text-neutral-400 hover:text-white"
        )}
        title={userVote === 'down' ? "Remove downvote" : "Downvote this song"}
      >
        <FaThumbsDown 
          size={12} 
          className={userVote === 'down' ? "text-white" : "text-neutral-400"} 
        />
        <span className="text-xs font-medium">
          {downvotes}
        </span>
      </button>
    </div>
  );
}; 