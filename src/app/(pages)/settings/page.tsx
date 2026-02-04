"use client"

import {
	disconnectCRMIntegration,
	getCRMIntegrations,
	saveCRMIntegration
} from "@/actions/crm-integrations"
import {
	disconnectCalcomIntegration,
	getCalcomIntegration,
	saveCalcomIntegration
} from "@/actions/integrations"
import {
	disconnectTelephonyIntegration,
	getTelephonyIntegrations,
	saveTelephonyIntegration
} from "@/actions/telephony-integrations"
import { authClient } from "@/lib/auth-client"
import { useAuthUser } from "@/lib/auth/use-auth-user"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSettings } from "@/contexts/settings-context"
import {
	BellIcon,
	InfoIcon,
	LogOutIcon,
	MailIcon,
	PlugZapIcon,
	UserIcon
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type CRMProvider = "hubspot" | "salesforce" | "gohighlevel" | "pipedrive"
type TelephonyProvider = "twilio" | "telnyx" | "vonage"

type CRMIntegrationForm = {
	apiKey: string
	isConnected: boolean
	leadLinks: number
	updatedAt: string | null
	settings: {
		instanceUrl: string
		locationId: string
		apiDomain: string
		companyDomain: string
		apiVersion: string
		salesforceLeadObject: "Lead" | "Contact"
	}
}

type CalcomIntegrationForm = {
	apiKey: string
	isConnected: boolean
	updatedAt: string | null
	settings: {
		eventTypeId: string
		eventTypeSlug: string
		teamSlug: string
		username: string
		organizationSlug: string
		defaultTimeZone: string
	}
}

type TelephonyIntegrationForm = {
	apiKey: string
	isConnected: boolean
	updatedAt: string | null
	settings: {
		accountSid: string
		fromNumber: string
		outboundTwimlUrl: string
		statusCallbackUrl: string
		recordCalls: boolean
		connectionId: string
		webhookUrl: string
		applicationId: string
		answerUrl: string
		eventUrl: string
	}
}

const crmProviders: Array<{
	id: CRMProvider
	label: string
	description: string
}> = [
	{
		id: "hubspot",
		label: "HubSpot",
		description: "Private app token for contact import + call notes sync."
	},
	{
		id: "salesforce",
		label: "Salesforce",
		description: "Access token + instance URL for lead/contact sync."
	},
	{
		id: "gohighlevel",
		label: "GoHighLevel",
		description: "Access token + location ID for contact import and notes."
	},
	{
		id: "pipedrive",
		label: "Pipedrive",
		description: "Token + API domain (or company domain) for person sync."
	}
]

const telephonyProviders: Array<{
	id: TelephonyProvider
	label: string
	description: string
}> = [
	{
		id: "twilio",
		label: "Twilio",
		description: "Auth token + account SID for outbound call execution."
	},
	{
		id: "telnyx",
		label: "Telnyx",
		description: "API key + connection ID for outbound call execution."
	},
	{
		id: "vonage",
		label: "Vonage",
		description:
			"Private key + application metadata for outbound call execution."
	}
]

function emptyCRMIntegrationState(): Record<CRMProvider, CRMIntegrationForm> {
	return {
		hubspot: {
			apiKey: "",
			isConnected: false,
			leadLinks: 0,
			updatedAt: null,
			settings: {
				instanceUrl: "",
				locationId: "",
				apiDomain: "",
				companyDomain: "",
				apiVersion: "v60.0",
				salesforceLeadObject: "Lead"
			}
		},
		salesforce: {
			apiKey: "",
			isConnected: false,
			leadLinks: 0,
			updatedAt: null,
			settings: {
				instanceUrl: "",
				locationId: "",
				apiDomain: "",
				companyDomain: "",
				apiVersion: "v60.0",
				salesforceLeadObject: "Lead"
			}
		},
		gohighlevel: {
			apiKey: "",
			isConnected: false,
			leadLinks: 0,
			updatedAt: null,
			settings: {
				instanceUrl: "",
				locationId: "",
				apiDomain: "",
				companyDomain: "",
				apiVersion: "v60.0",
				salesforceLeadObject: "Lead"
			}
		},
		pipedrive: {
			apiKey: "",
			isConnected: false,
			leadLinks: 0,
			updatedAt: null,
			settings: {
				instanceUrl: "",
				locationId: "",
				apiDomain: "",
				companyDomain: "",
				apiVersion: "v60.0",
				salesforceLeadObject: "Lead"
			}
		}
	}
}

function emptyCalcomIntegrationState(): CalcomIntegrationForm {
	return {
		apiKey: "",
		isConnected: false,
		updatedAt: null,
		settings: {
			eventTypeId: "",
			eventTypeSlug: "",
			teamSlug: "",
			username: "",
			organizationSlug: "",
			defaultTimeZone: ""
		}
	}
}

function emptyTelephonyIntegrationState(): Record<
	TelephonyProvider,
	TelephonyIntegrationForm
> {
	return {
		twilio: {
			apiKey: "",
			isConnected: false,
			updatedAt: null,
			settings: {
				accountSid: "",
				fromNumber: "",
				outboundTwimlUrl: "",
				statusCallbackUrl: "",
				recordCalls: true,
				connectionId: "",
				webhookUrl: "",
				applicationId: "",
				answerUrl: "",
				eventUrl: ""
			}
		},
		telnyx: {
			apiKey: "",
			isConnected: false,
			updatedAt: null,
			settings: {
				accountSid: "",
				fromNumber: "",
				outboundTwimlUrl: "",
				statusCallbackUrl: "",
				recordCalls: true,
				connectionId: "",
				webhookUrl: "",
				applicationId: "",
				answerUrl: "",
				eventUrl: ""
			}
		},
		vonage: {
			apiKey: "",
			isConnected: false,
			updatedAt: null,
			settings: {
				accountSid: "",
				fromNumber: "",
				outboundTwimlUrl: "",
				statusCallbackUrl: "",
				recordCalls: true,
				connectionId: "",
				webhookUrl: "",
				applicationId: "",
				answerUrl: "",
				eventUrl: ""
			}
		}
	}
}

function valueAsString(value: unknown) {
	if (typeof value === "string") return value
	if (typeof value === "number" && Number.isFinite(value)) return String(value)
	return ""
}

function PageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Settings
				</h1>
			</div>
		</div>
	)
}

