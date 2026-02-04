"use client"

import { createContext, useContext, useEffect, useState } from "react"

type SettingsContextType = {
	tableRowsPerPage: number
	setTableRowsPerPage: (rowsPerPage: number) => void
	tableDenseMode: boolean
	setTableDenseMode: (denseMode: boolean) => void
	emailNotificationsEnabled: boolean
	setEmailNotificationsEnabled: (enabled: boolean) => void
	inAppNotificationsEnabled: boolean
	setInAppNotificationsEnabled: (enabled: boolean) => void
	weeklyDigestEnabled: boolean
	setWeeklyDigestEnabled: (enabled: boolean) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(
	undefined
)

// Default settings values
const DEFAULT_ROWS_PER_PAGE = 10
const ALLOWED_ROWS_PER_PAGE = [5, 10, 20, 50, 100] as const
const DEFAULT_DENSE_MODE = false
const DEFAULT_EMAIL_NOTIFICATIONS = true
const DEFAULT_IN_APP_NOTIFICATIONS = true
const DEFAULT_WEEKLY_DIGEST = false

function normalizeRowsPerPage(value: unknown): number {
	const parsed =
		typeof value === "number"
			? value
			: Number.parseInt(String(value || ""), 10)
	return ALLOWED_ROWS_PER_PAGE.includes(
		parsed as (typeof ALLOWED_ROWS_PER_PAGE)[number]
	)
		? parsed
		: DEFAULT_ROWS_PER_PAGE
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
	const [tableRowsPerPage, setTableRowsPerPageState] = useState(
		DEFAULT_ROWS_PER_PAGE
	)
	const [tableDenseMode, setTableDenseModeState] = useState(
		DEFAULT_DENSE_MODE
	)
	const [emailNotificationsEnabled, setEmailNotificationsEnabledState] =
		useState(DEFAULT_EMAIL_NOTIFICATIONS)
	const [inAppNotificationsEnabled, setInAppNotificationsEnabledState] =
		useState(DEFAULT_IN_APP_NOTIFICATIONS)
	const [weeklyDigestEnabled, setWeeklyDigestEnabledState] = useState(
		DEFAULT_WEEKLY_DIGEST
	)

	// On mount, load settings from localStorage
	useEffect(() => {
		try {
			const savedRowsPerPage = localStorage.getItem("tableRowsPerPage")
			if (savedRowsPerPage) {
				setTableRowsPerPageState(
					normalizeRowsPerPage(savedRowsPerPage)
				)
			}
			const savedDenseMode = localStorage.getItem("tableDenseMode")
			if (savedDenseMode !== null) {
				setTableDenseModeState(savedDenseMode === "true")
			}
			const savedEmailNotifications = localStorage.getItem(
				"emailNotificationsEnabled"
			)
			if (savedEmailNotifications !== null) {
				setEmailNotificationsEnabledState(
					savedEmailNotifications === "true"
				)
			}
			const savedInAppNotifications = localStorage.getItem(
				"inAppNotificationsEnabled"
			)
			if (savedInAppNotifications !== null) {
				setInAppNotificationsEnabledState(
					savedInAppNotifications === "true"
				)
			}
			const savedWeeklyDigest = localStorage.getItem("weeklyDigestEnabled")
			if (savedWeeklyDigest !== null) {
				setWeeklyDigestEnabledState(savedWeeklyDigest === "true")
			}
		} catch (error) {
			console.error("Failed to load settings from localStorage:", error)
		}
	}, [])

	useEffect(() => {
		document.documentElement.dataset.tableDensity = tableDenseMode
			? "compact"
			: "comfortable"
	}, [tableDenseMode])

	// Save settings to localStorage when they change
	const setTableRowsPerPage = (rowsPerPage: number) => {
		const normalizedRowsPerPage = normalizeRowsPerPage(rowsPerPage)
		setTableRowsPerPageState(normalizedRowsPerPage)
		try {
			localStorage.setItem(
				"tableRowsPerPage",
				normalizedRowsPerPage.toString()
			)
		} catch (error) {
			console.error("Failed to save settings to localStorage:", error)
		}
	}

	const setTableDenseMode = (denseMode: boolean) => {
		setTableDenseModeState(denseMode)
		try {
			localStorage.setItem("tableDenseMode", denseMode.toString())
		} catch (error) {
			console.error("Failed to save dense mode setting:", error)
		}
	}

	const setEmailNotificationsEnabled = (enabled: boolean) => {
		setEmailNotificationsEnabledState(enabled)
		try {
			localStorage.setItem("emailNotificationsEnabled", enabled.toString())
		} catch (error) {
			console.error("Failed to save email notification setting:", error)
		}
	}

	const setInAppNotificationsEnabled = (enabled: boolean) => {
		setInAppNotificationsEnabledState(enabled)
		try {
			localStorage.setItem(
				"inAppNotificationsEnabled",
				enabled.toString()
			)
		} catch (error) {
			console.error("Failed to save in-app notification setting:", error)
		}
	}

	const setWeeklyDigestEnabled = (enabled: boolean) => {
		setWeeklyDigestEnabledState(enabled)
		try {
			localStorage.setItem("weeklyDigestEnabled", enabled.toString())
		} catch (error) {
			console.error("Failed to save weekly digest setting:", error)
		}
	}

	return (
		<SettingsContext.Provider
			value={{
				tableRowsPerPage,
				setTableRowsPerPage,
				tableDenseMode,
				setTableDenseMode,
				emailNotificationsEnabled,
				setEmailNotificationsEnabled,
				inAppNotificationsEnabled,
				setInAppNotificationsEnabled,
				weeklyDigestEnabled,
				setWeeklyDigestEnabled
			}}
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
