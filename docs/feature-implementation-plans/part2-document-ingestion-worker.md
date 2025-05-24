# Part 2: Document Ingestion Worker System (Cloudflare Workers)

## Overview

This document outlines the implementation plan for the Document Ingestion Worker System using Cloudflare Workers with Hono as the API framework. This component will handle the parsing, chunking, embedding, and storage of documents for the IcePhone RAG system, featuring advanced RAG capabilities including multimodal embeddings for complex document layouts.

## Advanced RAG Features Integrated

### 1. Multimodal Document Processing

- **Voyage Multimodal-3 Integration**: Support for PDFs with complex layouts containing text, images, tables, and figures
- **Screenshot-based Embedding**: Process document pages as screenshots to preserve visual context
- **Interleaved Text & Images**: Handle documents with mixed content types without complex parsing

### 2. HyDE (Hypothetical Document Embeddings) Support

- **Document Enrichment**: Generate hypothetical queries that documents could answer
- **Enhanced Retrieval**: Create additional embeddings based on potential use cases
- **Context Expansion**: Improve semantic understanding of document content

### 3. Advanced Chunking Strategies

- **Layout-Aware Chunking**: Preserve visual relationships between content elements
- **Adaptive Chunking**: Different strategies based on document type and content density
- **Context-Preserving Splits**: Maintain semantic coherence across chunk boundaries

## Technical Requirements

- Cloudflare Workers environment
- Hono API framework
- Document parsing libraries compatible with Cloudflare Workers
- Voyage AI integration for embedding generation (text and multimodal)
- Drizzle ORM for database operations
- TypeScript type definitions

## Implementation Steps

### 1. Cloudflare Workers Project Setup (2 days)

#### 1.1 Initialize Cloudflare Workers Project

```bash
# Create a directory for the workers project
mkdir -p workers/knowledge-base-ingestion
cd workers/knowledge-base-ingestion

# Initialize Cloudflare Workers project
bunx wrangler init

# Install dependencies
bun add hono @hono/zod-validator zod
bun add @neondatabase/serverless
bun add pdf.js-extract mammoth unzipper
bun add node-html-parser jimp canvas
```

#### 1.2 Configure `wrangler.toml`

```toml
name = "knowledge-base-ingestion"
main = "src/index.ts"
compatibility_date = "2023-12-01"

[vars]
NEON_DATABASE_URL = ""
VOYAGE_API_KEY = ""

# Optional KV namespace for caching
[[kv_namespaces]]
binding = "KNOWLEDGE_CACHE"
id = "YOUR_KV_NAMESPACE_ID"

# KV namespace for storing processing jobs
[[kv_namespaces]]
binding = "JOB_STORAGE"
id = "YOUR_JOB_KV_NAMESPACE_ID"

# Use this for secrets management (don't commit actual secrets)
# [secrets]
# NEON_DATABASE_URL
# VOYAGE_API_KEY
```

### 2. Advanced Document Processing Infrastructure (7 days)

#### 2.1 Multimodal Document Processor

