# Part 4: Monitoring, Caching & Performance Optimization

## Overview

This document outlines the implementation plan for monitoring, caching, and performance optimization of the IcePhone RAG system. These components will ensure the system performs efficiently at scale while providing valuable insights into usage patterns and areas for improvement.

**Advanced Optimization Features:**

- **Multi-Strategy Query Monitoring**: Track performance of query rewriting, HyDE, and multimodal processing
- **Intelligent Caching**: Layer-specific caching for embeddings, reranking, and responses
- **Performance Analytics**: Advanced metrics for retrieval quality and response times
- **Auto-Optimization**: Dynamic parameter tuning based on usage patterns
- **Resource Management**: Efficient handling of multimodal content and large document collections

## Technical Requirements

- Cloudflare Workers KV for caching
- Cloudflare Analytics integration
- Neon DB query optimization with pgvector performance tuning
- Advanced embedding caching strategies
- TypeScript type definitions

## Implementation Steps

### 1. Advanced RAG System Monitoring (4 days)

#### 1.1 Enhanced Monitoring Infrastructure

```typescript
// workers/common/advanced-monitoring.ts
export interface AdvancedLogEvent {
  timestamp: string;
  service: string;
  event: string;
  duration?: number;
  status: 'success' | 'failure' | 'partial';
  error?: string;
  queryAnalysis?: {
    type: string;
    complexity: string;
    hasVisualContent: boolean;
    rewrittenQueriesCount: number;
  };
  retrievalMetadata?: {
    strategiesUsed: string[];
    documentsRetrieved: number;
    documentsAfterDedup: number;
    finalContextDocs: number;
    hydeEnabled: boolean;
    rerankingEnabled: boolean;
  };
  performanceMetrics?: {
    embeddingTime: number;
    retrievalTime: number;
    rerankingTime: number;
    llmTime: number;
    totalTime: number;
  };
  qualityMetrics?: {
    averageScore: number;
    topDocumentScore: number;
    scoreDistribution: number[];
    rerankingImprovement?: number;
  };
  metadata?: Record<string, any>;
}

export class AdvancedMonitoring {
  constructor(private env: any) {}

  async logEnhancedQuery(event: AdvancedLogEvent): Promise<void> {
    try {
      // Store in KV with multiple access patterns
      const timestamp = Date.now();

      // Main event log
      const eventKey = `log:query:${timestamp}:${crypto.randomUUID()}`;
      await this.env.SYSTEM_LOGS.put(eventKey, JSON.stringify(event), {
        expirationTtl: 60 * 60 * 24 * 30 // 30 days
      });

      // Performance metrics aggregation
      if (event.performanceMetrics) {
        await this.updatePerformanceAggregates(event);
      }

      // Quality metrics tracking
      if (event.qualityMetrics) {
        await this.updateQualityMetrics(event);
      }

      // Strategy effectiveness tracking
      if (event.retrievalMetadata) {
        await this.updateStrategyMetrics(event);
      }
    } catch (error) {
      console.error('Error logging enhanced event:', error);
    }
  }

  private async updatePerformanceAggregates(event: AdvancedLogEvent): Promise<void> {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const perfKey = `perf:${date}`;

    try {
      const existing = await this.env.SYSTEM_LOGS.get(perfKey, 'json') || {
        totalQueries: 0,
        totalTime: 0,
        embeddingTime: 0,
        retrievalTime: 0,
        rerankingTime: 0,
        llmTime: 0,
        samples: []
      };

      const metrics = event.performanceMetrics!;
      existing.totalQueries += 1;
      existing.totalTime += metrics.totalTime;
      existing.embeddingTime += metrics.embeddingTime;
      existing.retrievalTime += metrics.retrievalTime;
      existing.rerankingTime += metrics.rerankingTime;
      existing.llmTime += metrics.llmTime;

      // Keep last 100 samples for percentile calculations
      existing.samples.push(metrics.totalTime);
      if (existing.samples.length > 100) {
        existing.samples = existing.samples.slice(-100);
      }

      await this.env.SYSTEM_LOGS.put(perfKey, JSON.stringify(existing), {
        expirationTtl: 60 * 60 * 24 * 90 // 90 days
      });
    } catch (error) {
      console.error('Error updating performance aggregates:', error);
    }
  }

  private async updateQualityMetrics(event: AdvancedLogEvent): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const qualityKey = `quality:${date}`;

    try {
      const existing = await this.env.SYSTEM_LOGS.get(qualityKey, 'json') || {
        totalQueries: 0,
        averageScoreSum: 0,
        topScoreSum: 0,
        rerankingImprovements: [],
        scoreDistributions: []
      };

      const quality = event.qualityMetrics!;
      existing.totalQueries += 1;
      existing.averageScoreSum += quality.averageScore;
      existing.topScoreSum += quality.topDocumentScore;

      if (quality.rerankingImprovement) {
        existing.rerankingImprovements.push(quality.rerankingImprovement);
      }

      existing.scoreDistributions.push(quality.scoreDistribution);

      await this.env.SYSTEM_LOGS.put(qualityKey, JSON.stringify(existing), {
        expirationTtl: 60 * 60 * 24 * 90 // 90 days
      });
    } catch (error) {
      console.error('Error updating quality metrics:', error);
    }
  }

  private async updateStrategyMetrics(event: AdvancedLogEvent): Promise<void> {
    const date = new Date().toISOString().split('T')[0];

    for (const strategy of event.retrievalMetadata!.strategiesUsed) {
      const strategyKey = `strategy:${strategy}:${date}`;

      try {
        const existing = await this.env.SYSTEM_LOGS.get(strategyKey, 'json') || {
          usageCount: 0,
          totalDocuments: 0,
          successRate: 0,
          averageScore: 0
        };

        existing.usageCount += 1;
        existing.totalDocuments += event.retrievalMetadata!.documentsRetrieved;

        if (event.qualityMetrics) {
          existing.averageScore = (existing.averageScore * (existing.usageCount - 1) +
                                   event.qualityMetrics.averageScore) / existing.usageCount;
        }

        await this.env.SYSTEM_LOGS.put(strategyKey, JSON.stringify(existing), {
          expirationTtl: 60 * 60 * 24 * 90 // 90 days
        });
      } catch (error) {
        console.error(`Error updating strategy metrics for ${strategy}:`, error);
      }
    }
  }

  async getPerformanceAnalytics(days: number = 7): Promise<any> {
    const analytics = {
      performance: {},
      quality: {},
      strategies: {},
      trends: {}
    };

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Get performance data
      const perfKey = `perf:${dateStr}`;
      const perfData = await this.env.SYSTEM_LOGS.get(perfKey, 'json');
      if (perfData) {
        analytics.performance[dateStr] = perfData;
      }

      // Get quality data
      const qualityKey = `quality:${dateStr}`;
      const qualityData = await this.env.SYSTEM_LOGS.get(qualityKey, 'json');
      if (qualityData) {
        analytics.quality[dateStr] = qualityData;
      }
    }

    return analytics;
  }
}
```

