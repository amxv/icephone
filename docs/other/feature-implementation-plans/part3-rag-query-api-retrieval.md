# Part 3: RAG Query API & Retrieval System

## Overview

This document outlines the implementation plan for the RAG Query API & Retrieval System using Cloudflare Workers with Hono as the API framework. This component will handle query embedding, document retrieval, reranking, and LLM generation using the Vercel AI SDK.

**Advanced RAG Features Integrated:**

- **Query Rewriting**: Multiple query reformulation strategies for better retrieval
- **HyDE (Hypothetical Document Embeddings)**: Generate hypothetical answers for improved search
- **Voyage Reranking**: Cross-encoder models for relevance refinement
- **Multimodal Query Support**: Handle text and image queries using Voyage's multimodal-3 model
- **Hybrid Search**: Combine vector similarity with text search and metadata filtering

## Technical Requirements

- Cloudflare Workers environment
- Hono API framework
- Voyage AI integration for query embedding, multimodal processing, and reranking
- Vercel AI SDK for LLM interaction
- Neon DB with pgvector for similarity search
- TypeScript type definitions

## Implementation Steps

### 1. Query API Worker Setup (3 days)

#### 1.1 Initialize RAG Query API Worker Project

```bash
# Create a directory for the query API worker
mkdir -p workers/rag-query-api
cd workers/rag-query-api

# Initialize Cloudflare Workers project
bunx wrangler init

# Install dependencies
bun add hono @hono/zod-validator zod
bun add @neondatabase/serverless
bun add ai @vercel/ai
```

#### 1.2 Configure `wrangler.toml`

```toml
name = "rag-query-api"
main = "src/index.ts"
compatibility_date = "2023-12-01"

[vars]
NEON_DATABASE_URL = ""
VOYAGE_API_KEY = ""
OPENAI_API_KEY = ""
GEMINI_API_KEY = ""
ANTHROPIC_API_KEY = ""
MODEL_PROVIDER = "openai" # Default provider
MODEL_NAME = "gpt-4o-mini" # Default model

# Optional KV namespace for caching
[[kv_namespaces]]
binding = "QUERY_CACHE"
id = "YOUR_KV_NAMESPACE_ID"

# Use this for secrets management (don't commit actual secrets)
# [secrets]
# NEON_DATABASE_URL
# VOYAGE_API_KEY
# OPENAI_API_KEY
# GEMINI_API_KEY
# ANTHROPIC_API_KEY
```

### 2. Advanced Query Processing Pipeline (6 days)

#### 2.1 Query Analysis and Rewriting Service

