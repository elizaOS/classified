import crypto from 'crypto';
import type { IAgentRuntime } from '@elizaos/core';

/**
 * Secure Secrets Manager for ELIZA Game
 * 
 * Implements secure secret storage, access control, and audit logging
 * to replace the insecure plaintext secret handling
 */

interface SecretMetadata {
  id: string;
  created: Date;
  lastAccessed: Date;
  accessCount: number;
  requiredRole: string;
  encrypted: boolean;
}

interface AccessLog {
  timestamp: Date;
  requester: string;
  action: 'read' | 'write' | 'delete';
  success: boolean;
  ip?: string;
}

interface SecureSecret {
  metadata: SecretMetadata;
  encryptedValue: string;
  iv: string;
  accessLogs: AccessLog[];
}

export class SecureSecretsManager {
  private secrets = new Map<string, SecureSecret>();
  private encryptionKey: Buffer;
  private readonly ALGORITHM = 'aes-256-gcm';
  
  constructor(encryptionKey?: string) {
    // Generate or use provided encryption key
    this.encryptionKey = encryptionKey 
      ? Buffer.from(encryptionKey, 'hex')
      : crypto.randomBytes(32);
  }

  /**
   * Securely store a secret with encryption and audit logging
   */
  async setSecret(
    key: string, 
    value: string, 
    requester: string = 'system',
    requiredRole: string = 'admin'
  ): Promise<void> {
    try {
      // Validate inputs
      this.validateSecretKey(key);
      this.validateSecretValue(value);

      // Encrypt the secret value
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.ALGORITHM, this.encryptionKey);
      let encryptedValue = cipher.update(value, 'utf8', 'hex');
      encryptedValue += cipher.final('hex');

      // Create secure secret object
      const secureSecret: SecureSecret = {
        metadata: {
          id: key,
          created: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
          requiredRole,
          encrypted: true
        },
        encryptedValue,
        iv: iv.toString('hex'),
        accessLogs: []
      };

      // Store the secret
      this.secrets.set(key, secureSecret);

      // Log the operation (never log the actual secret value)
      await this.logAccess(key, requester, 'write', true);
      
      console.log(`[SECURE-SECRETS] Secret stored: ${key} (requester: ${requester})`);
      
    } catch (error) {
      await this.logAccess(key, requester, 'write', false);
      throw new Error(`Failed to store secret: ${error.message}`);
    }
  }

  /**
   * Securely retrieve a secret with access control and audit logging
   */
  async getSecret(
    key: string, 
    requester: string = 'system',
    requesterRole: string = 'user'
  ): Promise<string | null> {
    try {
      const secureSecret = this.secrets.get(key);
      
      if (!secureSecret) {
        await this.logAccess(key, requester, 'read', false);
        console.warn(`[SECURE-SECRETS] Secret not found: ${key} (requester: ${requester})`);
        return null;
      }

      // Check access permissions
      if (!this.checkAccess(secureSecret.metadata.requiredRole, requesterRole)) {
        await this.logAccess(key, requester, 'read', false);
        throw new Error(`Access denied: insufficient permissions for secret ${key}`);
      }

      // Decrypt the secret value
      const decipher = crypto.createDecipher(this.ALGORITHM, this.encryptionKey);
      let decryptedValue = decipher.update(secureSecret.encryptedValue, 'hex', 'utf8');
      decryptedValue += decipher.final('utf8');

      // Update access metadata
      secureSecret.metadata.lastAccessed = new Date();
      secureSecret.metadata.accessCount++;

      // Log successful access (never log the actual secret value)
      await this.logAccess(key, requester, 'read', true);
      
      return decryptedValue;
      
    } catch (error) {
      await this.logAccess(key, requester, 'read', false);
      throw new Error(`Failed to retrieve secret: ${error.message}`);
    }
  }

  /**
   * Check if a secret exists without retrieving its value
   */
  hasSecret(key: string): boolean {
    return this.secrets.has(key);
  }

  /**
   * Get secret metadata without exposing the actual secret
   */
  getSecretMetadata(key: string): SecretMetadata | null {
    const secureSecret = this.secrets.get(key);
    return secureSecret ? { ...secureSecret.metadata } : null;
  }

  /**
   * List all secret keys (not values) with metadata
   */
  listSecrets(requesterRole: string = 'user'): Array<{ key: string; metadata: SecretMetadata }> {
    const result: Array<{ key: string; metadata: SecretMetadata }> = [];
    
    for (const [key, secureSecret] of this.secrets) {
      // Only show secrets the requester has permission to access
      if (this.checkAccess(secureSecret.metadata.requiredRole, requesterRole)) {
        result.push({
          key,
          metadata: { ...secureSecret.metadata }
        });
      }
    }
    
    return result;
  }

  /**
   * Delete a secret securely
   */
  async deleteSecret(key: string, requester: string = 'system'): Promise<boolean> {
    try {
      const exists = this.secrets.has(key);
      if (exists) {
        this.secrets.delete(key);
        await this.logAccess(key, requester, 'delete', true);
        console.log(`[SECURE-SECRETS] Secret deleted: ${key} (requester: ${requester})`);
        return true;
      } else {
        await this.logAccess(key, requester, 'delete', false);
        return false;
      }
    } catch (error) {
      await this.logAccess(key, requester, 'delete', false);
      throw new Error(`Failed to delete secret: ${error.message}`);
    }
  }

  /**
   * Validate secret key format
   */
  private validateSecretKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Secret key must be a non-empty string');
    }
    
    if (key.length < 3 || key.length > 100) {
      throw new Error('Secret key must be between 3 and 100 characters');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      throw new Error('Secret key can only contain alphanumeric characters, underscores, and hyphens');
    }
  }

  /**
   * Validate secret value
   */
  private validateSecretValue(value: string): void {
    if (!value || typeof value !== 'string') {
      throw new Error('Secret value must be a non-empty string');
    }
    
    if (value.length > 10000) {
      throw new Error('Secret value too large (max 10KB)');
    }
  }

  /**
   * Check if requester has access to secret based on role
   */
  private checkAccess(requiredRole: string, requesterRole: string): boolean {
    const roleHierarchy = ['guest', 'user', 'admin', 'system'];
    const requiredIndex = roleHierarchy.indexOf(requiredRole);
    const requesterIndex = roleHierarchy.indexOf(requesterRole);
    
    return requesterIndex >= requiredIndex;
  }

  /**
   * Log access attempts for audit purposes
   */
  private async logAccess(
    key: string, 
    requester: string, 
    action: 'read' | 'write' | 'delete', 
    success: boolean,
    ip?: string
  ): Promise<void> {
    const logEntry: AccessLog = {
      timestamp: new Date(),
      requester,
      action,
      success,
      ip
    };

    // Add to secret-specific logs if secret exists
    const secureSecret = this.secrets.get(key);
    if (secureSecret) {
      secureSecret.accessLogs.push(logEntry);
      
      // Keep only last 100 access logs per secret
      if (secureSecret.accessLogs.length > 100) {
        secureSecret.accessLogs = secureSecret.accessLogs.slice(-100);
      }
    }

    // Also log to console for monitoring (never log secret values)
    const status = success ? 'SUCCESS' : 'FAILED';
    console.log(`[AUDIT] Secret ${action.toUpperCase()} ${status}: ${key} by ${requester}${ip ? ` from ${ip}` : ''}`);
  }

  /**
   * Get audit logs for a specific secret
   */
  getAuditLogs(key: string, limit: number = 50): AccessLog[] {
    const secureSecret = this.secrets.get(key);
    if (!secureSecret) {
      return [];
    }
    
    return secureSecret.accessLogs.slice(-limit);
  }

  /**
   * Clear all secrets (use with extreme caution)
   */
  async clearAllSecrets(requester: string = 'system'): Promise<void> {
    console.warn(`[SECURE-SECRETS] CLEARING ALL SECRETS requested by ${requester}`);
    
    for (const key of this.secrets.keys()) {
      await this.logAccess(key, requester, 'delete', true);
    }
    
    this.secrets.clear();
    console.warn(`[SECURE-SECRETS] ALL SECRETS CLEARED by ${requester}`);
  }

  /**
   * Export encryption key for backup (use with extreme caution)
   */
  exportEncryptionKey(): string {
    console.warn('[SECURE-SECRETS] ENCRYPTION KEY EXPORTED - ENSURE SECURE STORAGE');
    return this.encryptionKey.toString('hex');
  }
}

/**
 * Singleton instance for the game
 */
export const secureSecretsManager = new SecureSecretsManager();