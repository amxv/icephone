# Part 1: Knowledge Base & Database Setup (Neon DB with pgvector)

## Overview

This document outlines the implementation plan for setting up the knowledge base infrastructure using Neon DB with pgvector extension for the IcePhone RAG system. This foundation will enable vector similarity search for our retrieval system.

## Technical Requirements

- Neon PostgreSQL database with pgvector extension
- Drizzle ORM integration
- PostgreSQL vector indexing strategy
- TypeScript type definitions

## Implementation Steps

### 1. Database Schema Setup (3 days)

#### 1.1 Update `src/db/schema.ts` with Knowledge Base Tables

```typescript
// src/db/schema.ts
import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Import existing schema components
// ...

// Custom pgvector type for Drizzle ORM
export const pgvector = {
  vector: (dimensions: number) => 
    sql`vector(${sql.raw(dimensions.toString())})`.as('vector') as any,
};

// Knowledge Base Sources Table
export const knowledgeBaseSources = pgTable("knowledge_base_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "website_url", "pdf_upload", "gdoc", etc.
  uri: text("uri").notNull(), // URL or path to the source
  lastIndexedAt: timestamp("last_indexed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Knowledge Base Documents Table (chunks with embeddings)
export const knowledgeBaseDocuments = pgTable("knowledge_base_documents", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => knowledgeBaseSources.id, { 
    onDelete: "cascade" 
  }),
  contentChunk: text("content_chunk").notNull(),
  textEmbeddingModel: text("text_embedding_model").notNull(), // e.g., "voyage-3.5"
  textEmbedding: pgvector.vector(1024), // Adjust dimension based on chosen model
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Define relationships
export const knowledgeBaseSourcesRelations = relations(knowledgeBaseSources, ({ many }) => ({
  documents: many(knowledgeBaseDocuments),
}));

export const knowledgeBaseDocumentsRelations = relations(knowledgeBaseDocuments, ({ one }) => ({
  source: one(knowledgeBaseSources, {
    fields: [knowledgeBaseDocuments.sourceId],
    references: [knowledgeBaseSources.id],
  }),
}));

// Export all schema components
export {
  // existing exports...
  knowledgeBaseSources,
  knowledgeBaseDocuments,
};
```

#### 1.2 Create Types for Knowledge Base Models

```typescript
// src/types.ts (add these types to the existing file)

// Knowledge Base Source types
export type KnowledgeBaseSourceType = "website_url" | "pdf_upload" | "gdoc" | "txt_upload";

export interface KnowledgeBaseSource {
  id: number;
  name: string;
  type: KnowledgeBaseSourceType;
  uri: string;
  lastIndexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Knowledge Base Document types
export interface KnowledgeBaseDocument {
  id: number;
  sourceId: number | null;
  contentChunk: string;
  textEmbeddingModel: string;
  textEmbedding: unknown; // Vector type will be handled specially
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Types for API requests/responses
export interface KnowledgeBaseSourceCreateRequest {
  name: string;
  type: KnowledgeBaseSourceType;
  uri: string;
}

export interface KnowledgeBaseDocumentCreateRequest {
  sourceId?: number;
  contentChunk: string;
  textEmbeddingModel: string;
  textEmbedding: number[]; // Array of embedding values
  metadata?: Record<string, any>;
}
```

### 2. Database Configuration (2 days)

#### 2.1 Enable pgvector Extension on Neon DB

Run the following SQL to enable pgvector extension on your Neon database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 2.2 Create Indexing Strategy for Vector Search

```sql
-- After tables are created by Drizzle, set up vector search indexes
CREATE INDEX knowledge_base_documents_text_embedding_idx ON knowledge_base_documents USING hnsw (text_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

#### 2.3 Update Database Migration Script

```typescript
// src/db/migrations/add-knowledge-base-tables.ts
import { sql } from "drizzle-orm";
import { db } from "../db";