```typescript
// src/lib/query-processing.ts
interface QueryAnalysis {
  queryType: 'factual' | 'analytical' | 'contextual' | 'procedural' | 'multimodal';
  complexity: 'simple' | 'moderate' | 'complex';
  rewrittenQueries: string[];
  originalQuery: string;
  hasVisualContent: boolean;
}

export class QueryProcessor {
  constructor(private apiKey: string) {}

  async analyzeQuery(query: string, images?: string[]): Promise<QueryAnalysis> {
    const hasVisualContent = images && images.length > 0;

    // Determine query type
    const queryType = this.determineQueryType(query, hasVisualContent);
    const complexity = this.assessComplexity(query);

    // Generate rewritten queries based on type
    const rewrittenQueries = await this.generateRewrittenQueries(query, queryType);

    return {
      queryType,
      complexity,
      rewrittenQueries,
      originalQuery: query,
      hasVisualContent,
    };
  }

  private determineQueryType(query: string, hasVisual: boolean): QueryAnalysis['queryType'] {
    if (hasVisual) return 'multimodal';

    const lowercaseQuery = query.toLowerCase();

    // Procedural queries (how-to)
    if (/\b(how to|how do|step|process|procedure|setup|configure)\b/.test(lowercaseQuery)) {
      return 'procedural';
    }

    // Analytical queries (comparison, analysis)
    if (/\b(compare|difference|analysis|evaluate|pros and cons|versus|vs)\b/.test(lowercaseQuery)) {
      return 'analytical';
    }

    // Contextual queries (explain, describe)
    if (/\b(explain|describe|what is|tell me about|overview)\b/.test(lowercaseQuery)) {
      return 'contextual';
    }

    // Default to factual
    return 'factual';
  }

  private assessComplexity(query: string): QueryAnalysis['complexity'] {
    const words = query.split(/\s+/).length;
    const hasMultipleConcepts = (query.match(/\band\b|\bor\b/g) || []).length > 1;

    if (words > 15 || hasMultipleConcepts) return 'complex';
    if (words > 8) return 'moderate';
    return 'simple';
  }

  private async generateRewrittenQueries(query: string, type: QueryAnalysis['queryType']): Promise<string[]> {
    const rewriteStrategies = {
      factual: [
        `What are the key facts about ${this.extractMainConcept(query)}?`,
        `Provide specific information regarding ${this.extractMainConcept(query)}`,
      ],
      analytical: [
        `Compare and analyze ${this.extractMainConcept(query)}`,
        `What are the advantages and disadvantages of ${this.extractMainConcept(query)}?`,
      ],
      contextual: [
        `Explain thoroughly and provide context for: ${this.extractMainConcept(query)}`,
        `Provide comprehensive information about ${this.extractMainConcept(query)}`,
      ],
      procedural: [
        `Step-by-step instructions for ${this.extractMainConcept(query)}`,
        `How to implement ${this.extractMainConcept(query)}`,
      ],
      multimodal: [
        `Visual and textual information about ${this.extractMainConcept(query)}`,
        `Describe what is shown in the image related to ${this.extractMainConcept(query)}`,
      ],
    };

    // Add query decomposition for complex queries
    const subQueries = this.decomposeQuery(query);

    return [
      query, // Original query
      ...rewriteStrategies[type],
      ...subQueries,
    ].slice(0, 5); // Limit to 5 queries maximum
  }

  private extractMainConcept(query: string): string {
    // Simple extraction - in production, could use NLP libraries
    const stopWords = ['what', 'how', 'when', 'where', 'why', 'is', 'are', 'the', 'a', 'an'];
    const words = query.toLowerCase().split(/\s+/).filter(word => !stopWords.includes(word));
    return words.slice(0, 3).join(' ');
  }

  private decomposeQuery(query: string): string[] {
    // Split complex queries into sub-queries
    const subQueries: string[] = [];

    // Look for compound questions
    const parts = query.split(/\band\b|\bor\b/);
    if (parts.length > 1) {
      parts.forEach(part => {
        const trimmed = part.trim();
        if (trimmed.length > 10) {
          subQueries.push(trimmed);
        }
      });
    }

    return subQueries;
  }
}
```

#### 2.2 HyDE (Hypothetical Document Embeddings) Service

```typescript
// src/lib/hyde-service.ts
interface HydeResult {
  hypotheticalAnswer: string;
  embedding: number[];
  originalQuery: string;
}

export class HydeProcessor {
  constructor(private apiKey: string, private llmApiKey: string) {}

  async generateHypotheticalDocument(query: string, queryType: string): Promise<HydeResult> {
    try {
      // Generate hypothetical answer using LLM
      const hypotheticalAnswer = await this.generateHypotheticalAnswer(query, queryType);

      // Get embedding for the hypothetical answer
      const embedding = await this.getHypotheticalEmbedding(hypotheticalAnswer);

      return {
        hypotheticalAnswer,
        embedding,
        originalQuery: query,
      };
    } catch (error) {
      console.error('Error in HyDE processing:', error);
      throw new Error(`HyDE processing failed: ${error.message}`);
    }
  }

  private async generateHypotheticalAnswer(query: string, queryType: string): Promise<string> {
    const prompts = {
      factual: `Answer this question with specific facts and details: ${query}`,
      analytical: `Provide a comprehensive analysis addressing: ${query}`,
      contextual: `Explain thoroughly and provide context for: ${query}`,
      procedural: `Provide step-by-step instructions for: ${query}`,
      multimodal: `Describe both visual and textual aspects related to: ${query}`,
    };

    const prompt = prompts[queryType as keyof typeof prompts] || prompts.factual;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.llmApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert on IcePhone CRM and Voice Agent Platform. Generate a detailed, accurate response that would be found in documentation or knowledge base.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async getHypotheticalEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'voyage-3.5',
        input: text,
        dimensions: 1024,
        input_type: 'document', // Treat hypothetical answer as document
      })
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
```

#### 2.3 Multimodal Query Processing

