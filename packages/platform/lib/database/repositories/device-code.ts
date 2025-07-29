/**
 * Device Code Repository for OAuth 2.0 Device Flow
 * Handles persistent storage of device authorization codes
 */

import { eq, and, lt, gte } from 'drizzle-orm';
import { getDatabase } from '../index';
import {
  deviceCodes,
  users,
  type DeviceCode,
  type NewDeviceCode,
} from '../schema';

export class DeviceCodeRepository {
  private async getDb() {
    return await getDatabase();
  }

  /**
   * Create a new device authorization request
   */
  async create(data: NewDeviceCode): Promise<DeviceCode> {
    const db = await this.getDb();
    const [deviceCode] = await db.insert(deviceCodes).values(data).returning();

    return deviceCode;
  }

  /**
   * Get device code by device_code
   */
  async getByDeviceCode(deviceCode: string): Promise<DeviceCode | null> {
    const db = await this.getDb();
    const [result] = await db
      .select()
      .from(deviceCodes)
      .where(eq(deviceCodes.deviceCode, deviceCode))
      .limit(1);

    return result || null;
  }

  /**
   * Get device code by user_code
   */
  async getByUserCode(userCode: string): Promise<DeviceCode | null> {
    const db = await this.getDb();
    const [result] = await db
      .select()
      .from(deviceCodes)
      .where(eq(deviceCodes.userCode, userCode))
      .limit(1);

    return result || null;
  }

  /**
   * Authorize a device code
   */
  async authorize(
    deviceCode: string,
    userId: string,
    accessToken: string,
  ): Promise<boolean> {
    const db = await this.getDb();
    const result = await db
      .update(deviceCodes)
      .set({
        isAuthorized: true,
        authorizedAt: new Date(),
        authorizedByUserId: userId,
        accessToken,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deviceCodes.deviceCode, deviceCode),
          eq(deviceCodes.isAuthorized, false),
          gte(deviceCodes.expiresAt, new Date()), // Still valid
        ),
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Delete a device code (after token exchange or expiration)
   */
  async delete(deviceCode: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db
      .delete(deviceCodes)
      .where(eq(deviceCodes.deviceCode, deviceCode))
      .returning();

    return result.length > 0;
  }

  /**
   * Clean up expired device codes
   */
  async cleanupExpired(): Promise<number> {
    const db = await this.getDb();
    const result = await db
      .delete(deviceCodes)
      .where(lt(deviceCodes.expiresAt, new Date()))
      .returning();

    return result.length;
  }

  /**
   * Get device code with user information (for authorization display)
   */
  async getByUserCodeWithUser(
    userCode: string,
  ): Promise<(DeviceCode & { user?: any }) | null> {
    const db = await this.getDb();
    const [result] = await db
      .select({
        deviceCode: deviceCodes,
        user: users,
      })
      .from(deviceCodes)
      .leftJoin(users, eq(deviceCodes.authorizedByUserId, users.id))
      .where(eq(deviceCodes.userCode, userCode))
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      ...result.deviceCode,
      user: result.user,
    };
  }

  /**
   * Get device code with user information by device code
   */
  async getByDeviceCodeWithUser(
    deviceCode: string,
  ): Promise<(DeviceCode & { user?: any }) | null> {
    const db = await this.getDb();
    const [result] = await db
      .select({
        deviceCode: deviceCodes,
        user: users,
      })
      .from(deviceCodes)
      .leftJoin(users, eq(deviceCodes.authorizedByUserId, users.id))
      .where(eq(deviceCodes.deviceCode, deviceCode))
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      ...result.deviceCode,
      user: result.user,
    };
  }

  /**
   * Check if a user code is valid and not expired
   */
  async isUserCodeValid(userCode: string): Promise<boolean> {
    const db = await this.getDb();
    const [result] = await db
      .select({ id: deviceCodes.id })
      .from(deviceCodes)
      .where(
        and(
          eq(deviceCodes.userCode, userCode),
          gte(deviceCodes.expiresAt, new Date()),
          eq(deviceCodes.isAuthorized, false),
        ),
      )
      .limit(1);

    return !!result;
  }

  /**
   * Get statistics for monitoring
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    authorized: number;
    expired: number;
  }> {
    const now = new Date();

    const db = await this.getDb();
    const [stats] = await db
      .select({
        total: deviceCodes.id,
        active: deviceCodes.isAuthorized,
        authorized: deviceCodes.authorizedAt,
        expired: deviceCodes.expiresAt,
      })
      .from(deviceCodes);

    // This is a simplified version - in reality you'd use proper aggregation
    // For now, we'll do individual queries for accuracy
    const [totalResult] = await db.select().from(deviceCodes);
    const [activeResult] = await db
      .select()
      .from(deviceCodes)
      .where(
        and(
          gte(deviceCodes.expiresAt, now),
          eq(deviceCodes.isAuthorized, false),
        ),
      );
    const [authorizedResult] = await db
      .select()
      .from(deviceCodes)
      .where(eq(deviceCodes.isAuthorized, true));
    const [expiredResult] = await db
      .select()
      .from(deviceCodes)
      .where(lt(deviceCodes.expiresAt, now));

    return {
      total: totalResult ? 1 : 0, // Simplified for now
      active: activeResult ? 1 : 0,
      authorized: authorizedResult ? 1 : 0,
      expired: expiredResult ? 1 : 0,
    };
  }
}

// Export singleton instance
export const deviceCodeRepository = new DeviceCodeRepository();
