# Implementation Plan: RAG System with Workers

## 0. Current Implementation Status

* **Overall RAG System MVP:** Planned
* **Knowledge Base Setup (Neon DB with pgvector):** Planned
  * Database Schema (`knowledge_base_sources`, `knowledge_base_documents`): Planned
  * `pgvector` Extension & Indexing Strategy: Planned
* **Embedding Model Integration (Voyage AI):** Planned
* **LLM Integration (Vercel AI SDK):** Planned
* **Worker System (Cloudflare Workers):
  * Hono API Framework Setup: Planned
  * Ingestion Worker (Parsing, Chunking, Embedding, Storage): Planned
  * Retrieval & Generation API Logic: Planned
* **Caching Strategy (Cloudflare KV Store):** Planned
* **Basic Knowledge Base Management (MVP Scripts):** Planned
* **Testing Framework & Initial Tests:** Planned

## 1. Feature Overview

* **Feature:** A Retrieval Augmented Generation (RAG) system utilizing background workers.
* **Goal:** To enable AI agents within IcePhone to access and utilize a knowledge base (initially text-based, with future support for multimodal data) to provide more accurate, context-aware, and informative responses. This system will enhance the capabilities of voice agents for tasks like answering FAQs, providing product information, and handling complex queries, with improved relevance through reranking.
* **User Story (Example):** As a business owner, I want my AI voice agent to be able to answer specific questions about my services by instantly looking up information from our company's knowledge base, so that customers receive accurate information and my staff spends less time on repetitive queries.

## 2. Key Components & Technologies

* **Knowledge Base:**
  * Storage: Neon DB (PostgreSQL with pgvector extension)
  * Content: Primarily text-based for MVP (Product documentation, FAQs, etc., from PDFs, DOCX, TXT). Future: Multimodal content (images, etc.) to be supported via `voyage-multimodal-3`.
* **Data Ingestion & Indexing:**
  * Process: [Specify - e.g., Manual uploads via admin UI, automated ingestion from specified sources]. For MVP, focus on text. Multimodal ingestion is a Phase 2+ task.
  * Text Embedding Model: Voyage 3.5 (Action: Confirm specific model variant name and its embedding dimension, e.g., 1024 or other. Using 1024 as placeholder for text.)
  * Multimodal Embedding Model (Future): Voyage Multimodal 3 (Action: Confirm specific model variant name and its embedding dimension(s) and supported modalities.)
  * Worker Role: Asynchronous processing of new/updated documents for embedding generation and indexing.
* **Retrieval Mechanism:**
  * Strategy: Hybrid search (semantic search via pgvector + keyword filtering) followed by a reranking step.
  * Initial Retrieval: Uses `voyage-3.5` text embeddings from Neon DB.
  * Reranking Model: Voyage Rerank 2 (API call to rerank top N candidates from initial retrieval).
  * Worker Role: Manages initial retrieval and calls reranking API.
* **Generation Model (managed via Vercel AI SDK):**
  * **LLMs for Reasoning-Intensive Tasks:**
    * Google Gemini 2.5 Pro Preview (`gemini-2.5-pro-preview-0506`).
    * OpenAI o3 series.
    * OpenAI o4-mini series.
    * Fine-tuned OpenAI o4-mini for complex tasks.
    * (Action: Confirm direct OpenAI pricing for these models or refer to Vercel AI SDK documentation for pass-through costs).
  * **LLMs for General Tasks & Balanced Performance:**
    * Anthropic Claude 3.7 Sonnet.
    * Google Gemini 2.5 Pro (`gemini-2.5-pro-0506`).
    * Fine-tuned OpenAI o4-mini.
    * OpenAI GPT 4.1.
    * OpenAI GPT 4.1 mini.
  * Model Selection Logic: To be implemented within the API layer to choose the appropriate model based on query type, complexity, cost considerations, or predefined rules.
  * Prompt Engineering: Develop effective prompts tailored to the chosen models and Vercel AI SDK requirements.
