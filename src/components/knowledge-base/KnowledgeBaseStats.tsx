"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, FileText } from "lucide-react"

export interface KnowledgeBaseStatsProps {
	stats: {
		sourceCount: number
		documentCount: number
	}
}

export default function KnowledgeBaseStats({ stats }: KnowledgeBaseStatsProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-lg font-medium">
						Sources
					</CardTitle>
					<Database className="h-5 w-5 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{stats.sourceCount}
					</div>
					<p className="text-xs text-muted-foreground">
						Total knowledge sources in the system
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-lg font-medium">
						Documents
					</CardTitle>
					<FileText className="h-5 w-5 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{stats.documentCount}
					</div>
					<p className="text-xs text-muted-foreground">
						Total document chunks with embeddings
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