```typescript
// src/lib/multimodal-processor.ts
import { generateEmbeddings, generateMultimodalEmbeddings } from './embedding-service';
import { generateHydeDocuments } from './hyde-processor';

interface ProcessingOptions {
  useMultimodal: boolean;
  useHyde: boolean;
  chunkingStrategy: 'adaptive' | 'layout-aware' | 'standard';
  preserveLayout: boolean;
}

interface ProcessedDocument {
  chunks: DocumentChunk[];
  multimodalEmbeddings?: number[][];
  hydeEmbeddings?: number[][];
  metadata: ProcessingMetadata;
}

interface DocumentChunk {
  content: string;
  type: 'text' | 'image' | 'table' | 'mixed';
  embedding: number[];
  pageNumber: number;
  boundingBox?: BoundingBox;
  visualContext?: string; // Description of visual elements
}

interface ProcessingMetadata {
  totalPages: number;
  processingTime: number;
  chunkingStrategy: string;
  embeddingModels: string[];
  visualElementsDetected: boolean;
}

export class MultimodalDocumentProcessor {
  private voyageApiKey: string;

  constructor(voyageApiKey: string) {
    this.voyageApiKey = voyageApiKey;
  }

  async processDocument(
    documentBuffer: ArrayBuffer,
    fileName: string,
    options: ProcessingOptions
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();

    // Determine document type and processing strategy
    const documentType = this.detectDocumentType(fileName);
    const processingStrategy = this.selectProcessingStrategy(documentType, options);

    let processedDoc: ProcessedDocument;

    switch (processingStrategy) {
      case 'multimodal-screenshot':
        processedDoc = await this.processWithScreenshots(documentBuffer, options);
        break;
      case 'hybrid-text-visual':
        processedDoc = await this.processHybridDocument(documentBuffer, options);
        break;
      case 'standard-text':
        processedDoc = await this.processTextDocument(documentBuffer, options);
        break;
      default:
        throw new Error(`Unsupported processing strategy: ${processingStrategy}`);
    }

    // Add HyDE embeddings if requested
    if (options.useHyde) {
      processedDoc.hydeEmbeddings = await this.generateHydeEmbeddings(processedDoc.chunks);
    }

    processedDoc.metadata.processingTime = Date.now() - startTime;
    return processedDoc;
  }

  private async processWithScreenshots(
    documentBuffer: ArrayBuffer,
    options: ProcessingOptions
  ): Promise<ProcessedDocument> {
    // Convert PDF pages to screenshots for multimodal processing
    const screenshots = await this.convertPdfToScreenshots(documentBuffer);
    const chunks: DocumentChunk[] = [];

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];

      // Generate multimodal embedding for the entire page
      const multimodalEmbedding = await generateMultimodalEmbeddings(
        [{ type: 'image', content: screenshot }],
        this.voyageApiKey,
        'document'
      );

      // Extract text for search and context
      const extractedText = await this.extractTextFromScreenshot(screenshot);

      // Create chunk with both text and visual context
      const chunk: DocumentChunk = {
        content: extractedText,
        type: 'mixed',
        embedding: multimodalEmbedding[0],
        pageNumber: i + 1,
        visualContext: `Screenshot of page ${i + 1} containing text, images, and layout elements`
      };

      chunks.push(chunk);
    }

    return {
      chunks,
      multimodalEmbeddings: chunks.map(c => c.embedding),
      metadata: {
        totalPages: screenshots.length,
        processingTime: 0, // Will be set later
        chunkingStrategy: 'page-level-screenshots',
        embeddingModels: ['voyage-multimodal-3'],
        visualElementsDetected: true
      }
    };
  }

  private async processHybridDocument(
    documentBuffer: ArrayBuffer,
    options: ProcessingOptions
  ): Promise<ProcessedDocument> {
    // Extract both text and visual elements separately
    const textContent = await this.extractText(documentBuffer);
    const visualElements = await this.extractVisualElements(documentBuffer);

    const chunks: DocumentChunk[] = [];

    // Process text chunks with layout awareness
    const textChunks = await this.chunkTextWithLayout(textContent, options.chunkingStrategy);

    for (const textChunk of textChunks) {
      // Generate text embedding
      const textEmbedding = await generateEmbeddings(
        [textChunk.content],
        this.voyageApiKey,
        'document'
      );

      chunks.push({
        ...textChunk,
        type: 'text',
        embedding: textEmbedding[0]
      });
    }

    // Process visual elements
    for (const visualElement of visualElements) {
      const multimodalEmbedding = await generateMultimodalEmbeddings(
        [{ type: 'image', content: visualElement.imageData, text: visualElement.caption }],
        this.voyageApiKey,
        'document'
      );

      chunks.push({
        content: visualElement.caption || `Visual element from page ${visualElement.pageNumber}`,
        type: visualElement.type as 'image' | 'table',
        embedding: multimodalEmbedding[0],
        pageNumber: visualElement.pageNumber,
        boundingBox: visualElement.boundingBox,
        visualContext: visualElement.description
      });
    }

    return {
      chunks,
      metadata: {
        totalPages: Math.max(...chunks.map(c => c.pageNumber)),
        processingTime: 0,
        chunkingStrategy: options.chunkingStrategy,
        embeddingModels: ['voyage-3.5', 'voyage-multimodal-3'],
        visualElementsDetected: visualElements.length > 0
      }
    };
  }

  private async generateHydeEmbeddings(chunks: DocumentChunk[]): Promise<number[][]> {
    const hydeEmbeddings: number[][] = [];

    for (const chunk of chunks) {
      // Generate hypothetical questions that this chunk could answer
      const hypotheticalQueries = await generateHydeDocuments(chunk.content, {
        numQueries: 3,
        queryTypes: ['factual', 'analytical', 'contextual']
      });

      // Generate embeddings for hypothetical queries
      const queryEmbeddings = await generateEmbeddings(
        hypotheticalQueries,
        this.voyageApiKey,
        'query'
      );

      // Average the embeddings to create a composite HyDE embedding
      const avgEmbedding = this.averageEmbeddings(queryEmbeddings);
      hydeEmbeddings.push(avgEmbedding);
    }

    return hydeEmbeddings;
  }
}
```

