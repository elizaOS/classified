/**
 * Webhook Event Deduplication Service
 * Prevents duplicate webhook processing and implements security measures
 */

import { getDatabase } from '../database/connection';
import { auditLogs } from '../database/schema';
import { eq, and, gte } from 'drizzle-orm';

interface WebhookEvent {
  id: string;
  type: string;
  createdAt: number;
  organizationId?: string;
  data: Record<string, any>;
}

export class WebhookDeduplicationService {
  private static readonly EVENT_EXPIRY_HOURS = 24;

  /**
   * Check if webhook event has already been processed
   */
  static async isEventProcessed(eventId: string): Promise<boolean> {
    const db = getDatabase();

    try {
      const existingEvent = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.requestId, eventId),
            eq(auditLogs.action, 'webhook_processed'),
          ),
        )
        .limit(1);

      return existingEvent.length > 0;
    } catch (error) {
      console.error('Failed to check event processing status:', error);
      // In case of error, allow processing to continue but log the issue
      return false;
    }
  }

  /**
   * Mark webhook event as processed
   */
  static async markEventProcessed(
    event: WebhookEvent,
    processingResult: { success: boolean; error?: string },
  ): Promise<void> {
    const db = getDatabase();

    try {
      await db.insert(auditLogs).values({
        organizationId: event.organizationId!,
        userId: null,
        action: 'webhook_processed',
        resource: 'stripe_webhook',
        resourceId: event.id,
        requestId: event.id,
        metadata: {
          eventType: event.type,
          eventCreatedAt: event.createdAt,
          processingSuccess: processingResult.success,
          processingError: processingResult.error,
          eventData: event.data,
        },
      });
    } catch (error) {
      console.error('Failed to mark event as processed:', error);
      // Don't throw error here as the main webhook processing was successful
    }
  }

  /**
   * Clean up old webhook events to prevent database bloat
   */
  static async cleanupOldEvents(): Promise<void> {
    const db = getDatabase();

    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - this.EVENT_EXPIRY_HOURS);

      const deleted = await db
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.action, 'webhook_processed'),
            gte(auditLogs.createdAt, cutoffDate),
          ),
        );

      console.log(`Cleaned up old webhook events: ${deleted} records removed`);
    } catch (error) {
      console.error('Failed to cleanup old webhook events:', error);
    }
  }

  /**
   * Validate webhook event structure and timing
   */
  static validateWebhookEvent(event: WebhookEvent): {
    valid: boolean;
    reason?: string;
  } {
    // Check if event is too old (replay attack protection)
    const eventAge = Date.now() / 1000 - event.createdAt;
    const MAX_EVENT_AGE = 300; // 5 minutes

    if (eventAge > MAX_EVENT_AGE) {
      return {
        valid: false,
        reason: `Event is too old: ${eventAge} seconds (max: ${MAX_EVENT_AGE})`,
      };
    }

    // Check if event is from the future (clock skew protection)
    if (eventAge < -60) {
      // Allow 1 minute clock skew
      return {
        valid: false,
        reason: `Event is from the future: ${eventAge} seconds`,
      };
    }

    // Validate required fields
    if (!event.id || !event.type) {
      return {
        valid: false,
        reason: 'Missing required event fields (id, type)',
      };
    }

    return { valid: true };
  }

  /**
   * Process webhook with deduplication and error handling
   */
  static async processWebhookSafely<T>(
    event: WebhookEvent,
    processor: () => Promise<T>,
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      // Validate event
      const validation = this.validateWebhookEvent(event);
      if (!validation.valid) {
        throw new Error(`Invalid webhook event: ${validation.reason}`);
      }

      // Check for duplicate processing
      const isProcessed = await this.isEventProcessed(event.id);
      if (isProcessed) {
        console.log(`Webhook event ${event.id} already processed, skipping`);
        return { success: true };
      }

      // Process the webhook
      const result = await processor();

      // Mark as successfully processed
      await this.markEventProcessed(event, { success: true });

      return { success: true, result };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `Failed to process webhook event ${event.id}:`,
        errorMessage,
      );

      // Mark as failed
      await this.markEventProcessed(event, {
        success: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get webhook processing statistics
   */
  static async getProcessingStats(organizationId?: string): Promise<{
    totalProcessed: number;
    successfullyProcessed: number;
    failedProcessed: number;
    recentErrors: Array<{ eventId: string; error: string; timestamp: Date }>;
  }> {
    const db = getDatabase();

    try {
      const conditions = [eq(auditLogs.action, 'webhook_processed')];
      if (organizationId) {
        conditions.push(eq(auditLogs.organizationId, organizationId));
      }

      const events = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(auditLogs.createdAt);

      const totalProcessed = events.length;
      const successfullyProcessed = events.filter(
        (e: any) => e.metadata?.processingSuccess === true,
      ).length;
      const failedProcessed = totalProcessed - successfullyProcessed;

      const recentErrors = events
        .filter((e: any) => e.metadata?.processingSuccess === false)
        .slice(-10) // Last 10 errors
        .map((e: any) => ({
          eventId: e.requestId || 'unknown',
          error: e.metadata?.processingError || 'Unknown error',
          timestamp: e.createdAt,
        }));

      return {
        totalProcessed,
        successfullyProcessed,
        failedProcessed,
        recentErrors,
      };
    } catch (error) {
      console.error('Failed to get webhook processing stats:', error);
      throw new Error('Failed to get webhook processing statistics');
    }
  }
}