#### 1.2 Query Pipeline Performance Tracking

```typescript
// src/lib/performance-tracker.ts
export class QueryPerformanceTracker {
  private startTime: number;
  private checkpoints: { [key: string]: number } = {};

  constructor() {
    this.startTime = performance.now();
  }

  checkpoint(name: string): void {
    this.checkpoints[name] = performance.now() - this.startTime;
  }

  getDurations(): { [key: string]: number } {
    return { ...this.checkpoints };
  }

  getTotalTime(): number {
    return performance.now() - this.startTime;
  }

  getPhaseTime(from: string, to: string): number {
    return this.checkpoints[to] - this.checkpoints[from];
  }
}

// Usage in the main query handler
export function createPerformanceTracker() {
  return new QueryPerformanceTracker();
}
```

#### 1.3 Real-time Quality Assessment

```typescript
// src/lib/quality-assessor.ts
interface QualityMetrics {
  averageScore: number;
  topDocumentScore: number;
  scoreDistribution: number[];
  rerankingImprovement?: number;
  coherenceScore?: number;
  diversityScore?: number;
}

export class QualityAssessor {
  assessRetrievalQuality(
    originalDocs: any[],
    rerankedDocs?: any[]
  ): QualityMetrics {
    const scores = originalDocs.map(doc => doc.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const topDocumentScore = Math.max(...scores);

    // Calculate score distribution (quartiles)
    const sortedScores = [...scores].sort((a, b) => b - a);
    const scoreDistribution = [
      sortedScores[Math.floor(sortedScores.length * 0.25)],
      sortedScores[Math.floor(sortedScores.length * 0.5)],
      sortedScores[Math.floor(sortedScores.length * 0.75)],
      sortedScores[sortedScores.length - 1]
    ];

    let rerankingImprovement;
    if (rerankedDocs) {
      const originalAvg = averageScore;
      const rerankedAvg = rerankedDocs.reduce((a, b) => a + b.score, 0) / rerankedDocs.length;
      rerankingImprovement = rerankedAvg - originalAvg;
    }

    // Calculate diversity (how different are the top documents)
    const diversityScore = this.calculateDiversity(originalDocs.slice(0, 5));

    return {
      averageScore,
      topDocumentScore,
      scoreDistribution,
      rerankingImprovement,
      diversityScore,
    };
  }

  private calculateDiversity(docs: any[]): number {
    if (docs.length < 2) return 1.0;

    // Simple diversity based on content similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        // Simple word overlap similarity
        const words1 = new Set(docs[i].content_chunk.toLowerCase().split(/\s+/));
        const words2 = new Set(docs[j].content_chunk.toLowerCase().split(/\s+/));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        const similarity = intersection.size / union.size;

        totalSimilarity += similarity;
        comparisons++;
      }
    }

    const averageSimilarity = totalSimilarity / comparisons;
    return 1.0 - averageSimilarity; // Higher diversity = lower similarity
  }
}
```

