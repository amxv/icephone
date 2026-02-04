# RAG Pipeline Research: Complete Implementation Analysis

## Executive Summary

This codebase implements a production-ready **Retrieval Augmented Generation (RAG)** system that enables AI agents to search and retrieve information from uploaded documents. The system uses **OpenAI's Vector Store API** for semantic search with automatic chunking and embedding, combined with **Vercel Blob** for file storage. The implementation is fully integrated into a Next.js 15 application with tRPC for type-safe APIs.

**Key Technologies:**
- **OpenAI Vector Store API** - Semantic search with automatic text chunking and embeddings
- **OpenAI Files API** - Document upload and storage
- **Vercel Blob** - CDN-backed file storage for direct access
- **PostgreSQL** - Document metadata and vector store configuration
- **AI SDK (Vercel)** - Tool definitions for agent integration
- **Next.js 15 App Router** - API routes and admin UI
- **tRPC** - Type-safe client-server communication

---

## Part 1: Admin Document Upload Flow

### 1.1 Admin UI Components

#### Entry Point: Admin Documents Page
**File:** `app/admin/documents/page.tsx`

```tsx
export default function AdminDocumentsPage() {
  return (
    <div className="container h-[calc(100vh-5rem)]">
      <div className="flex h-full flex-col gap-8 p-2 md:px-8 md:py-4">
        <div>
          <h1>Document Management</h1>
          <p>Upload and manage documents for semantic search in the AI chat</p>
        </div>
        <DocumentListTable />
      </div>
    </div>
  );
}
```

- Simple container that renders the `DocumentListTable` component
- Accessible at `/admin/documents`
- Requires admin role (enforced by layout middleware)

#### Main Component: DocumentListTable
**File:** `components/admin/document-list-table.tsx`

Key Features:
- **Search Filtering** - Search documents by filename (line 141-146)
- **Status Badges** - Visual status indicators for upload/processing states (line 216-220)
- **Tag Management** - Display and filter by document tags (line 221-234)
- **Auto-refresh** - Automatically refreshes status on mount if processing documents exist (line 86-102)
- **Refresh Button** - Manual status refresh via tRPC mutation (line 66-84)
- **Upload Dialog** - Triggers `UploadDocumentDialog` component (line 133-135)

```tsx
const { data, isLoading, error } = useQuery({
  ...trpc.admin.documents.list.queryOptions({
    searchTerm: searchValue || undefined,
    limit: 50,
    offset: 0,
  }),
});
```

#### Upload Dialog Component
**File:** `components/admin/upload-document-dialog.tsx`

Upload Flow (line 118-173):
1. **Drag & Drop UI** - Uses `react-dropzone` for file selection (line 62-72)
2. **File Validation** - Supports PDF, DOCX, TXT, MD up to 512MB (line 64-71)
3. **Tag Input** - Optional tags with autocomplete from existing tags (line 54-56, 330-341)
4. **Parallel Upload** - Uploads multiple files concurrently (line 135-138)
5. **Status Tracking** - Real-time upload progress per file (line 195-203)
6. **Success/Error Handling** - Individual file status with retry on failure (line 148-167)

Upload Process:
```tsx
const uploadSingleFile = async (file: File): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("tags", JSON.stringify(tags));

  const response = await fetch("/api/documents/upload", {
    method: "POST",
    body: formData,
  });

  // Status tracking and error handling...
};
```

### 1.2 API Route: Document Upload

**File:** `app/(admin)/api/documents/upload/route.ts`

Complete Upload Pipeline (lines 48-142):

```typescript
export async function POST(request: Request) {
  // 1. Authentication & Authorization (lines 49-58)
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse FormData and Validate (lines 64-85)
  const formData = await request.formData();
  const file = formData.get("file") as Blob;
  const filename = (formData.get("file") as File).name;
  const tagsString = formData.get("tags") as string | null;
  const tags = tagsString ? JSON.parse(tagsString) : [];

  // Schema validation with supported file types (lines 37-46)
  const validatedFile = DocumentFileSchema.safeParse({ file });

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // 3. Upload to Vercel Blob (lines 90-91)
  const blobResult = await uploadFile(filename, fileBuffer);
  // Returns: { url: string, pathname: string }

  // 4. Upload to OpenAI Files API (lines 93-94)
  const openaiFileId = await uploadFileToOpenAI(filename, fileBuffer);
  // Returns: OpenAI file ID (e.g., "file-abc123...")

  // 5. Get or Create Vector Store (lines 96-97)
  const vectorStoreId = await getOrCreateVectorStore();
  // Returns existing vector store ID or creates new one

  // 6. Add File to Vector Store (lines 99-100)
  await addFileToVectorStore(vectorStoreId, openaiFileId);
  // Initiates async indexing

  // 7. Save to Database (lines 102-114)
  const document = await saveUploadedDocument({
    filename,
    fileSize: file.size,
    contentType: file.type,
    blobUrl: blobResult.url,
    blobPathname: blobResult.pathname,
    openaiFileId,
    vectorStoreId,
    status: "processing",
    uploadedBy: session.user.id,
    tags,
  });

  // 8. Start Background Status Polling (lines 116-125)
  pollDocumentStatus(document.id, vectorStoreId, openaiFileId).catch(
    (error) => {
      console.error(`Background polling failed: ${error}`);
    }
  );

  return NextResponse.json({
    success: true,
    documentId: document.id,
  });
}
```

