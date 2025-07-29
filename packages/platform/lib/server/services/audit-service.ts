import { eq, desc } from 'drizzle-orm';
import { getDatabase } from '@/lib/database';
import { auditLogs, type NewAuditLog } from '@/lib/database/schema';

interface AuditLogData {
  organizationId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string;
  metadata?: Record<string, any>;
}

export async function auditLog(data: AuditLogData): Promise<void> {
  try {
    const auditEntry: NewAuditLog = {
      organizationId: data.organizationId,
      userId: data.userId || null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId || null,
      oldValues: data.oldValues || null,
      newValues: data.newValues || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      requestId: data.requestId || null,
      metadata: data.metadata || {},
    };

    const db = await getDatabase();
    await db.insert(auditLogs).values(auditEntry);
  } catch (error) {
    // Log audit failures but don't throw - we don't want audit failures to break the main flow
    console.error('Failed to create audit log:', error);
  }
}

export async function getAuditLogs(
  organizationId: string,
  options: {
    userId?: string;
    resource?: string;
    action?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {},
) {
  const { limit = 100, offset = 0 } = options;

  // This would need proper filtering implementation based on options
  // For now, returning basic query structure
  const db = await getDatabase();
  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}
