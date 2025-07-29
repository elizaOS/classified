/**
 * NextAuth configuration - compatibility layer for ElizaOS
 * This provides a NextAuth-compatible interface for our custom WorkOS auth system
 */

import { NextAuthOptions } from 'next-auth';
import { sessionService } from './session';

// Mock NextAuth configuration that redirects to our custom auth system
export const authOptions: NextAuthOptions = {
  providers: [],

  callbacks: {
    async session({ session, token }) {
      // This shouldn't be called since we're using custom auth
      return session;
    },

    async jwt({ token, user }) {
      // This shouldn't be called since we're using custom auth
      return token;
    },
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
  },

  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
};

/**
 * Get server session - compatibility function for NextAuth's getServerSession
 * This is a wrapper around our custom session service
 */
export async function getServerSession(options?: NextAuthOptions) {
  try {
    const sessionData = await sessionService.getSessionFromCookies();

    if (!sessionData) {
      return null;
    }

    // Return session in NextAuth format
    return {
      user: {
        id: sessionData.userId,
        email: sessionData.email,
        organizationId: sessionData.organizationId,
        role: sessionData.role,
        isAdmin: sessionData.isAdmin,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
  } catch (error) {
    console.error('Failed to get server session:', error);
    return null;
  }
}

// Re-export for compatibility
export { getServerSession as getSession };