### 2. Advanced Caching Implementation (3 days)

#### 2.1 Multi-Layer Intelligent Caching

```typescript
// src/lib/advanced-cache-service.ts
interface CacheLayer {
  name: string;
  ttl: number;
  namespace: string;
  compression: boolean;
}

interface CacheConfig {
  embeddings: CacheLayer;
  queries: CacheLayer;
  reranking: CacheLayer;
  multimodal: CacheLayer;
  hyde: CacheLayer;
}

export class AdvancedCacheService {
  private config: CacheConfig = {
    embeddings: {
      name: 'embeddings',
      ttl: 86400 * 7, // 7 days
      namespace: 'embeddings',
      compression: true,
    },
    queries: {
      name: 'queries',
      ttl: 3600 * 4, // 4 hours
      namespace: 'queries',
      compression: false,
    },
    reranking: {
      name: 'reranking',
      ttl: 3600 * 2, // 2 hours
      namespace: 'reranking',
      compression: false,
    },
    multimodal: {
      name: 'multimodal',
      ttl: 86400 * 3, // 3 days (images don't change often)
      namespace: 'multimodal',
      compression: true,
    },
    hyde: {
      name: 'hyde',
      ttl: 86400, // 1 day
      namespace: 'hyde',
      compression: false,
    },
  };

  constructor(private env: any) {}

  async getEmbedding(text: string, model: string): Promise<number[] | null> {
    const key = this.createEmbeddingKey(text, model);
    return await this.get(key, this.config.embeddings);
  }

  async setEmbedding(text: string, model: string, embedding: number[]): Promise<void> {
    const key = this.createEmbeddingKey(text, model);
    await this.set(key, embedding, this.config.embeddings);
  }

  async getMultimodalEmbedding(text: string, images: string[], model: string): Promise<number[] | null> {
    const key = this.createMultimodalKey(text, images, model);
    return await this.get(key, this.config.multimodal);
  }

  async setMultimodalEmbedding(text: string, images: string[], model: string, embedding: number[]): Promise<void> {
    const key = this.createMultimodalKey(text, images, model);
    await this.set(key, embedding, this.config.multimodal);
  }

  async getHydeResult(query: string, queryType: string): Promise<any | null> {
    const key = this.createHydeKey(query, queryType);
    return await this.get(key, this.config.hyde);
  }

  async setHydeResult(query: string, queryType: string, result: any): Promise<void> {
    const key = this.createHydeKey(query, queryType);
    await this.set(key, result, this.config.hyde);
  }

  async getRerankedResults(query: string, docIds: string[]): Promise<any[] | null> {
    const key = this.createRerankingKey(query, docIds);
    return await this.get(key, this.config.reranking);
  }

  async setRerankedResults(query: string, docIds: string[], results: any[]): Promise<void> {
    const key = this.createRerankingKey(query, docIds);
    await this.set(key, results, this.config.reranking);
  }

  private async get<T>(key: string, layer: CacheLayer): Promise<T | null> {
    try {
      const fullKey = `${layer.namespace}:${key}`;
      let value = await this.env.QUERY_CACHE.get(fullKey, layer.compression ? 'json' : 'text');

      if (value && layer.compression && typeof value === 'string') {
        value = JSON.parse(value);
      }

      return value as T;
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  private async set<T>(key: string, value: T, layer: CacheLayer): Promise<void> {
    try {
      const fullKey = `${layer.namespace}:${key}`;
      let serializedValue: string;

      if (layer.compression) {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      }

      await this.env.QUERY_CACHE.put(fullKey, serializedValue, {
        expirationTtl: layer.ttl
      });
    } catch (error) {
      console.error(`Cache set error for ${key}:`, error);
    }
  }

  private createEmbeddingKey(text: string, model: string): string {
    const textHash = this.hashString(text.toLowerCase().trim());
    return `emb:${model}:${textHash}`;
  }

  private createMultimodalKey(text: string, images: string[], model: string): string {
    const textHash = this.hashString(text.toLowerCase().trim());
    const imagesHash = this.hashString(images.join(''));
    return `mm:${model}:${textHash}:${imagesHash}`;
  }

  private createHydeKey(query: string, queryType: string): string {
    const queryHash = this.hashString(query.toLowerCase().trim());
    return `hyde:${queryType}:${queryHash}`;
  }

  private createRerankingKey(query: string, docIds: string[]): string {
    const queryHash = this.hashString(query.toLowerCase().trim());
    const docIdsHash = this.hashString(docIds.sort().join(','));
    return `rerank:${queryHash}:${docIdsHash}`;
  }

  private hashString(str: string): string {
    // Simple hash function - in production, consider using crypto.subtle
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Cache warming functionality
  async warmCache(commonQueries: string[]): Promise<void> {
    console.log('Starting cache warming process...');

    for (const query of commonQueries) {
      try {
        // Warm embedding cache
        const embeddingKey = this.createEmbeddingKey(query, 'voyage-3.5');
        const existingEmbedding = await this.get(embeddingKey, this.config.embeddings);

        if (!existingEmbedding) {
          // Pre-generate embeddings for common queries
          // This would be called during off-peak hours
          console.log(`Warming embedding cache for: ${query.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error(`Error warming cache for query "${query}":`, error);
      }
    }
  }

  // Cache analytics
  async getCacheStats(): Promise<any> {
    const stats = {
      hitRates: {},
      sizes: {},
      ttlInfo: {},
    };

    for (const [layerName, layer] of Object.entries(this.config)) {
      try {
        // This would require additional tracking in a real implementation
        const hitRateKey = `stats:hitrate:${layer.namespace}`;
        const sizeKey = `stats:size:${layer.namespace}`;

        stats.hitRates[layerName] = await this.env.QUERY_CACHE.get(hitRateKey, 'json') || { hits: 0, misses: 0 };
        stats.sizes[layerName] = await this.env.QUERY_CACHE.get(sizeKey, 'json') || { count: 0, estimatedBytes: 0 };
        stats.ttlInfo[layerName] = { ttl: layer.ttl, namespace: layer.namespace };
      } catch (error) {
        console.error(`Error getting cache stats for ${layerName}:`, error);
      }
    }

    return stats;
  }
}
```

#### 2.2 Adaptive Cache Management

```typescript
// src/lib/adaptive-cache-manager.ts
interface CacheUsageMetrics {
  hitRate: number;
  averageLatency: number;
  memoryUsage: number;
  evictionRate: number;
}

