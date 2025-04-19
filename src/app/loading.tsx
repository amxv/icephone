"use client"

import { DottedSpinner } from "@/components/ui/dotted-spinner"

export default function Loading() {
	return (
		<div className="flex items-center justify-center h-screen w-full">
			<DottedSpinner />
		</div>
	)
}