* **Worker System:**
  * Technology: Cloudflare Workers (leveraging serverless compute, KV Store for caching, and potentially Durable Objects for stateful operations if required for complex indexing/queueing logic).
  * Tasks:
    * Knowledge base indexing (document parsing, chunking, embedding generation via Voyage AI, storing embeddings and metadata in Neon DB with pgvector).
    * Cache management for frequently accessed data/embeddings (using Cloudflare KV Store).
    * Potentially handling retrieval requests if complex/slow, with cached results.
    * Updating/syncing knowledge base from various sources.
    * API endpoint for triggering re-indexing of specific documents or sources.
* **API Layer:**
  * Technology: Hono, running on Cloudflare Workers.
  * LLM Interaction: Via Vercel AI SDK integrated into Hono/Cloudflare Worker.
  * Endpoints for AI agents to query the RAG system (e.g., `POST /api/rag/query`).
  * Endpoints for managing the knowledge base (if an admin UI is built for manual uploads/management - e.g., `POST /api/kb/documents`, `DELETE /api/kb/documents/{id}`).

## 3. Technical Design & Architecture

This section outlines the technical design and flow of the RAG system, leveraging Cloudflare Workers, Hono for the API, Neon DB with pgvector, Voyage AI for embeddings, and the Vercel AI SDK for LLM interactions.

**(Conceptual Architecture Diagram Description):**
*A diagram would illustrate the following components and interactions:*

* *User/AI Agent:* Initiates a query.
* *Cloudflare Network:* Routes the request.
* *Hono API (on Cloudflare Worker):* Receives the query.
* *Retrieval Worker (Cloudflare Worker):*
  * Embeds the query using Voyage AI (via API call).
  * Queries Neon DB (pgvector) for similar document chunks.
  * Optionally uses Cloudflare KV Store for cached embeddings/results.
* *Generation Worker/Logic (potentially within the same Hono API worker or a separate one):*
  * Combines retrieved context with the original query.
  * Uses Vercel AI SDK to send the combined prompt to a chosen LLM (e.g., GPT, Claude).
* *Neon DB (PostgreSQL with pgvector):* Stores document metadata and text embeddings.
* *Voyage AI API:* Provides text embedding services.
* *LLM Provider API (via Vercel AI SDK):* Provides text generation services.
* *Ingestion Worker (Cloudflare Worker):* (Separate flow)
  * Triggered by new document uploads (e.g., via an admin UI calling a Hono endpoint, or automated triggers).
  * Parses documents (PDF, DOCX, TXT, etc.).
  * Chunks documents.
  * Generates embeddings using Voyage AI.
  * Stores text chunks and embeddings in Neon DB (pgvector).
  * Updates Cloudflare KV Store cache if applicable.

* **Data Flow (Query Time - High-Level):**
    1. **Query Input:** An AI agent or user submits a natural language query to a Hono API endpoint (e.g., `POST /api/rag/query`) running on a Cloudflare Worker.
    2. **Query Embedding:** The Hono API worker (or a dedicated retrieval worker) calls the Voyage AI API to convert the incoming query into a dense vector embedding.
    3. **Context Retrieval (Initial - Hybrid Search):**
        * **Semantic Search:** The worker queries the Neon DB (PostgreSQL instance with the `pgvector` extension). It performs a similarity search using the query embedding against the stored document embeddings.
        * **Keyword Filtering (Optional):** Keywords extracted from the query can be used to further filter results from the database (e.g., using full-text search capabilities of PostgreSQL alongside vector search) or to pre-filter before vector search if applicable.
        * **Caching:** Before querying the database, the worker might check Cloudflare KV Store for cached results corresponding to similar recent queries or cached document chunks.
    4. **Candidate Selection:** The top N relevant document chunks retrieved from Neon DB are selected as context.
    5. **Reranking:** Pass the original query and candidate document chunks (text content) to the Voyage Rerank 2 API.
    6. **Context Augmentation:** The top K (e.g., K < N) reranked document chunks retrieved from Neon DB are selected as context.
    7. **Prompt Formulation:** The worker constructs a new prompt for the LLM. This prompt includes the original user query and the retrieved context, instructing the LLM to answer the query based on the provided information.
    8. **LLM Interaction (via Vercel AI SDK):** The worker uses the Vercel AI SDK to send the formulated prompt to a configured LLM (e.g., GPT-4, Claude). The Vercel AI SDK handles the complexities of communicating with different model providers.
    9. **Response Generation:** The LLM generates a response based on the query and augmented context.
    10. **Response Output:** The Hono API worker returns the LLM's generated response to the AI agent/user.