export class AdaptiveCacheManager {
  private metrics: Map<string, CacheUsageMetrics> = new Map();
  private cacheService: AdvancedCacheService;

  constructor(cacheService: AdvancedCacheService) {
    this.cacheService = cacheService;
  }

  async optimizeCacheConfiguration(): Promise<void> {
    // Analyze usage patterns and adjust TTLs
    const stats = await this.cacheService.getCacheStats();

    for (const [layerName, layerStats] of Object.entries(stats.hitRates)) {
      const hitRate = (layerStats as any).hits / ((layerStats as any).hits + (layerStats as any).misses);

      if (hitRate < 0.3) {
        // Low hit rate - might need longer TTL or different caching strategy
        console.log(`Low hit rate detected for ${layerName}: ${hitRate.toFixed(2)}`);
        await this.adjustTTL(layerName, 'increase');
      } else if (hitRate > 0.9) {
        // Very high hit rate - could potentially reduce TTL to save memory
        console.log(`High hit rate detected for ${layerName}: ${hitRate.toFixed(2)}`);
        await this.adjustTTL(layerName, 'optimize');
      }
    }
  }

  private async adjustTTL(layerName: string, direction: 'increase' | 'decrease' | 'optimize'): Promise<void> {
    // Implement TTL adjustment logic
    // In a production system, this would dynamically modify cache configuration
    console.log(`Adjusting TTL for ${layerName} in direction: ${direction}`);
  }

  async scheduleMaintenanceTasks(): Promise<void> {
    // Schedule cache warming, cleanup, and optimization tasks
    const commonQueries = await this.getCommonQueries();
    await this.cacheService.warmCache(commonQueries);
  }

  private async getCommonQueries(): Promise<string[]> {
    // Analyze query logs to find most common queries
    // This would be implemented based on your monitoring data
    return [
      "What are the main features of IcePhone?",
      "How do I set up a voice agent?",
      "What is the pricing for IcePhone?",
      "How does the CRM integration work?",
      "What are the technical requirements?"
    ];
  }
}
```

### 3. Database and Query Optimization (4 days)

#### 3.1 Advanced PostgreSQL and pgvector Optimization

```typescript
// scripts/advanced-pgvector-optimization.ts
import { db } from "../src/db/db";
import { sql } from "drizzle-orm";

