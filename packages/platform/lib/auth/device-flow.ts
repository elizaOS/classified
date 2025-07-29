/**
 * Device Flow Service
 * Implements OAuth 2.0 Device Authorization Grant (RFC 8628)
 * Provides high-level API for device authentication flow
 */

import { v4 as uuidv4 } from 'uuid';
import { deviceCodeRepository } from '@/lib/database/repositories/device-code';
import { oauthClientRepository } from '@/lib/database/repositories/oauth-client';
import { generateApiKey } from '@/lib/api/auth';
import type { DeviceCode } from '@/lib/database/schema';

/**
 * Generate a human-friendly user code
 * Format: XXXX-XXXX (8 characters, uppercase letters and numbers)
 */
function generateUserCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

/**
 * Generate a secure device code
 */
function generateDeviceCode(): string {
  return `dc_${uuidv4().replace(/-/g, '')}`;
}

export interface DeviceAuthResult {
  device_code: string;
  user_code: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface AuthCheckResult {
  success: boolean;
  error?: string;
  data?: {
    access_token: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
}

export class DeviceFlowService {
  private readonly DEFAULT_EXPIRY = 600; // 10 minutes
  private readonly DEFAULT_INTERVAL = 5; // 5 seconds

  /**
   * Create a new device authorization request
   */
  async createDeviceAuth(
    clientId: string,
    scope: string,
    expiresIn?: number,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<DeviceAuthResult> {
    // Validate client exists
    const clientValidation = await oauthClientRepository.validateClient(
      clientId,
      'device_code',
    );

    if (!clientValidation.isValid) {
      throw new Error('Invalid client');
    }

    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const expirySeconds = expiresIn || this.DEFAULT_EXPIRY;
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    // Create the device code record
    await deviceCodeRepository.create({
      deviceCode,
      userCode,
      clientId,
      scope,
      expiresAt,
      interval: this.DEFAULT_INTERVAL,
      isAuthorized: false,
      userAgent,
      ipAddress,
    });

    return {
      device_code: deviceCode,
      user_code: userCode,
      expires_in: expirySeconds,
      interval: this.DEFAULT_INTERVAL,
    };
  }

  /**
   * Check if a user code is valid
   */
  async isUserCodeValid(userCode: string): Promise<boolean> {
    return await deviceCodeRepository.isUserCodeValid(userCode);
  }

  /**
   * Authorize a device by user code
   */
  async authorizeDevice(
    userCode: string,
    userId: string,
    userInfo: { id: string; name: string; email: string },
  ): Promise<{ success: boolean; error?: string }> {
    // Get the device code record
    const deviceCodeRecord = await deviceCodeRepository.getByUserCode(userCode);

    if (!deviceCodeRecord) {
      return { success: false, error: 'Invalid user code' };
    }

    // Check if expired
    if (deviceCodeRecord.expiresAt < new Date()) {
      return { success: false, error: 'User code expired' };
    }

    // Check if already authorized
    if (deviceCodeRecord.isAuthorized) {
      return { success: false, error: 'Already authorized' };
    }

    // Generate access token for the device
    const accessToken = generateApiKey();

    // Authorize the device code
    const authorized = await deviceCodeRepository.authorize(
      deviceCodeRecord.deviceCode,
      userId,
      accessToken,
    );

    if (!authorized) {
      return { success: false, error: 'Authorization failed' };
    }

    return { success: true };
  }

  /**
   * Check device authorization status (polling endpoint)
   */
  async checkDeviceAuth(deviceCode: string): Promise<AuthCheckResult> {
    // Get the device code record with user info
    const deviceCodeRecord =
      await deviceCodeRepository.getByDeviceCodeWithUser(deviceCode);

    if (!deviceCodeRecord) {
      return { success: false, error: 'invalid_grant' };
    }

    // Check if expired
    if (deviceCodeRecord.expiresAt < new Date()) {
      // Clean up expired code
      await deviceCodeRepository.delete(deviceCode);
      return { success: false, error: 'expired_token' };
    }

    // Check if not yet authorized
    if (!deviceCodeRecord.isAuthorized) {
      return { success: false, error: 'authorization_pending' };
    }

    // Device is authorized - return the access token
    const accessToken = deviceCodeRecord.accessToken;
    const user = deviceCodeRecord.user;

    if (!accessToken || !user) {
      return { success: false, error: 'invalid_grant' };
    }

    // Delete the device code after successful token exchange
    await deviceCodeRepository.delete(deviceCode);

    return {
      success: true,
      data: {
        access_token: accessToken,
        user: {
          id: user.id,
          name: user.name || '',
          email: user.email || '',
        },
      },
    };
  }

  /**
   * Clean up expired device codes (maintenance task)
   */
  async cleanupExpiredCodes(): Promise<number> {
    return await deviceCodeRepository.cleanupExpired();
  }

  /**
   * Get device flow statistics
   */
  async getStats() {
    return await deviceCodeRepository.getStats();
  }
}

// Export singleton instance
export const deviceFlowService = new DeviceFlowService();
