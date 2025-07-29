import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production',
);

export interface UserJWTPayload {
  sub: string; // user id
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createJWT(payload: UserJWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<UserJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (
      payload.sub &&
      typeof payload.email === 'string' &&
      typeof payload.name === 'string'
    ) {
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export function generateApiKey(): string {
  const prefix = 'sk_live_';
  const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(32)));
  const randomString = randomBytes
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return prefix + randomString;
}