export class DatabaseOptimizer {
  async optimizeForAdvancedRAG(): Promise<void> {
    console.log("Starting advanced pgvector optimization for multi-strategy RAG...");

    try {
      // 1. Create specialized indexes for different embedding types
      await this.createSpecializedIndexes();

      // 2. Optimize database configuration for vector operations
      await this.optimizeVectorConfiguration();

      // 3. Create materialized views for common queries
      await this.createMaterializedViews();

      // 4. Set up partitioning for large document collections
      await this.setupPartitioning();

      // 5. Create indexes for hybrid search
      await this.createHybridSearchIndexes();

      console.log("Advanced pgvector optimization completed successfully");
    } catch (error) {
      console.error("Error during advanced optimization:", error);
      throw error;
    }
  }

  private async createSpecializedIndexes(): Promise<void> {
    console.log("Creating specialized vector indexes...");

    // HNSW index for text embeddings (optimized for query performance)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_base_documents_text_embedding_hnsw_idx
      ON knowledge_base_documents
      USING hnsw (text_embedding vector_cosine_ops)
      WITH (m = 48, ef_construction = 200);
    `);

    // HNSW index for multimodal embeddings (different parameters for multimodal)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_base_documents_multimodal_embedding_hnsw_idx
      ON knowledge_base_documents
      USING hnsw (multimodal_embedding vector_cosine_ops)
      WHERE multimodal_embedding IS NOT NULL
      WITH (m = 32, ef_construction = 150);
    `);

    // HNSW index for HyDE embeddings
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_base_documents_hyde_embedding_hnsw_idx
      ON knowledge_base_documents
      USING hnsw (hyde_embedding vector_cosine_ops)
      WHERE hyde_embedding IS NOT NULL
      WITH (m = 40, ef_construction = 180);
    `);

    // Composite indexes for filtered searches
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_base_documents_source_type_idx
      ON knowledge_base_documents (source_id, embedding_type);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_base_documents_metadata_gin_idx
      ON knowledge_base_documents
      USING gin (metadata);
    `);
  }

  private async optimizeVectorConfiguration(): Promise<void> {
    console.log("Optimizing vector search configuration...");

    // Set optimal parameters for different query types
    await db.execute(sql`ALTER DATABASE CURRENT SET hnsw.ef_search = 150;`);
    await db.execute(sql`ALTER DATABASE CURRENT SET max_parallel_workers_per_gather = 4;`);
    await db.execute(sql`ALTER DATABASE CURRENT SET work_mem = '256MB';`);
    await db.execute(sql`ALTER DATABASE CURRENT SET maintenance_work_mem = '1GB';`);

    // Enable parallel query execution for vector searches
    await db.execute(sql`ALTER DATABASE CURRENT SET max_parallel_workers = 8;`);
    await db.execute(sql`ALTER DATABASE CURRENT SET parallel_tuple_cost = 0.01;`);
  }

  private async createMaterializedViews(): Promise<void> {
    console.log("Creating materialized views for common queries...");

    // Materialized view for document statistics
    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS document_stats AS
      SELECT
        source_id,
        embedding_type,
        COUNT(*) as document_count,
        AVG(array_length(string_to_array(content_chunk, ' '), 1)) as avg_chunk_length,
        MIN(created_at) as first_document,
        MAX(created_at) as last_document
      FROM knowledge_base_documents
      GROUP BY source_id, embedding_type;
    `);

    // Create index on materialized view
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS document_stats_source_idx
      ON document_stats (source_id);
    `);

    // Materialized view for high-quality documents (for caching)
    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS high_quality_documents AS
      SELECT
        id, source_id, content_chunk, metadata, text_embedding, embedding_type
      FROM knowledge_base_documents
      WHERE array_length(string_to_array(content_chunk, ' '), 1) > 50
        AND array_length(string_to_array(content_chunk, ' '), 1) < 500;
    `);
  }

  private async setupPartitioning(): Promise<void> {
    console.log("Setting up table partitioning for large collections...");

    // This would be implemented for very large document collections
    // For now, we'll create a framework for future partitioning

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS knowledge_base_documents_archive (
        LIKE knowledge_base_documents INCLUDING ALL
      );
    `);

    // Create a function to archive old documents
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION archive_old_documents(days_old INTEGER DEFAULT 365)
      RETURNS INTEGER AS $$
      DECLARE
        archived_count INTEGER;
      BEGIN
        WITH archived AS (
          DELETE FROM knowledge_base_documents
          WHERE created_at < NOW() - INTERVAL '1 day' * days_old
            AND metadata->>'archive_eligible' = 'true'
          RETURNING *
        )
        INSERT INTO knowledge_base_documents_archive
        SELECT * FROM archived;

        GET DIAGNOSTICS archived_count = ROW_COUNT;
        RETURN archived_count;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  private async createHybridSearchIndexes(): Promise<void> {
    console.log("Creating indexes for hybrid search...");

    // Full-text search index for content
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_base_documents_content_fts_idx
      ON knowledge_base_documents
      USING gin (to_tsvector('english', content_chunk));
    `);

    // Trigram index for fuzzy text matching
    await db.execute(sql`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_base_documents_content_trgm_idx
      ON knowledge_base_documents
      USING gin (content_chunk gin_trgm_ops);
    `);

    // Combined index for metadata + text search
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_base_documents_metadata_content_idx
      ON knowledge_base_documents (source_id, embedding_type)
      INCLUDE (content_chunk);
    `);
  }

  async refreshMaterializedViews(): Promise<void> {
    console.log("Refreshing materialized views...");

    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY document_stats;`);
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY high_quality_documents;`);
  }

  async analyzePerformance(): Promise<any> {
    console.log("Analyzing database performance...");

    // Get index usage statistics
    const indexStats = await db.execute(sql`
      SELECT
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      WHERE tablename = 'knowledge_base_documents'
      ORDER BY idx_scan DESC;
    `);

    // Get query performance statistics
    const queryStats = await db.execute(sql`
      SELECT
        calls,
        total_time,
        mean_time,
        stddev_time,
        query
      FROM pg_stat_statements
      WHERE query LIKE '%knowledge_base_documents%'
      ORDER BY total_time DESC
      LIMIT 10;
    `);

    return {
      indexUsage: indexStats.rows,
      queryPerformance: queryStats.rows,
      timestamp: new Date().toISOString(),
    };
  }
}
```

#### 3.2 Smart Query Planning

```typescript
// src/lib/query-planner.ts
interface QueryPlan {
  strategies: string[];
  weights: number[];
  estimatedCost: number;
  expectedLatency: number;
  cacheHitProbability: number;
}

