"use client"

import {
	createLeadAndAssignToCampaign,
	processCSVImport,
	type CSVImportResult
} from "@/actions/campaigns"
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
import {
	FileTextIcon,
	UploadCloudIcon,
	UserPlusIcon,
	AlertCircleIcon,
	CheckCircleIcon
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"

interface AddLeadsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	campaignId: string
	onLeadsAdded?: () => void // Callback for when leads are added
}

export function AddLeadsModal({
	open,
	onOpenChange,
	campaignId,
	onLeadsAdded
}: AddLeadsModalProps) {
	const [activeTab, setActiveTab] = useState("single")
	const [csvFile, setCsvFile] = useState<File | null>(null)
	const [uploadedFiles, setUploadedFiles] = useState<
		Array<{
			id: string
			preview: string
			progress: number
			name: string
			size: number
			type: string
			lastModified?: number
			file?: File
		}>
	>([])
	const [leadName, setLeadName] = useState("")
	const [leadPhone, setLeadPhone] = useState("")
	const [leadEmail, setLeadEmail] = useState("")
	const [leadNotes, setLeadNotes] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [csvImportResult, setCsvImportResult] =
		useState<CSVImportResult | null>(null)

	const resetForm = () => {
		setLeadName("")
		setLeadPhone("")
		setLeadEmail("")
		setLeadNotes("")
		setCsvFile(null)
		setUploadedFiles([])
		setCsvImportResult(null)
	}

	const handleFiles = (fileList: FileList) => {
		const newFiles = Array.from(fileList).map((file) => ({
			id: `${URL.createObjectURL(file)}-${Date.now()}`,
			preview: URL.createObjectURL(file),
			progress: 0,
			name: file.name,
			size: file.size,
			type: file.type,
			lastModified: file.lastModified,
			file
		}))
		setUploadedFiles((prev) => [...prev, ...newFiles])
		setCsvFile(fileList[0]) // Keep the first file for backward compatibility
	}

	const handleAddSingleLead = async () => {
		if (!leadName.trim()) {
			toast.error("Name is required")
			return
		}

		if (!leadPhone.trim() && !leadEmail.trim()) {
			toast.error("Either phone or email is required")
			return
		}

		setIsLoading(true)
		try {
			const result = await createLeadAndAssignToCampaign(
				{
					name: leadName,
					phone: leadPhone,
					email: leadEmail,
					notes: leadNotes,
					source: "Manual Entry"
				},
				parseInt(campaignId)
			)

			if (result.success) {
				toast.success("Lead added successfully")
				resetForm()
				onLeadsAdded?.()
				onOpenChange(false)
			} else {
				toast.error(result.error || "Failed to add lead")
			}
		} catch (error) {
			console.error("Error adding lead:", error)
			toast.error("Failed to add lead")
		} finally {
			setIsLoading(false)
		}
	}

	const handleUploadCsv = async () => {
		if (!csvFile) {
			toast.error("Please select a CSV file")
			return
		}

		setIsLoading(true)
		setCsvImportResult(null)

		try {
			// Read the file content
			const fileContent = await csvFile.text()

			// Process the CSV import
			const result = await processCSVImport(
				fileContent,
				parseInt(campaignId),
				{
					skipDuplicates: false, // Show duplicate errors for user review
					validateOnly: false
				}
			)

			setCsvImportResult(result)

			if (result.success && result.successCount > 0) {
				toast.success(
					`Successfully imported ${result.successCount} leads`
				)
				onLeadsAdded?.()

				// Auto-close if no errors
				if (result.errorCount === 0) {
					setTimeout(() => {
						resetForm()
						onOpenChange(false)
					}, 2000)
				}
			} else if (result.success && result.successCount === 0) {
				toast.error("No valid leads found in CSV file")
			} else {
				toast.error("CSV import failed")
			}
		} catch (error) {
			console.error("Error uploading CSV:", error)
			toast.error("Failed to process CSV file")
		} finally {
			setIsLoading(false)
		}
	}

	const renderImportResults = () => {
		if (!csvImportResult) return null

		return (
			<div className="mt-4 space-y-4">
				{/* Success Summary */}
				{csvImportResult.successCount > 0 && (
					<Alert className="border-green-200 bg-green-50">
						<CheckCircleIcon className="h-4 w-4 text-green-600" />
						<AlertDescription className="text-green-800">
							Successfully imported {csvImportResult.successCount}{" "}
							of {csvImportResult.totalRows} leads
							{csvImportResult.duplicatesFound > 0 &&
								` (${csvImportResult.duplicatesFound} duplicates found)`}
						</AlertDescription>
					</Alert>
				)}

				{/* Error Summary */}
				{csvImportResult.errorCount > 0 && (
					<Alert className="border-red-200 bg-red-50">
						<AlertCircleIcon className="h-4 w-4 text-red-600" />
						<AlertDescription className="text-red-800">
							{csvImportResult.errorCount} error(s) found. Please
							review and fix the issues below:
						</AlertDescription>
					</Alert>
				)}

				{/* Error Details */}
				{csvImportResult.errors.length > 0 && (
					<div className="max-h-48 overflow-y-auto space-y-2">
						{csvImportResult.errors
							.slice(0, 10)
							.map((error, index) => (
								<div
									key={index}
									className="p-2 bg-red-50 border border-red-200 rounded text-sm"
								>
									<span className="font-medium text-red-800">
										Row {error.row}:
									</span>
									{error.field && (
										<span className="text-red-600 ml-1">
											({error.field})
										</span>
									)}
									<span className="text-red-700 ml-1">
										{error.message}
									</span>
								</div>
							))}
						{csvImportResult.errors.length > 10 && (
							<div className="text-sm text-muted-foreground text-center">
								... and {csvImportResult.errors.length - 10}{" "}
								more errors
							</div>
						)}
					</div>
				)}

				{/* Created Leads List */}
				{csvImportResult.createdLeads.length > 0 && (
					<div className="mt-4">
						<h4 className="text-sm font-medium mb-2">
							Successfully Created Leads:
						</h4>
						<div className="max-h-32 overflow-y-auto space-y-1">
							{csvImportResult.createdLeads.map((lead) => (
								<div
									key={lead.id}
									className="text-sm text-muted-foreground"
								>
									• {lead.name} (ID: {lead.id})
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		)
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
										disabled={isLoading}
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
										disabled={isLoading}
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
										disabled={isLoading}
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
										disabled={isLoading}
									/>
								</div>
							</div>
							<DialogFooter className="mt-6">
								<Button
									variant="outline"
									onClick={() => onOpenChange(false)}
									className="rounded-lg"
									disabled={isLoading}
								>
									Cancel
								</Button>
								<Button
									onClick={handleAddSingleLead}
									className="bg-primary hover:bg-primary/90 rounded-lg"
									disabled={isLoading}
								>
									{isLoading ? "Adding..." : "Add Lead"}
								</Button>
							</DialogFooter>
						</TabsContent>
						<TabsContent value="csv">
							<div className="space-y-4">
								<div>
									<Label htmlFor="csv-upload">
										Upload CSV File
									</Label>
									<div className="mt-1.5">
										<div className="flex items-center justify-center w-full">
											<label
												htmlFor="csv-file-input"
												className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/40 transition-colors"
											>
												<div className="flex flex-col items-center justify-center pt-5 pb-6">
													<FileTextIcon className="w-8 h-8 mb-2 text-muted-foreground" />
													<p className="mb-2 text-sm text-muted-foreground">
														<span className="font-semibold">
															Click to upload
														</span>{" "}
														or drag and drop
													</p>
													<p className="text-xs text-muted-foreground">
														CSV files only (MAX.
														5MB)
													</p>
													{csvFile && (
														<p className="text-xs text-green-600 mt-1">
															Selected:{" "}
															{csvFile.name}
														</p>
													)}
												</div>
												<input
													id="csv-file-input"
													type="file"
													accept=".csv,text/csv"
													className="hidden"
													disabled={isLoading}
													onChange={(e) => {
														const files =
															e.target.files
														if (
															files &&
															files.length > 0
														) {
															setCsvFile(files[0])
															handleFiles(files)
														}
													}}
												/>
											</label>
										</div>
									</div>
									<p className="text-xs text-muted-foreground mt-2">
										CSV should contain columns: name, phone,
										email (optional), notes (optional)
									</p>
								</div>

								{/* Import Results */}
								{renderImportResults()}
							</div>
							<DialogFooter className="mt-6">
								<Button
									variant="outline"
									onClick={() => {
										resetForm()
										onOpenChange(false)
									}}
									className="rounded-lg"
									disabled={isLoading}
								>
									{csvImportResult?.successCount
										? "Close"
										: "Cancel"}
								</Button>
								<Button
									onClick={handleUploadCsv}
									className="bg-primary hover:bg-primary/90 rounded-lg"
									disabled={isLoading || !csvFile}
								>
									{isLoading ? "Processing..." : "Import CSV"}
								</Button>
							</DialogFooter>
						</TabsContent>
					</Tabs>
				</div>
			</DialogContent>
		</Dialog>
	)
}
