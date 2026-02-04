export interface Lead {
	id: number
	name: string
	email: string | null
	phone: string | null
	score: number
	status: "new" | "contacted" | "qualified" | "converted" | "lost"
	source: string | null
	notes: string | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

export interface Appointment {
	id: number
	leadId: number
	title: string
	description: string | null
	startTime: string | Date
	endTime: string | Date
	location: string | null
	completed: boolean
	notes: string | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

export interface Call {
	id: number
	leadId: number
	type: "incoming" | "outgoing"
	duration: number | null
	startTime: string | Date
	summary: string | null
	transcript: string | null
	recordingUrl: string | null
	status: string | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

export interface TextMessage {
	id: number
	leadId: number
	type: "incoming" | "outgoing"
	content: string
	sentAt: string | Date
	deliveredAt: string | Date | null
	readAt: string | Date | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

export interface LeadDetailData {
	lead: Lead
	appointments: Appointment[]
	calls: Call[]
	textMessages: TextMessage[]
}
