"use client"

import { createContext, useContext, useEffect, useState } from "react"

type SettingsContextType = {
	tableRowsPerPage: number
	setTableRowsPerPage: (rowsPerPage: number) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(
	undefined
)

// Default settings values
const DEFAULT_ROWS_PER_PAGE = 10

export function SettingsProvider({ children }: { children: React.ReactNode }) {
	const [tableRowsPerPage, setTableRowsPerPageState] = useState(
		DEFAULT_ROWS_PER_PAGE
	)

	// On mount, load settings from localStorage
	useEffect(() => {
		try {
			const savedRowsPerPage = localStorage.getItem("tableRowsPerPage")
			if (savedRowsPerPage) {
				setTableRowsPerPageState(Number(savedRowsPerPage))
			}
		} catch (error) {
			console.error("Failed to load settings from localStorage:", error)
		}
	}, [])

	// Save settings to localStorage when they change
	const setTableRowsPerPage = (rowsPerPage: number) => {
		setTableRowsPerPageState(rowsPerPage)
		try {
			localStorage.setItem("tableRowsPerPage", rowsPerPage.toString())
		} catch (error) {
			console.error("Failed to save settings to localStorage:", error)
		}
	}

	return (
		<SettingsContext.Provider
			value={{ tableRowsPerPage, setTableRowsPerPage }}
		>
			{children}
		</SettingsContext.Provider>
	)
}

export function useSettings() {
	const context = useContext(SettingsContext)
	if (context === undefined) {
		throw new Error("useSettings must be used within a SettingsProvider")
	}
	return context
}
