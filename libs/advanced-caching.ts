/**
 * Advanced Caching Service for MySetlist
 * Multi-layer caching with intelligent invalidation and performance optimization
 */

import { DatabaseOptimizer } from './performance';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[]; // For group invalidation
  compressed?: boolean; // Enable compression for large data
  encrypted?: boolean; // Enable encryption for sensitive data
  refreshAhead?: boolean; // Proactively refresh before expiry
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  compressed: boolean;
  encrypted: boolean;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  evictions: number;
  memoryUsage: number;
  entryCount: number;
  averageAccessTime: number;
}

export interface CacheMetrics {
  layer: string;
  stats: CacheStats;
  topKeys: Array<{ key: string; hits: number; size: number }>;
  hotPatterns: Array<{ pattern: string; frequency: number }>;
}

export class AdvancedCachingService {
  private static instance: AdvancedCachingService;
  
  // Multi-layer cache storage
  private l1Cache = new Map<string, CacheEntry<any>>(); // Memory cache
  private l2Cache = new Map<string, CacheEntry<any>>(); // Extended memory cache
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    writes: 0
  };

  // Configuration
  private readonly config = {
    l1MaxSize: 1000, // Max entries in L1 cache
    l2MaxSize: 5000, // Max entries in L2 cache
    maxMemoryMB: 256, // Max memory usage in MB
    compressionThreshold: 1024, // Compress data larger than 1KB
    refreshAheadThreshold: 0.8, // Refresh when 80% of TTL has passed
    cleanupInterval: 60000, // Cleanup every minute
  };

  // Cache patterns and access tracking
  private accessPatterns = new Map<string, { count: number; lastAccess: number }>();
  private keyPatterns = new Map<string, number>(); // Track common key patterns

  static getInstance(): AdvancedCachingService {
    if (!AdvancedCachingService.instance) {
      AdvancedCachingService.instance = new AdvancedCachingService();
      AdvancedCachingService.instance.startMaintenanceTasks();
    }
    return AdvancedCachingService.instance;
  }

  /**
   * Get data from cache with intelligent fallback
   */
  async get<T>(
    key: string,
    fallbackFn?: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const startTime = performance.now();

    try {
      // Track access pattern
      this.trackAccess(key);

      // Try L1 cache first
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && this.isValid(l1Entry)) {
        this.updateAccessMetrics(l1Entry);
        this.stats.hits++;
        
        // Check if refresh ahead is needed
        if (options.refreshAhead && this.needsRefreshAhead(l1Entry) && fallbackFn) {
          this.refreshAhead(key, fallbackFn, options);
        }
        
        return this.deserializeData(l1Entry.data, l1Entry.compressed, l1Entry.encrypted);
      }

      // Try L2 cache
      const l2Entry = this.l2Cache.get(key);
      if (l2Entry && this.isValid(l2Entry)) {
        this.updateAccessMetrics(l2Entry);
        
        // Promote to L1 cache
        this.promoteToL1(key, l2Entry);
        this.stats.hits++;
        
        return this.deserializeData(l2Entry.data, l2Entry.compressed, l2Entry.encrypted);
      }

      // Cache miss - use fallback if provided
      this.stats.misses++;
      
      if (fallbackFn) {
        const data = await fallbackFn();
        if (data !== null && data !== undefined) {
          await this.set(key, data, options);
        }
        return data;
      }

      return null;
    } finally {
      const duration = performance.now() - startTime;
      this.recordAccessTime(duration);
    }
  }

  /**
   * Set data in cache with intelligent placement
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const {
      ttl = 300000, // 5 minutes default
      priority = 'medium',
      tags = [],
      compressed = false,
      encrypted = false
    } = options;

    try {
      const serializedData = this.serializeData(data, compressed, encrypted);
      const size = this.calculateSize(serializedData);
      const now = Date.now();

      const entry: CacheEntry<T> = {
        data: serializedData,
        timestamp: now,
        ttl,
        accessCount: 0,
        lastAccessed: now,
        size,
        priority,
        tags,
        compressed,
        encrypted
      };

      // Decide cache layer based on priority and size
      if (this.shouldUseL1Cache(entry)) {
        // Ensure space in L1
        this.makeSpaceInL1(size);
        this.l1Cache.set(key, entry);
      } else {
        // Use L2 cache
        this.makeSpaceInL2(size);
        this.l2Cache.set(key, entry);
      }

      this.stats.writes++;
      this.trackKeyPattern(key);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const l1Deleted = this.l1Cache.delete(key);
    const l2Deleted = this.l2Cache.delete(key);
    return l1Deleted || l2Deleted;
  }

  /**
   * Clear cache by tags
   */
  clearByTags(tags: string[]): number {
    let cleared = 0;
    
    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.l1Cache.delete(key);
        cleared++;
      }
    }
    
    for (const [key, entry] of this.l2Cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.l2Cache.delete(key);
        cleared++;
      }
    }
    
    return cleared;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.accessPatterns.clear();
    this.keyPatterns.clear();
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const memoryUsage = this.calculateMemoryUsage();
    
    return {
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      evictions: this.stats.evictions,
      memoryUsage,
      entryCount: this.l1Cache.size + this.l2Cache.size,
      averageAccessTime: 0 // Would track in production
    };
  }

  /**
   * Get detailed metrics for monitoring
   */
  getDetailedMetrics(): CacheMetrics[] {
    const l1Stats = this.getLayerStats('L1', this.l1Cache);
    const l2Stats = this.getLayerStats('L2', this.l2Cache);
    
    return [
      { layer: 'L1', stats: l1Stats, topKeys: this.getTopKeys('L1'), hotPatterns: this.getHotPatterns() },
      { layer: 'L2', stats: l2Stats, topKeys: this.getTopKeys('L2'), hotPatterns: [] }
    ];
  }

  /**
   * Prefetch data based on access patterns
   */
  async prefetchPopularData(): Promise<void> {
    const popularPatterns = Array.from(this.accessPatterns.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10);

    for (const [pattern] of popularPatterns) {
      // Generate keys that match popular patterns
      const predictedKeys = this.predictKeysFromPattern(pattern);
      
      for (const key of predictedKeys) {
        if (!this.l1Cache.has(key) && !this.l2Cache.has(key)) {
          // Prefetch would trigger data loading
          // Implementation depends on data source
        }
      }
    }
  }

  /**
   * Optimize cache layout based on access patterns
   */
  optimizeLayout(): void {
    // Move frequently accessed L2 items to L1
    const l2Entries = Array.from(this.l2Cache.entries())
      .sort(([, a], [, b]) => b.accessCount - a.accessCount)
      .slice(0, Math.floor(this.config.l1MaxSize * 0.2)); // Top 20% of capacity

    for (const [key, entry] of l2Entries) {
      if (this.shouldPromoteToL1(entry)) {
        this.l2Cache.delete(key);
        this.makeSpaceInL1(entry.size);
        this.l1Cache.set(key, entry);
      }
    }
  }

  /**
   * Warm up cache with essential data
   */
  async warmUp(warmUpFunctions: Array<{ key: string; fn: () => Promise<any>; options?: CacheOptions }>): Promise<void> {
    const promises = warmUpFunctions.map(async ({ key, fn, options }) => {
      try {
        const data = await fn();
        await this.set(key, data, { ...options, priority: 'high' });
      } catch (error) {
        console.error(`Failed to warm up cache for key ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  // Private helper methods

  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private updateAccessMetrics(entry: CacheEntry<any>): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  private needsRefreshAhead(entry: CacheEntry<any>): boolean {
    const elapsed = Date.now() - entry.timestamp;
    return elapsed / entry.ttl > this.config.refreshAheadThreshold;
  }

  private async refreshAhead<T>(key: string, fallbackFn: () => Promise<T>, options: CacheOptions): Promise<void> {
    try {
      const newData = await fallbackFn();
      await this.set(key, newData, options);
    } catch (error) {
      console.error('Refresh ahead failed:', error);
    }
  }

  private promoteToL1(key: string, entry: CacheEntry<any>): void {
    this.makeSpaceInL1(entry.size);
    this.l1Cache.set(key, entry);
  }

  private shouldUseL1Cache(entry: CacheEntry<any>): boolean {
    return entry.priority === 'critical' || entry.priority === 'high' || entry.size < 10240; // < 10KB
  }

  private makeSpaceInL1(requiredSize: number): void {
    this.makeSpace(this.l1Cache, this.config.l1MaxSize, requiredSize);
  }

  private makeSpaceInL2(requiredSize: number): void {
    this.makeSpace(this.l2Cache, this.config.l2MaxSize, requiredSize);
  }

  private makeSpace(cache: Map<string, CacheEntry<any>>, maxSize: number, requiredSize: number): void {
    while (cache.size >= maxSize) {
      // Use LRU eviction strategy
      let oldestKey = '';
      let oldestTime = Date.now();
      
      for (const [key, entry] of cache.entries()) {
        if (entry.lastAccessed < oldestTime && entry.priority !== 'critical') {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        cache.delete(oldestKey);
        this.stats.evictions++;
      } else {
        break; // No evictable entries found
      }
    }
  }

  private serializeData(data: any, compressed: boolean, encrypted: boolean): any {
    let result = data;
    
    if (compressed && this.shouldCompress(data)) {
      // Compression would be implemented here
      // result = compress(JSON.stringify(data));
    }
    
    if (encrypted) {
      // Encryption would be implemented here
      // result = encrypt(result);
    }
    
    return result;
  }

  private deserializeData(data: any, compressed: boolean, encrypted: boolean): any {
    let result = data;
    
    if (encrypted) {
      // Decryption would be implemented here
      // result = decrypt(result);
    }
    
    if (compressed) {
      // Decompression would be implemented here
      // result = JSON.parse(decompress(result));
    }
    
    return result;
  }

  private shouldCompress(data: any): boolean {
    const size = this.calculateSize(data);
    return size > this.config.compressionThreshold;
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate
  }

  private calculateMemoryUsage(): number {
    let total = 0;
    
    for (const entry of this.l1Cache.values()) {
      total += entry.size;
    }
    
    for (const entry of this.l2Cache.values()) {
      total += entry.size;
    }
    
    return total;
  }

  private trackAccess(key: string): void {
    const pattern = this.extractPattern(key);
    const current = this.accessPatterns.get(pattern) || { count: 0, lastAccess: 0 };
    this.accessPatterns.set(pattern, {
      count: current.count + 1,
      lastAccess: Date.now()
    });
  }

  private trackKeyPattern(key: string): void {
    const pattern = this.extractPattern(key);
    this.keyPatterns.set(pattern, (this.keyPatterns.get(pattern) || 0) + 1);
  }

  private extractPattern(key: string): string {
    // Extract pattern by replacing UUIDs and numbers with placeholders
    return key
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
      .replace(/\d+/g, '{num}');
  }

  private predictKeysFromPattern(pattern: string): string[] {
    // Implementation would predict actual keys based on pattern
    return [];
  }

  private shouldPromoteToL1(entry: CacheEntry<any>): boolean {
    return entry.accessCount > 5 || entry.priority === 'high';
  }

  private getLayerStats(layer: string, cache: Map<string, CacheEntry<any>>): CacheStats {
    let totalSize = 0;
    let totalAccess = 0;
    
    for (const entry of cache.values()) {
      totalSize += entry.size;
      totalAccess += entry.accessCount;
    }
    
    return {
      hitRate: 0, // Would calculate based on layer-specific metrics
      missRate: 0,
      totalHits: 0,
      totalMisses: 0,
      evictions: 0,
      memoryUsage: totalSize,
      entryCount: cache.size,
      averageAccessTime: 0
    };
  }

  private getTopKeys(layer: string): Array<{ key: string; hits: number; size: number }> {
    const cache = layer === 'L1' ? this.l1Cache : this.l2Cache;
    
    return Array.from(cache.entries())
      .map(([key, entry]) => ({
        key,
        hits: entry.accessCount,
        size: entry.size
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);
  }

  private getHotPatterns(): Array<{ pattern: string; frequency: number }> {
    return Array.from(this.keyPatterns.entries())
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  }

  private recordAccessTime(duration: number): void {
    // Implementation would track access times for performance monitoring
  }

  private resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0, writes: 0 };
  }

  private startMaintenanceTasks(): void {
    // Periodic cleanup of expired entries
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);

    // Periodic optimization
    setInterval(() => {
      this.optimizeLayout();
    }, this.config.cleanupInterval * 5);

    // Periodic prefetching
    setInterval(() => {
      this.prefetchPopularData();
    }, this.config.cleanupInterval * 10);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.l1Cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.l1Cache.delete(key);
      }
    }
    
    for (const [key, entry] of this.l2Cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.l2Cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const advancedCaching = AdvancedCachingService.getInstance();