#### 2.2 HyDE (Hypothetical Document Embeddings) Processor

```typescript
// src/lib/hyde-processor.ts
interface HydeOptions {
  numQueries: number;
  queryTypes: ('factual' | 'analytical' | 'contextual' | 'procedural')[];
  llmProvider: 'openai' | 'anthropic' | 'gemini';
}

interface HydeQuery {
  query: string;
  type: string;
  confidence: number;
}

export async function generateHydeDocuments(
  documentContent: string,
  options: HydeOptions
): Promise<string[]> {
  const prompts = {
    factual: `Based on the following document content, generate ${Math.ceil(options.numQueries / options.queryTypes.length)} factual questions that someone might ask to find this information:\n\n${documentContent}\n\nGenerate questions that would lead someone to this document when searching for specific facts, data, or information contained within it.`,

    analytical: `Based on the following document content, generate ${Math.ceil(options.numQueries / options.queryTypes.length)} analytical questions that someone might ask to find this information:\n\n${documentContent}\n\nGenerate questions that involve analysis, interpretation, or understanding of concepts, trends, or relationships discussed in this document.`,

    contextual: `Based on the following document content, generate ${Math.ceil(options.numQueries / options.queryTypes.length)} contextual questions that someone might ask to find this information:\n\n${documentContent}\n\nGenerate questions that seek background information, context, or explanations that this document provides.`,

    procedural: `Based on the following document content, generate ${Math.ceil(options.numQueries / options.queryTypes.length)} procedural questions that someone might ask to find this information:\n\n${documentContent}\n\nGenerate questions about processes, steps, methods, or instructions that this document contains.`
  };

  const allQueries: string[] = [];

  for (const queryType of options.queryTypes) {
    const prompt = prompts[queryType];

    try {
      // Call LLM to generate hypothetical queries
      const response = await callLLM(prompt, {
        provider: options.llmProvider,
        maxTokens: 200,
        temperature: 0.7
      });

      // Parse queries from response
      const queries = parseQueriesFromResponse(response);
      allQueries.push(...queries);
    } catch (error) {
      console.error(`Error generating ${queryType} HyDE queries:`, error);
      // Fallback to template-based generation
      const fallbackQueries = generateFallbackQueries(documentContent, queryType);
      allQueries.push(...fallbackQueries);
    }
  }

  // Limit to requested number and ensure uniqueness
  return [...new Set(allQueries)].slice(0, options.numQueries);
}

async function callLLM(prompt: string, options: any): Promise<string> {
  // Implementation would call the appropriate LLM API
  // This would use Vercel AI SDK or direct API calls
  // Placeholder implementation:
  return "What is the main topic discussed in this document?\nHow does this information relate to business operations?\nWhat are the key findings presented?";
}

function parseQueriesFromResponse(response: string): string[] {
  // Parse LLM response to extract individual queries
  return response
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter(query => query.length > 10); // Filter out very short responses
}

function generateFallbackQueries(content: string, queryType: string): string[] {
  // Fallback query generation based on content analysis
  const contentLength = content.length;
  const hasNumbers = /\d/.test(content);
  const hasSteps = /step|process|procedure/i.test(content);

  const fallbackQueries: string[] = [];

  switch (queryType) {
    case 'factual':
      fallbackQueries.push("What information is provided in this document?");
      if (hasNumbers) fallbackQueries.push("What are the key statistics or data points mentioned?");
      break;
    case 'analytical':
      fallbackQueries.push("What analysis or insights are presented?");
      break;
    case 'contextual':
      fallbackQueries.push("What is the background context for this information?");
      break;
    case 'procedural':
      if (hasSteps) fallbackQueries.push("What process or procedure is described?");
      break;
  }

  return fallbackQueries;
}
```