```typescript
// src/lib/multimodal-service.ts
interface MultimodalQueryResult {
  combinedEmbedding: number[];
  textEmbedding: number[];
  imageEmbeddings: number[][];
  processedText: string;
}

export class MultimodalQueryProcessor {
  constructor(private apiKey: string) {}

  async processMultimodalQuery(text: string, images: string[]): Promise<MultimodalQueryResult> {
    try {
      // Process text separately for fallback
      const textEmbedding = await this.getTextEmbedding(text);

      // Process images if provided
      const imageEmbeddings: number[][] = [];
      let combinedEmbedding: number[];

      if (images && images.length > 0) {
        // Use Voyage multimodal-3 for combined text+image processing
        combinedEmbedding = await this.getMultimodalEmbedding(text, images);

        // Also get individual image embeddings for granular search
        for (const image of images) {
          const imgEmbedding = await this.getImageEmbedding(image);
          imageEmbeddings.push(imgEmbedding);
        }
      } else {
        combinedEmbedding = textEmbedding;
      }

      return {
        combinedEmbedding,
        textEmbedding,
        imageEmbeddings,
        processedText: text,
      };
    } catch (error) {
      console.error('Error in multimodal processing:', error);
      throw new Error(`Multimodal processing failed: ${error.message}`);
    }
  }

  private async getTextEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'voyage-3.5',
        input: text,
        dimensions: 1024,
        input_type: 'query',
      })
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async getMultimodalEmbedding(text: string, images: string[]): Promise<number[]> {
    // Create interleaved content for multimodal model
    const content = [
      { type: 'text', text },
      ...images.map(img => ({ type: 'image_base64', image_base64: img }))
    ];

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'voyage-multimodal-3',
        input: content,
        dimensions: 1024,
        input_type: 'query',
      })
    });

    if (!response.ok) {
      throw new Error(`Voyage multimodal API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async getImageEmbedding(imageBase64: string): Promise<number[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'voyage-multimodal-3',
        input: [{ type: 'image_base64', image_base64: imageBase64 }],
        dimensions: 1024,
        input_type: 'query',
      })
    });

    if (!response.ok) {
      throw new Error(`Voyage multimodal API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
```

### 3. Core RAG Query API Implementation (5 days)

#### 3.1 Enhanced Query Endpoint with Advanced Features

```typescript
// src/index.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { cors } from 'hono/cors';
import { createClient } from '@neondatabase/serverless';
import { StreamingTextResponse, OpenAIStream, GoogleGenerativeAIStream, AnthropicStream } from 'ai';
import { QueryProcessor } from './lib/query-processing';
import { HydeProcessor } from './lib/hyde-service';
import { MultimodalQueryProcessor } from './lib/multimodal-service';
import { retrieveRelevantDocuments } from './lib/retrieval-service';
import { reranker } from './lib/reranker-service';
import { createPrompt } from './lib/prompt-templates';

// Define types
interface Env {
  NEON_DATABASE_URL: string;
  VOYAGE_API_KEY: string;
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  MODEL_PROVIDER: string;
  MODEL_NAME: string;
  QUERY_CACHE: KVNamespace;
}

// Create the Hono app
const app = new Hono<{ Bindings: Env }>();

// Apply middleware
app.use('/*', cors());

// Health check endpoint
app.get('/', (c) => {
  return c.json({ status: 'healthy', service: 'rag-query-api' });
});

// Enhanced query endpoint with advanced RAG features
app.post('/query',
  zValidator('json', z.object({
    query: z.string(),
    images: z.array(z.string()).optional(), // Base64 encoded images
    top_k: z.number().optional().default(5),
    similarity_threshold: z.number().optional().default(0.7),
    model_provider: z.enum(['openai', 'google', 'anthropic']).optional(),
    model_name: z.string().optional(),
    stream: z.boolean().optional().default(true),
    include_sources: z.boolean().optional().default(true),
    enable_query_rewriting: z.boolean().optional().default(true),
    enable_hyde: z.boolean().optional().default(true),
    enable_reranking: z.boolean().optional().default(true),
    filters: z.record(z.any()).optional(),
  })),
  async (c) => {
    const data = c.req.valid('json');
    const db = createClient(c.env.NEON_DATABASE_URL);

    try {
      // Initialize processors
      const queryProcessor = new QueryProcessor(c.env.VOYAGE_API_KEY);
      const hydeProcessor = new HydeProcessor(c.env.VOYAGE_API_KEY, c.env.OPENAI_API_KEY);
      const multimodalProcessor = new MultimodalQueryProcessor(c.env.VOYAGE_API_KEY);

      // Get model configuration
      const modelProvider = data.model_provider || c.env.MODEL_PROVIDER;
      const modelName = data.model_name || c.env.MODEL_NAME;

      // Step 1: Analyze and process query
      const queryAnalysis = await queryProcessor.analyzeQuery(data.query, data.images);

      // Step 2: Generate embeddings using multiple strategies
      const embeddingStrategies = [];

      // Original query embedding
      if (queryAnalysis.hasVisualContent) {
        const multimodalResult = await multimodalProcessor.processMultimodalQuery(data.query, data.images!);
        embeddingStrategies.push({
          type: 'multimodal',
          embedding: multimodalResult.combinedEmbedding,
          weight: 0.5,
        });
        embeddingStrategies.push({
          type: 'text',
          embedding: multimodalResult.textEmbedding,
          weight: 0.3,
        });
      } else {
        const textResult = await multimodalProcessor.processMultimodalQuery(data.query, []);
        embeddingStrategies.push({
          type: 'text',
          embedding: textResult.textEmbedding,
          weight: 0.6,
        });
      }

      // HyDE embedding if enabled
      if (data.enable_hyde) {
        const hydeResult = await hydeProcessor.generateHypotheticalDocument(data.query, queryAnalysis.queryType);
        embeddingStrategies.push({
          type: 'hyde',
          embedding: hydeResult.embedding,
          weight: 0.3,
        });
      }

      // Query rewriting embeddings if enabled
      if (data.enable_query_rewriting && queryAnalysis.rewrittenQueries.length > 1) {
        for (const rewrittenQuery of queryAnalysis.rewrittenQueries.slice(1, 3)) { // Use top 2 rewrites
          const rewriteResult = await multimodalProcessor.processMultimodalQuery(rewrittenQuery, []);
          embeddingStrategies.push({
            type: 'rewritten',
            embedding: rewriteResult.textEmbedding,
            weight: 0.2,
          });
        }
      }

      // Step 3: Retrieve documents using multiple embedding strategies
      let allRetrievedDocs = [];

      for (const strategy of embeddingStrategies) {
        const docs = await retrieveRelevantDocuments({
          queryEmbedding: strategy.embedding,
          embeddingType: strategy.type === 'multimodal' ? 'multimodal' : 'text',
          topK: Math.ceil(data.top_k * 2 * strategy.weight),
          similarityThreshold: data.similarity_threshold * 0.8, // Lower threshold for diverse results
          filters: data.filters,
          db,
        });

        // Add strategy metadata to docs
        docs.forEach(doc => {
          doc.retrievalStrategy = strategy.type;
          doc.strategyWeight = strategy.weight;
        });

        allRetrievedDocs.push(...docs);
      }

      // Remove duplicates while preserving highest scores
      const uniqueDocs = this.deduplicateDocuments(allRetrievedDocs);

      // Step 4: Rerank documents if enabled
      let contextDocs = uniqueDocs;
      if (data.enable_reranking && uniqueDocs.length > data.top_k) {
        const rerankedResults = await reranker({
          query: data.query,
          documents: uniqueDocs.map(doc => ({
            id: doc.id.toString(),
            text: doc.content_chunk,
          })),
          apiKey: c.env.VOYAGE_API_KEY,
        });

        // Filter to top_k based on reranking scores
        contextDocs = rerankedResults
          .sort((a, b) => b.score - a.score)
          .slice(0, data.top_k)
          .map(result => {
            const originalDoc = uniqueDocs.find(doc => doc.id.toString() === result.id);
            return {
              ...originalDoc,
              score: result.score,
              reranked: true,
            };
          });
      } else {
        contextDocs = uniqueDocs
          .sort((a, b) => b.score - a.score)
          .slice(0, data.top_k);
      }

      // Step 5: Create enhanced prompt with context
      const prompt = createPrompt(data.query, contextDocs, {
        queryType: queryAnalysis.queryType,
        hasVisualContent: queryAnalysis.hasVisualContent,
        includeRetrievalMetadata: true,
      });

      // Step 6: Generate response using appropriate model
      if (data.stream) {
        let stream;

        switch (modelProvider) {
          case 'openai':
            stream = OpenAIStream({
              apiKey: c.env.OPENAI_API_KEY,
              model: modelName,
              messages: [{ role: 'user', content: prompt }],
            });
            break;
          case 'google':
            stream = GoogleGenerativeAIStream({
              apiKey: c.env.GEMINI_API_KEY,
              model: modelName,
              prompt,
            });
            break;
          case 'anthropic':
            stream = AnthropicStream({
              apiKey: c.env.ANTHROPIC_API_KEY,
              model: modelName,
              prompt,
            });
            break;
          default:
            return c.json({ error: `Unsupported model provider: ${modelProvider}` }, 400);
        }

        // Return streaming response
        return new StreamingTextResponse(stream);
      } else {
        // Non-streaming response with enhanced metadata
        let response;

        switch (modelProvider) {
          case 'openai': {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`
              },
              body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: prompt }],
              })
            });
            const data = await res.json();
            response = data.choices[0].message.content;
            break;
          }
          // ... other providers
        }

        // Prepare enhanced result with advanced RAG metadata
        const result = {
          answer: response,
          query_analysis: {
            type: queryAnalysis.queryType,
            complexity: queryAnalysis.complexity,
            has_visual_content: queryAnalysis.hasVisualContent,
            rewritten_queries_used: data.enable_query_rewriting ? queryAnalysis.rewrittenQueries.length : 0,
          },
          retrieval_metadata: {
            strategies_used: embeddingStrategies.map(s => s.type),
            total_documents_retrieved: allRetrievedDocs.length,
            documents_after_deduplication: uniqueDocs.length,
            final_context_documents: contextDocs.length,
            hyde_enabled: data.enable_hyde,
            reranking_enabled: data.enable_reranking,
          },
          sources: data.include_sources ? contextDocs.map(doc => ({
            id: doc.id,
            source_id: doc.source_id,
            score: doc.score,
            content_chunk_preview: doc.content_chunk.substring(0, 200) + '...',
            metadata: doc.metadata,
            retrieval_strategy: doc.retrievalStrategy,
            reranked: doc.reranked || false,
          })) : undefined,
        };

        return c.json(result);
      }
    } catch (error) {
      console.error('Error processing enhanced query:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to process query'
      }, 500);
    } finally {
      await db.end();
    }
  }
);

