# Document Ingestion Worker

This Cloudflare Worker handles document processing, chunking, embedding generation, and storage for the IcePhone RAG system.

## Features

- **Document Processing**: Extracts text from various file formats
- **Intelligent Chunking**: Uses RecursiveCharacterTextSplitter for optimal chunk sizes
- **Embedding Generation**: Integrates with Voyage AI with mock fallback for development
- **Database Storage**: Direct integration with Neon PostgreSQL using pgvector
- **Error Handling**: Comprehensive error handling and retry logic
- **Authentication**: Bearer token authentication for secure API access

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │───▶│ Document Worker  │───▶│   Neon DB       │
│   (File Upload) │    │ (This Worker)    │    │  (Vector Store) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Voyage AI      │
                       │  (Embeddings)    │
                       └──────────────────┘
```

## Setup

### 1. Install Dependencies

```bash
cd workers/document-ingestion
npm install
```

### 2. Configure Environment Variables

Set up your environment variables using Wrangler secrets:

```bash
# Database connection
wrangler secret put NEON_DATABASE_URL

# AI Services
wrangler secret put VOYAGE_API_KEY
wrangler secret put OPENAI_API_KEY

# Authentication
wrangler secret put INGESTION_WORKER_AUTH_TOKEN
```

### 3. Optional: Configure R2 and KV

Edit `wrangler.toml` to enable R2 storage and KV caching:

```toml
# Uncomment these sections in wrangler.toml

[[r2_buckets]]
binding = "DOCUMENTS_R2_BUCKET"
bucket_name = "icephone-documents"

[[kv_namespaces]]
binding = "EMBEDDINGS_CACHE"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

## Development

### Local Development

```bash
# Start the worker locally
npm run dev

# Test the worker
curl -X POST http://localhost:8787/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "sourceId": 1,
    "sourceName": "Test Document",
    "sourceType": "txt_upload",
    "fileContent": "VGVzdCBkb2N1bWVudCBjb250ZW50",
    "userId": "user_123"
  }'
```

### Health Check

```bash
curl http://localhost:8787/health
```

## Deployment

### Development Environment

```bash
npm run deploy -- --env development
```

### Production Environment

```bash
npm run deploy -- --env production
```

## API Endpoints

### POST /api/ingest

Process a single document.

**Request:**

```json
{
  "sourceId": 123,
  "sourceName": "Product Manual",
  "sourceType": "pdf_upload",
  "fileContent": "base64_encoded_content",
  "processingOptions": {
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "chunkingStrategy": "standard"
  },
  "userId": "user_123"
}
```

**Response:**

```json
{
  "success": true,
  "sourceId": 123,
  "documentsCreated": 15,
  "errors": [],
  "processingTime": 2500,
  "metadata": {
    "chunkingStrategy": "standard",
    "embeddingModel": "voyage-3",
    "totalChunks": 15,
    "failedChunks": 0
  }
}
```

### POST /api/ingest/batch

Process multiple documents in batch.

**Request:**

```json
{
  "documents": [
    {
      "sourceId": 123,
      "sourceName": "Doc 1",
      "sourceType": "txt_upload",
      "fileContent": "content1"
    },
    {
      "sourceId": 124,
      "sourceName": "Doc 2",
      "sourceType": "txt_upload",
      "fileContent": "content2"
    }
  ],
  "userId": "user_123"
}
```

### GET /api/status/:jobId

Check processing status (basic implementation).

**Response:**

```json
{
  "jobId": "job_123",
  "status": "completed",
  "message": "Document processing completed"
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Integration with Next.js App

The worker is integrated with the main Next.js application via `src/actions/knowledge-base-worker.ts`. The integration provides:

1. **Automatic fallback** to local processing if worker is unavailable
2. **Authentication** using Clerk user context
3. **Error handling** with user-friendly messages
4. **Progress tracking** for file upload operations

To use the worker in your Next.js app:

```typescript
import { processAndEmbedFileWithWorker } from "@/actions/knowledge-base-worker"

const result = await processAndEmbedFileWithWorker(
  file,
  "Document Name",
  "txt_upload"
)
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEON_DATABASE_URL` | PostgreSQL connection string | Yes |
| `VOYAGE_API_KEY` | Voyage AI API key | No (falls back to mock) |
| `OPENAI_API_KEY` | OpenAI API key | No |
| `INGESTION_WORKER_AUTH_TOKEN` | Authentication token | Yes |

## File Type Support

Currently supported:

- ✅ Text files (`.txt`, `.md`)
- ✅ Plain text content
- 🚧 PDF files (placeholder implementation)
- 🚧 DOCX files (placeholder implementation)

To add PDF/DOCX support:

1. Add `pdf-parse` and `mammoth` to dependencies
2. Implement text extraction in `DocumentIngestionService.ts`
3. Update file type validation

## Performance Considerations

- **Chunking**: Uses RecursiveCharacterTextSplitter for optimal chunk boundaries
- **Batching**: Processes embeddings in batches to optimize API calls
- **Database**: Uses prepared statements and batch inserts
- **Memory**: Efficient streaming for large files (when R2 is enabled)

## Monitoring

### Logs

View worker logs:

```bash
npm run tail
```

### Metrics

Monitor via Cloudflare dashboard:

- Request count and latency
- Error rates
- Memory and CPU usage
- Database connection health

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify `NEON_DATABASE_URL` is correctly set
   - Check database permissions and firewall settings

2. **Embedding Generation Failures**
   - Verify `VOYAGE_API_KEY` is valid
   - Check API rate limits
   - Worker will fall back to mock embeddings if API fails

3. **Authentication Errors**
   - Verify `INGESTION_WORKER_AUTH_TOKEN` matches in both worker and Next.js app
   - Check request headers include proper Authorization header

### Debug Mode

Enable debug logging by setting `DEBUG=true` in environment variables.

## Contributing

1. Make changes to the worker code
2. Test locally with `npm run dev`
3. Update tests in the main project
4. Deploy to development environment for testing
5. Deploy to production when ready

## License

Part of the IcePhone project.