#### 2.3 Enhanced Embedding Service with Multimodal Support

```typescript
// src/lib/embedding-service.ts
interface MultimodalInput {
  type: 'text' | 'image' | 'mixed';
  content: string | ArrayBuffer;
  text?: string; // For image captions or descriptions
}

export async function generateMultimodalEmbeddings(
  inputs: MultimodalInput[],
  apiKey: string,
  inputType: 'query' | 'document' = 'document'
): Promise<number[][]> {
  const voyageInputs = inputs.map(input => {
    if (input.type === 'text') {
      return [input.content as string];
    } else if (input.type === 'image') {
      // Convert image buffer to PIL Image or base64 as required by Voyage API
      const imageData = convertToVoyageFormat(input.content as ArrayBuffer);
      return input.text ? [input.text, imageData] : [imageData];
    } else {
      // Mixed content - interleaved text and images
      return [input.text || '', convertToVoyageFormat(input.content as ArrayBuffer)];
    }
  });

  try {
    const response = await fetch('https://api.voyageai.com/v1/multimodalembeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: voyageInputs,
        model: 'voyage-multimodal-3',
        input_type: inputType,
        truncation: true
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings;
  } catch (error) {
    console.error('Error generating multimodal embeddings:', error);
    throw error;
  }
}

export async function generateEmbeddings(
  texts: string[],
  apiKey: string,
  inputType: 'query' | 'document' = 'document'
): Promise<number[][]> {
  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: texts,
        model: 'voyage-3.5',
        input_type: inputType,
        truncation: true
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings;
  } catch (error) {
    console.error('Error generating text embeddings:', error);
    throw error;
  }
}

function convertToVoyageFormat(imageBuffer: ArrayBuffer): any {
  // Convert ArrayBuffer to format expected by Voyage multimodal API
  // This would involve creating a PIL Image object or base64 encoding
  // Implementation depends on the specific format requirements
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
  return `data:image/jpeg;base64,${base64}`;
}
```

### 3. Enhanced Database Schema for Advanced RAG (2 days)

#### 3.1 Updated Schema with Multimodal and HyDE Support

