import { useEffect } from "react"

interface KeyboardShortcut {
	key: string
	ctrlKey?: boolean
	altKey?: boolean
	shiftKey?: boolean
	action: () => void
	description: string
}

interface UseKeyboardShortcutsOptions {
	shortcuts: KeyboardShortcut[]
	enabled?: boolean
}

export function useKeyboardShortcuts({
	shortcuts,
	enabled = true
}: UseKeyboardShortcutsOptions) {
	useEffect(() => {
		if (!enabled) return

		const handleKeyDown = (event: KeyboardEvent) => {
			// Don't trigger shortcuts when typing in inputs
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement ||
				event.target instanceof HTMLSelectElement ||
				(event.target as HTMLElement).contentEditable === "true"
			) {
				return
			}

			const matchingShortcut = shortcuts.find((shortcut) => {
				return (
					event.key.toLowerCase() === shortcut.key.toLowerCase() &&
					!!event.ctrlKey === !!shortcut.ctrlKey &&
					!!event.altKey === !!shortcut.altKey &&
					!!event.shiftKey === !!shortcut.shiftKey
				)
			})

			if (matchingShortcut) {
				event.preventDefault()
				matchingShortcut.action()
			}
		}

		document.addEventListener("keydown", handleKeyDown)

		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [shortcuts, enabled])
}

// Predefined shortcuts for communication features
export const createCommunicationShortcuts = ({
	onCall,
	onEmail,
	onText,
	onAppointment
}: {
	onCall: () => void
	onEmail: () => void
	onText: () => void
	onAppointment: () => void
}): KeyboardShortcut[] => [
	{
		key: "c",
		ctrlKey: true,
		action: onCall,
		description: "Schedule a call (Ctrl+C)"
	},
	{
		key: "e",
		ctrlKey: true,
		action: onEmail,
		description: "Send email (Ctrl+E)"
	},
	{
		key: "t",
		ctrlKey: true,
		action: onText,
		description: "Send text message (Ctrl+T)"
	},
	{
		key: "a",
		ctrlKey: true,
		action: onAppointment,
		description: "Schedule appointment (Ctrl+A)"
	}
]
