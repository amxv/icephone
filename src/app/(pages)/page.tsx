"use client"
export default function Home() {
	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-2xl font-bold">Home</h1>
			<p className="text-lg text-neutral-700 dark:text-neutral-200">
				Welcome! If you see this text, the sidebar layout is working
				correctly.
			</p>
			<p className="text-base text-neutral-500">
				Try resizing your browser or navigating to other pages to see
				the sidebar in action.
			</p>
		</div>
	)
}