export class SmartQueryPlanner {
  constructor(private cacheService: AdvancedCacheService) {}

  async planQuery(query: string, options: any): Promise<QueryPlan> {
    const analysis = this.analyzeQuery(query, options);

    // Determine optimal strategies based on query characteristics
    const strategies = this.selectStrategies(analysis);

    // Calculate weights based on historical performance
    const weights = await this.calculateWeights(strategies, analysis);

    // Estimate costs and latency
    const estimatedCost = this.estimateCost(strategies, weights);
    const expectedLatency = this.estimateLatency(strategies, weights);

    // Check cache hit probability
    const cacheHitProbability = await this.estimateCacheHitProbability(query, strategies);

    return {
      strategies,
      weights,
      estimatedCost,
      expectedLatency,
      cacheHitProbability,
    };
  }

  private analyzeQuery(query: string, options: any): any {
    return {
      length: query.length,
      complexity: this.assessComplexity(query),
      hasVisualContent: options.images && options.images.length > 0,
      queryType: this.determineQueryType(query),
      similarityThreshold: options.similarity_threshold || 0.7,
    };
  }

  private selectStrategies(analysis: any): string[] {
    const strategies = ['text'];

    if (analysis.hasVisualContent) {
      strategies.push('multimodal');
    }

    if (analysis.complexity === 'complex' || analysis.queryType === 'analytical') {
      strategies.push('hyde');
      strategies.push('rewritten');
    }

    return strategies;
  }

  private async calculateWeights(strategies: string[], analysis: any): Promise<number[]> {
    // In a real implementation, this would use historical performance data
    const baseWeights: { [key: string]: number } = {
      text: 0.6,
      multimodal: 0.5,
      hyde: 0.3,
      rewritten: 0.2,
    };

    // Adjust weights based on query characteristics
    if (analysis.queryType === 'factual') {
      baseWeights.text += 0.1;
      baseWeights.hyde += 0.1;
    } else if (analysis.queryType === 'multimodal') {
      baseWeights.multimodal += 0.2;
    }

    return strategies.map(strategy => baseWeights[strategy] || 0.3);
  }

  private estimateCost(strategies: string[], weights: number[]): number {
    const costPerStrategy: { [key: string]: number } = {
      text: 1.0,
      multimodal: 3.0,
      hyde: 2.5,
      rewritten: 1.5,
    };

    return strategies.reduce((total, strategy, index) => {
      return total + (costPerStrategy[strategy] || 1.0) * weights[index];
    }, 0);
  }

