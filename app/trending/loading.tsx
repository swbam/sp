export default function TrendingLoading() {
  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      {/* Header Skeleton */}
      <div className="relative bg-gradient-to-b from-purple-800/40 via-purple-900/20 to-neutral-900 pt-8 pb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
        <div className="relative z-10 px-6">
          <div className="h-10 bg-neutral-800 rounded-lg w-64 mb-4 animate-pulse" />
          <div className="h-6 bg-neutral-800 rounded-lg w-96 animate-pulse" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="px-6 py-8 space-y-8">
        {/* Tabs Skeleton */}
        <div className="flex gap-4 justify-between">
          <div className="flex gap-2">
            <div className="h-12 bg-neutral-800 rounded-lg w-32 animate-pulse" />
            <div className="h-12 bg-neutral-800 rounded-lg w-32 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 bg-neutral-800 rounded-md w-20 animate-pulse" />
            <div className="h-10 bg-neutral-800 rounded-md w-24 animate-pulse" />
            <div className="h-10 bg-neutral-800 rounded-md w-28 animate-pulse" />
          </div>
        </div>

        {/* Content Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="bg-neutral-800 rounded-lg h-32 animate-pulse"
            />
          ))}
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-neutral-800 rounded-lg h-20 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}