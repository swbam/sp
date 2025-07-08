import { Header } from '@/components/Header';

export default function ShowLoading() {
  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header className="from-emerald-800">
        <div className="mt-20">
          <div className="flex flex-col md:flex-row items-center gap-x-5">
            {/* Image skeleton */}
            <div className="relative h-32 w-32 lg:h-44 lg:w-44 bg-neutral-800 rounded animate-pulse" />
            
            <div className="flex flex-col gap-y-2 mt-4 md:mt-0">
              {/* Concert type skeleton */}
              <div className="hidden md:block h-4 w-16 bg-neutral-800 rounded animate-pulse" />
              
              {/* Artist name skeleton (main headline) */}
              <div className="h-12 lg:h-16 w-80 lg:w-96 bg-neutral-800 rounded animate-pulse" />
              
              {/* Show/tour name skeleton (secondary headline) */}
              <div className="h-6 lg:h-8 w-64 lg:w-80 bg-neutral-800 rounded animate-pulse" />
              
              {/* Date & venue skeleton */}
              <div className="h-4 w-64 bg-neutral-800 rounded animate-pulse" />
              <div className="h-4 w-56 bg-neutral-800 rounded animate-pulse" />

              {/* Ticket button skeleton */}
              <div className="mt-4 h-12 w-32 bg-neutral-800 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </Header>

      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main Content skeleton */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-neutral-800 rounded-lg p-6">
              <div className="h-6 w-48 bg-neutral-700 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-neutral-700 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-neutral-700 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-neutral-700 rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-6">
            <div className="bg-neutral-800 rounded-lg p-6">
              <div className="h-5 w-32 bg-neutral-700 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-neutral-700 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-neutral-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}