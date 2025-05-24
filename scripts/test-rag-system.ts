#!/usr/bin/env tsx
import { sql } from "drizzle-orm"
// Import will be done dynamically in the function
import { db } from "../src/db/db"
import { knowledgeBaseDocuments, knowledgeBaseSources } from "../src/db/schema"

const TEST_USER_ID = "test_user_123"

// Sample knowledge base content
const SAMPLE_SOURCES = [
	{
		name: "IcePhone Getting Started Guide",
		type: "txt_upload" as const,
		uri: "icephone-guide.txt",
		content: `IcePhone is an AI-powered CRM and Voice Agent Platform. Here's how to get started:

1. Setup Your Voice Agents
- Create custom voice personas for your business
- Configure call routing and workflows
- Set up automated responses and call handling

2. Lead Management
- Import existing contacts or add new leads
- Track lead status and qualification stages
- Set up automated follow-up sequences

3. Campaign Creation
- Design outbound calling campaigns
- Configure call scripts and objectives
- Monitor campaign performance and analytics

4. Integration Features
- Connect with popular CRM systems
- Set up webhook integrations
- Export data and reports

5. Analytics and Reporting
- View real-time call metrics
- Generate performance reports
- Track conversion rates and ROI

Contact support for advanced setup and customization options.`
	},
	{
		name: "Voice Agent Best Practices",
		type: "txt_upload" as const,
		uri: "voice-agent-best-practices.txt",
		content: `Best Practices for Voice Agent Configuration:

1. Persona Development
- Define clear personality traits
- Use natural conversation patterns
- Maintain consistency across interactions

2. Script Optimization
- Keep responses concise and clear
- Use positive language and tone
- Include relevant business information

3. Call Flow Design
- Plan logical conversation paths
- Prepare for common objections
- Include proper qualification questions

4. Performance Monitoring
- Track call success rates
- Monitor conversation quality
- Analyze customer feedback

5. Continuous Improvement
- A/B test different approaches
- Update scripts based on results
- Train agents with real scenarios

6. Compliance and Ethics
- Follow telemarketing regulations
- Respect do-not-call lists
- Maintain transparency about AI usage

Remember: The goal is to provide helpful, natural interactions that benefit both your business and your customers.`
	},
	{
		name: "CRM Integration Guide",
		type: "txt_upload" as const,
		uri: "crm-integration.txt",
		content: `CRM Integration with IcePhone:

Supported CRM Systems:
- Salesforce
- HubSpot
- Pipedrive
- Zoho CRM
- Custom APIs via webhooks

Setup Process:
1. Navigate to Settings > Integrations
2. Select your CRM platform
3. Authenticate using API credentials
4. Configure field mappings
5. Test the connection

Data Synchronization:
- Lead information syncs automatically
- Call logs are recorded in CRM
- Campaign results update lead status
- Custom fields can be mapped

Troubleshooting:
- Check API rate limits
- Verify authentication tokens
- Review field mapping accuracy
- Monitor sync error logs

For custom integrations, use our REST API endpoints or webhook system to push/pull data in real-time.`
	},
	{
		name: "Troubleshooting Common Issues",
		type: "txt_upload" as const,
		uri: "troubleshooting.txt",
		content: `Common IcePhone Issues and Solutions:

Call Quality Problems:
- Check internet connection stability
- Verify microphone and speaker settings
- Ensure proper network bandwidth
- Test with different browsers

Voice Agent Not Responding:
- Restart the voice agent service
- Check API key configuration
- Verify script syntax and formatting
- Review error logs for specific issues

Integration Failures:
- Validate CRM credentials
- Check API endpoint availability
- Review rate limiting settings
- Test with reduced data volumes

Performance Issues:
- Monitor system resource usage
- Optimize database queries
- Clear browser cache and cookies
- Check for software updates

Data Sync Problems:
- Verify field mapping accuracy
- Check data format requirements
- Review permission settings
- Test with sample records first

Contact technical support if issues persist or for advanced troubleshooting assistance.`
	}
]

async function clearTestData() {
	console.log("🗑️  Clearing existing test data...")

	await db
		.delete(knowledgeBaseDocuments)
		.where(sql`user_id = ${TEST_USER_ID}`)

	await db.delete(knowledgeBaseSources).where(sql`user_id = ${TEST_USER_ID}`)

	console.log("✅ Test data cleared")
}