**Supported File Types** (lines 15-35):
- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
- `text/plain`, `text/markdown`
- `application/json`
- Code files: JS, Python, Java, C/C++, C#, Go, Ruby, PHP
- `text/html`, `text/css`

### 1.3 Bulk Upload API

**File:** `app/(admin)/api/documents/bulk-upload/route.ts`

Designed for programmatic bulk uploads from external sources:

```typescript
// Input schema (lines 26-35)
const BulkUploadSchema = z.object({
  documents: z.array(
    z.object({
      category: z.string(),
      title: z.string(),
      file_type: z.string(),
      url: z.string().url(), // Downloads from URL
    })
  ),
});

// Processing (lines 67-114)
for (const doc of documents) {
  // 1. Download file from URL
  const response = await fetch(doc.url);
  const arrayBuffer = await response.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  // 2. Generate filename
  const filename = `${doc.title}.${doc.file_type}`;

  // 3-8. Same upload pipeline as single upload
  const blobResult = await uploadFile(filename, fileBuffer);
  const openaiFileId = await uploadFileToOpenAI(filename, fileBuffer);
  await addFileToVectorStore(vectorStoreId, openaiFileId);
  const document = await saveUploadedDocument({...});
  pollDocumentStatus(document.id, vectorStoreId, openaiFileId);
}
```

Returns summary statistics:
```json
{
  "success": true,
  "message": "Bulk upload completed: 5 succeeded, 1 failed",
  "results": [...],
  "stats": {
    "total": 6,
    "succeeded": 5,
    "failed": 1
  }
}
```

### 1.4 Database Schema

**File:** `lib/db/schema.ts`

#### UploadedDocument Table (lines 133-181)

```typescript
export const uploadedDocument = pgTable(
  "UploadedDocument",
  {
    // Identity
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    filename: text("filename").notNull(),

    // Ownership and timestamps
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"), // Soft delete

    // File metadata
    fileSize: integer("file_size").notNull(),
    contentType: text("content_type").notNull(),

    // Storage references
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),

    // OpenAI references
    openaiFileId: text("openai_file_id").notNull().unique(),
    vectorStoreId: text("vector_store_id").notNull(),

    // Processing status
    status: varchar("status", {
      enum: ["uploading", "processing", "ready", "failed"],
    }).notNull().default("uploading"),
    errorMessage: text("error_message"),

    // Organization
    tags: json("tags").$type<string[]>().notNull().default([]),
  },
  (table) => ({
    uploadedByIdx: index("uploaded_document_uploaded_by_idx").on(table.uploadedBy),
    statusIdx: index("uploaded_document_status_idx").on(table.status),
    vectorStoreIdx: index("uploaded_document_vector_store_id_idx").on(table.vectorStoreId),
    deletedAtIdx: index("uploaded_document_deleted_at_idx").on(table.deletedAt),
  })
);
```

#### VectorStoreConfig Table (lines 183-188)

Singleton table storing the shared vector store ID:

```typescript
export const vectorStoreConfig = pgTable("VectorStoreConfig", {
  id: text("id").primaryKey().default("singleton"),
  vectorStoreId: text("vector_store_id").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Design Note: Single shared vector store for all documents - this enables cross-document semantic search.

### 1.5 File Storage Integration

**File:** `lib/blob.ts`

Vercel Blob wrapper functions:

```typescript
// Upload with automatic random suffix (lines 13-27)
export async function uploadFile(
  filename: string,
  buffer: Parameters<typeof put>[1]
): Promise<PutBlobResult> {
  return await put(`${BLOB_FILE_PREFIX}${filename}`, buffer, {
    access: "public",
    addRandomSuffix: true, // Prevents filename collisions
  });
}

// Returns:
// {
//   url: "https://xxx.public.blob.vercel-storage.com/documents/file-xyz.pdf",
//   pathname: "documents/file-xyz.pdf"
// }

