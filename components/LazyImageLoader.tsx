'use client';

import { useState, useRef, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { twMerge } from 'tailwind-merge';
import { OptimizedIcon } from './LazyIcons';

interface LazyImageLoaderProps extends Omit<ImageProps, 'src' | 'alt'> {
  src: string;
  alt: string;
  placeholder?: 'blur' | 'empty' | 'skeleton';
  fallbackSrc?: string;
  aspectRatio?: 'square' | 'video' | 'wide' | 'tall';
  showOverlay?: boolean;
  overlayContent?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  loadingClassName?: string;
  errorClassName?: string;
  skeletonClassName?: string;
}

export const LazyImageLoader: React.FC<LazyImageLoaderProps> = ({
  src,
  alt,
  placeholder = 'skeleton',
  fallbackSrc = '/images/placeholder.jpg',
  aspectRatio = 'square',
  showOverlay = false,
  overlayContent,
  onLoad,
  onError,
  className,
  loadingClassName,
  errorClassName,
  skeletonClassName,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    wide: 'aspect-[16/9]',
    tall: 'aspect-[3/4]'
  };

  const SkeletonPlaceholder = () => (
    <div className={twMerge(
      "bg-neutral-800 animate-pulse flex items-center justify-center",
      aspectRatioClasses[aspectRatio],
      skeletonClassName
    )}>
      <OptimizedIcon 
        iconSet="lucide" 
        iconName="Image" 
        size={24} 
        className="text-neutral-600" 
      />
    </div>
  );

  const ErrorPlaceholder = () => (
    <div className={twMerge(
      "bg-neutral-800 flex items-center justify-center flex-col space-y-2",
      aspectRatioClasses[aspectRatio],
      errorClassName
    )}>
      <OptimizedIcon 
        iconSet="lucide" 
        iconName="AlertCircle" 
        size={24} 
        className="text-red-400" 
      />
      <span className="text-xs text-neutral-400">Failed to load</span>
    </div>
  );

  const LoadingPlaceholder = () => (
    <div className={twMerge(
      "bg-neutral-800 animate-pulse flex items-center justify-center",
      aspectRatioClasses[aspectRatio],
      loadingClassName
    )}>
      <OptimizedIcon 
        iconSet="lucide" 
        iconName="Loader" 
        size={24} 
        className="text-neutral-600 animate-spin" 
      />
    </div>
  );

  return (
    <div ref={imgRef} className={twMerge("relative overflow-hidden", className)}>
      {!isInView && placeholder === 'skeleton' && <SkeletonPlaceholder />}
      
      {isInView && (
        <>
          {hasError ? (
            <ErrorPlaceholder />
          ) : (
            <div className="relative">
              {isLoading && placeholder !== 'empty' && (
                <div className="absolute inset-0 z-10">
                  {placeholder === 'skeleton' ? <SkeletonPlaceholder /> : <LoadingPlaceholder />}
                </div>
              )}
              
              <Image
                {...props}
                src={hasError ? fallbackSrc : src}
                alt={alt}
                className={twMerge(
                  "transition-opacity duration-300",
                  isLoading ? "opacity-0" : "opacity-100",
                  aspectRatioClasses[aspectRatio],
                  className
                )}
                onLoad={handleLoad}
                onError={handleError}
                placeholder={placeholder === 'blur' ? 'blur' : 'empty'}
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R7+tv8AkBHpF4RiL0SuXqWxE5QxBGVhyOvYdBLXqKVHaKjqNYDKHrxzJYjIZiQSO8jVPUoJUcqpDXKNxWZJNTTHJ8RKpNBRXCBpZmhKqjpHKRjJJ/TvRDOmZhpSKEJwNRCFDFVGGfxqCfDqNhUJ0hMwlBfcnkvxf4K3RjnwB+VJGxjxrELyqQ8qGfCIFJXjJBJJ8mqfATOgbNrLfFmxHfNBGAwgfvQPfFcJxhI2YbGrwCdYsRwbGUeMJvCEFxFGfWjbTjGnKj+EBrfIwDwfqJBKCJhIwjfEhxuzfGOEDgBdCGUJYKoFaILBYjIBJXsBIbGYTcfJZJKn7bGbzfXyJqpzJdMsxgYiYeOQQm8hMYnKJB4LyNzJpJEhQsxhEBpJdCIjbJUXtGBdSIhhBHPNxAZb9hzLYLjxsJEAzGCRkZKS5RJdKgXJn3h5KjJGKjjhA4qhCUy4MhGvFx4LUAGfEQjyFGTdVzLIBEjgA2vNNxFwvhCBdBLuFTj+DbFdz3xZAGHGVjA7b5jPEFKFvwjhBHC2OgNqnkJJ3NgCKgmYfFITgIjcQHBGJLjGJCJ2dQkdyJJ0KJSJLxjpJJSJYqrODgQtCBQBJJJJMSDkZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKAJJJJMSDkjgZKA"
              />
              
              {showOverlay && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                  {overlayContent}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Optimized image component with preset sizes for common use cases
export const OptimizedImage = {
  Avatar: ({ src, alt, size = 48, ...props }: { src: string; alt: string; size?: number } & Partial<LazyImageLoaderProps>) => (
    <LazyImageLoader
      src={src}
      alt={alt}
      width={size}
      height={size}
      aspectRatio="square"
      className="rounded-full"
      {...props}
    />
  ),
  
  Card: ({ src, alt, ...props }: { src: string; alt: string } & Partial<LazyImageLoaderProps>) => (
    <LazyImageLoader
      src={src}
      alt={alt}
      width={300}
      height={300}
      aspectRatio="square"
      className="rounded-lg"
      {...props}
    />
  ),
  
  Hero: ({ src, alt, ...props }: { src: string; alt: string } & Partial<LazyImageLoaderProps>) => (
    <LazyImageLoader
      src={src}
      alt={alt}
      width={1200}
      height={600}
      aspectRatio="wide"
      className="rounded-lg"
      {...props}
    />
  ),
  
  Thumbnail: ({ src, alt, ...props }: { src: string; alt: string } & Partial<LazyImageLoaderProps>) => (
    <LazyImageLoader
      src={src}
      alt={alt}
      width={120}
      height={120}
      aspectRatio="square"
      className="rounded-md"
      {...props}
    />
  ),
  
  Banner: ({ src, alt, ...props }: { src: string; alt: string } & Partial<LazyImageLoaderProps>) => (
    <LazyImageLoader
      src={src}
      alt={alt}
      width={800}
      height={200}
      aspectRatio="wide"
      className="rounded-lg"
      {...props}
    />
  )
};