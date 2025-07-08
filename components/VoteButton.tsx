'use client';

import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';

interface VoteButtonProps {
  upvotes: number;
  downvotes: number;
  onVote: (type: 'up' | 'down') => void;
  disabled?: boolean;
  userVote?: 'up' | 'down' | null;
  className?: string;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  upvotes,
  downvotes,
  onVote,
  disabled = false,
  userVote = null,
  className
}) => {
  const netScore = upvotes - downvotes;

  return (
    <div className={twMerge("flex items-center gap-2", className)}>
      {/* Upvote Button */}
      <button
        onClick={() => onVote('up')}
        disabled={disabled}
        className={twMerge(
          "p-2 rounded-full transition-colors",
          "hover:bg-neutral-700",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          userVote === 'up' 
            ? "bg-green-600 text-white" 
            : "text-neutral-400 hover:text-white"
        )}
        title="Upvote this song"
      >
        <FaThumbsUp size={16} />
      </button>

      {/* Score Display */}
      <div className="flex flex-col items-center min-w-[40px]">
        <span className={twMerge(
          "text-sm font-semibold text-center",
          netScore > 0 && "text-green-400",
          netScore < 0 && "text-red-400", 
          netScore === 0 && "text-neutral-400"
        )}>
          {netScore > 0 ? `+${netScore}` : netScore}
        </span>
        <span className="text-xs text-neutral-500">
          {upvotes + downvotes} votes
        </span>
      </div>

      {/* Downvote Button */}
      <button
        onClick={() => onVote('down')}
        disabled={disabled}
        className={twMerge(
          "p-2 rounded-full transition-colors",
          "hover:bg-neutral-700",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          userVote === 'down' 
            ? "bg-red-600 text-white" 
            : "text-neutral-400 hover:text-white"
        )}
        title="Downvote this song"
      >
        <FaThumbsDown size={16} />
      </button>
    </div>
  );
}; 