async function createTestSources() {
	console.log("📝 Creating test sources...")

	const createdSources = []

	for (const source of SAMPLE_SOURCES) {
		const [createdSource] = await db
			.insert(knowledgeBaseSources)
			.values({
				name: source.name,
				type: source.type,
				uri: source.uri,
				userId: TEST_USER_ID
			})
			.returning()

		createdSources.push({ ...createdSource, content: source.content })
		console.log(`  ✅ Created source: ${source.name}`)
	}

	return createdSources
}

async function chunkAndEmbedContent(
	sources: Array<{ id: number; name: string; content: string }>
) {
	console.log("🔧 Chunking and embedding content...")

	const { RecursiveCharacterTextSplitter } = await import(
		"langchain/text_splitter"
	)

	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1000,
		chunkOverlap: 200,
		separators: ["\n\n", "\n", ". ", "! ", "? ", " ", ""]
	})

	let totalDocuments = 0

	for (const source of sources) {
		console.log(`  Processing: ${source.name}`)

		// Chunk the content
		const documents = await splitter.createDocuments([source.content])
		const textChunks = documents.map((doc) => doc.pageContent)

		// Generate embeddings for all chunks
		console.log(
			`    Generating embeddings for ${textChunks.length} chunks...`
		)
		const embeddings = await generateEmbeddings(textChunks, "document")

		// Insert documents with embeddings
		for (let i = 0; i < textChunks.length; i++) {
			const vectorValues = embeddings[i].join(",")

			await db.execute(sql`
				INSERT INTO knowledge_base_documents
				(source_id, content_chunk, text_embedding_model, text_embedding, metadata, user_id)
				VALUES
				(${source.id},
				 ${textChunks[i]},
				 ${"voyage-3.5"},
				 ${sql.raw(`'[${vectorValues}]'::vector`)},
				 ${JSON.stringify({
						chunkIndex: i,
						totalChunks: textChunks.length,
						contentType: "text",
						processingDate: new Date().toISOString()
					})},
				 ${TEST_USER_ID})
			`)

			totalDocuments++
		}

		// Update source lastIndexedAt
		await db
			.update(knowledgeBaseSources)
			.set({ lastIndexedAt: new Date() })
			.where(sql`id = ${source.id}`)

		console.log(`    ✅ Embedded ${textChunks.length} chunks`)
	}

	console.log(`✅ Total documents created: ${totalDocuments}`)
	return totalDocuments
}

async function testRAGQueries() {
	console.log("🔍 Testing RAG query functionality...")

	const { performRAGQuery, generateRAGResponse } = await import(
		"../src/actions/knowledge-base"
	)

	const testQueries = [
		"How do I set up voice agents?",
		"What CRM systems are supported?",
		"How do I troubleshoot call quality issues?",
		"What are the best practices for voice agents?",
		"How do I integrate with Salesforce?"
	]

	for (const query of testQueries) {
		console.log(`\n  Testing query: "${query}"`)

		// Test vector search
		const searchResult = await performRAGQuery(query, {
			limit: 3,
			threshold: 0.1 // Lower threshold for testing
		})

		if (searchResult.success && searchResult.data) {
			console.log(
				`    📄 Found ${searchResult.data.length} relevant documents`
			)

			// Test RAG response generation
			const ragResult = await generateRAGResponse(query, {
				limit: 3,
				threshold: 0.1,
				modelProvider: "openai",
				modelName: "gpt-4o-mini"
			})

			if (ragResult.success && ragResult.data) {
				console.log(
					`    🤖 Generated response (${ragResult.data.answer.length} chars)`
				)
				console.log(
					`    📚 Used ${ragResult.data.sources.length} sources`
				)
			} else {
				console.log(`    ❌ RAG generation failed: ${ragResult.error}`)
			}
		} else {
			console.log(`    ❌ Search failed: ${searchResult.error}`)
		}
	}
}

async function generateEmbeddings(
	texts: string[],
	inputType: "query" | "document" = "document"
): Promise<number[][]> {
	// Mock embeddings for testing - each embedding is 1024 dimensions
	return texts.map(() =>
		Array.from({ length: 1024 }, () => Math.random() * 2 - 1)
	)
}

async function main() {
	try {
		console.log("🚀 Starting RAG system test...")

		// Step 1: Clear existing test data
		await clearTestData()

		// Step 2: Create test sources
		const sources = await createTestSources()

		// Step 3: Chunk and embed content
		const documentCount = await chunkAndEmbedContent(sources)

		// Step 4: Test RAG queries
		await testRAGQueries()

		console.log("\n✅ RAG system test completed successfully!")
		console.log(
			`📊 Summary: ${sources.length} sources, ${documentCount} documents`
		)
	} catch (error) {
		console.error("❌ Test failed:", error)
		process.exit(1)
	}
}

// Run the test
main()