  private estimateLatency(strategies: string[], weights: number[]): number {
    const latencyPerStrategy: { [key: string]: number } = {
      text: 100,     // ms
      multimodal: 300,
      hyde: 250,
      rewritten: 150,
    };

    // Strategies run in parallel, so take the max weighted latency
    return Math.max(...strategies.map((strategy, index) => {
      return (latencyPerStrategy[strategy] || 100) * weights[index];
    }));
  }

  private async estimateCacheHitProbability(query: string, strategies: string[]): Promise<number> {
    let totalHitProb = 0;

    for (const strategy of strategies) {
      // Check if similar queries are in cache
      const cacheKey = this.generateCacheKey(query, strategy);
      const cached = await this.cacheService.get(cacheKey, {
        name: strategy,
        ttl: 3600,
        namespace: strategy,
        compression: false
      } as any);

      if (cached) {
        totalHitProb += 0.8; // High probability if exact match
      } else {
        totalHitProb += 0.2; // Lower probability for partial matches
      }
    }

    return Math.min(totalHitProb / strategies.length, 1.0);
  }

  private generateCacheKey(query: string, strategy: string): string {
    return `plan:${strategy}:${this.hashString(query)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private assessComplexity(query: string): 'simple' | 'moderate' | 'complex' {
    const words = query.split(/\s+/).length;
    const hasMultipleConcepts = (query.match(/\band\b|\bor\b/g) || []).length > 1;

    if (words > 15 || hasMultipleConcepts) return 'complex';
    if (words > 8) return 'moderate';
    return 'simple';
  }

  private determineQueryType(query: string): string {
    const lowercaseQuery = query.toLowerCase();

    if (/\b(how to|how do|step|process|procedure)\b/.test(lowercaseQuery)) {
      return 'procedural';
    }
    if (/\b(compare|difference|analysis|evaluate)\b/.test(lowercaseQuery)) {
      return 'analytical';
    }
    if (/\b(explain|describe|what is|tell me about)\b/.test(lowercaseQuery)) {
      return 'contextual';
    }

    return 'factual';
  }
}
```

### 4. Testing and Deployment (2 days)

#### 4.1 Performance Testing Script

```typescript
// scripts/test-rag-performance.ts
import { performance } from 'perf_hooks';

async function testRagPerformance() {
  // Sample test queries of varying complexity
  const testQueries = [
    "What are the main features of IcePhone?",
    "Explain how the voice agent handles customer objections",
    "What is the difference between inbound and outbound call handling?",
    "How does the CRM integration work with voice agents?",
    "Can you provide technical details about the RAG system architecture?"
  ];

  console.log("Starting RAG performance test...");
  console.log("-------------------------------");

  // Test each query
  for (const query of testQueries) {
    console.log(`Testing query: "${query}"`);

    // Test non-streaming response
    const startTime = performance.now();

    try {
      const response = await fetch('https://rag-query-api.yourdomain.workers.dev/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          stream: false,
          include_sources: true,
        }),
      });

      const result = await response.json();
      const duration = performance.now() - startTime;

      console.log(`  Duration: ${duration.toFixed(2)}ms`);
      console.log(`  Sources retrieved: ${result.sources?.length || 0}`);
      console.log(`  Response length: ${result.answer?.length || 0} chars`);

      // Test cached response
      const cacheStartTime = performance.now();
      await fetch('https://rag-query-api.yourdomain.workers.dev/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          stream: false,
          include_sources: true,
        }),
      });

      const cacheDuration = performance.now() - cacheStartTime;
      console.log(`  Cached response duration: ${cacheDuration.toFixed(2)}ms`);
      console.log(`  Cache speedup: ${(duration / cacheDuration).toFixed(1)}x`);
    } catch (error) {
      console.error(`  Error testing query "${query}":`, error);
    }

    console.log("-------------------------------");
  }

  console.log("Performance test completed");
}

testRagPerformance();
```

#### 4.2 Deployment Script

```typescript
// scripts/deploy-rag-system.ts
import { execSync } from 'child_process';

function runCommand(command: string): void {
  console.log(`Executing: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

async function deployRagSystem() {
  console.log("Starting RAG system deployment...");

  // 1. Deploy database migrations
  console.log("\n--- Deploying database migrations ---");
  runCommand('bun db:prod:push');

  // 2. Deploy the ingestion worker
  console.log("\n--- Deploying document ingestion worker ---");
  runCommand('cd workers/knowledge-base-ingestion && bunx wrangler deploy');

  // 3. Deploy the query worker
  console.log("\n--- Deploying RAG query API worker ---");
  runCommand('cd workers/rag-query-api && bunx wrangler deploy');

  // 4. Update KV bindings
  console.log("\n--- Updating KV namespace bindings ---");
  runCommand('cd workers/knowledge-base-ingestion && bunx wrangler kv:namespace list');
  runCommand('cd workers/rag-query-api && bunx wrangler kv:namespace list');

  // 5. Run database optimizations
  console.log("\n--- Optimizing database indexes ---");
  runCommand('bun run scripts/optimize-pgvector-indexes.ts');

  // 6. Run performance tests
  console.log("\n--- Running performance tests ---");
  runCommand('bun run scripts/test-rag-performance.ts');

  console.log("\nRAG system deployment completed successfully!");
}

deployRagSystem();
```

### 5. Documentation and Knowledge Transfer (2 days)

#### 5.1 Create System Documentation

```markdown
# RAG System Documentation

## Overview

The IcePhone RAG (Retrieval Augmented Generation) system enhances AI voice agents with knowledge base access. This document provides technical details for developers.

## Architecture

The system consists of four main components:

1. **Knowledge Base Infrastructure** (Neon DB with pgvector)
   - Stores document chunks and vector embeddings
   - Enables vector similarity search

2. **Document Ingestion System** (Cloudflare Worker)
   - Parses, chunks, and embeds documents
   - Stores content in the knowledge base

3. **RAG Query API** (Cloudflare Worker)
   - Processes natural language queries
   - Retrieves relevant documents
   - Generates AI responses with context

4. **Monitoring & Optimization** (Cloudflare KV + Workers)
   - Caches frequent queries and embeddings
   - Monitors system performance
   - Optimizes database access patterns

## API Reference

### RAG Query API

**Endpoint**: `POST https://rag-query-api.yourdomain.workers.dev/query`

**Request Body**:
```json
{
  "query": "What are the main features of IcePhone?",
  "top_k": 5,
  "similarity_threshold": 0.7,
  "model_provider": "openai",
  "model_name": "gpt-4o-mini",
  "stream": true,
  "include_sources": true,
  "filters": {
    "source_id": 123
  }
}
```

**Response**:

```json
{
  "answer": "IcePhone is an AI-powered CRM and Voice Agent Platform that...",
  "sources": [
    {
      "id": 456,
      "source_id": 123,
      "score": 0.92,
      "content_chunk_preview": "IcePhone features include AI-powered voice agents...",
      "metadata": { "page": 1 }
    }
  ]
}
```

### Document Ingestion API

**Endpoint**: `POST https://knowledge-base-ingestion.yourdomain.workers.dev/ingest`

**Request Body**:

```json
{
  "source_id": 123,
  "source_name": "Product Manual",
  "source_type": "pdf_upload",
  "source_uri": "product_manual.pdf",
  "file_content": "base64_encoded_content"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Document ingestion started",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "chunks_count": 42
}
```

## Maintenance Tasks

- **Reindexing Knowledge Base**: Run `bun run scripts/optimize-pgvector-indexes.ts`
- **Clearing Cache**: Use Cloudflare dashboard or Workers KV API
- **Monitoring Performance**: Visit `/admin/rag-monitoring` in the IcePhone admin dashboard

## Troubleshooting

Common issues and solutions:

1. **Slow Retrieval Performance**
   - Check database index status
   - Verify caching is functioning
   - Optimize chunk size/overlap

2. **Poor Relevance in Results**
   - Adjust similarity threshold
   - Review reranking configuration
   - Check document chunking strategy

3. **High API Costs**
   - Increase cache TTL values
   - Optimize top_k parameter
   - Use cheaper models for simpler queries

```

## Next Steps and Future Enhancements

1. **Multimodal Support**
   - Integrate Voyage Multimodal 3 for image understanding
   - Update database schema for multimodal content
   - Implement image processing in the ingestion pipeline

2. **Enhanced Voice Agent Integration**
   - Create specialized voice agent prompts
   - Improve context transfer between RAG and voice agents
   - Implement real-time knowledge lookup during calls

3. **User Feedback Loop**
   - Develop feedback collection mechanism
   - Implement response quality tracking
   - Create automated index improvement based on usage patterns

4. **Advanced Security Features**
   - Implement fine-grained access control for knowledge bases
   - Add content filtering and sensitive information detection
   - Create audit logs for all knowledge base access

5. **Automated Knowledge Base Management**
   - Scheduled document crawling and ingestion
   - Automatic redundancy detection and deduplication
   - Content refresh detection and prioritization
