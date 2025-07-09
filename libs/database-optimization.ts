/**
 * Advanced Database Query Optimization & Connection Pooling
 * Production-ready database performance optimization for MySetlist
 */

import { createClient } from '@supabase/supabase-js';
import { advancedCaching } from './advanced-caching';

// Connection pool configuration
export interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
  queryTimeout: number;
  enablePreparedStatements: boolean;
}

const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 20,
  idleTimeout: 30000, // 30 seconds
  connectionTimeout: 5000, // 5 seconds
  retryAttempts: 3,
  retryDelay: 1000,
  healthCheckInterval: 60000, // 1 minute
  queryTimeout: 30000, // 30 seconds
  enablePreparedStatements: true
};

// Query performance monitoring
export interface QueryMetrics {
  queryId: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC';
  executionTime: number;
  rowsAffected: number;
  cacheHit: boolean;
  timestamp: number;
  table?: string;
  parameters?: Record<string, any>;
}

export interface DatabaseMetrics {
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: QueryMetrics[];
  cacheHitRate: number;
  connectionPoolStatus: {
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
    averageConnectionTime: number;
  };
  topTables: Array<{
    table: string;
    queryCount: number;
    averageTime: number;
  }>;
}

// Database connection pool manager
export class DatabaseConnectionPool {
  private connections: Map<string, {
    client: any;
    inUse: boolean;
    lastUsed: number;
    created: number;
  }> = new Map();
  
