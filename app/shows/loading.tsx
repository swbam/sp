import { Header } from '@/components/Header';

export default function ShowsLoading() {
  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header>
        <div className="mb-2">
          <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-neutral-800 rounded animate-pulse" />
        </div>
      </Header>

      <div className="px-6 pb-6">
        {/* Featured Shows skeleton */}
        <div className="mb-8">
          <div className="h-6 w-40 bg-neutral-800 rounded animate-pulse mb-4" />
          <div className="h-4 w-80 bg-neutral-800 rounded animate-pulse mb-6" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-neutral-800 rounded-lg p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-neutral-700 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-neutral-700 rounded" />
                    <div className="h-3 w-1/2 bg-neutral-700 rounded" />
                    <div className="h-3 w-2/3 bg-neutral-700 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All upcoming shows skeleton */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 w-52 bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 w-16 bg-neutral-800 rounded animate-pulse" />
          </div>

          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-x-4 p-4 bg-neutral-800 rounded-md animate-pulse"
              >
                <div className="min-h-[64px] min-w-[64px] bg-neutral-700 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-neutral-700 rounded" />
                  <div className="h-3 w-1/2 bg-neutral-700 rounded" />
                  <div className="h-3 w-2/3 bg-neutral-700 rounded" />
                  <div className="h-3 w-3/5 bg-neutral-700 rounded" />
                </div>
                <div className="flex flex-col items-end gap-y-2">
                  <div className="h-6 w-16 bg-neutral-700 rounded-full" />
                  <div className="h-4 w-12 bg-neutral-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}