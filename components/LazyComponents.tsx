'use client';

import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';

// Lazy load heavy components with loading states
export const LazyAdvancedSearchInput = lazy(() => 
  import('./AdvancedSearchInput').then(mod => ({ default: mod.AdvancedSearchInput }))
);

export const LazyAIPredictionVisualization = lazy(() => 
  import('./AIPredictionVisualization').then(mod => ({ default: mod.AIPredictionVisualization }))
);

export const LazyRealtimeSetlistVoting = lazy(() => 
  import('./RealtimeSetlistVoting').then(mod => ({ default: mod.RealtimeSetlistVoting }))
);

export const LazyProductionPerformanceMonitor = lazy(() => 
  import('./ProductionPerformanceMonitor').then(mod => ({ default: mod.default }))
);

export const LazyWebVitalsMonitor = lazy(() => 
  import('./WebVitalsMonitor').then(mod => ({ default: mod.default }))
);

export const LazyPWAInstallPrompt = lazy(() => 
  import('./PWAInstallPrompt').then(mod => ({ default: mod.PWAInstallPrompt }))
);

// Loading skeleton components
export const SearchInputSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-12 bg-neutral-800 rounded-lg w-full"></div>
  </div>
);

export const VisualizationSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-neutral-800 rounded w-3/4"></div>
    <div className="h-32 bg-neutral-800 rounded"></div>
    <div className="h-4 bg-neutral-800 rounded w-1/2"></div>
  </div>
);

export const VotingSkeleton = () => (
  <div className="animate-pulse space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center space-x-4 p-3 bg-neutral-800 rounded">
        <div className="h-4 bg-neutral-700 rounded w-1/4"></div>
        <div className="h-4 bg-neutral-700 rounded w-1/2"></div>
        <div className="h-8 bg-neutral-700 rounded w-16"></div>
      </div>
    ))}
  </div>
);

export const MonitoringSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-2 bg-neutral-800 rounded w-full"></div>
  </div>
);

// Wrapper components with suspense and error boundaries
export const SuspenseAdvancedSearchInput = (props: any) => (
  <Suspense fallback={<SearchInputSkeleton />}>
    <LazyAdvancedSearchInput {...props} />
  </Suspense>
);

export const SuspenseAIPredictionVisualization = (props: any) => (
  <Suspense fallback={<VisualizationSkeleton />}>
    <LazyAIPredictionVisualization {...props} />
  </Suspense>
);

export const SuspenseRealtimeSetlistVoting = (props: any) => (
  <Suspense fallback={<VotingSkeleton />}>
    <LazyRealtimeSetlistVoting {...props} />
  </Suspense>
);

export const SuspenseProductionPerformanceMonitor = (props: any) => (
  <Suspense fallback={<MonitoringSkeleton />}>
    <LazyProductionPerformanceMonitor {...props} />
  </Suspense>
);

export const SuspenseWebVitalsMonitor = (props: any) => (
  <Suspense fallback={<MonitoringSkeleton />}>
    <LazyWebVitalsMonitor {...props} />
  </Suspense>
);

export const SuspensePWAInstallPrompt = (props: any) => (
  <Suspense fallback={null}>
    <LazyPWAInstallPrompt {...props} />
  </Suspense>
);

// Progressive enhancement wrapper
export const ProgressiveEnhancement = ({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </motion.div>
  );
};