// Delete files (lines 47-54)
export async function deleteFilesByUrls(urls: string[]): Promise<void> {
  await del(urls);
}
```

---

## Part 2: Document Processing Pipeline

### 2.1 OpenAI Files API Integration

**File:** `lib/openai/files.ts`

#### File Upload (lines 17-73)

```typescript
export async function uploadFileToOpenAI(
  filename: string,
  fileBuffer: Buffer
): Promise<string> {
  // Convert buffer to File object (required by OpenAI API)
  const file = new File([fileBuffer], filename, {
    type: "application/octet-stream",
  });

  const uploadedFile = await withRetry(() =>
    openaiClient.files.create({
      file,
      purpose: "assistants", // Important: enables vector store indexing
    })
  );

  // Returns file ID like "file-abc123..."
  return uploadedFile.id;
}
```

Error Handling (lines 47-59):
- **400 Validation Errors** - Invalid format or size exceeded
- **Automatic Retry** - Uses `withRetry()` wrapper for transient failures
- **Detailed Logging** - Logs filename, file ID, and byte size

#### File Content Retrieval (lines 90-146)

```typescript
export async function retrieveFileContent(
  vectorStoreId: string,
  fileId: string
): Promise<string> {
  // Uses Vector Store API, NOT standard Files API
  const page = await withRetry(() =>
    openaiClient.vectorStores.files.content(fileId, {
      vector_store_id: vectorStoreId,
    })
  );

  const textChunks: string[] = [];

  // Stream parsed content chunks
  for await (const chunk of page) {
    if (chunk?.type !== "text") {
      continue;
    }

    // Handle multiple text response formats
    if (typeof chunk.text === "string") {
      textChunks.push(chunk.text);
    } else if (chunk.text && typeof chunk.text === "object") {
      if (typeof (chunk.text as { value?: string }).value === "string") {
        textChunks.push((chunk.text as { value: string }).value);
      } else if (typeof (chunk.text as { text?: string }).text === "string") {
        textChunks.push((chunk.text as { text: string }).text);
      }
    }
  }

  return textChunks.join("\n");
}
```

Key Points:
- OpenAI automatically parses and extracts text from PDFs, DOCX, etc.
- Returns pre-processed text chunks
- No manual PDF parsing required

#### File Deletion (lines 156-182)

```typescript
export async function deleteFileFromOpenAI(fileId: string): Promise<void> {
  await openaiClient.files.delete(fileId);

  // Gracefully handles 404 errors (already deleted)
}
```

### 2.2 Vector Store Management

**File:** `lib/openai/vector-store.ts`

#### Get or Create Vector Store (lines 16-59)

```typescript
export async function getOrCreateVectorStore(): Promise<string> {
  // Try to get existing vector store ID from database
  const existingVectorStoreId = await getVectorStoreId();

  if (existingVectorStoreId) {
    return existingVectorStoreId;
  }

  // No vector store exists - create a new one
  const vectorStore = await withRetry(() =>
    openaiClient.vectorStores.create({
      name: "Organization Documents",
    })
  );

  // Save vector store ID to database
  await setVectorStoreId(vectorStore.id);

  return vectorStore.id;
}
```

**Important:** This maintains a **single shared vector store** for all documents. This enables:
- Cross-document semantic search
- Unified knowledge base
- Simpler management

#### Add File to Vector Store (lines 70-99)

```typescript
export async function addFileToVectorStore(
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  await withRetry(() =>
    openaiClient.vectorStores.files.create(vectorStoreId, {
      file_id: fileId,
    })
  );
}
```

**Critical Note:** This operation is **non-blocking**. OpenAI indexes the file asynchronously. The file status must be polled separately.

#### Remove File from Vector Store (lines 110-148)

```typescript
export async function removeFileFromVectorStore(
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  await openaiClient.vectorStores.files.delete(fileId, {
    vector_store_id: vectorStoreId,
  });

  // Gracefully handles 404 (file already removed)
}
```

**Important:** This only removes from vector store, NOT from OpenAI Files storage. Must call `deleteFileFromOpenAI()` separately for full cleanup.

#### Poll Vector Store Status (lines 159-194)

```typescript
export async function pollVectorStoreStatus(vectorStoreId: string): Promise<{
  inProgress: number;
  completed: number;
  failed: number;
}> {
  const vectorStore = await withRetry(() =>
    openaiClient.vectorStores.retrieve(vectorStoreId)
  );

  return {
    inProgress: vectorStore.file_counts.in_progress,
    completed: vectorStore.file_counts.completed,
    failed: vectorStore.file_counts.failed,
  };
}
```

Returns **aggregate counts** for all files in the vector store.

#### Get Individual File Status (lines 206-248)

```typescript
export async function getVectorStoreFileStatus(
  vectorStoreId: string,
  fileId: string
): Promise<{
  status: "in_progress" | "completed" | "failed" | "cancelled";
  lastError: { code: string; message: string } | null;
}> {
  const file = await withRetry(() =>
    openaiClient.vectorStores.files.retrieve(fileId, {
      vector_store_id: vectorStoreId,
    })
  );

  return {
    status: file.status,
    lastError: file.last_error
      ? {
          code: file.last_error.code,
          message: file.last_error.message,
        }
      : null,
  };
}
```

**Important:** This is the **correct** way to check file processing status. Don't rely on aggregate vector store counts.

#### Semantic Search API (lines 262-309)

```typescript
export async function searchVectorStore(
  vectorStoreId: string,
  query: string,
  maxNumResults = 10
): Promise<{
  data: Array<{
    file_id: string;
    filename: string;
    score: number;
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
}> {
  const results = await withRetry(() =>
    openaiClient.vectorStores.search(vectorStoreId, {
      query,
      max_num_results: maxNumResults,
    })
  );

  return results;
}
```

**New Vector Store Search API** - Much simpler than the old Assistants API approach. Returns:
- Ranked results with relevance scores
- Text content chunks
- File references

### 2.3 Background Status Polling

**File:** `lib/openai/status-polling.ts`

Automatic background job that polls OpenAI for processing status:

```typescript
export async function pollDocumentStatus(
  documentId: string,
  vectorStoreId: string,
  openaiFileId: string
): Promise<void> {
  const maxAttempts = 20; // ~10 minutes max with exponential backoff
  let attempt = 0;

  while (attempt < maxAttempts) {
    // Check file status
    const fileStatus = await getVectorStoreFileStatus(
      vectorStoreId,
      openaiFileId
    );

    if (fileStatus.status === "completed") {
      await updateDocumentStatus(documentId, "ready");
      return;
    }

    if (fileStatus.status === "failed") {
      await updateDocumentStatus(
        documentId,
        "failed",
        fileStatus.lastError?.message || "Processing failed"
      );
      return;
    }

    if (fileStatus.status === "cancelled") {
      await updateDocumentStatus(
        documentId,
        "failed",
        "Processing was cancelled"
      );
      return;
    }

    // Still processing - wait and retry with exponential backoff
    attempt++;
    const delay = Math.min(1000 * 1.5 ** attempt, 30_000); // Max 30s between polls
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Max attempts reached - keep as processing for manual refresh
  await updateDocumentStatus(
    documentId,
    "processing",
    DOCUMENT_PROCESSING_TIMEOUT_MESSAGE
  );
}
```

**Exponential Backoff Strategy:**
- Start: 1.5 seconds
- Max delay: 30 seconds
- Max attempts: 20 (~10 minutes total)
- On timeout: Marks document with special error message for manual refresh

### 2.4 OpenAI Client Configuration

**File:** `lib/openai/client.ts`

```typescript
import OpenAI from "openai";
import { env } from "@/lib/env";

export const openaiClient = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});
```

**Important:** This is a **separate client** from the AI SDK gateway. It uses the `OPENAI_API_KEY` directly for:
- Files API
- Vector Store API
- Image generation

The main chat uses Vercel AI Gateway for multi-model routing.

### 2.5 Chunking and Embedding

**Automatic by OpenAI** - The Vector Store API automatically:
1. **Chunks documents** - Splits text into semantic chunks
2. **Generates embeddings** - Uses OpenAI's embedding model
3. **Indexes content** - Stores embeddings for semantic search
4. **Maintains references** - Preserves source file and content mapping

**No manual chunking code required!** This is a huge advantage over custom RAG implementations.

---

## Part 3: Agent Tools and Document Search

### 3.1 AI Agent Tool Integration

**File:** `lib/ai/tools/tools.ts`

Tools registered in the chat system (lines 94-98):

```typescript
export function getTools({...}) {
  return {
    // ... other tools
    ...(env.NEXT_PUBLIC_OPENAI_AVAILABLE
      ? {
          semanticSearch: semanticSearch({ dataStream }),
          fileRetrieve: fileRetrieve({ dataStream }),
        }
      : {}),
  };
}
```

**Conditional Loading:** Only available when `NEXT_PUBLIC_OPENAI_AVAILABLE=true` in environment.

### 3.2 Semantic Search Tool

**File:** `lib/ai/tools/semantic-search.ts`

Complete tool implementation:

```typescript
export const semanticSearch = ({ dataStream }: SemanticSearchProps) =>
  tool({
    description:
      "Search the organization's document library using semantic similarity to find relevant information. Returns text passages with citations to source documents.",

    inputSchema: z.object({
      query: z.string().describe("The search query in natural language"),
      limit: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .describe("Maximum number of results to return (default: 5)"),
    }),

    execute: async ({ query, limit = 5 }: SemanticSearchInput) => {
      // 1. Write stream update (lines 54-61)
      dataStream.write({
        type: "data-researchUpdate",
        data: {
          title: "Searching documents",
          timestamp: Date.now(),
          type: "started",
        },
      });

      // 2. Get vector store ID from database (lines 64-73)
      const vectorStoreId = await getVectorStoreId();
      if (!vectorStoreId) {
        return {
          results: [],
          totalResults: 0,
        };
      }

      // 3. Perform semantic search (lines 77-82)
      const searchResults = await searchVectorStore(
        vectorStoreId,
        query,
        limit
      );

      // 4. Map results to output format (lines 90-120)
      const results: SearchResultItem[] = [];

      for (const result of searchResults.data) {
        // Get document metadata from database
        const document = await getUploadedDocumentByOpenAIFileId(
          result.file_id
        );

        if (!document) {
          continue; // Skip if not in database
        }

        // Extract text content
        const chunkContent = result.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n");

        results.push({
          documentId: document.id,
          documentName: document.filename,
          chunkContent,
          pageNumber: null, // OpenAI doesn't provide page numbers
          relevanceScore: result.score,
          blobUrl: document.blobUrl,
        });
      }

      // 5. Write completion update (lines 122-130)
      dataStream.write({
        type: "data-researchUpdate",
        data: {
          title: "Search complete",
          timestamp: Date.now(),
          type: "completed",
        },
      });

      return {
        results,
        totalResults: results.length,
      };
    },
  });