export async function createKnowledgeBaseTables() {
  // Enable pgvector extension
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
  
  // Apply Drizzle schema (this will create the tables)
  // This is handled by Drizzle push
  
  // Create vector search index 
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS knowledge_base_documents_text_embedding_idx 
    ON knowledge_base_documents 
    USING hnsw (text_embedding vector_cosine_ops) 
    WITH (m = 16, ef_construction = 64);
  `);
}
```

### 3. Integration with Client/Server Components (3 days)

#### 3.1 Server Action for Knowledge Base Management

```typescript
// src/actions/knowledge-base.ts
"use server";

import { db } from "@/db/db";
import { knowledgeBaseSources, knowledgeBaseDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { 
  KnowledgeBaseSourceCreateRequest, 
  KnowledgeBaseDocumentCreateRequest 
} from "@/types";

// Create a new knowledge base source
export async function createKnowledgeBaseSource(
  source: KnowledgeBaseSourceCreateRequest
) {
  try {
    const [createdSource] = await db
      .insert(knowledgeBaseSources)
      .values({
        name: source.name,
        type: source.type,
        uri: source.uri,
      })
      .returning();
    
    revalidatePath("/admin/knowledge-base");
    return { success: true, data: createdSource };
  } catch (error) {
    console.error("Failed to create knowledge base source:", error);
    return { success: false, error: "Failed to create knowledge base source" };
  }
}

// Get all knowledge base sources
export async function getKnowledgeBaseSources() {
  try {
    const sources = await db.select().from(knowledgeBaseSources);
    return { success: true, data: sources };
  } catch (error) {
    console.error("Failed to get knowledge base sources:", error);
    return { success: false, error: "Failed to get knowledge base sources" };
  }
}

// Get a knowledge base source by ID
export async function getKnowledgeBaseSourceById(id: number) {
  try {
    const source = await db
      .select()
      .from(knowledgeBaseSources)
      .where(eq(knowledgeBaseSources.id, id))
      .limit(1);
    
    return { success: true, data: source[0] || null };
  } catch (error) {
    console.error("Failed to get knowledge base source:", error);
    return { success: false, error: "Failed to get knowledge base source" };
  }
}

// Delete a knowledge base source
export async function deleteKnowledgeBaseSource(id: number) {
  try {
    await db
      .delete(knowledgeBaseSources)
      .where(eq(knowledgeBaseSources.id, id));
    
    revalidatePath("/admin/knowledge-base");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete knowledge base source:", error);
    return { success: false, error: "Failed to delete knowledge base source" };
  }
}

// Insert vector embedding document
export async function insertKnowledgeBaseDocument(
  document: KnowledgeBaseDocumentCreateRequest
) {
  try {
    const vectorValues = document.textEmbedding.join(',');
    
    // Use raw SQL for vector insertion since Drizzle doesn't natively support pgvector
    const [createdDocument] = await db.execute(sql`
      INSERT INTO knowledge_base_documents 
      (source_id, content_chunk, text_embedding_model, text_embedding, metadata)
      VALUES 
      (${document.sourceId || null}, ${document.contentChunk}, ${document.textEmbeddingModel}, 
       ${sql.raw(`'[${vectorValues}]'::vector`)}, ${JSON.stringify(document.metadata || {})})
      RETURNING *
    `);
    
    return { success: true, data: createdDocument };
  } catch (error) {
    console.error("Failed to insert knowledge base document:", error);
    return { success: false, error: "Failed to insert knowledge base document" };
  }
}

// Query similar documents using vector similarity
export async function querySimilarDocuments(
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.7
) {
  try {
    const vectorValues = queryEmbedding.join(',');
    
    // Use raw SQL for vector similarity search
    const results = await db.execute(sql`
      SELECT 
        kd.id, 
        kd.source_id, 
        kd.content_chunk,
        kd.metadata,
        1 - (kd.text_embedding <=> ${sql.raw(`'[${vectorValues}]'::vector`)}) as similarity
      FROM 
        knowledge_base_documents kd
      WHERE 
        1 - (kd.text_embedding <=> ${sql.raw(`'[${vectorValues}]'::vector`)}) > ${threshold}
      ORDER BY 
        similarity DESC
      LIMIT ${limit}
    `);
    
    return { success: true, data: results };
  } catch (error) {
    console.error("Failed to query similar documents:", error);
    return { success: false, error: "Failed to query similar documents" };
  }
}
```

### 4. Testing and Validation (2 days)

#### 4.1 Create Test Scripts for Database Operations

```typescript
// src/scripts/test-kb-vector-operations.ts
import { db } from "../db/db";
import { 
  createKnowledgeBaseSource,
  insertKnowledgeBaseDocument,
  querySimilarDocuments
} from "../actions/knowledge-base";

async function testKnowledgeBaseOperations() {
  try {
    // Test creating a source
    const sourceResult = await createKnowledgeBaseSource({
      name: "Test Source",
      type: "txt_upload",
      uri: "test-document.txt"
    });
    
    if (!sourceResult.success) {
      throw new Error("Failed to create source");
    }
    
    const sourceId = sourceResult.data.id;
    console.log("Created source:", sourceResult.data);
    
    // Generate a random test embedding (simplified for testing)
    const testEmbedding = Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
    
    // Test inserting a document with an embedding
    const docResult = await insertKnowledgeBaseDocument({
      sourceId,
      contentChunk: "This is a test document chunk for vector search.",
      textEmbeddingModel: "voyage-3.5-test",
      textEmbedding: testEmbedding,
      metadata: { test: true, page: 1 }
    });
    
    if (!docResult.success) {
      throw new Error("Failed to insert document");
    }
    
    console.log("Inserted document:", docResult.data);
    
    // Test vector similarity search
    const similarDocsResult = await querySimilarDocuments(testEmbedding, 5, 0.5);
    
    if (!similarDocsResult.success) {
      throw new Error("Failed to query similar documents");
    }
    
    console.log("Similar documents:", similarDocsResult.data);
    
    console.log("All tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Clean up test data if needed
    await db.execute(sql`DELETE FROM knowledge_base_documents WHERE metadata->>'test' = 'true'`);
    await db.execute(sql`DELETE FROM knowledge_base_sources WHERE name = 'Test Source'`);
  }
}

// Run the test
testKnowledgeBaseOperations();
```

### 5. Administrative Panel (Optional - 2 days)

Create a simple admin interface for knowledge base management in the Next.js application:

#### 5.1 Create Admin Routes and Components

```typescript
// src/app/admin/knowledge-base/page.tsx
import { getKnowledgeBaseSources } from "@/actions/knowledge-base";
import KnowledgeBaseSourcesList from "@/components/admin/KnowledgeBaseSourcesList";
import AddKnowledgeBaseSourceForm from "@/components/admin/AddKnowledgeBaseSourceForm";

export default async function KnowledgeBasePage() {
  const { data: sources = [] } = await getKnowledgeBaseSources();
  
  return (
    <div className="container h-[calc(100vh-5rem)]">
      <div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
        <h1 className="text-4xl lg:text-3xl font-medium tracking-tight pb-2 pt-4 text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700">
          Knowledge Base Management
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-medium mb-4">Knowledge Sources</h2>
            <KnowledgeBaseSourcesList sources={sources} />
          </div>
          <div>
            <h2 className="text-2xl font-medium mb-4">Add New Source</h2>
            <AddKnowledgeBaseSourceForm />
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Deployment and Configuration

1. Run migrations to set up the database schema:
   ```bash
   bun db:dev:push
   ```

2. Apply additional SQL for vector indexes:
   ```bash
   bun run src/scripts/apply-vector-indexes.ts
   ```

3. Test the knowledge base vector operations:
   ```bash
   bun run src/scripts/test-kb-vector-operations.ts
   ```

## Next Steps

After successfully implementing the knowledge base infrastructure, proceed to Part 2: Document Ingestion Worker System, which will handle the processing of documents and generation of embeddings.