// Helper method for document deduplication
function deduplicateDocuments(docs: any[]): any[] {
  const seen = new Map();
  const result = [];

  for (const doc of docs) {
    const key = `${doc.source_id}-${doc.id}`;
    if (!seen.has(key) || seen.get(key).score < doc.score) {
      seen.set(key, doc);
    }
  }

  return Array.from(seen.values());
}

// Export the Hono app for Cloudflare Workers
export default app;

export async function reranker(params: RerankerParams): Promise<RerankerResult[]> {
  const { query, documents, apiKey, model = 'voyage-rerank-2' } = params;

  if (documents.length === 0) {
    return [];
  }

  try {
    // Use Voyage's reranking API
    const response = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        query: query,
        documents: documents.map(doc => doc.text),
        return_documents: false, // We already have the documents
        top_k: documents.length, // Return all, we'll filter later
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Voyage reranking API error:', error);
      
      // Fallback to simple scoring if reranking fails
      return documents.map((doc, index) => ({
        id: doc.id,
        score: 1.0 - (index * 0.1), // Decreasing scores
        model: 'fallback',
      }));
    }

    const data = await response.json();

    return data.results.map((result: any, index: number) => ({
      id: documents[result.index].id,
      score: result.relevance_score,
      model: model,
    }));
  } catch (error) {
    console.error('Error reranking documents:', error);
    
    // Fallback to original order with decreasing scores
    return documents.map((doc, index) => ({
      id: doc.id,
      score: 1.0 - (index * 0.1),
      model: 'fallback',
    }));
  }
}

