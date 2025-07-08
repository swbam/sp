'use client';

import { FaHeart } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';

interface VoteButtonProps {
  upvotes: number;
  onVote: () => void;
  disabled?: boolean;
  userVoted?: boolean;
  className?: string;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  upvotes,
  onVote,
  disabled = false,
  userVoted = false,
  className
}) => {
  return (
    <div className={twMerge("flex items-center gap-2", className)}>
      {/* Vote Button */}
      <button
        onClick={onVote}
        disabled={disabled}
        className={twMerge(
          "flex items-center gap-2 px-3 py-2 rounded-full transition-colors",
          "hover:bg-neutral-700",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          userVoted 
            ? "bg-red-600 text-white" 
            : "text-neutral-400 hover:text-white border border-neutral-600 hover:border-neutral-500"
        )}
        title={userVoted ? "Remove vote" : "Vote for this song"}
      >
        <FaHeart 
          size={14} 
          className={userVoted ? "text-white" : "text-neutral-400"} 
        />
        <span className="text-sm font-medium">
          {upvotes}
        </span>
      </button>
    </div>
  );
}; 