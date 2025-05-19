"use client"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { FileTextIcon, UploadCloudIcon, UserPlusIcon } from "lucide-react"
import { useState } from "react"

interface AddLeadsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	campaignId: string
	// onAddLeads: (data: any) => void; // Callback for when leads are added
}

export function AddLeadsModal({
	open,
	onOpenChange,
	campaignId
}: AddLeadsModalProps) {
	const [activeTab, setActiveTab] = useState("single")
	const [csvFile, setCsvFile] = useState<File | null>(null)
	const [leadName, setLeadName] = useState("")
	const [leadPhone, setLeadPhone] = useState("")
	const [leadEmail, setLeadEmail] = useState("")
	const [leadNotes, setLeadNotes] = useState("")

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files?.[0]) {
			setCsvFile(event.target.files[0])
		}
	}

	const handleAddSingleLead = () => {
		// TODO: Implement single lead addition logic
		console.log("Adding single lead:", {
			campaignId,
			leadName,
			leadPhone,
			leadEmail,
			leadNotes
		})
		onOpenChange(false) // Close modal after submission
	}

	const handleUploadCsv = () => {
		// TODO: Implement CSV upload logic
		if (csvFile) {
			console.log(
				"Uploading CSV file:",
				csvFile.name,
				"for campaign:",
				campaignId
			)
			onOpenChange(false) // Close modal after submission
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg p-6 border border-border bg-white shadow-lg rounded-3xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Add Leads to Campaign
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						You can add a single lead or upload a CSV file with
						multiple leads.
					</DialogDescription>
				</DialogHeader>
				<div className="pt-2">
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="w-full"
					>
						<TabsList className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 mb-6 h-auto">
							<TabsTrigger
								value="single"
								className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
							>
								<UserPlusIcon className="h-4 w-4 mr-2" /> Add
								Single Lead
							</TabsTrigger>
							<TabsTrigger
								value="csv"
								className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
							>
								<UploadCloudIcon className="h-4 w-4 mr-2" />{" "}
								Upload CSV
							</TabsTrigger>
						</TabsList>
						<TabsContent value="single">
							<div className="space-y-4">
								<div>
									<Label htmlFor="lead-name">Name</Label>
									<Input
										id="lead-name"
										value={leadName}
										onChange={(e) =>
											setLeadName(e.target.value)
										}
										placeholder="e.g., John Doe"
										className="rounded-lg mt-1.5"
									/>
								</div>
								<div>
									<Label htmlFor="lead-phone">
										Phone Number
									</Label>
									<Input
										id="lead-phone"
										type="tel"
										value={leadPhone}
										onChange={(e) =>
											setLeadPhone(e.target.value)
										}
										placeholder="e.g., (555) 123-4567"
										className="rounded-lg mt-1.5"
									/>
								</div>
								<div>
									<Label htmlFor="lead-email">
										Email (Optional)
									</Label>
									<Input
										id="lead-email"
										type="email"
										value={leadEmail}
										onChange={(e) =>
											setLeadEmail(e.target.value)
										}
										placeholder="e.g., john.doe@example.com"
										className="rounded-lg mt-1.5"
									/>
								</div>
								<div>
									<Label htmlFor="lead-notes">
										Notes (Optional)
									</Label>
									<Textarea
										id="lead-notes"
										value={leadNotes}
										onChange={(e) =>
											setLeadNotes(e.target.value)
										}
										placeholder="Any relevant details..."
										className="rounded-lg resize-none min-h-[100px] mt-1.5"
									/>
								</div>
							</div>
							<DialogFooter className="mt-6">
								<Button
									variant="outline"
									onClick={() => onOpenChange(false)}
									className="rounded-lg"
								>
									Cancel
								</Button>
								<Button
									onClick={handleAddSingleLead}
									className="bg-primary hover:bg-primary/90 rounded-lg"
								>
									Add Lead
								</Button>
							</DialogFooter>
						</TabsContent>
						<TabsContent value="csv">
							<div className="space-y-4">
								<div>
									<Label htmlFor="csv-file">CSV File</Label>
									<Input
										id="csv-file"
										type="file"
										accept=".csv"
										onChange={handleFileChange}
										className="rounded-lg mt-1.5"
									/>
									{csvFile && (
										<p className="text-sm text-muted-foreground mt-2 flex items-center">
											<FileTextIcon className="h-4 w-4 mr-1.5 text-primary" />
											Selected: {csvFile.name}
										</p>
									)}
								</div>
								<div className="text-xs text-muted-foreground p-3 bg-slate-50 rounded-xl border border-slate-200">
									<p className="font-medium mb-1 text-slate-700">
										CSV Format Guide:
									</p>
									<ul className="list-disc list-inside pl-2 space-y-0.5 text-slate-600">
										<li>
											Ensure the first row contains
											headers: <code>name</code>,{" "}
											<code>phone</code>,{" "}
											<code>email</code> (optional),{" "}
											<code>notes</code> (optional).
										</li>
										<li>
											<code>phone</code> is required for
											each lead.
										</li>
										<li>One lead per row.</li>
									</ul>
								</div>
							</div>
							<DialogFooter className="mt-6">
								<Button
									variant="outline"
									onClick={() => onOpenChange(false)}
									className="rounded-lg"
								>
									Cancel
								</Button>
								<Button
									onClick={handleUploadCsv}
									disabled={!csvFile}
									className="bg-primary hover:bg-primary/90 rounded-lg"
								>
									<UploadCloudIcon className="h-4 w-4 mr-2" />{" "}
									Upload CSV
								</Button>
							</DialogFooter>
						</TabsContent>
					</Tabs>
				</div>
			</DialogContent>
		</Dialog>
	)
}