```

**Output Format:**
```typescript
{
  results: [
    {
      documentId: "uuid",
      documentName: "Employee Handbook.pdf",
      chunkContent: "Vacation policy: Employees accrue 2.5 days per month...",
      pageNumber: null,
      relevanceScore: 0.89,
      blobUrl: "https://xxx.blob.vercel-storage.com/..."
    }
  ],
  totalResults: 3
}
```

### 3.3 File Retrieve Tool

**File:** `lib/ai/tools/file-retrieve.ts`

Retrieves complete document content:

```typescript
export const fileRetrieve = ({ dataStream }: FileRetrieveProps) =>
  tool({
    description:
      "Retrieve the complete content of a specific document from the library. Use this when you need full context from a document rather than just search results.",

    inputSchema: z.object({
      documentId: z.string().describe("The ID of the document to retrieve"),
    }),

    execute: async ({ documentId }: FileRetrieveInput) => {
      // 1. Get document by ID (lines 54-61)
      const document = await getUploadedDocumentById(documentId);

      if (!document) {
        return { error: "Document not found" };
      }

      // 2. Check if document is ready (lines 64-72)
      if (document.status !== "ready") {
        return {
          error: `Document is ${document.status === "processing" ? "still processing" : "not available"}`,
        };
      }

      // 3. Retrieve file content from OpenAI (lines 84-87)
      const content = await retrieveFileContent(
        document.vectorStoreId,
        document.openaiFileId
      );

      // 4. Extract page count (best effort for PDFs) (lines 90-96)
      let pageCount: number | null = null;
      if (document.contentType === "application/pdf") {
        const pageMatches = content.match(/\f/g); // Form feed character
        pageCount = pageMatches ? pageMatches.length + 1 : null;
      }

      return {
        documentId: document.id,
        documentName: document.filename,
        content,
        pageCount,
        fileSize: document.fileSize,
      };
    },
  });