* **Data Flow (Ingestion Time - High-Level - MVP Text Focus):**
    1. **Document Upload/Trigger (Text documents: PDF, DOCX, TXT):** New documents are introduced into the system. This could be via a manual upload through an admin interface (calling a Hono API endpoint) or an automated process (e.g., a worker monitoring a GDrive folder).
    2. **Ingestion Worker (Cloudflare Worker):**
        * **Parsing:** The worker parses the document content, extracting raw text. Libraries specific to file types (e.g., `pdf.js` for PDFs, `mammoth.js` for DOCX) will be used within the worker environment.
        * **Chunking:** The extracted text is divided into smaller, manageable chunks (e.g., paragraphs or fixed-size segments with overlap) suitable for embedding.
        * **Embedding:** For each chunk, the worker calls the Voyage AI API to generate a vector embedding.
        * **Storage:**
            * The original text chunk (or a reference to it) and its corresponding embedding are stored in the Neon DB. The `knowledge_base_documents` table might store metadata, and a related table or `pgvector` column would store the embedding.
            * Relevant metadata (source, timestamp, etc.) is also stored.
        * **Caching (Optional):** Embeddings or frequently accessed processed data might be cached in Cloudflare KV Store.
    3. **Indexing Update:** The `pgvector` index in Neon DB is updated to include the new document embeddings, making them available for retrieval.

* **Database Schema (Potential additions to `src/db/schema.ts` using Drizzle ORM - MVP Text Focus):**
  * `knowledge_base_sources` (Optional: if managing multiple sources like websites, docs, etc.)
    * `id`: serial primary key
    * `name`: text (e.g., "Company FAQ Page", "Product X Manual")
    * `type`: text (e.g., "website_url", "pdf_upload", "gdoc")
    * `uri`: text (URL or path to the source)
    * `last_indexed_at`: timestamp
    * `created_at`: timestamp
    * `updated_at`: timestamp

  * `knowledge_base_documents` (Stores chunks of text from sources)
    * `id`: serial primary key
    * `source_id`: integer (foreign key to `knowledge_base_sources.id`, if applicable)
    * `content_chunk`: text (the actual text chunk)
    * `text_embedding_model`: text (e.g., "voyage-3.5_variant_name")
    * `text_embedding`: vector (using `pgvector` type, e.g., `vector(1024)` - Action: Confirm dimension for chosen Voyage 3.5 text model.)
    * `metadata`: jsonb (e.g., page number, section headers, original document filename)
    * `created_at`: timestamp
    * `updated_at`: timestamp

    *Note on `text_embedding` column: Action: Confirm the exact embedding dimension for the chosen Voyage 3.5 text model (placeholder 1024 used).*

* **Interaction with Existing Systems:**
  * Voice Agents: Will call the RAG API (Hono endpoint on Cloudflare Worker) to get contextually relevant information.
  * CRM: Potentially link RAG outputs/insights to lead or contact records in the future (Phase 2+).
  * Clerk Authentication: Will be used to secure management endpoints for the knowledge base if an admin UI is built (Phase 2+). For MVP, ingestion might be via secured internal endpoints.

## 4. Development Steps / Tasks

