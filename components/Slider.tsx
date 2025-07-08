'use client';

import { useState, useRef, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface SliderProps {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  showArrows?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  itemsPerView?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export const Slider: React.FC<SliderProps> = ({
  children,
  className = '',
  itemClassName = '',
  showArrows = true,
  autoPlay = false,
  autoPlayInterval = 5000,
  itemsPerView = { default: 1, sm: 2, md: 3, lg: 4, xl: 5 }
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);
  const itemWidth = useRef(0);

  const updateScrollState = () => {
    if (!sliderRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const scrollToIndex = (index: number) => {
    if (!sliderRef.current) return;
    
    const scrollLeft = index * itemWidth.current;
    sliderRef.current.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
    setCurrentIndex(index);
  };

  const scrollLeft = () => {
    if (!sliderRef.current) return;
    const newIndex = Math.max(currentIndex - 1, 0);
    scrollToIndex(newIndex);
  };

  const scrollRight = () => {
    if (!sliderRef.current) return;
    const maxIndex = children.length - 1;
    const newIndex = Math.min(currentIndex + 1, maxIndex);
    scrollToIndex(newIndex);
  };

  useEffect(() => {
    const calculateItemWidth = () => {
      if (!sliderRef.current) return;
      
      const containerWidth = sliderRef.current.clientWidth;
      const gap = 16; // 1rem gap
      
      // Get items per view based on screen size
      let items = itemsPerView.default;
      if (window.innerWidth >= 1280) items = itemsPerView.xl || items;
      else if (window.innerWidth >= 1024) items = itemsPerView.lg || items;
      else if (window.innerWidth >= 768) items = itemsPerView.md || items;
      else if (window.innerWidth >= 640) items = itemsPerView.sm || items;
      
      itemWidth.current = (containerWidth - (gap * (items - 1))) / items;
    };

    calculateItemWidth();
    updateScrollState();
    
    const handleResize = () => {
      calculateItemWidth();
      updateScrollState();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [itemsPerView]);

  useEffect(() => {
    if (!autoPlay) return;
    
    const interval = setInterval(() => {
      const maxIndex = children.length - 1;
      setCurrentIndex(prev => prev >= maxIndex ? 0 : prev + 1);
    }, autoPlayInterval);
    
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, children.length]);

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    slider.addEventListener('scroll', updateScrollState);
    return () => slider.removeEventListener('scroll', updateScrollState);
  }, []);

  return (
    <div className={`relative group ${className}`}>
      {/* Left Arrow */}
      {showArrows && canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="
            absolute 
            left-0 
            top-1/2 
            transform 
            -translate-y-1/2 
            z-10 
            bg-black/80 
            hover:bg-black/90 
            text-white 
            rounded-full 
            p-2 
            transition-all
            opacity-0 
            group-hover:opacity-100
            backdrop-blur-sm
          "
          aria-label="Scroll left"
        >
          <FiChevronLeft size={20} />
        </button>
      )}

      {/* Right Arrow */}
      {showArrows && canScrollRight && (
        <button
          onClick={scrollRight}
          className="
            absolute 
            right-0 
            top-1/2 
            transform 
            -translate-y-1/2 
            z-10 
            bg-black/80 
            hover:bg-black/90 
            text-white 
            rounded-full 
            p-2 
            transition-all
            opacity-0 
            group-hover:opacity-100
            backdrop-blur-sm
          "
          aria-label="Scroll right"
        >
          <FiChevronRight size={20} />
        </button>
      )}

      {/* Slider Container */}
      <div
        ref={sliderRef}
        className="
          flex 
          gap-4 
          overflow-x-auto 
          scrollbar-hide 
          scroll-smooth
          pb-2
        "
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children.map((child, index) => (
          <div
            key={index}
            className={`
              flex-shrink-0 
              ${itemClassName}
            `}
            style={{
              minWidth: `calc((100% - ${(itemsPerView.default - 1) * 16}px) / ${itemsPerView.default})`
            }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Dots Indicator */}
      {children.length > 1 && (
        <div className="flex justify-center mt-4 gap-2">
          {Array.from({ length: Math.ceil(children.length / itemsPerView.default) }).map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index * itemsPerView.default)}
              className={`
                w-2 
                h-2 
                rounded-full 
                transition-colors
                ${index === Math.floor(currentIndex / itemsPerView.default)
                  ? 'bg-emerald-500' 
                  : 'bg-neutral-600 hover:bg-neutral-500'
                }
              `}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};