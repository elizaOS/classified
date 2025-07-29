import * as CryptoJS from 'crypto-js';

export class SecurityManager {
  private static readonly ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || 'default-key';
  private static readonly MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private static readonly RATE_LIMIT_MAX_REQUESTS = 100;

  private requestCounts = new Map<string, { count: number; window: number }>();

  // Input sanitization
  static sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  // Rate limiting
  checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requestCounts.get(identifier);

    if (
      !userRequests ||
      now - userRequests.window > SecurityManager.RATE_LIMIT_WINDOW
    ) {
      this.requestCounts.set(identifier, { count: 1, window: now });
      return true;
    }

    if (userRequests.count >= SecurityManager.RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    userRequests.count++;
    return true;
  }

  // Content validation
  static validateContentSize(content: any): boolean {
    const size = new Blob([JSON.stringify(content)]).size;
    return size <= SecurityManager.MAX_REQUEST_SIZE;
  }

  // Token encryption for storage
  static encryptToken(token: string): string {
    return CryptoJS.AES.encrypt(
      token,
      SecurityManager.ENCRYPTION_KEY,
    ).toString();
  }

  static decryptToken(encryptedToken: string): string {
    const bytes = CryptoJS.AES.decrypt(
      encryptedToken,
      SecurityManager.ENCRYPTION_KEY,
    );
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // CSP header generation
  static generateCSP(): string {
    const nonce = CryptoJS.lib.WordArray.random(128 / 8).toString();
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Needed for Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https: wss:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }
}

export const security = new SecurityManager();