export default function SettingsPage() {
	const router = useRouter()
	const { user, isLoading: isUserLoading, isAuthenticated } = useAuthUser()
	const [isSigningOut, setIsSigningOut] = useState(false)
	const [isIntegrationsLoading, setIsIntegrationsLoading] = useState(true)
	const [crmSavingProvider, setCrmSavingProvider] =
		useState<CRMProvider | null>(null)
	const [crmDisconnectingProvider, setCrmDisconnectingProvider] =
		useState<CRMProvider | null>(null)
	const [isCalcomSaving, setIsCalcomSaving] = useState(false)
	const [isCalcomDisconnecting, setIsCalcomDisconnecting] = useState(false)
	const [telephonySavingProvider, setTelephonySavingProvider] =
		useState<TelephonyProvider | null>(null)
	const [telephonyDisconnectingProvider, setTelephonyDisconnectingProvider] =
		useState<TelephonyProvider | null>(null)
	const [crmIntegrations, setCrmIntegrations] = useState<
		Record<CRMProvider, CRMIntegrationForm>
	>(() => emptyCRMIntegrationState())
	const [calcomIntegration, setCalcomIntegration] =
		useState<CalcomIntegrationForm>(() => emptyCalcomIntegrationState())
	const [telephonyIntegrations, setTelephonyIntegrations] = useState<
		Record<TelephonyProvider, TelephonyIntegrationForm>
	>(() => emptyTelephonyIntegrationState())
	const {
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
	} = useSettings()

	const loadIntegrations = useCallback(async () => {
		setIsIntegrationsLoading(true)
		try {
			const [crmResult, calcomResult, telephonyResult] =
				await Promise.all([
				getCRMIntegrations(),
				getCalcomIntegration(),
				getTelephonyIntegrations()
			])

			if (crmResult.success && crmResult.data) {
				const nextState = emptyCRMIntegrationState()
				for (const integration of crmResult.data) {
					const provider = integration.provider as CRMProvider
					if (!(provider in nextState)) continue

					const settings = (integration.settings || {}) as Record<
						string,
						unknown
					>
					nextState[provider] = {
						...nextState[provider],
						isConnected: Boolean(integration.isConnected),
						leadLinks: Number(integration.leadLinks || 0),
						updatedAt: integration.updatedAt
							? new Date(integration.updatedAt).toISOString()
							: null,
						settings: {
							...nextState[provider].settings,
							instanceUrl: valueAsString(settings.instanceUrl),
							locationId: valueAsString(settings.locationId),
							apiDomain: valueAsString(settings.apiDomain),
							companyDomain: valueAsString(
								settings.companyDomain
							),
							apiVersion:
								valueAsString(settings.apiVersion) || "v60.0",
							salesforceLeadObject:
								valueAsString(
									(settings.objectMapping as
										| Record<string, unknown>
										| undefined)?.salesforceLeadObject
								) === "Contact"
									? "Contact"
									: "Lead"
						}
					}
				}
				setCrmIntegrations(nextState)
			}

			if (calcomResult.success && calcomResult.data) {
				const settings = calcomResult.data.settings || {}
				setCalcomIntegration({
					apiKey: "",
					isConnected: Boolean(calcomResult.data.isConnected),
					updatedAt: calcomResult.data.updatedAt
						? new Date(calcomResult.data.updatedAt).toISOString()
						: null,
					settings: {
						eventTypeId: valueAsString(settings.eventTypeId),
						eventTypeSlug: valueAsString(settings.eventTypeSlug),
						teamSlug: valueAsString(settings.teamSlug),
						username: valueAsString(settings.username),
						organizationSlug: valueAsString(
							settings.organizationSlug
						),
						defaultTimeZone: valueAsString(
							settings.defaultTimeZone
						)
					}
				})
			}

			if (telephonyResult.success && telephonyResult.data) {
				const nextState = emptyTelephonyIntegrationState()
				for (const integration of telephonyResult.data) {
					const provider = integration.provider as TelephonyProvider
					if (!(provider in nextState)) continue
					const settings = integration.settings || {}

					nextState[provider] = {
						...nextState[provider],
						isConnected: Boolean(integration.isConnected),
						updatedAt: integration.updatedAt
							? new Date(integration.updatedAt).toISOString()
							: null,
						settings: {
							...nextState[provider].settings,
							accountSid: valueAsString(settings.accountSid),
							fromNumber: valueAsString(settings.fromNumber),
							outboundTwimlUrl: valueAsString(
								settings.outboundTwimlUrl
							),
							statusCallbackUrl: valueAsString(
								settings.statusCallbackUrl
							),
							recordCalls:
								typeof settings.recordCalls === "boolean"
									? settings.recordCalls
									: true,
							connectionId: valueAsString(settings.connectionId),
							webhookUrl: valueAsString(settings.webhookUrl),
							applicationId: valueAsString(
								settings.applicationId
							),
							answerUrl: valueAsString(settings.answerUrl),
							eventUrl: valueAsString(settings.eventUrl)
						}
					}
				}
				setTelephonyIntegrations(nextState)
			}
		} catch (error) {
			console.error("Failed loading integrations", error)
			toast.error("Failed to load integration settings")
		} finally {
			setIsIntegrationsLoading(false)
		}
	}, [])

	useEffect(() => {
		void loadIntegrations()
	}, [loadIntegrations])

	const handleSignOut = async () => {
		setIsSigningOut(true)
		try {
			await authClient.signOut()
			router.push("/sign-in")
		} catch (error) {
			console.error("Failed to sign out", error)
		} finally {
			setIsSigningOut(false)
		}
	}

	const updateCRMApiKey = (provider: CRMProvider, apiKey: string) => {
		setCrmIntegrations((prev) => ({
			...prev,
			[provider]: {
				...prev[provider],
				apiKey
			}
		}))
	}

	const updateCRMSetting = (
		provider: CRMProvider,
		key: keyof CRMIntegrationForm["settings"],
		value: string
	) => {
		setCrmIntegrations((prev) => ({
			...prev,
			[provider]: {
				...prev[provider],
				settings: {
					...prev[provider].settings,
					[key]:
						key === "salesforceLeadObject" &&
						value !== "Contact"
							? "Lead"
							: value
				}
			}
		}))
	}

	const saveCRMProvider = async (provider: CRMProvider) => {
		const values = crmIntegrations[provider]
		const apiKey = values.apiKey.trim()

		if (!values.isConnected && apiKey.length === 0) {
			toast.error("API key is required to connect this CRM")
			return
		}

		if (
			provider === "salesforce" &&
			values.settings.instanceUrl.trim().length === 0
		) {
			toast.error("Salesforce instance URL is required")
			return
		}

		if (
			provider === "gohighlevel" &&
			values.settings.locationId.trim().length === 0
		) {
			toast.error("GoHighLevel location ID is required")
			return
		}

		if (
			provider === "pipedrive" &&
			values.settings.apiDomain.trim().length === 0 &&
			values.settings.companyDomain.trim().length === 0
		) {
			toast.error("Pipedrive API domain or company domain is required")
			return
		}

		const settings: Record<string, unknown> = {}
		const setIfPresent = (key: string, value: string) => {
			const trimmed = value.trim()
			if (trimmed.length > 0) settings[key] = trimmed
		}

		setIfPresent("instanceUrl", values.settings.instanceUrl)
		setIfPresent("locationId", values.settings.locationId)
		setIfPresent("apiDomain", values.settings.apiDomain)
		setIfPresent("companyDomain", values.settings.companyDomain)
		setIfPresent("apiVersion", values.settings.apiVersion)

		if (provider === "salesforce") {
			settings.objectMapping = {
				salesforceLeadObject: values.settings.salesforceLeadObject
			}
		}

		setCrmSavingProvider(provider)
		try {
			const result = await saveCRMIntegration({
				provider,
				apiKey: apiKey.length > 0 ? apiKey : undefined,
				settings
			})
			if (!result.success) {
				toast.error(result.error || "Failed to save CRM integration")
				return
			}

			toast.success(`${crmProviders.find((p) => p.id === provider)?.label || provider} integration saved`)
			setCrmIntegrations((prev) => ({
				...prev,
				[provider]: {
					...prev[provider],
					apiKey: ""
				}
			}))
			await loadIntegrations()
		} catch (error) {
			console.error("Failed to save CRM integration", error)
			toast.error("Failed to save CRM integration")
		} finally {
			setCrmSavingProvider(null)
		}
	}

	const disconnectCRMProvider = async (provider: CRMProvider) => {
		setCrmDisconnectingProvider(provider)
		try {
			const result = await disconnectCRMIntegration(provider)
			if (!result.success) {
				toast.error(result.error || "Failed to disconnect CRM")
				return
			}
			toast.success(`${crmProviders.find((p) => p.id === provider)?.label || provider} disconnected`)
			await loadIntegrations()
		} catch (error) {
			console.error("Failed to disconnect CRM integration", error)
			toast.error("Failed to disconnect CRM integration")
		} finally {
			setCrmDisconnectingProvider(null)
		}
	}

	const updateCalcomSetting = (
		key: keyof CalcomIntegrationForm["settings"],
		value: string
	) => {
		setCalcomIntegration((prev) => ({
			...prev,
			settings: {
				...prev.settings,
				[key]: value
			}
		}))
	}

	const handleSaveCalcom = async () => {
		const apiKey = calcomIntegration.apiKey.trim()
		if (!calcomIntegration.isConnected && apiKey.length === 0) {
			toast.error("Cal.com API key is required")
			return
		}

		setIsCalcomSaving(true)
		try {
			const result = await saveCalcomIntegration({
				apiKey: apiKey.length > 0 ? apiKey : undefined,
				settings: {
					eventTypeId: calcomIntegration.settings.eventTypeId,
					eventTypeSlug: calcomIntegration.settings.eventTypeSlug,
					teamSlug: calcomIntegration.settings.teamSlug,
					username: calcomIntegration.settings.username,
					organizationSlug:
						calcomIntegration.settings.organizationSlug,
					defaultTimeZone: calcomIntegration.settings.defaultTimeZone
				}
			})

			if (!result.success) {
				toast.error(result.error || "Failed to save Cal.com settings")
				return
			}

			toast.success("Cal.com integration saved")
			setCalcomIntegration((prev) => ({
				...prev,
				apiKey: ""
			}))
			await loadIntegrations()
		} catch (error) {
			console.error("Failed to save Cal.com integration", error)
			toast.error("Failed to save Cal.com integration")
		} finally {
			setIsCalcomSaving(false)
		}
	}

	const handleDisconnectCalcom = async () => {
		setIsCalcomDisconnecting(true)
		try {
			const result = await disconnectCalcomIntegration()
			if (!result.success) {
				toast.error(result.error || "Failed to disconnect Cal.com")
				return
			}

			toast.success("Cal.com disconnected")
			await loadIntegrations()
		} catch (error) {
			console.error("Failed to disconnect Cal.com", error)
			toast.error("Failed to disconnect Cal.com")
		} finally {
			setIsCalcomDisconnecting(false)
		}
	}

	const updateTelephonyApiKey = (
		provider: TelephonyProvider,
		apiKey: string
	) => {
		setTelephonyIntegrations((prev) => ({
			...prev,
			[provider]: {
				...prev[provider],
				apiKey
			}
		}))
	}

	const updateTelephonySetting = (
		provider: TelephonyProvider,
		key: keyof TelephonyIntegrationForm["settings"],
		value: string | boolean
	) => {
		setTelephonyIntegrations((prev) => ({
			...prev,
			[provider]: {
				...prev[provider],
				settings: {
					...prev[provider].settings,
					[key]: value
				}
			}
		}))
	}

	const saveTelephonyProvider = async (provider: TelephonyProvider) => {
		const values = telephonyIntegrations[provider]
		const apiKey = values.apiKey.trim()
		const settings = values.settings

		if (!values.isConnected && apiKey.length === 0) {
			toast.error("Provider credential is required")
			return
		}

		if (provider === "twilio" && settings.accountSid.trim().length === 0) {
			toast.error("Twilio account SID is required")
			return
		}
		if (
			provider === "telnyx" &&
			settings.connectionId.trim().length === 0
		) {
			toast.error("Telnyx connection ID is required")
			return
		}
		if (
			provider === "vonage" &&
			(settings.applicationId.trim().length === 0 ||
				settings.answerUrl.trim().length === 0)
		) {
			toast.error("Vonage application ID and answer URL are required")
			return
		}

		const payloadSettings: Record<string, unknown> = {}
		const setIfPresent = (key: string, value: string) => {
			const trimmed = value.trim()
			if (trimmed.length > 0) payloadSettings[key] = trimmed
		}

		if (provider === "twilio") {
			setIfPresent("accountSid", settings.accountSid)
			setIfPresent("fromNumber", settings.fromNumber)
			setIfPresent("outboundTwimlUrl", settings.outboundTwimlUrl)
			setIfPresent("statusCallbackUrl", settings.statusCallbackUrl)
			payloadSettings.recordCalls = settings.recordCalls
		}
		if (provider === "telnyx") {
			setIfPresent("connectionId", settings.connectionId)
			setIfPresent("fromNumber", settings.fromNumber)
			setIfPresent("webhookUrl", settings.webhookUrl)
		}
		if (provider === "vonage") {
			setIfPresent("applicationId", settings.applicationId)
			setIfPresent("fromNumber", settings.fromNumber)
			setIfPresent("answerUrl", settings.answerUrl)
			setIfPresent("eventUrl", settings.eventUrl)
		}

		setTelephonySavingProvider(provider)
		try {
			const result = await saveTelephonyIntegration({
				provider,
				apiKey: apiKey.length > 0 ? apiKey : undefined,
				settings: payloadSettings
			})
			if (!result.success) {
				toast.error(result.error || "Failed to save telephony provider")
				return
			}

			toast.success(
				`${telephonyProviders.find((p) => p.id === provider)?.label || provider} integration saved`
			)
			setTelephonyIntegrations((prev) => ({
				...prev,
				[provider]: {
					...prev[provider],
					apiKey: ""
				}
			}))
			await loadIntegrations()
		} catch (error) {
			console.error("Failed to save telephony integration", error)
			toast.error("Failed to save telephony integration")
		} finally {
			setTelephonySavingProvider(null)
		}
	}

	const disconnectTelephonyProvider = async (provider: TelephonyProvider) => {
		setTelephonyDisconnectingProvider(provider)
		try {
			const result = await disconnectTelephonyIntegration(provider)
			if (!result.success) {
				toast.error(
					result.error || "Failed to disconnect telephony provider"
				)
				return
			}

			toast.success(
				`${telephonyProviders.find((p) => p.id === provider)?.label || provider} disconnected`
			)
			await loadIntegrations()
		} catch (error) {
			console.error("Failed to disconnect telephony integration", error)
			toast.error("Failed to disconnect telephony integration")
		} finally {
			setTelephonyDisconnectingProvider(null)
		}
	}

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-8 p-2 md:px-8 md:py-4 h-full">
				<PageHeader />
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="px-6 py-2">
						<Tabs defaultValue="display" className="space-y-12">
							<div className="flex justify-center w-full">
								<TabsList className="rounded-full bg-muted/80 shadow-inner flex-wrap h-auto">
									<TabsTrigger
										value="display"
										className="px-8 text-base font-medium rounded-full"
									>
										Display
									</TabsTrigger>
									<TabsTrigger
										value="account"
										className="px-8 text-base font-medium rounded-full"
									>
										Account
									</TabsTrigger>
									<TabsTrigger
										value="notifications"
										className="px-8 text-base font-medium rounded-full"
									>
										Notifications
									</TabsTrigger>
									<TabsTrigger
										value="integrations"
										className="px-8 text-base font-medium rounded-full"
									>
										Integrations
									</TabsTrigger>
								</TabsList>
							</div>

							<TabsContent value="display" className="space-y-4 pt-4">
								<div className="space-y-6">
									<div className="flex items-center gap-2">
										<div className="h-10 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
										<div>
											<CardTitle className="text-xl">
												Table Settings
											</CardTitle>
											<CardDescription className="text-sm text-muted-foreground mt-1">
												Configure how tables are displayed
												throughout the application.
											</CardDescription>
										</div>
									</div>

									<div className="bg-muted/40 p-6 rounded-xl border border-border/50 shadow-sm">
										<div className="space-y-8">
											<div>
												<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
													<div className="space-y-1">
														<h3 className="text-sm font-medium leading-none">
															Rows per page
														</h3>
														<p className="text-xs text-muted-foreground">
															Number of rows to
															display in each table
															page
														</p>
													</div>
													<Select
														value={tableRowsPerPage.toString()}
														onValueChange={(value) =>
															setTableRowsPerPage(
																Number(value)
															)
														}
													>
														<SelectTrigger
															id="rows-per-page"
															aria-label="Select rows per page"
															className="w-40"
														>
															<SelectValue placeholder="Select rows" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="5">
																5 rows
															</SelectItem>
															<SelectItem value="10">
																10 rows
															</SelectItem>
															<SelectItem value="20">
																20 rows
															</SelectItem>
															<SelectItem value="50">
																50 rows
															</SelectItem>
															<SelectItem value="100">
																100 rows
															</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>

											<div className="flex items-center justify-between gap-4">
												<div className="space-y-1">
													<h3 className="text-sm font-medium leading-none">
														Dense mode
													</h3>
													<p className="text-xs text-muted-foreground">
														Compact table rows for
														higher data density
													</p>
												</div>
												<Switch
													checked={tableDenseMode}
													onCheckedChange={
														setTableDenseMode
													}
													aria-label="Enable dense table mode"
												/>
											</div>
										</div>
									</div>

									<div className="flex items-center bg-primary/5 border border-primary/20 rounded-lg p-3 mt-8">
										<div className="bg-primary/10 p-2 rounded-md mr-3">
											<InfoIcon className="size-4 text-primary" />
										</div>
										<p className="text-xs text-muted-foreground">
											These settings apply to all tables
											throughout the application.
										</p>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="account" className="space-y-4 pt-4">
								<div className="space-y-6">
									<div className="flex items-center gap-2">
										<div className="h-10 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
										<div>
											<CardTitle className="text-xl">
												Account Settings
											</CardTitle>
											<CardDescription className="text-sm text-muted-foreground mt-1">
												Review your active account and
												session controls.
											</CardDescription>
										</div>
									</div>

									<div className="bg-muted/40 p-6 rounded-xl border border-border/50 shadow-sm">
										{isUserLoading ? (
											<p className="text-sm text-muted-foreground">
												Loading account information...
											</p>
										) : isAuthenticated && user ? (
											<div className="space-y-4">
												<div className="flex items-center justify-between gap-4">
													<div className="space-y-1">
														<div className="flex items-center gap-2 text-sm font-medium">
															<UserIcon className="size-4 text-muted-foreground" />
															Name
														</div>
														<p className="text-sm text-muted-foreground">
															{user.name || "Not set"}
														</p>
													</div>
												</div>
												<Separator />
												<div className="flex items-center justify-between gap-4">
													<div className="space-y-1">
														<div className="flex items-center gap-2 text-sm font-medium">
															<MailIcon className="size-4 text-muted-foreground" />
															Email
														</div>
														<p className="text-sm text-muted-foreground">
															{user.email}
														</p>
													</div>
												</div>
												<Separator />
												<div className="flex items-center justify-between gap-4">
													<div className="space-y-1">
														<h3 className="text-sm font-medium leading-none">
															Current Session
														</h3>
														<p className="text-xs text-muted-foreground">
															Sign out of this
															session on this
															device.
														</p>
													</div>
													<Button
														variant="outline"
														className="rounded-xl"
														onClick={handleSignOut}
														disabled={isSigningOut}
													>
														<LogOutIcon className="mr-2 size-4" />
														{isSigningOut
															? "Signing out..."
															: "Sign out"}
													</Button>
												</div>
											</div>
										) : (
											<p className="text-sm text-muted-foreground">
												No authenticated session was found.
											</p>
										)}
									</div>
								</div>
							</TabsContent>

							<TabsContent
								value="notifications"
								className="space-y-4 pt-4"
							>
								<div className="space-y-6">
									<div className="flex items-center gap-2">
										<div className="h-10 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
										<div>
											<CardTitle className="text-xl">
												Notification Settings
											</CardTitle>
											<CardDescription className="text-sm text-muted-foreground mt-1">
												Choose how updates are surfaced in
												your workspace.
											</CardDescription>
										</div>
									</div>

									<div className="bg-muted/40 p-6 rounded-xl border border-border/50 shadow-sm space-y-6">
										<div className="flex items-center justify-between gap-4">
											<div className="space-y-1">
												<h3 className="text-sm font-medium leading-none">
													Email notifications
												</h3>
												<p className="text-xs text-muted-foreground">
													Receive summaries and alerts
													through email.
												</p>
											</div>
											<Switch
												checked={
													emailNotificationsEnabled
												}
												onCheckedChange={
													setEmailNotificationsEnabled
												}
												aria-label="Toggle email notifications"
											/>
										</div>
										<Separator />
										<div className="flex items-center justify-between gap-4">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<BellIcon className="size-4 text-muted-foreground" />
													<h3 className="text-sm font-medium leading-none">
														In-app notifications
													</h3>
												</div>
												<p className="text-xs text-muted-foreground">
													Show operational updates in
													the app interface.
												</p>
											</div>
											<Switch
												checked={
													inAppNotificationsEnabled
												}
												onCheckedChange={
													setInAppNotificationsEnabled
												}
												aria-label="Toggle in-app notifications"
											/>
										</div>
										<Separator />
										<div className="flex items-center justify-between gap-4">
											<div className="space-y-1">
												<h3 className="text-sm font-medium leading-none">
													Weekly digest
												</h3>
												<p className="text-xs text-muted-foreground">
													Receive a weekly summary of
													calls, outcomes, and trends.
												</p>
											</div>
											<Switch
												checked={weeklyDigestEnabled}
												onCheckedChange={
													setWeeklyDigestEnabled
												}
												aria-label="Toggle weekly digest notifications"
											/>
										</div>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="integrations" className="space-y-4 pt-4">
								<div className="space-y-6">
									<div className="flex items-center gap-2">
										<div className="h-10 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
										<div>
											<CardTitle className="text-xl">
												Integrations
											</CardTitle>
											<CardDescription className="text-sm text-muted-foreground mt-1">
												Connect Cal.com and CRM providers
												for booking and lead-sync flows.
											</CardDescription>
										</div>
									</div>

									{isIntegrationsLoading ? (
										<Card className="rounded-2xl border border-border bg-card/40">
											<CardContent className="py-10 text-sm text-muted-foreground">
												Loading integration settings...
											</CardContent>
										</Card>
									) : (
										<>
											<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
												<CardHeader className="pb-4">
													<div className="flex items-center justify-between gap-3">
														<div>
															<CardTitle className="flex items-center gap-2 text-lg">
																<PlugZapIcon className="size-4" />
																Cal.com
															</CardTitle>
															<CardDescription className="mt-1">
																Configure team-level
																booking credentials.
															</CardDescription>
														</div>
														<Badge
															variant="outline"
															className={
																calcomIntegration.isConnected
																	? "bg-green-100 text-green-800 border-green-200"
																	: "bg-amber-100 text-amber-800 border-amber-200"
															}
														>
															{calcomIntegration.isConnected
																? "Connected"
																: "Not Connected"}
														</Badge>
													</div>
												</CardHeader>
												<CardContent className="space-y-4">
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
														<div className="space-y-1.5">
															<Label htmlFor="calcom-api-key">
																API Key
															</Label>
															<Input
																id="calcom-api-key"
																type="password"
																placeholder="cal_live_..."
																value={calcomIntegration.apiKey}
																onChange={(event) =>
																	setCalcomIntegration(
																		(prev) => ({
																			...prev,
																			apiKey: event
																				.target
																				.value
																		})
																	)
																}
															/>
														</div>
														<div className="space-y-1.5">
															<Label htmlFor="calcom-event-type-id">
																Event Type ID
															</Label>
															<Input
																id="calcom-event-type-id"
																placeholder="123456"
																value={
																	calcomIntegration
																		.settings
																		.eventTypeId
																}
																onChange={(event) =>
																	updateCalcomSetting(
																		"eventTypeId",
																		event.target
																			.value
																	)
																}
															/>
														</div>
														<div className="space-y-1.5">
															<Label htmlFor="calcom-event-type-slug">
																Event Type Slug
															</Label>
															<Input
																id="calcom-event-type-slug"
																placeholder="demo-call"
																value={
																	calcomIntegration
																		.settings
																		.eventTypeSlug
																}
																onChange={(event) =>
																	updateCalcomSetting(
																		"eventTypeSlug",
																		event.target
																			.value
																	)
																}
															/>
														</div>
														<div className="space-y-1.5">
															<Label htmlFor="calcom-team-slug">
																Team Slug
															</Label>
															<Input
																id="calcom-team-slug"
																placeholder="sales-team"
																value={
																	calcomIntegration
																		.settings
																		.teamSlug
																}
																onChange={(event) =>
																	updateCalcomSetting(
																		"teamSlug",
																		event.target
																			.value
																	)
																}
															/>
														</div>
														<div className="space-y-1.5">
															<Label htmlFor="calcom-username">
																Username
															</Label>
															<Input
																id="calcom-username"
																placeholder="agent-name"
																value={
																	calcomIntegration
																		.settings
																		.username
																}
																onChange={(event) =>
																	updateCalcomSetting(
																		"username",
																		event.target
																			.value
																	)
																}
															/>
														</div>
														<div className="space-y-1.5">
															<Label htmlFor="calcom-org-slug">
																Organization Slug
															</Label>
															<Input
																id="calcom-org-slug"
																placeholder="acme-org"
																value={
																	calcomIntegration
																		.settings
																		.organizationSlug
																}
																onChange={(event) =>
																	updateCalcomSetting(
																		"organizationSlug",
																		event.target
																			.value
																	)
																}
															/>
														</div>
														<div className="space-y-1.5 md:col-span-2">
															<Label htmlFor="calcom-timezone">
																Default Timezone
															</Label>
															<Input
																id="calcom-timezone"
																placeholder="America/New_York"
																value={
																	calcomIntegration
																		.settings
																		.defaultTimeZone
																}
																onChange={(event) =>
																	updateCalcomSetting(
																		"defaultTimeZone",
																		event.target
																			.value
																	)
																}
															/>
														</div>
													</div>
													<div className="flex flex-wrap items-center justify-between gap-2">
														<p className="text-xs text-muted-foreground">
															Last updated:{" "}
															{calcomIntegration.updatedAt
																? new Date(
																		calcomIntegration.updatedAt
																	).toLocaleString()
																: "Never"}
														</p>
														<div className="flex gap-2">
															<Button
																variant="outline"
																onClick={
																	handleDisconnectCalcom
																}
																disabled={
																	isCalcomDisconnecting ||
																	!calcomIntegration.isConnected
																}
															>
																{isCalcomDisconnecting
																	? "Disconnecting..."
																	: "Disconnect"}
															</Button>
															<Button
																onClick={
																	handleSaveCalcom
																}
																disabled={
																	isCalcomSaving
																}
															>
																{isCalcomSaving
																	? "Saving..."
																	: "Save Cal.com"}
															</Button>
														</div>
													</div>
												</CardContent>
											</Card>

											{crmProviders.map((provider) => {
												const value =
													crmIntegrations[
														provider.id
													]
												return (
													<Card
														key={provider.id}
														className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm"
													>
														<CardHeader className="pb-4">
															<div className="flex items-center justify-between gap-3">
																<div>
																	<CardTitle className="text-lg">
																		{
																			provider.label
																		}
																	</CardTitle>
																	<CardDescription className="mt-1">
																		{
																			provider.description
																		}
																	</CardDescription>
																</div>
																<Badge
																	variant="outline"
																	className={
																		value.isConnected
																			? "bg-green-100 text-green-800 border-green-200"
																			: "bg-amber-100 text-amber-800 border-amber-200"
																	}
																>
																	{value.isConnected
																		? "Connected"
																		: "Not Connected"}
																</Badge>
															</div>
														</CardHeader>
														<CardContent className="space-y-4">
															<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
																<div className="space-y-1.5 md:col-span-2">
																	<Label
																		htmlFor={`${provider.id}-api-key`}
																	>
																		API Key / Access Token
																	</Label>
																	<Input
																		id={`${provider.id}-api-key`}
																		type="password"
																		placeholder="Paste token (leave blank to keep current)"
																		value={
																			value.apiKey
																		}
																		onChange={(
																			event
																		) =>
																			updateCRMApiKey(
																				provider.id,
																				event
																					.target
																					.value
																			)
																		}
																	/>
																</div>

																{provider.id ===
																	"salesforce" && (
																	<>
																		<div className="space-y-1.5">
																			<Label
																				htmlFor={`${provider.id}-instance-url`}
																			>
																				Instance URL
																			</Label>
																			<Input
																				id={`${provider.id}-instance-url`}
																				placeholder="https://your-org.my.salesforce.com"
																				value={
																					value
																						.settings
																						.instanceUrl
																				}
																				onChange={(
																					event
																				) =>
																					updateCRMSetting(
																						provider.id,
																						"instanceUrl",
																						event
																							.target
																							.value
																					)
																				}
																			/>
																		</div>
																		<div className="space-y-1.5">
																			<Label
																				htmlFor={`${provider.id}-api-version`}
																			>
																				API Version
																			</Label>
																			<Input
																				id={`${provider.id}-api-version`}
																				placeholder="v60.0"
																				value={
																					value
																						.settings
																						.apiVersion
																				}
																				onChange={(
																					event
																				) =>
																					updateCRMSetting(
																						provider.id,
																						"apiVersion",
																						event
																							.target
																							.value
																					)
																				}
																			/>
																		</div>
																		<div className="space-y-1.5 md:col-span-2">
																			<Label>
																				Import Object
																			</Label>
																			<Select
																				value={
																					value
																						.settings
																						.salesforceLeadObject
																				}
																				onValueChange={(
																					nextValue
																				) =>
																					updateCRMSetting(
																						provider.id,
																						"salesforceLeadObject",
																						nextValue
																					)
																				}
																			>
																				<SelectTrigger>
																					<SelectValue />
																				</SelectTrigger>
																				<SelectContent>
																					<SelectItem value="Lead">
																						Lead
																					</SelectItem>
																					<SelectItem value="Contact">
																						Contact
																					</SelectItem>
																				</SelectContent>
																			</Select>
																		</div>
																	</>
																)}

																{provider.id ===
																	"gohighlevel" && (
																	<div className="space-y-1.5 md:col-span-2">
																		<Label
																			htmlFor={`${provider.id}-location-id`}
																		>
																			Location ID
																		</Label>
																		<Input
																			id={`${provider.id}-location-id`}
																			placeholder="abc123"
																			value={
																				value
																					.settings
																					.locationId
																			}
																			onChange={(
																				event
																			) =>
																				updateCRMSetting(
																					provider.id,
																					"locationId",
																					event
																						.target
																						.value
																				)
																			}
																		/>
																	</div>
																)}

																{provider.id ===
																	"pipedrive" && (
																	<>
																		<div className="space-y-1.5">
																			<Label
																				htmlFor={`${provider.id}-api-domain`}
																			>
																				API Domain
																			</Label>
																			<Input
																				id={`${provider.id}-api-domain`}
																				placeholder="https://company.pipedrive.com"
																				value={
																					value
																						.settings
																						.apiDomain
																				}
																				onChange={(
																					event
																				) =>
																					updateCRMSetting(
																						provider.id,
																						"apiDomain",
																						event
																							.target
																							.value
																					)
																				}
																			/>
																		</div>
																		<div className="space-y-1.5">
																			<Label
																				htmlFor={`${provider.id}-company-domain`}
																			>
																				Company Domain
																			</Label>
																			<Input
																				id={`${provider.id}-company-domain`}
																				placeholder="company"
																				value={
																					value
																						.settings
																						.companyDomain
																				}
																				onChange={(
																					event
																				) =>
																					updateCRMSetting(
																						provider.id,
																						"companyDomain",
																						event
																							.target
																							.value
																					)
																				}
																			/>
																		</div>
																	</>
																)}
															</div>

															<div className="flex flex-wrap items-center justify-between gap-2">
																<p className="text-xs text-muted-foreground">
																	Linked leads:{" "}
																	{value.leadLinks} · Last
																	updated:{" "}
																	{value.updatedAt
																		? new Date(
																				value.updatedAt
																			).toLocaleString()
																		: "Never"}
																</p>
																<div className="flex gap-2">
																	<Button
																		variant="outline"
																		onClick={() =>
																			disconnectCRMProvider(
																				provider.id
																			)
																		}
																		disabled={
																			crmDisconnectingProvider ===
																				provider.id ||
																			!value.isConnected
																		}
																	>
																		{crmDisconnectingProvider ===
																		provider.id
																			? "Disconnecting..."
																			: "Disconnect"}
																	</Button>
																	<Button
																		onClick={() =>
																			saveCRMProvider(
																				provider.id
																			)
																		}
																		disabled={
																			crmSavingProvider ===
																			provider.id
																		}
																	>
																		{crmSavingProvider ===
																		provider.id
																			? "Saving..."
																			: "Save"}
																	</Button>
																</div>
															</div>
														</CardContent>
													</Card>
													)
												})}

											{telephonyProviders.map(
												(provider) => {
													const value =
														telephonyIntegrations[
															provider.id
														]
													return (
														<Card
															key={provider.id}
															className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm"
														>
															<CardHeader className="pb-4">
																<div className="flex items-center justify-between gap-3">
																	<div>
																		<CardTitle className="text-lg">
																			{
																				provider.label
																			}
																		</CardTitle>
																		<CardDescription className="mt-1">
																			{
																				provider.description
																			}
																		</CardDescription>
																	</div>
																	<Badge
																		variant="outline"
																		className={
																			value.isConnected
																				? "bg-green-100 text-green-800 border-green-200"
																				: "bg-amber-100 text-amber-800 border-amber-200"
																		}
																	>
																		{value.isConnected
																			? "Connected"
																			: "Not Connected"}
																	</Badge>
																</div>
															</CardHeader>
															<CardContent className="space-y-4">
																<div className="space-y-1.5">
																	<Label
																		htmlFor={`${provider.id}-secret`}
																	>
																		{provider.id ===
																		"vonage"
																			? "Private Key"
																			: "Secret / API Key"}
																	</Label>
																	{provider.id ===
																	"vonage" ? (
																		<Textarea
																			id={`${provider.id}-secret`}
																			placeholder="-----BEGIN PRIVATE KEY-----"
																			value={
																				value.apiKey
																			}
																			onChange={(
																				event
																			) =>
																				updateTelephonyApiKey(
																					provider.id,
																					event
																						.target
																						.value
																				)
																			}
																			rows={4}
																		/>
																	) : (
																		<Input
																			id={`${provider.id}-secret`}
																			type="password"
																			placeholder="Paste credential (leave blank to keep current)"
																			value={
																				value.apiKey
																			}
																			onChange={(
																				event
																			) =>
																				updateTelephonyApiKey(
																					provider.id,
																					event
																						.target
																						.value
																				)
																			}
																		/>
																	)}
																</div>

																<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
																	{provider.id ===
																		"twilio" && (
																		<>
																			<div className="space-y-1.5">
																				<Label
																					htmlFor="twilio-account-sid"
																				>
																					Account SID
																				</Label>
																				<Input
																					id="twilio-account-sid"
																					placeholder="AC..."
																					value={
																						value
																							.settings
																							.accountSid
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"twilio",
																							"accountSid",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="space-y-1.5">
																				<Label
																					htmlFor="twilio-from-number"
																				>
																					Default From Number
																				</Label>
																				<Input
																					id="twilio-from-number"
																					placeholder="+1..."
																					value={
																						value
																							.settings
																							.fromNumber
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"twilio",
																							"fromNumber",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="space-y-1.5">
																				<Label
																					htmlFor="twilio-twiml-url"
																				>
																					Outbound TwiML URL
																				</Label>
																				<Input
																					id="twilio-twiml-url"
																					placeholder="https://..."
																					value={
																						value
																							.settings
																							.outboundTwimlUrl
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"twilio",
																							"outboundTwimlUrl",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="space-y-1.5">
																				<Label
																					htmlFor="twilio-callback-url"
																				>
																					Status Callback URL
																				</Label>
																				<Input
																					id="twilio-callback-url"
																					placeholder="https://..."
																					value={
																						value
																							.settings
																							.statusCallbackUrl
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"twilio",
																							"statusCallbackUrl",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="md:col-span-2 flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
																				<div>
																					<p className="text-sm font-medium">
																						Record Calls
																					</p>
																					<p className="text-xs text-muted-foreground">
																						Enable provider-side recording by default.
																					</p>
																				</div>
																				<Switch
																					checked={
																						value
																							.settings
																							.recordCalls
																					}
																					onCheckedChange={(
																						checked
																					) =>
																						updateTelephonySetting(
																							"twilio",
																							"recordCalls",
																							checked
																						)
																					}
																				/>
																			</div>
																		</>
																	)}

																	{provider.id ===
																		"telnyx" && (
																		<>
																			<div className="space-y-1.5">
																				<Label htmlFor="telnyx-connection-id">
																					Connection ID
																				</Label>
																				<Input
																					id="telnyx-connection-id"
																					placeholder="123456789"
																					value={
																						value
																							.settings
																							.connectionId
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"telnyx",
																							"connectionId",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="space-y-1.5">
																				<Label htmlFor="telnyx-from-number">
																					Default From Number
																				</Label>
																				<Input
																					id="telnyx-from-number"
																					placeholder="+1..."
																					value={
																						value
																							.settings
																							.fromNumber
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"telnyx",
																							"fromNumber",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="space-y-1.5 md:col-span-2">
																				<Label htmlFor="telnyx-webhook-url">
																					Webhook URL
																				</Label>
																				<Input
																					id="telnyx-webhook-url"
																					placeholder="https://..."
																					value={
																						value
																							.settings
																							.webhookUrl
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"telnyx",
																							"webhookUrl",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																		</>
																	)}

																	{provider.id ===
																		"vonage" && (
																		<>
																			<div className="space-y-1.5">
																				<Label htmlFor="vonage-application-id">
																					Application ID
																				</Label>
																				<Input
																					id="vonage-application-id"
																					placeholder="application-id"
																					value={
																						value
																							.settings
																							.applicationId
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"vonage",
																							"applicationId",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="space-y-1.5">
																				<Label htmlFor="vonage-from-number">
																					Default From Number
																				</Label>
																				<Input
																					id="vonage-from-number"
																					placeholder="+1..."
																					value={
																						value
																							.settings
																							.fromNumber
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"vonage",
																							"fromNumber",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="space-y-1.5">
																				<Label htmlFor="vonage-answer-url">
																					Answer URL
																				</Label>
																				<Input
																					id="vonage-answer-url"
																					placeholder="https://..."
																					value={
																						value
																							.settings
																							.answerUrl
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"vonage",
																							"answerUrl",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																			<div className="space-y-1.5">
																				<Label htmlFor="vonage-event-url">
																					Event URL
																				</Label>
																				<Input
																					id="vonage-event-url"
																					placeholder="https://..."
																					value={
																						value
																							.settings
																							.eventUrl
																					}
																					onChange={(
																						event
																					) =>
																						updateTelephonySetting(
																							"vonage",
																							"eventUrl",
																							event
																								.target
																								.value
																						)
																					}
																				/>
																			</div>
																		</>
																	)}
																</div>

																<div className="flex flex-wrap items-center justify-between gap-2">
																	<p className="text-xs text-muted-foreground">
																		Last updated:{" "}
																		{value.updatedAt
																			? new Date(
																					value.updatedAt
																				).toLocaleString()
																			: "Never"}
																	</p>
																	<div className="flex gap-2">
																		<Button
																			variant="outline"
																			onClick={() =>
																				disconnectTelephonyProvider(
																					provider.id
																				)
																			}
																			disabled={
																				telephonyDisconnectingProvider ===
																					provider.id ||
																				!value.isConnected
																			}
																		>
																			{telephonyDisconnectingProvider ===
																			provider.id
																				? "Disconnecting..."
																				: "Disconnect"}
																		</Button>
																		<Button
																			onClick={() =>
																				saveTelephonyProvider(
																					provider.id
																				)
																			}
																			disabled={
																				telephonySavingProvider ===
																				provider.id
																			}
																		>
																			{telephonySavingProvider ===
																			provider.id
																				? "Saving..."
																				: "Save"}
																		</Button>
																	</div>
																</div>
															</CardContent>
														</Card>
													)
												}
											)}
										</>
									)}
								</div>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
