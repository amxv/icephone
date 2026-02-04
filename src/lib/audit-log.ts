"use server"

import { db_ws } from "@/db"
import { auditLogs } from "@/db/schema"

export interface AuditLogInput {
	teamId: string
	actorUserId: string
	action: string
	entityType: string
	entityId?: string | number | null
	metadata?: Record<string, unknown> | null
}

export async function logAuditEvent({
	teamId,
	actorUserId,
	action,
	entityType,
	entityId,
	metadata
}: AuditLogInput) {
	await db_ws.insert(auditLogs).values({
		teamId,
		actorUserId,
		action,
		entityType,
		entityId: entityId != null ? String(entityId) : null,
		metadata: metadata ?? {},
		createdAt: new Date()
	})
}