// Advanced reranking with multiple strategies
export async function advancedReranker(params: RerankerParams & {
  strategies: string[];
}): Promise<RerankerResult[]> {
  const { strategies, ...baseParams } = params;
  
  if (strategies.includes('voyage-rerank-2')) {
    try {
      return await reranker({ ...baseParams, model: 'voyage-rerank-2' });
    } catch (error) {
      console.warn('Voyage reranker failed, trying fallback:', error);
    }
  }
  
  if (strategies.includes('semantic-similarity')) {
    // Implement semantic similarity reranking as fallback
    return await semanticSimilarityRerank(baseParams);
  }
  
  // Final fallback
  return params.documents.map((doc, index) => ({
    id: doc.id,
    score: 1.0 - (index * 0.1),
    model: 'fallback',
  }));
}

async function semanticSimilarityRerank(params: RerankerParams): Promise<RerankerResult[]> {
  // Simple semantic similarity scoring based on keyword overlap
  const queryWords = params.query.toLowerCase().split(/\s+/);
  
  return params.documents.map(doc => {
    const docWords = doc.text.toLowerCase().split(/\s+/);
    const intersection = queryWords.filter(word => docWords.includes(word));
    const score = intersection.length / Math.max(queryWords.length, docWords.length);
    
    return {
      id: doc.id,
      score: score,
      model: 'semantic-similarity',
    };
  }).sort((a, b) => b.score - a.score);
}