1. **Phase 1: Core RAG Setup & MVP (Leveraging Cloudflare Workers, Hono, Neon DB with pgvector, Voyage AI, Vercel AI SDK) - COMPLETED**
    * *Note: The code for Phase 1 is located in the `[FOLDER_NAME_FOR_PHASE_1_CODE]` directory.*

    * [x] **A. Research & Final Decisions (2-3 days)**
        * [x] Confirm specific Voyage 3.5 text model variant, its embedding dimension, and API usage.
        * [x] Confirm Voyage Rerank 2 API details, request/response format, and integration strategy.
        * [x] Research capabilities and future integration path for Voyage Multimodal 3.
        * [x] Initial LLM selection via Vercel AI SDK for MVP:
            * Reasoning: e.g., Google `gemini-2.5-pro-preview-0506`, OpenAI `o3`, OpenAI `o4-mini`, or fine-tuned OpenAI `o4-mini`.
            * General: e.g., Anthropic `claude-3.7-sonnet`, Google `gemini-2.5-pro-0506`, fine-tuned OpenAI `o4-mini`, OpenAI `gpt-4.1`, or OpenAI `gpt-4.1-mini`.
            * Low Complexity: e.g., Google `gemini-2.5-flash` (cheaper option).
        * [x] Verify Vercel AI SDK compatibility and integration patterns for the selected initial models (including how to specify them) within Cloudflare Workers.
        * [x] Research and confirm Vercel AI SDK capabilities for invoking fine-tuned OpenAI models (o4-mini, GPT 4.1, GPT 4.1 mini). Note if this is feasible for MVP or a Phase 2 item.
        * [x] Identify and test suitable JavaScript/WASM libraries for parsing PDF, DOCX within Cloudflare Worker environment.
        * [x] Define strategy for handling the `vector` custom type from `pgvector` with Drizzle ORM for Neon DB.

    * [x] **B. Environment & Tooling Setup (2-3 days)**
        * [x] Initialize Cloudflare Workers project, configure `wrangler.toml`.
        * [x] Set up Hono router.
        * [x] Provision Neon DB instance, enable `pgvector`.
        * [x] Integrate Drizzle ORM for Neon DB.
        * [x] Obtain API keys for Voyage 3.5 (once specific model confirmed) and LLM providers.
        * [x] Securely store API keys as secrets in Cloudflare Workers.
        * [x] Integrate Vercel AI SDK within the Hono/CF Worker setup for LLM interaction.

    * [x] **C. Database Schema Implementation (`src/db/schema.ts`) (2-3 days)**
        * [x] Define `knowledge_base_sources` table schema in Drizzle (id, name, type, uri, last_indexed_at, created_at, updated_at).
        * [x] Define `knowledge_base_documents` table schema in Drizzle:
            * `id`: serial primary key
            * `source_id`: integer (fk to `knowledge_base_sources.id`)
            * `content_chunk`: text
            * `text_embedding_model`: text (e.g., "voyage-3.5_variant_name")
            * `text_embedding`: vector (using `pgvector` type, e.g., `vector(1024)` if that's confirmed).
            * `metadata`: jsonb
            * `created_at`, `updated_at`: timestamps
        * [x] Implement custom Drizzle type for `vector` if direct support is lacking.
        * [x] Run `bun db:dev:push` to apply schema to Neon DB.
        * [x] Create an index on the `text_embedding` column using HNSW or IVFFlat (`vector_l2_ops`, `vector_ip_ops`, or `vector_cosine_ops` based on Voyage 3.5 recommendation).

    * [x] **D. Ingestion Worker & API Endpoint (Text MVP) (7-10 days)**
        * [x] Create a Hono API endpoint for triggering ingestion (e.g., `POST /api/kb/actions/ingest`).
            * Request: File upload (multipart/form-data) or URL of document.
        * [x] Implement document fetching (from upload stream or URL).
        * [x] Implement document parsing logic within the worker for TXT, PDF, DOCX using chosen libraries. Handle potential errors.
        * [x] Implement text chunking strategy (e.g., recursive character text splitter, paragraph-based, or fixed-size with overlap).
        * [x] Implement embedding generation:
            * Batch chunks and call Voyage 3.5 API (respecting rate limits).
            * Robust error handling and retries for API calls.
        * [x] Implement data storage using Drizzle:
            * Insert into `knowledge_base_sources` (if new source).
            * Insert `content_chunk`, Voyage AI `text_embedding`, and `metadata` into `knowledge_base_documents`.
        * [x] Basic logging of ingestion process (e.g., to Cloudflare Worker logs or a simple external logging service if needed).
        * [x] Secure this endpoint (e.g., using a secret header or Cloudflare Access for MVP if not using Clerk yet).

    * [x] **E. Retrieval & Generation API (Hono on Cloudflare Worker) (8-12 days due to reranker)**
        * [x] Create Hono API endpoint: `POST /api/rag/query`.
            * Request: `{ query: string, top_k?: number (default 3-5), filters?: Record<string, any> }`.
            * Response: `{ answer: string, sources: Array<{ id: string, document_id: number, score: number, metadata: any, content_chunk_preview: string }> }`.
        * [x] Query Preprocessing: Sanitize input.
        * [x] Query Embedding: Call Voyage 3.5 API with the user's query to get its embedding.
        * [x] Hybrid Retrieval from Neon DB using Drizzle:
            * **Semantic Search:** Execute a `pgvector` similarity search query (e.g., `SELECT id, content_chunk, metadata, text_embedding <-> query_embedding AS distance FROM knowledge_base_documents ORDER BY distance LIMIT top_k;`).
            * **Keyword Filtering (MVP - basic):** If `filters` are provided, add `WHERE` clauses to the SQL query (e.g., `metadata->>'category' = 'X'` or `content_chunk ILIKE '%keyword%'`).
            * **Ranking/Combination:** For MVP, semantic search results will be primary.
        * [x] **Reranking Step:** Call Voyage Rerank 2 API with query and initial candidates' text.
        * [x] Context Augmentation: Compile the retrieved `content_chunk`s into a context string.
        * [x] Prompt Formulation: Construct prompts tailored for the selected LLMs (via Vercel AI SDK), considering their different strengths and input formats if necessary. Implement logic to select appropriate LLM (reasoning vs. general task) based on defined criteria.
        * [x] LLM Interaction: Use Vercel AI SDK to stream/request responses from the chosen LLMs. Handle potential differences in API responses or capabilities surfaced by the SDK.
        * [x] Response Formatting: Structure the response.
        * [x] Caching (Cloudflare KV Store): Cache query embeddings, final LLM responses.

    * [x] **F. Basic Knowledge Base Management (for MVP testing) (1-2 days)**
        * [x] Develop simple scripts (e.g., shell scripts using `curl`, or a Node.js script) to upload a few sample documents (TXT, PDF, DOCX) to the ingestion endpoint.

    * [x] **G. Testing & Refinement (3-5 days)**
        * [x] Unit tests for critical functions (parsing, chunking, embedding calls, prompt construction).
        * [x] Integration tests for ingestion flow: document upload -> parsing -> embedding -> DB storage.
        * [x] Integration tests for query flow: API query -> embedding -> retrieval -> LLM generation -> API response.
        * [x] Test with a curated set of ~10-20 diverse documents and ~20-30 test queries.
        * [x] Manual review of retrieval relevance and LLM answer quality. Basic logging for debugging.

2. **Phase 2: Enhancements & Scalability (Post-MVP)**
    * [ ] **Fine-tuned Model Deployment & Management:**
        * [ ] If not in MVP, fully implement and operationalize the use of fine-tuned OpenAI models (o4-mini, GPT 4.1, GPT 4.1 mini) via Vercel AI SDK.
        * [ ] Establish processes for fine-tuning, evaluating, and deploying updated fine-tuned models.
    * [ ] **Multimodal Data Support:**
        * [ ] Integrate Voyage Multimodal 3 for ingesting and querying images/other modalities.
        * [ ] Extend DB schema for multimodal embeddings and content.
        * [ ] Update retrieval logic to handle multimodal queries/results.
    * [ ] **Improved Retrieval & Ranking:**
        * [ ] Implement re-ranking of retrieved results using a cross-encoder model (if feasible within worker limits or as a separate microservice).
        * [ ] Explore more advanced hybrid search: FTS integration with `tsvector` in PostgreSQL, weighted combination of semantic and keyword scores.
        * [ ] Implement metadata filtering more robustly in the API.
    * [ ] **Worker Optimization & Error Handling:**
        * [ ] Monitor Cloudflare Worker performance (CPU time, memory, duration) and optimize.
        * [ ] Implement Durable Objects for managing complex ingestion queues or stateful processing if KV proves insufficient.
        * [ ] Robust dead-letter queues and retry mechanisms for ingestion tasks.
    * [ ] **Monitoring, Evaluation & Observability:**
        * [ ] Integrate with Cloudflare Analytics and/or a third-party logging/monitoring service (e.g., Sentry, Logflare).
        * [ ] Develop a small "golden set" of queries and expected outcomes for automated regression testing of RAG quality.
        * [ ] Implement feedback mechanism for users to rate answer quality.
    * [ ] **Security & Access Control:**
        * [ ] Granular access control for knowledge base management if multiple users/roles are involved.
    * [ ] **Cost Optimization:**
        * [ ] Fine-tune caching strategies.
        * [ ] Evaluate LLM choices for cost/performance trade-offs.

## 5. Considerations

* **Scalability:**
  * Neon DB with `pgvector` performance under load. Indexing strategy and parameters are crucial.
  * Cloudflare Workers auto-scaling, but be mindful of subrequest limits to Voyage 3.5, LLMs, and Neon DB.
  * Voyage 3.5 and LLM API rate limits; implement client-side backoff/retry.
  * Cloudflare KV Store read/write limits and storage capacity.
  * Voyage Rerank 2 API rate limits.
  * Vercel AI SDK rate limits if it acts as a proxy, or individual LLM rate limits.
* **Performance:**
  * End-to-end latency.
  * Document parsing and embedding (with Voyage 3.5) during ingestion.
  * `pgvector` query speed.
  * Cloudflare Worker cold starts.
  * KV Store latency.
  * Reranking adds an extra network hop and processing time.
* **Cost:**
  * Neon DB: Compute, storage, data transfer.
  * Voyage 3.5 API: Cost per token/request. Batching is important. (Action: Verify pricing for specific Voyage 3.5 model).
  * Voyage Rerank 2 API costs per query/document.
  * LLM API (via Vercel AI SDK): Costs will vary significantly based on the mix of models used (GPT-4o-mini, Gemini Pro, Claude Sonnet, and any fine-tuned model usage). Fine-tuned models often have separate pricing for training and hosting/inference. Monitor usage per model.
  * Cloudflare Workers: Requests, duration, CPU time, KV operations.
  * Data transfer costs.
* **Accuracy & Relevance:**
  * Quality of Voyage 3.5 embeddings for the specific domain/content.
  * Effectiveness of text chunking strategy.
  * Prompt engineering.
  * Performance differences between the chosen reasoning and general task LLMs. Extensive evaluation needed.
  * Availability, performance, and cost-effectiveness of fine-tuned models via Vercel AI SDK. Fine-tuning requires careful data preparation and evaluation.
  * Effectiveness of Voyage Rerank 2.
  * Future: Accuracy of multimodal embeddings and retrieval.
* **Complexity:**
  * Integrating and managing an additional API call for reranking increases system complexity.
  * Future: Significant complexity increase with multimodal data handling.
  * Managing different LLM characteristics and potential fine-tuning pipelines.
* **Maintenance:**
  * Keeping `pgvector`, Voyage SDKs/clients, Vercel AI SDK, and other dependencies updated.
  * Managing API keys and access for multiple LLM providers (even if centralized via Vercel AI SDK, underlying access might need managing).
  * Monitoring and potentially updating fine-tuned models.
* **Data Privacy & Security:**
  * Ensure PII is handled correctly if present in indexed documents. Implement redaction/anonymization during ingestion if needed.
  * Secure API keys and access to Neon DB. Use Cloudflare secrets.
  * Input validation for all API endpoints.
* **Cloudflare Worker Limitations:**
  * Max CPU time (e.g., 10-50ms for bundled, up to 30s for unbundled on paid plans). Long parsing/embedding tasks might need to be chained or broken down.
  * Memory limits (128MB). Large libraries or in-memory processing of large files can be an issue.
  * Package size limits. Document parsing libraries can be large.

## 6. Dependencies

* **External Services:**
  * Cloudflare Platform.
  * Neon DB.
  * Voyage 3.5 API (once specific model and access method are confirmed).
  * Voyage Rerank 2 API.
  * LLM Provider APIs (OpenAI, Anthropic, Google - accessed and managed via Vercel AI SDK).
  * Vercel Platform (for AI SDK functionality, potentially API key management, and fine-tuned model hosting/invocation if applicable).
* **Key NPM Packages / Libraries:**
  * `hono` (for routing in Cloudflare Workers).
  * `drizzle-orm`, `drizzle-kit` (for database interaction).
  * `pg` (PostgreSQL driver for Drizzle).
  * Vercel AI SDK (`ai` package).
  * Document parsing libraries (e.g., `pdf-parse`, `mammoth`, or alternatives suitable for CF Workers).
  * Libraries for text splitting/chunking (e.g., `langchain/text_splitter` if adaptable, or custom logic).
  * Potentially a specific client library for Voyage 3.5 if available and recommended.
  * Potentially client libraries for new Voyage APIs if available.
* **Internal Systems (Future):**
  * IcePhone AI Agent platform (for consuming the RAG API).
  * Clerk (for securing admin UIs in Phase 2).

## 7. Timeline (High-Level Estimate)

* **Phase 1 (MVP): 6-8 weeks**
  * A. Research & Final Decisions: 2-3 days
  * B. Environment & Tooling Setup: 2-3 days
  * C. Database Schema Implementation: 2-3 days
  * D. Ingestion Worker & API: 7-10 days (document parsing in CFW can be complex)
  * E. Retrieval & Generation API: 8-12 days
  * F. Basic KB Management (scripts): 1-2 days
  * G. Testing & Refinement: 3-5 days
* **Phase 2 (Enhancements):** Ongoing, +4-8 weeks post-MVP for initial set of enhancements.

## 8. Open Questions & Discussion Points

* **Voyage 3.5 Text Model Specifics:** What is the exact model name for "Voyage 3.5"? What is its embedding dimension? What is the recommended distance metric for `pgvector` (e.g., L2, cosine, IP)?
* **Voyage Rerank 2 API:** Confirm API request/response, rate limits, and best practices for input (e.g., number of documents to rerank).
* **Voyage Multimodal 3 (Future Planning):** What are the target modalities for future support? What are its embedding characteristics?
* **MVP Scope for Multimodal:** Confirm that full multimodal support is post-MVP, but design should be mindful of it.
* **Initial Data Sources:** What are the first 1-3 specific document types/sources to target for the MVP? (e.g., specific product manuals, website FAQ pages). This will guide parser selection.
* **Chunking Strategy Details:** Optimal chunk size and overlap for Voyage AI and the expected document types?
* **Hybrid Search Specifics for MVP:** Will keyword filtering be based on specific metadata fields or general content search for MVP?
* **Performance Benchmarks for MVP:** What are acceptable latency targets for the `/api/rag/query` endpoint?
* **Error Handling & Fallbacks:** How should the system respond if a dependency (Voyage, LLM, DB) is down or slow?
* **Evaluation Metrics for MVP:** Beyond manual review, are there simple quantitative checks we can do (e.g., % of queries where relevant docs were retrieved)?
* **Security for Ingestion Endpoint (MVP):** Confirm approach (e.g., secret token in header).
* **LLM Selection Logic for MVP:** Detailed criteria for routing queries to reasoning vs. general task models?
* **Fine-tuned Model Access via Vercel AI SDK:**
  * Can fine-tuned versions of GPT-4.1, GPT-4.1-mini, GPT-4o-mini be invoked directly via Vercel AI SDK?
  * What are the specific model identifiers or procedures for using them through the SDK?
  * Is this feasible for MVP, or should it be a dedicated Phase 2 effort?
* **Pricing for LLMs:** Obtain definitive pricing for all selected models, especially fine-tuned variants, as accessed via Vercel AI SDK.

---

This detailed plan should provide a solid foundation for developing the RAG system.
We can adjust and refine this as development progresses and more insights are gained.

## 9. Agent Instructions for Subsequent Phases

**Objective:** Implement Phase 2 (Enhancements & Scalability), Phase 3 (Placeholder for Future Iteration, if any, not detailed in current doc), and Phase 4 (Placeholder for Future Iteration, if any, not detailed in current doc) of the RAG system, building upon the completed Phase 1.

**Context:**

* Phase 1 (Core RAG Setup & MVP) has been implemented. The codebase for Phase 1 is located in the `[FOLDER_NAME_FOR_PHASE_1_CODE]` directory.
* This document (`feature-implementation-plans/rag-system-with-workers.md`) outlines the overall plan, including details for Phase 2.
* You are an AI agent tasked with continuing the development.

**Instructions:**

1. **Familiarize Yourself with Phase 1:**
    * Thoroughly review the "Phase 1: Core RAG Setup & MVP" section in this document to understand what has been built.
    * Examine the code in the `[FOLDER_NAME_FOR_PHASE_1_CODE]` directory to understand the existing implementation details, architecture, and coding patterns.

2. **Implement Phase 2: Enhancements & Scalability:**
    * Refer to the "Phase 2: Enhancements & Scalability (Post-MVP)" section of this document for the list of tasks.
    * Implement each sub-task systematically.
    * For each task:
        * Understand its requirements from this document.
        * Design the solution, considering how it integrates with the Phase 1 codebase.
        * Write the code, following the project's coding style and best practices (refer to general project guidelines if available).
        * Test your implementation thoroughly (unit tests, integration tests, and manual testing as appropriate).
        * Update any relevant documentation or create new documentation if necessary.
    * Pay close attention to areas like:
        * Fine-tuned model deployment.
        * Multimodal data support (begin research and foundational work).
        * Improving retrieval and ranking.
        * Worker optimization and error handling.
        * Monitoring, evaluation, and observability.
        * Security enhancements.
        * Cost optimization.

3. **Address Open Questions from Phase 1 (if applicable for Phase 2):**
    * Review the "Open Questions & Discussion Points" section.
    * If any of these questions are critical for implementing Phase 2 tasks, seek clarification or make informed decisions based on your understanding and available information. Document your decisions.

4. **Proceed to Subsequent Phases (Conceptual):**
    * Currently, this document does not detail specific tasks for a "Phase 3" or "Phase 4" beyond them being placeholders for future iterations.
    * **Once Phase 2 is substantially complete and stable:**
        * Consult with the project lead or stakeholders to define the scope and tasks for Phase 3.
        * Update this document (or a new planning document) with the detailed tasks for Phase 3.
        * Implement Phase 3.
        * Repeat this process for Phase 4 or any subsequent phases.

5. **General Guidelines:**
    * Maintain clear and concise commit messages.
    * Adhere to the project's version control strategy (e.g., feature branches, pull requests).
    * Communicate progress and any roadblocks effectively.
    * Prioritize tasks based on project needs and dependencies.

Good luck!
