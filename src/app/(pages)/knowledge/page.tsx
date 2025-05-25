// Force dynamic rendering for this page
export const dynamic = "force-dynamic"

import {
	getKnowledgeBaseSources,
	getKnowledgeBaseStats
} from "@/actions/knowledge-base"
import KnowledgeBaseSearch from "@/components/knowledge-base/KnowledgeBaseSearch"
// import AddKnowledgeBaseSourceForm from "@/components/admin/knowledge-base/AddKnowledgeBaseSourceForm"
import KnowledgeBaseSourcesList from "@/components/knowledge-base/KnowledgeBaseSourcesList"
import KnowledgeBaseStats from "@/components/knowledge-base/KnowledgeBaseStats"
import type { KnowledgeBaseStatsProps } from "@/components/knowledge-base/KnowledgeBaseStats"
import StreamingRAGChat from "@/components/knowledge-base/StreamingRAGChat"
import FileUpload from "@/components/ui/file-upload"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { KnowledgeBaseSource } from "@/types"
import { Suspense } from "react"

export default async function KnowledgeBasePage() {
	const sourcesResult = await getKnowledgeBaseSources()
	const statsResult = await getKnowledgeBaseStats()

	const sources =
		sourcesResult.success && sourcesResult.data
			? (sourcesResult.data as unknown as KnowledgeBaseSource[])
			: []
	const stats =
		statsResult.success && statsResult.data
			? (statsResult.data as unknown as KnowledgeBaseStatsProps["stats"])
			: { sourceCount: 0, documentCount: 0 }

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight pb-2 pt-4 text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700">
					Knowledge Base Management
				</h1>

				<KnowledgeBaseStats stats={stats} />

				<Separator className="my-2" />

				<Tabs defaultValue="chat" className="flex-1 flex flex-col">
					<TabsList>
						<TabsTrigger value="chat">AI Chat</TabsTrigger>
						<TabsTrigger value="search">Search</TabsTrigger>
						<TabsTrigger value="sources">Sources</TabsTrigger>
						<TabsTrigger value="add">Add New Source</TabsTrigger>
					</TabsList>

					<TabsContent value="chat" className="flex-1 overflow-auto">
						<Suspense fallback={<div>Loading AI chat...</div>}>
							<StreamingRAGChat />
						</Suspense>
					</TabsContent>

					<TabsContent
						value="search"
						className="flex-1 overflow-auto"
					>
						<Suspense fallback={<div>Loading search...</div>}>
							<KnowledgeBaseSearch />
						</Suspense>
					</TabsContent>

					<TabsContent
						value="sources"
						className="flex-1 overflow-auto"
					>
						<Suspense fallback={<div>Loading sources...</div>}>
							<KnowledgeBaseSourcesList sources={sources} />
						</Suspense>
					</TabsContent>

					<TabsContent value="add" className="flex-1">
						<FileUpload />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	)
}