```typescript
// Update to src/db/schema.ts
import { sql } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, jsonb, vector, boolean, integer, real } from 'drizzle-orm/pg-core';

// Enhanced knowledge base sources table
export const knowledgeBaseSources = pgTable('knowledge_base_sources', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'pdf_upload', 'docx_upload', 'website_url', 'image_upload'
  uri: text('uri').notNull(),
  processingOptions: jsonb('processing_options').$type<{
    useMultimodal: boolean;
    useHyde: boolean;
    chunkingStrategy: string;
    preserveLayout: boolean;
  }>(),
  lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Enhanced documents table with multimodal support
export const knowledgeBaseDocuments = pgTable('knowledge_base_documents', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').references(() => knowledgeBaseSources.id),
  contentChunk: text('content_chunk').notNull(),
  chunkType: text('chunk_type').notNull(), // 'text', 'image', 'table', 'mixed'

  // Text embedding (voyage-3.5)
  textEmbeddingModel: text('text_embedding_model').default('voyage-3.5'),
  textEmbedding: vector('text_embedding', { dimensions: 1024 }),

  // Multimodal embedding (voyage-multimodal-3)
  multimodalEmbeddingModel: text('multimodal_embedding_model'),
  multimodalEmbedding: vector('multimodal_embedding', { dimensions: 1024 }),

  // HyDE embeddings
  hydeEmbedding: vector('hyde_embedding', { dimensions: 1024 }),
  hydeQueries: jsonb('hyde_queries').$type<string[]>(),

  // Visual context and metadata
  visualContext: text('visual_context'), // Description of visual elements
  boundingBox: jsonb('bounding_box').$type<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>(),

  pageNumber: integer('page_number'),
  processingMetadata: jsonb('processing_metadata').$type<{
    processingTime: number;
    chunkingStrategy: string;
    embeddingModels: string[];
    visualElementsDetected: boolean;
    confidence: number;
  }>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Table for storing visual elements separately (optional)
export const visualElements = pgTable('visual_elements', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').references(() => knowledgeBaseDocuments.id),
  elementType: text('element_type').notNull(), // 'image', 'table', 'chart', 'diagram'
  description: text('description'),
  extractedText: text('extracted_text'),
  imageData: text('image_data'), // Base64 encoded image
  embedding: vector('embedding', { dimensions: 1024 }),
  boundingBox: jsonb('bounding_box'),
  pageNumber: integer('page_number'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

### 4. Enhanced API Endpoints (3 days)

#### 4.1 Advanced Document Ingestion Endpoint

```typescript
// src/index.ts - Enhanced ingestion endpoint
app.post('/ingest',
  zValidator('json', z.object({
    source_id: z.number().optional(),
    source_name: z.string(),
    source_type: z.enum(['website_url', 'pdf_upload', 'gdoc', 'txt_upload', 'image_upload']),
    source_uri: z.string(),
    file_content: z.string().optional(),
    processing_options: z.object({
      use_multimodal: z.boolean().default(false),
      use_hyde: z.boolean().default(false),
      chunking_strategy: z.enum(['adaptive', 'layout-aware', 'standard']).default('standard'),
      preserve_layout: z.boolean().default(false),
      generate_visual_descriptions: z.boolean().default(true),
    }).optional(),
  })),
  async (c) => {
    const data = c.req.valid('json');
    const db = createClient(c.env.NEON_DATABASE_URL);

    try {
      // Enhanced document processing with multimodal support
      const processor = new MultimodalDocumentProcessor(c.env.VOYAGE_API_KEY);

      const processingOptions = {
        useMultimodal: data.processing_options?.use_multimodal || false,
        useHyde: data.processing_options?.use_hyde || false,
        chunkingStrategy: data.processing_options?.chunking_strategy || 'standard',
        preserveLayout: data.processing_options?.preserve_layout || false,
      };

      // Process document with advanced capabilities
      const fileBuffer = data.file_content
        ? Uint8Array.from(atob(data.file_content), c => c.charCodeAt(0)).buffer
        : await fetchDocumentFromUri(data.source_uri);

      const processedDoc = await processor.processDocument(
        fileBuffer,
        data.source_name,
        processingOptions
      );

      // Store processed chunks in database
      const jobId = crypto.randomUUID();
      await storeProcessedDocument(db, {
        sourceId: data.source_id,
        sourceName: data.source_name,
        sourceType: data.source_type,
        sourceUri: data.source_uri,
        processedDoc,
        processingOptions,
        jobId,
      });

      return c.json({
        success: true,
        message: 'Advanced document ingestion completed',
        job_id: jobId,
        chunks_count: processedDoc.chunks.length,
        processing_metadata: processedDoc.metadata,
        features_used: {
          multimodal: processingOptions.useMultimodal,
          hyde: processingOptions.useHyde,
          chunking_strategy: processingOptions.chunkingStrategy,
        },
      });
    } catch (error) {
      console.error('Error in advanced document ingestion:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to process document with advanced features'
      }, 500);
    } finally {
      await db.end();
    }
  }
);
```

### 5. Next.js Integration and Admin Panel (3 days)

#### 5.1 Create Next.js API Route to Trigger Ingestion

```typescript
// src/app/api/knowledge-base/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { createKnowledgeBaseSource } from '@/actions/knowledge-base';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sourceName = formData.get('name') as string;
    const sourceType = formData.get('type') as string;

    if (!file || !sourceName || !sourceType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create source in the database
    const sourceResult = await createKnowledgeBaseSource({
      name: sourceName,
      type: sourceType as any,
      uri: file.name,
    });

    if (!sourceResult.success) {
      return NextResponse.json(
        { error: sourceResult.error },
        { status: 500 }
      );
    }

    // Read file as base64
    const buffer = await file.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString('base64');

    // Call the worker to process the document
    const response = await fetch('https://knowledge-base-ingestion.yourdomain.workers.dev/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: sourceResult.data.id,
        source_name: sourceName,
        source_type: sourceType,
        source_uri: file.name,
        file_content: base64Content,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to process document' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      jobId: result.job_id,
      sourceId: sourceResult.data.id,
      message: 'Document ingestion started',
    });
  } catch (error) {
    console.error('Error in knowledge base ingestion:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 5.2 Create Upload Component for Next.js Admin

```typescript
// src/components/admin/DocumentUploader.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload } from 'lucide-react';

export default function DocumentUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState('pdf_upload');
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // Auto-fill name if empty
      if (!sourceName) {
        setSourceName(selectedFile.name.split('.')[0]);
      }

      // Auto-detect type
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (extension === 'pdf') {
        setSourceType('pdf_upload');
      } else if (extension === 'docx' || extension === 'doc') {
        setSourceType('docx_upload');
      } else if (extension === 'txt') {
        setSourceType('txt_upload');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !sourceName || !sourceType) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', sourceName);
      formData.append('type', sourceType);

      const response = await fetch('/api/knowledge-base/ingest', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload document');
      }

      setJobId(result.jobId);

      toast({
        title: 'Document uploaded successfully',
        description: `Processing started with job ID: ${result.jobId}`,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'An error occurred during upload',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Document File</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Source Name</Label>
            <Input
              id="name"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="E.g., Product Manual"
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Source Type</Label>
            <Select
              value={sourceType}
              onValueChange={setSourceType}
              disabled={isUploading}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf_upload">PDF Document</SelectItem>
                <SelectItem value="docx_upload">Word Document</SelectItem>
                <SelectItem value="txt_upload">Text File</SelectItem>
                <SelectItem value="website_url">Website URL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {jobId && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Job ID: {jobId}</p>
              <p className="text-xs text-muted-foreground">
                Document processing has started. You can check the status in the jobs list.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={isUploading || !file}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload & Process
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
```

### 6. Worker Deployment and Testing (2 days)

#### 6.1 Deploy Worker to Cloudflare

```bash
# Deploy worker to Cloudflare
bunx wrangler deploy

# Set environment secrets
bunx wrangler secret put NEON_DATABASE_URL
bunx wrangler secret put VOYAGE_API_KEY

# Create KV namespace if not already done
bunx wrangler kv:namespace create KNOWLEDGE_CACHE
```

#### 6.2 Test the Ingestion Pipeline

Create a test script to verify the entire pipeline:

```typescript
// scripts/test-ingestion-pipeline.ts
async function testIngestionPipeline() {
  try {
    // Test file (small PDF)
    const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    // Create form data
    const formData = new FormData();
    formData.append('file', testFile);
    formData.append('name', 'Test Document');
    formData.append('type', 'pdf_upload');

    // Call the API
    const response = await fetch('http://localhost:3000/api/knowledge-base/ingest', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log('Ingestion result:', result);

    // Check job status
    if (result.jobId) {
      console.log(`Job started with ID: ${result.jobId}`);

      // Poll for job status a few times
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(
          `https://knowledge-base-ingestion.yourdomain.workers.dev/job/${result.jobId}`
        );

        const statusResult = await statusResponse.json();
        console.log(`Job status (attempt ${i + 1}):`, statusResult);

        if (statusResult.data?.status === 'completed' || statusResult.data?.status === 'failed') {
          break;
        }
      }
    }

    console.log('Test completed');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testIngestionPipeline();
```

## Next Steps

After successfully implementing the Document Ingestion Worker System, proceed to Part 3: RAG Query API & Retrieval System, which will handle the retrieval and generation aspects of the RAG system.