  private config: ConnectionPoolConfig;
  private metrics: QueryMetrics[] = [];
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.startHealthCheck();
  }

  private createConnection(): any {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      }
    );
  }

  async getConnection(): Promise<any> {
    // Try to find an idle connection
    for (const [id, connection] of this.connections) {
      if (!connection.inUse) {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        return connection.client;
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const client = this.createConnection();
      
      this.connections.set(id, {
        client,
        inUse: true,
        lastUsed: Date.now(),
        created: Date.now()
      });

      return client;
    }

    // Wait for connection to become available
    return this.waitForConnection();
  }

  private async waitForConnection(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      const checkForConnection = () => {
        for (const [id, connection] of this.connections) {
          if (!connection.inUse) {
            clearTimeout(timeout);
            connection.inUse = true;
            connection.lastUsed = Date.now();
            resolve(connection.client);
            return;
          }
        }
        
        // Check again in 100ms
        setTimeout(checkForConnection, 100);
      };

      checkForConnection();
    });
  }

  releaseConnection(client: any): void {
    for (const [id, connection] of this.connections) {
      if (connection.client === client) {
        connection.inUse = false;
        connection.lastUsed = Date.now();
        break;
      }
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.cleanupIdleConnections();
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    
    for (const [id, connection] of this.connections) {
      if (!connection.inUse && 
          now - connection.lastUsed > this.config.idleTimeout) {
        this.connections.delete(id);
      }
    }
  }

  private async performHealthCheck(): Promise<void> {
    const healthyConnections = new Set<string>();
    
    for (const [id, connection] of this.connections) {
      if (!connection.inUse) {
        try {
          // Simple health check query
          await connection.client.from('artists').select('id').limit(1);
          healthyConnections.add(id);
        } catch (error) {
          console.error(`Connection ${id} health check failed:`, error);
          this.connections.delete(id);
        }
      }
    }
  }

  getMetrics(): DatabaseMetrics {
    const totalQueries = this.metrics.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
      : 0;

    const slowQueries = this.metrics
      .filter(m => m.executionTime > 1000) // Queries > 1 second
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    const cacheHits = this.metrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    const tableStats = new Map<string, { count: number; totalTime: number }>();
    this.metrics.forEach(m => {
      if (m.table) {
        const current = tableStats.get(m.table) || { count: 0, totalTime: 0 };
        current.count++;
        current.totalTime += m.executionTime;
        tableStats.set(m.table, current);
      }
    });

    const topTables = Array.from(tableStats.entries())
      .map(([table, stats]) => ({
        table,
        queryCount: stats.count,
        averageTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 10);

    const activeConnections = Array.from(this.connections.values())
      .filter(c => c.inUse).length;
    const idleConnections = this.connections.size - activeConnections;

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries,
      cacheHitRate,
      connectionPoolStatus: {
        activeConnections,
        idleConnections,
        maxConnections: this.config.maxConnections,
        averageConnectionTime: 0 // Would calculate from connection metrics
      },
      topTables
    };
  }

  recordQuery(metrics: QueryMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 10000 queries to prevent memory issues
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Close all connections
    for (const [id, connection] of this.connections) {
      // Supabase client doesn't have explicit close method
      // But we clear the map to release references
    }
    this.connections.clear();
  }
}

// Global connection pool instance
export const connectionPool = new DatabaseConnectionPool();

// Enhanced query builder with caching and performance monitoring
export class OptimizedQueryBuilder {
  private connection: any;
  private queryId: string;
  private startTime: number;
  private cacheKey?: string;
  private cacheTTL: number = 300000; // 5 minutes default
  private table?: string;

  constructor(connection: any, table?: string) {
    this.connection = connection;
    this.queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    this.table = table;
  }

  // Cached SELECT queries
  async select(
    columns: string = '*',
    cacheOptions?: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<any> {
    if (cacheOptions) {
      this.cacheKey = `query:${this.table}:${columns}:${JSON.stringify(this.getFilters())}`;
      this.cacheTTL = cacheOptions.ttl || this.cacheTTL;
    }

    let query = this.connection.from(this.table).select(columns);
    
    // Apply filters, sorts, limits that have been set
    query = this.applyModifiers(query);

    const executeQuery = async () => {
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      return data;
    };

    let result;
    let cacheHit = false;

    if (this.cacheKey) {
      result = await advancedCaching.get(
        this.cacheKey,
        executeQuery,
        cacheOptions
      );
      cacheHit = true;
    } else {
      result = await executeQuery();
    }

    this.recordMetrics('SELECT', result?.length || 0, cacheHit);
    return result;
  }

  // Optimized INSERT with batching
  async insert(
    data: any | any[],
    options?: {
      onConflict?: string;
      returning?: string;
      batchSize?: number;
    }
  ): Promise<any> {
    const { onConflict, returning = '*', batchSize = 1000 } = options || {};
    
    // Handle batch inserts
    if (Array.isArray(data) && data.length > batchSize) {
      const results = [];
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        let query = this.connection.from(this.table).insert(batch);
        
        if (onConflict) {
          query = query.onConflict(onConflict);
        }
        
        const { data: result, error } = await query.select(returning);
        
        if (error) {
          throw error;
        }
        
        results.push(...(result || []));
      }
      
      this.recordMetrics('INSERT', results.length, false);
      return results;
    }

    // Single insert
    let query = this.connection.from(this.table).insert(data);
    
    if (onConflict) {
      query = query.onConflict(onConflict);
    }
    
    const { data: result, error } = await query.select(returning);
    
    if (error) {
      throw error;
    }
    
    this.recordMetrics('INSERT', result?.length || 0, false);
    return result;
  }

  // Optimized UPDATE with conditions
  async update(
    data: any,
    conditions: Record<string, any>,
    options?: {
      returning?: string;
    }
  ): Promise<any> {
    const { returning = '*' } = options || {};
    
    let query = this.connection.from(this.table).update(data);
    
    // Apply conditions
    for (const [column, value] of Object.entries(conditions)) {
      query = query.eq(column, value);
    }
    
    const { data: result, error } = await query.select(returning);
    
    if (error) {
      throw error;
    }
    
    this.recordMetrics('UPDATE', result?.length || 0, false);
    
    // Invalidate related caches
    if (this.table) {
      await advancedCaching.clearByTags([this.table]);
    }
    
    return result;
  }

  // Optimized DELETE with conditions
  async delete(
    conditions: Record<string, any>,
    options?: {
      returning?: string;
    }
  ): Promise<any> {
    const { returning } = options || {};
    
    let query = this.connection.from(this.table).delete();
    
    // Apply conditions
    for (const [column, value] of Object.entries(conditions)) {
      query = query.eq(column, value);
    }
    
    if (returning) {
      query = query.select(returning);
    }
    
    const { data: result, error } = await query;
    
    if (error) {
      throw error;
    }
    
    this.recordMetrics('DELETE', result?.length || 0, false);
    
    // Invalidate related caches
    if (this.table) {
      await advancedCaching.clearByTags([this.table]);
    }
    
    return result;
  }

  // Remote procedure call with caching
  async rpc(
    functionName: string,
    parameters: Record<string, any> = {},
    cacheOptions?: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<any> {
    if (cacheOptions) {
      this.cacheKey = `rpc:${functionName}:${JSON.stringify(parameters)}`;
      this.cacheTTL = cacheOptions.ttl || this.cacheTTL;
    }

    const executeRPC = async () => {
      const { data, error } = await this.connection.rpc(functionName, parameters);
      
      if (error) {
        throw error;
      }
      
      return data;
    };

    let result;
    let cacheHit = false;

    if (this.cacheKey) {
      result = await advancedCaching.get(
        this.cacheKey,
        executeRPC,
        cacheOptions
      );
      cacheHit = true;
    } else {
      result = await executeRPC();
    }

    this.recordMetrics('RPC', Array.isArray(result) ? result.length : 1, cacheHit);
    return result;
  }

  // Chain-able query modifiers
  private filters: Array<{ method: string; args: any[] }> = [];

  eq(column: string, value: any): OptimizedQueryBuilder {
    this.filters.push({ method: 'eq', args: [column, value] });
    return this;
  }

  in(column: string, values: any[]): OptimizedQueryBuilder {
    this.filters.push({ method: 'in', args: [column, values] });
    return this;
  }

  gt(column: string, value: any): OptimizedQueryBuilder {
    this.filters.push({ method: 'gt', args: [column, value] });
    return this;
  }

  gte(column: string, value: any): OptimizedQueryBuilder {
    this.filters.push({ method: 'gte', args: [column, value] });
    return this;
  }

  lt(column: string, value: any): OptimizedQueryBuilder {
    this.filters.push({ method: 'lt', args: [column, value] });
    return this;
  }

  lte(column: string, value: any): OptimizedQueryBuilder {
    this.filters.push({ method: 'lte', args: [column, value] });
    return this;
  }

  like(column: string, pattern: string): OptimizedQueryBuilder {
    this.filters.push({ method: 'like', args: [column, pattern] });
    return this;
  }

  ilike(column: string, pattern: string): OptimizedQueryBuilder {
    this.filters.push({ method: 'ilike', args: [column, pattern] });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): OptimizedQueryBuilder {
    this.filters.push({ method: 'order', args: [column, options] });
    return this;
  }

  limit(count: number): OptimizedQueryBuilder {
    this.filters.push({ method: 'limit', args: [count] });
    return this;
  }

  range(from: number, to: number): OptimizedQueryBuilder {
    this.filters.push({ method: 'range', args: [from, to] });
    return this;
  }

  private applyModifiers(query: any): any {
    for (const filter of this.filters) {
      query = query[filter.method](...filter.args);
    }
    return query;
  }

  private getFilters(): any {
    return this.filters;
  }

  private recordMetrics(queryType: QueryMetrics['queryType'], rowsAffected: number, cacheHit: boolean): void {
    const executionTime = Date.now() - this.startTime;
    
    connectionPool.recordQuery({
      queryId: this.queryId,
      queryType,
      executionTime,
      rowsAffected,
      cacheHit,
      timestamp: Date.now(),
      table: this.table
    });
  }
}

// Factory function to create optimized database queries
export async function createOptimizedQuery(table?: string): Promise<OptimizedQueryBuilder> {
  const connection = await connectionPool.getConnection();
  return new OptimizedQueryBuilder(connection, table);
}

// Utility functions for common operations
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError!;
}

// Database health check
export async function performDatabaseHealthCheck(): Promise<{
  healthy: boolean;
  responseTime: number;
  connectionCount: number;
  slowQueries: number;
}> {
  const startTime = Date.now();
  
  try {
    const query = await createOptimizedQuery('artists');
    await query.select('id').limit(1);
    
    const responseTime = Date.now() - startTime;
    const metrics = connectionPool.getMetrics();
    
    return {
      healthy: true,
      responseTime,
      connectionCount: metrics.connectionPoolStatus.activeConnections,
      slowQueries: metrics.slowQueries.length
    };
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      connectionCount: 0,
      slowQueries: 0
    };
  }
}

// Export metrics for monitoring
export function getDatabaseMetrics(): DatabaseMetrics {
  return connectionPool.getMetrics();
}

// Graceful shutdown
export function shutdownDatabaseConnections(): void {
  connectionPool.shutdown();
}