```

**Use Case:** When the agent needs complete document context (e.g., "Read the entire employee handbook").

### 3.4 System Prompt Integration

**File:** `lib/ai/prompts.ts` (lines 17-25)

The system prompt instructs the agent when to use RAG tools:

```typescript
## CRITICAL: Tool Usage Protocol

1. **Semantic Search** - Use this when you need to find relevant information from company documents
2. **File Retrieval** - Use this when you need to pull complete documents or specific file contents to provide comprehensive answers

**Never answer questions without using these tools.** All answers must be grounded in the actual company documents.
```

Citation Format Instructions (lines 63-69):
```typescript
### Always include citations
- Cite sources immediately after relevant information
- Format: [Document Name, Page X](URL) or [Policy Name](URL)
- Make citations clickable and specific
- Never provide information without citing the source document
```

### 3.5 Citation UI Components

**File:** `components/citation-link.tsx`

Renders clickable citation badges:

```tsx
export function CitationLink({ citation, index }: CitationLinkProps) {
  const { documentName, pageNumber, blobUrl, excerpt } = citation;

  // Build URL with page fragment (works in Chrome/Firefox/Edge, not Safari)
  const url = pageNumber ? `${blobUrl}#page=${pageNumber}` : blobUrl;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5"
        >
          <span>[{index}]</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <div>
          <p className="font-medium">{documentName}</p>
          {pageNumber && <p className="text-xs">Page {pageNumber}</p>}
          {excerpt && <p className="text-xs italic">"{excerpt.substring(0, 150)}..."</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

**File:** `components/citations.tsx`

Container component:

```tsx
export function Citations({ citations }: CitationsProps) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {citations.map((citation, index) => (
          <CitationLink
            citation={citation}
            index={index + 1}
            key={`${citation.documentId}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Part 4: Configuration and Environment

### 4.1 Required Environment Variables

**File:** `.env.example`

```bash
# OpenAI API Key - REQUIRED for RAG
OPENAI_API_KEY="sk-..."

# Vercel Blob - REQUIRED for file storage
BLOB_READ_WRITE_TOKEN=****

# Database - REQUIRED for metadata
POSTGRES_URL=****

# Redis - OPTIONAL (for resumable streams)
REDIS_URL=""

# AI Gateway - OPTIONAL (for multi-model routing)
AI_GATEWAY_API_KEY=""
```

### 4.2 Feature Flags

The RAG features are conditionally enabled based on environment variables:

**Server-side Check:**
```typescript
// lib/env.ts
export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  // ... other vars
};

// Tools registration (lib/ai/tools/tools.ts)
...(env.NEXT_PUBLIC_OPENAI_AVAILABLE
  ? {
      semanticSearch: semanticSearch({ dataStream }),
      fileRetrieve: fileRetrieve({ dataStream }),
    }
  : {})
```

**Client-side Check:**
```typescript
// Set NEXT_PUBLIC_OPENAI_AVAILABLE=true to enable RAG in frontend
NEXT_PUBLIC_OPENAI_AVAILABLE=true
```

### 4.3 tRPC Router Configuration

**File:** `trpc/routers/_app.ts`

```typescript
export const appRouter = createTRPCRouter({
  admin: adminRouter, // Contains document management procedures
  chat: chatRouter,
  credits: creditsRouter,
  vote: voteRouter,
  document: documentRouter,
});
```

**File:** `trpc/routers/admin.router.ts` (lines 270-432)

Document Management Procedures:

```typescript
export const adminRouter = createTRPCRouter({
  // ... user management procedures

  documents: {
    // List documents with filtering
    list: adminProcedure
      .input(z.object({
        searchTerm: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["uploading", "processing", "ready", "failed"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        const { listDocuments } = await import("@/lib/db/queries");
        return await listDocuments(input);
      }),

    // Get single document
    getById: adminProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const { getUploadedDocumentById } = await import("@/lib/db/queries");
        return await getUploadedDocumentById(input.id);
      }),

    // Delete document
    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        // 1. Remove from vector store
        await removeFileFromVectorStore(
          document.vectorStoreId,
          document.openaiFileId
        );

        // 2. Delete from OpenAI Files
        await deleteFileFromOpenAI(document.openaiFileId);

        // 3. Soft delete in database
        await softDeleteDocument(input.id);

        return { success: true };
      }),

    // Update tags
    updateTags: adminProcedure
      .input(z.object({
        id: z.string(),
        tags: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        await updateDocumentTags(input.id, input.tags);
        return { success: true };
      }),

    // Get all unique tags
    getAllTags: adminProcedure.query(async () => {
      const tags = await getAllTags();
      return { tags };
    }),

    // Refresh processing status
    refreshStatus: adminProcedure.mutation(async () => {
      const processingDocs = await getDocumentsRequiringStatusRefresh();

      let completed = 0;
      let failed = 0;

      for (const doc of processingDocs) {
        const fileStatus = await getVectorStoreFileStatus(
          doc.vectorStoreId,
          doc.openaiFileId
        );

        if (fileStatus.status === "completed") {
          await updateDocumentStatus(doc.id, "ready");
          completed++;
        } else if (fileStatus.status === "failed") {
          await updateDocumentStatus(
            doc.id,
            "failed",
            fileStatus.lastError?.message || "Unknown error"
          );
          failed++;
        }
      }

      return {
        updated: completed + failed,
        completed,
        failed,
      };
    }),
  },
});
```

### 4.4 Database Queries

**File:** `lib/db/queries.ts`

Key query functions:

```typescript
// Vector Store Config (lines 726-766)
export async function getVectorStoreId(): Promise<string | null> {
  const [config] = await db
    .select()
    .from(vectorStoreConfig)
    .where(eq(vectorStoreConfig.id, "singleton"))
    .limit(1);

  return config?.vectorStoreId || null;
}

export async function setVectorStoreId(vectorStoreId: string): Promise<void> {
  await db
    .insert(vectorStoreConfig)
    .values({
      id: "singleton",
      vectorStoreId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: vectorStoreConfig.id,
      set: {
        vectorStoreId,
        updatedAt: new Date(),
      },
    });
}

// Document Queries (lines 778-1027)
export async function listDocuments(input: {
  searchTerm?: string;
  tags?: string[];
  status?: "uploading" | "processing" | "ready" | "failed";
  limit?: number;
  offset?: number;
}): Promise<{
  documents: UploadedDocument[];
  total: number;
  hasMore: boolean;
}> {
  const whereConditions = [];

  // Exclude soft-deleted documents
  whereConditions.push(isNull(uploadedDocument.deletedAt));

  // Search term filter
  if (searchTerm) {
    whereConditions.push(ilike(uploadedDocument.filename, `%${searchTerm}%`));
  }

  // Tags filter using PostgreSQL JSON contains operator
  if (tags && tags.length > 0) {
    whereConditions.push(
      sql`${uploadedDocument.tags}::jsonb @> ${JSON.stringify(tags)}::jsonb`
    );
  }

  // Status filter
  if (status) {
    whereConditions.push(eq(uploadedDocument.status, status));
  }

  const documents = await db
    .select()
    .from(uploadedDocument)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(uploadedDocument.uploadedAt))
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ count: count() })
    .from(uploadedDocument)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

  const total = totalResult?.count || 0;

  return {
    documents,
    total,
    hasMore: offset + limit < total,
  };
}

export async function getUploadedDocumentById(
  id: string
): Promise<UploadedDocument | null> {
  const [document] = await db
    .select()
    .from(uploadedDocument)
    .where(
      and(eq(uploadedDocument.id, id), isNull(uploadedDocument.deletedAt))
    )
    .limit(1);

  return document || null;
}

export async function getUploadedDocumentByOpenAIFileId(
  openaiFileId: string
): Promise<UploadedDocument | null> {
  const [document] = await db
    .select()
    .from(uploadedDocument)
    .where(
      and(
        eq(uploadedDocument.openaiFileId, openaiFileId),
        isNull(uploadedDocument.deletedAt)
      )
    )
    .limit(1);

  return document || null;
}

export async function saveUploadedDocument(
  input: Omit<InsertUploadedDocument, "id" | "uploadedAt" | "updatedAt">
): Promise<UploadedDocument> {
  const [doc] = await db
    .insert(uploadedDocument)
    .values({
      ...input,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return doc;
}

export async function updateDocumentStatus(
  id: string,
  status: "uploading" | "processing" | "ready" | "failed",
  errorMessage?: string | null
): Promise<void> {
  await db
    .update(uploadedDocument)
    .set({
      status,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(uploadedDocument.id, id));
}

export async function softDeleteDocument(id: string): Promise<void> {
  await db
    .update(uploadedDocument)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(uploadedDocument.id, id));
}

export async function updateDocumentTags(
  id: string,
  tags: string[]
): Promise<void> {
  await db
    .update(uploadedDocument)
    .set({
      tags,
      updatedAt: new Date(),
    })
    .where(eq(uploadedDocument.id, id));
}

export async function getAllTags(): Promise<string[]> {
  const documents = await db
    .select({ tags: uploadedDocument.tags })
    .from(uploadedDocument)
    .where(isNull(uploadedDocument.deletedAt));

  // Flatten arrays and deduplicate
  const allTags = documents.flatMap((d) => (d.tags || []) as string[]);
  const uniqueTags = [...new Set(allTags)];

  return uniqueTags.sort();
}

export async function getDocumentsRequiringStatusRefresh(): Promise<
  UploadedDocument[]
> {
  return await db
    .select()
    .from(uploadedDocument)
    .where(
      and(
        isNull(uploadedDocument.deletedAt),
        or(
          eq(uploadedDocument.status, "processing"),
          and(
            eq(uploadedDocument.status, "failed"),
            eq(
              uploadedDocument.errorMessage,
              DOCUMENT_PROCESSING_TIMEOUT_MESSAGE
            )
          )
        )
      )
    )
    .orderBy(desc(uploadedDocument.uploadedAt));
}
```

---

## Data Flow Diagrams

### Upload Flow

```
User (Admin UI)
    |
    | 1. Select file(s) + tags
    v
Upload Dialog (React)
    |
    | 2. POST /api/documents/upload (FormData)
    v
Upload API Route
    |
    +---> 3a. uploadFile() --> Vercel Blob --> blobUrl, pathname
    |
    +---> 3b. uploadFileToOpenAI() --> OpenAI Files API --> openaiFileId
    |
    +---> 3c. getOrCreateVectorStore() --> DB/OpenAI --> vectorStoreId
    |
    +---> 3d. addFileToVectorStore() --> OpenAI Vector Store API
    |
    +---> 3e. saveUploadedDocument() --> PostgreSQL
    |
    +---> 3f. pollDocumentStatus() [background job]
              |
              +---> Polls getVectorStoreFileStatus() every 1.5-30s
              |
              +---> Updates DB when status changes
```

### Search Flow

```
User Message: "What's our vacation policy?"
    |
    | 1. Chat API receives message
    v
AI Agent (with tools)
    |
    | 2. Calls semanticSearch({ query: "vacation policy", limit: 5 })
    v
Semantic Search Tool
    |
    +---> 3a. getVectorStoreId() --> DB --> vectorStoreId
    |
    +---> 3b. searchVectorStore() --> OpenAI Vector Store Search API
    |          Returns: [{ file_id, score, content }]
    |
    +---> 3c. For each result:
              getUploadedDocumentByOpenAIFileId() --> DB --> document metadata
    |
    v
Returns SearchResultItem[]
    {
      documentId, documentName, chunkContent,
      relevanceScore, blobUrl
    }
    |
    v
AI Agent generates response with citations
    |
    v
User sees answer + clickable citation badges
```

### Delete Flow

```
Admin clicks "Delete" button
    |
    | 1. tRPC mutation: admin.documents.delete({ id })
    v
Delete Procedure
    |
    +---> 2a. getUploadedDocumentById() --> DB
    |
    +---> 2b. removeFileFromVectorStore() --> OpenAI Vector Store API
    |
    +---> 2c. deleteFileFromOpenAI() --> OpenAI Files API
    |
    +---> 2d. softDeleteDocument() --> DB (sets deletedAt timestamp)
    |
    v
Returns { success: true }
    |
    v
UI refreshes document list
```

---

## API Route Mappings

### Admin API Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/documents/upload` | POST | Upload single document | Admin |
| `/api/documents/bulk-upload` | POST | Bulk upload from URLs | Admin |
| `/api/documents/[id]/update` | PUT | Update document metadata | Admin |

### tRPC Procedures

| Procedure | Type | Purpose | Auth |
|-----------|------|---------|------|
| `admin.documents.list` | Query | List documents with filters | Admin |
| `admin.documents.getById` | Query | Get single document | Admin |
| `admin.documents.delete` | Mutation | Delete document | Admin |
| `admin.documents.updateTags` | Mutation | Update document tags | Admin |
| `admin.documents.getAllTags` | Query | Get all unique tags | Admin |
| `admin.documents.refreshStatus` | Mutation | Refresh processing status | Admin |

### AI Agent Tools

| Tool | Type | Purpose | Available When |
|------|------|---------|----------------|
| `semanticSearch` | AI Tool | Search documents by semantic similarity | `NEXT_PUBLIC_OPENAI_AVAILABLE=true` |
| `fileRetrieve` | AI Tool | Retrieve complete document content | `NEXT_PUBLIC_OPENAI_AVAILABLE=true` |

---

## Key Implementation Details

### 1. Single Shared Vector Store

**Design Decision:** All documents are indexed in a single OpenAI vector store.

**Advantages:**
- Cross-document semantic search
- Unified knowledge base
- Simpler management
- Lower API overhead

**Implementation:**
- `VectorStoreConfig` table has singleton record (id = "singleton")
- First upload creates vector store
- Subsequent uploads reuse same vector store

### 2. Soft Delete Pattern

Documents are soft-deleted (not hard-deleted):

```typescript
deletedAt: timestamp("deleted_at")
```

**Why:**
- Preserve audit trail
- Allow recovery
- Maintain referential integrity
- Safer than hard delete

**Query Handling:**
```typescript
// All queries exclude soft-deleted
whereConditions.push(isNull(uploadedDocument.deletedAt));
```

### 3. Background Processing with Polling

Documents are processed asynchronously:

1. Upload completes immediately (status: "processing")
2. Background job polls OpenAI every 1.5-30 seconds
3. Updates database when complete
4. Manual refresh available for failed polling

**Exponential Backoff:**
```typescript
const delay = Math.min(1000 * 1.5 ** attempt, 30_000);
```

### 4. Dual Storage Pattern

Files are stored in **two places**:

1. **Vercel Blob** - For direct user access (download, view)
2. **OpenAI Files** - For AI processing and search

**Why both:**
- Blob: Fast CDN delivery, no API costs for user access
- OpenAI: Required for vector store indexing and search

### 5. Tag-based Organization

Tags enable flexible categorization:

```typescript
tags: json("tags").$type<string[]>().notNull().default([])
```

**Features:**
- Multiple tags per document
- PostgreSQL JSONB operator for efficient queries
- Auto-suggest from existing tags
- Applied during bulk upload

### 6. Status Lifecycle

```
uploading → processing → ready
                      ↘ failed
```

**States:**
- `uploading` - File upload in progress (not used in current impl)
- `processing` - OpenAI indexing document
- `ready` - Document searchable
- `failed` - Processing failed (with errorMessage)

### 7. Error Handling Strategy

**Upload Route:**
- Validates file type and size before processing
- Returns 400 for validation errors
- Returns 500 for processing errors
- Continues background polling on 500

**Background Polling:**
- Gracefully handles transient errors (retry)
- Marks document as failed on persistent errors
- Preserves error message for debugging
- Special timeout message for manual refresh

### 8. OpenAI API Usage

**Files API:**
- `files.create({ purpose: "assistants" })` - Upload file
- `files.delete(fileId)` - Delete file

**Vector Store API:**
- `vectorStores.create({ name })` - Create vector store
- `vectorStores.files.create(vectorStoreId, { file_id })` - Add file
- `vectorStores.files.retrieve(fileId, { vector_store_id })` - Get status
- `vectorStores.files.delete(fileId, { vector_store_id })` - Remove file
- `vectorStores.search(vectorStoreId, { query, max_num_results })` - Search
- `vectorStores.files.content(fileId, { vector_store_id })` - Get content

### 9. Type Safety

Full type safety from database to frontend:

```typescript
// Database schema
export type UploadedDocument = InferSelectModel<typeof uploadedDocument>;

// tRPC output
return await listDocuments(input); // Type inferred

// React component
const { data } = useQuery({
  ...trpc.admin.documents.list.queryOptions({...})
});
// data.documents is typed as UploadedDocument[]
```

---

## Performance Considerations

### 1. Parallel Upload

Upload dialog processes multiple files concurrently:

```typescript
const uploadResults = await Promise.allSettled(
  files.map((file) => uploadSingleFile(file))
);
```

### 2. Indexed Queries

Database queries use indexes:

```typescript
uploadedByIdx: index("uploaded_document_uploaded_by_idx").on(table.uploadedBy),
statusIdx: index("uploaded_document_status_idx").on(table.status),
vectorStoreIdx: index("uploaded_document_vector_store_id_idx").on(table.vectorStoreId),
deletedAtIdx: index("uploaded_document_deleted_at_idx").on(table.deletedAt),
```

### 3. Pagination

List queries support pagination:

```typescript
.limit(input.limit)
.offset(input.offset)
```

### 4. Conditional Tool Loading

RAG tools only loaded when needed:

```typescript
...(env.NEXT_PUBLIC_OPENAI_AVAILABLE ? { semanticSearch, fileRetrieve } : {})
```

---

## Security Considerations

### 1. Admin-Only Access

All document management requires admin role:

```typescript
if (session.user.role !== "admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### 2. Soft Delete

Prevents accidental data loss:

```typescript
await softDeleteDocument(input.id);
// Sets deletedAt, doesn't remove from database
```

### 3. Public Blob Access

Files stored with public access for CDN delivery:

```typescript
await put(`${BLOB_FILE_PREFIX}${filename}`, buffer, {
  access: "public",
  addRandomSuffix: true, // Prevents URL guessing
});
```

**Note:** Documents are intended to be accessible to authenticated users. If you need private documents, implement signed URLs.

### 4. Input Validation

All inputs validated with Zod schemas:

```typescript
const DocumentFileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 512 * 1024 * 1024, {
      message: "File size should be less than 512MB",
    })
    .refine((file) => SUPPORTED_DOCUMENT_TYPES.includes(file.type), {
      message: "File type not supported",
    }),
});
```

---

## Summary

This RAG implementation is **production-ready** with:

✅ **Automatic chunking and embedding** - No manual processing
✅ **Semantic search** - Natural language queries
✅ **Background processing** - Non-blocking uploads
✅ **Status polling** - Auto-updates when ready
✅ **Soft delete** - Safe deletion with recovery
✅ **Tag organization** - Flexible categorization
✅ **Type safety** - End-to-end TypeScript
✅ **Admin UI** - Upload, search, delete, refresh
✅ **AI Agent integration** - Seamless tool calling
✅ **Citation system** - Source attribution
✅ **Bulk upload** - Programmatic ingestion
✅ **Error handling** - Graceful failures

**Architecture Highlights:**
- Dual storage (Vercel Blob + OpenAI Files)
- Single shared vector store
- tRPC for type-safe APIs
- PostgreSQL for metadata
- Background status polling
- Exponential backoff retry
- Comprehensive logging

**OpenAI APIs Used:**
- Files API (upload, delete, retrieve content)
- Vector Store API (create, add files, search, get status)

This implementation can serve as a **reference architecture** for adding RAG capabilities to any Next.js application with minimal modifications.
