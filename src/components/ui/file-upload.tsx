"use client"

import { processAndEmbedFileWithWorker } from "@/actions/knowledge-base-worker"
import clsx from "clsx"
import {
	CheckCircle,
	File as FileIcon,
	Loader,
	Trash2,
	UploadCloud
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { type ChangeEvent, type DragEvent, useRef, useState } from "react"
// import { useToast } from "@/components/ui/use-toast" // Will add later for notifications

interface FileWithPreview {
	id: string
	preview: string
	progress: number // 0-10 for sending, 10-99 for processing, 100 for success, -1 for error
	name: string
	size: number
	type: string
	lastModified?: number
	file?: File
	error?: string | null // To store error messages
}

export default function FileUpload() {
	const [files, setFiles] = useState<FileWithPreview[]>([])
	const [isDragging, setIsDragging] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	// const { toast } = useToast(); // Will add later

	// Process dropped or selected files
	const handleFiles = async (fileList: FileList) => {
		const newFilesArray = Array.from(fileList).map((file) => ({
			id: `${file.name}-${file.lastModified}-${file.size}`,
			preview: file.type.startsWith("image/")
				? URL.createObjectURL(file)
				: "",
			progress: 0,
			name: file.name,
			size: file.size,
			type: file.type,
			lastModified: file.lastModified,
			file,
			error: null
		}))

		setFiles((prev) => [...prev, ...newFilesArray])

		for (const newFileEntry of newFilesArray) {
			if (newFileEntry.file) {
				// Indicate processing has started for this file
				setFiles((prev) =>
					prev.map((f) =>
						f.id === newFileEntry.id ? { ...f, progress: 10 } : f
					)
				)

				try {
					const result = await processAndEmbedFileWithWorker(
						newFileEntry.file,
						newFileEntry.name
						// We can pass sourceType if we detect it from file.type
					)

					if (result.success) {
						setFiles((prev) =>
							prev.map((f) =>
								f.id === newFileEntry.id
									? { ...f, progress: 100 }
									: f
							)
						)
						// toast({ title: "Success", description: result.message }); // For later
						console.log("File processed:", result.message)
					} else {
						setFiles((prev) =>
							prev.map((f) =>
								f.id === newFileEntry.id
									? {
											...f,
											progress: -1,
											error: result.error
										}
									: f
							)
						)
						// toast({ variant: "destructive", title: "Error", description: result.error }); // For later
						console.error("File processing error:", result.error)
					}
				} catch (error) {
					console.error("Exception during file processing:", error)
					setFiles((prev) =>
						prev.map((f) =>
							f.id === newFileEntry.id
								? {
										...f,
										progress: -1,
										error:
											error instanceof Error
												? error.message
												: "Unknown client-side error"
									}
								: f
						)
					)
					// toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." }); // For later
				}
			}
		}
	}

	const onDrop = (e: DragEvent) => {
		e.preventDefault()
		setIsDragging(false)
		handleFiles(e.dataTransfer.files)
	}

	const onDragOver = (e: DragEvent) => {
		e.preventDefault()
		setIsDragging(true)
	}

	const onDragLeave = () => setIsDragging(false)

	const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) handleFiles(e.target.files)
	}

	const formatFileSize = (bytes: number): string => {
		if (!bytes) return "0 Bytes"
		const k = 1024
		const sizes = ["Bytes", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
	}

	return (
		<div className="w-full max-w-3xl mx-auto p-4 md:p-6">
			{/* Drop zone */}
			<motion.div
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
				onClick={() => inputRef.current?.click()}
				initial={false}
				animate={{
					borderColor: isDragging ? "#3b82f6" : "#ffffff10",
					scale: isDragging ? 1.02 : 1
				}}
				whileHover={{ scale: 1.01 }}
				transition={{ duration: 0.2 }}
				className={clsx(
					"relative rounded-2xl p-8 md:p-12 text-center cursor-pointer bg-secondary/50 border border-primary/10 shadow-sm hover:shadow-md backdrop-blur group",
					isDragging && "ring-4 ring-blue-400/30 border-blue-500"
				)}
			>
				<div className="flex flex-col items-center gap-5">
					<motion.div
						animate={{ y: isDragging ? [-5, 0, -5] : 0 }}
						transition={{
							duration: 1.5,
							repeat: isDragging ? Number.POSITIVE_INFINITY : 0,
							ease: "easeInOut"
						}}
						className="relative"
					>
						<motion.div
							animate={{
								opacity: isDragging ? [0.5, 1, 0.5] : 1,
								scale: isDragging ? [0.95, 1.05, 0.95] : 1
							}}
							transition={{
								duration: 1.5,
								repeat: isDragging
									? Number.POSITIVE_INFINITY
									: 0,
								ease: "easeInOut"
							}}
							className="absolute -inset-4 bg-blue-400/10 rounded-full blur-md"
							style={{ display: isDragging ? "block" : "none" }}
						/>
						<UploadCloud
							className={clsx(
								"w-16 h-16 md:w-20 md:h-20 drop-shadow-sm",
								isDragging
									? "text-blue-500"
									: "text-zinc-700 dark:text-zinc-300 group-hover:text-blue-500 transition-colors duration-300"
							)}
						/>
					</motion.div>

					<div className="space-y-2">
						<h3 className="text-xl md:text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
							{isDragging
								? "Drop files here"
								: files.length
									? "Add more files"
									: "Upload your file"}
						</h3>
						<p className="text-zinc-600 dark:text-zinc-300 md:text-lg max-w-md mx-auto">
							{isDragging ? (
								<span className="font-medium text-blue-500">
									Release to upload
								</span>
							) : (
								<>
									Drag & drop here, or{" "}
									<span className="text-blue-500 font-medium">
										browse
									</span>
								</>
							)}
						</p>
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							Supports CSV or Excel
						</p>
					</div>

					<input
						ref={inputRef}
						type="file"
						multiple
						hidden
						onChange={onSelect}
						accept="image/*,application/pdf,video/*,audio/*,text/*,application/zip"
					/>
				</div>
			</motion.div>

			{/* Uploaded files list */}
			<div className="mt-8">
				<AnimatePresence>
					{files.length > 0 && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="flex justify-between items-center mb-3 px-2"
						>
							<h3 className="font-semibold text-lg md:text-xl text-zinc-800 dark:text-zinc-200">
								Uploaded files ({files.length})
							</h3>
							{files.filter(
								(f) => f.progress !== -1 && f.progress < 100
							).length === 0 &&
								files.length > 1 && (
									<button
										type="button"
										onClick={() => setFiles([])} // Consider only clearing completed/error files or all
										className="text-sm font-medium px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-md text-zinc-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 transition-colors duration-200"
									>
										Clear all completed
									</button>
								)}
						</motion.div>
					)}
				</AnimatePresence>

				<div
					className={clsx(
						"flex flex-col gap-3 overflow-y-auto pr-2",
						files.length > 3 &&
							"max-h-96 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent"
					)}
				>
					<AnimatePresence>
						{files.map((file) => (
							<motion.div
								key={file.id}
								initial={{ opacity: 0, y: 20, scale: 0.97 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								exit={{ opacity: 0, y: -20, scale: 0.95 }}
								transition={{
									type: "spring",
									stiffness: 300,
									damping: 24
								}}
								className="px-4 py-4 flex items-start gap-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 shadow hover:shadow-md transition-all duration-200"
							>
								{/* Thumbnail - simplified for brevity, original logic for image/video/fileicon can remain */}
								<div className="relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg border dark:border-zinc-700 shadow-sm">
									{file.type.startsWith("image/") &&
									file.preview ? (
										<img
											src={file.preview}
											alt={`Preview of ${file.name}`}
											className="w-full h-full rounded-lg object-cover"
										/>
									) : (
										<FileIcon className="w-10 h-10 text-zinc-400" />
									)}
									{/* Status Icon overlay */}
									{(file.progress === 100 ||
										(file.progress > 0 &&
											file.progress < 100)) && (
										<motion.div
											initial={{ opacity: 0, scale: 0.5 }}
											animate={{ opacity: 1, scale: 1 }}
											className="absolute -right-2 -bottom-2 bg-white dark:bg-zinc-800 rounded-full shadow-sm p-0.5"
										>
											{file.progress === 100 && (
												<CheckCircle className="w-5 h-5 text-emerald-500" />
											)}
											{file.progress > 0 &&
												file.progress < 100 && (
													<Loader className="w-5 h-5 text-blue-500 animate-spin" />
												)}
										</motion.div>
									)}
								</div>

								{/* File info & progress */}
								<div className="flex-1 min-w-0">
									<div className="flex flex-col gap-1 w-full">
										{/* Filename */}
										<div className="flex items-center gap-2 min-w-0">
											<FileIcon className="w-5 h-5 flex-shrink-0 text-blue-500 dark:text-blue-400" />
											<h4
												className="font-medium text-base md:text-lg truncate text-zinc-800 dark:text-zinc-200"
												title={file.name}
											>
												{file.name}
											</h4>
										</div>

										{/* Error Message */}
										{file.progress === -1 && file.error && (
											<p className="text-xs text-red-500 dark:text-red-400 mt-0.5 break-all">
												Error: {file.error}
											</p>
										)}

										{/* Details & remove/status icon */}
										<div className="flex items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
											<span className="text-xs md:text-sm">
												{formatFileSize(file.size)}
												{file.progress > 0 &&
													file.progress < 100 &&
													"(Processing...)"}
												{file.progress === 100 &&
													"(Completed)"}
												{file.progress === -1 &&
													"(Failed)"}
											</span>
											<span className="flex items-center gap-1.5">
												{(file.progress === 0 ||
													file.progress === -1 ||
													file.progress === 100) && (
													<Trash2
														className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors duration-200"
														onClick={(e) => {
															e.stopPropagation()
															setFiles((prev) =>
																prev.filter(
																	(f) =>
																		f.id !==
																		file.id
																)
															)
														}}
														aria-label="Remove file"
													/>
												)}
												{file.progress > 0 &&
													file.progress < 100 && (
														<Loader className="w-4 h-4 animate-spin text-blue-500" />
													)}
												{file.progress === 100 && (
													<CheckCircle className="w-4 h-4 text-emerald-500" />
												)}
											</span>
										</div>
									</div>

									{/* Progress bar - only show for active processing or completed */}
									{(file.progress > 0 ||
										file.progress === 100) &&
										file.progress !== -1 && (
											<div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mt-3">
												<motion.div
													initial={{ width: 0 }}
													animate={{
														width: `${file.progress < 0 ? 100 : file.progress}%` // Show full red for error if needed, but error text is primary
													}}
													transition={{
														duration: 0.4,
														type: "spring",
														stiffness: 100,
														ease: "easeOut"
													}}
													className={clsx(
														"h-full rounded-full shadow-inner",
														file.progress === 100
															? "bg-emerald-500"
															: "bg-blue-500"
														// Add a red color for error if progress bar is shown for errors
														// file.progress === -1 ? "bg-red-500" :
													)}
												/>
											</div>
										)}
								</div>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			</div>
		</div>
	)
}
