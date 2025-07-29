/**
 * Billing Settings API Route
 * Manages billing preferences and payment methods for organizations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);
const getDatabase = () => import('@/lib/database').then((m) => m.getDatabase);
const getSchemas = () => import('@/lib/database/schema').then((m) => m);

// Validation schema for billing settings update
const updateBillingSettingsSchema = z.object({
  billingEmail: z.string().email().optional(),
  paymentMethod: z
    .object({
      type: z.enum(['card', 'bank', 'crypto']),
      isDefault: z.boolean().optional(),
    })
    .optional(),
  invoiceSettings: z
    .object({
      companyName: z.string().max(200).optional(),
      taxId: z.string().max(50).optional(),
      address: z
        .object({
          line1: z.string().max(200),
          line2: z.string().max(200).optional(),
          city: z.string().max(100),
          state: z.string().max(100).optional(),
          postalCode: z.string().max(20),
          country: z.string().length(2), // ISO country code
        })
        .optional(),
    })
    .optional(),
  notifications: z
    .object({
      lowCredits: z.boolean().optional(),
      transactions: z.boolean().optional(),
      invoices: z.boolean().optional(),
    })
    .optional(),
});

/**
 * GET /api/billing/settings - Get billing settings
 */
async function handleGET(request: NextRequest) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Get organization data
    const db = await (await getDatabase())();
    const { organizations } = await getSchemas();
    const { eq } = await import('drizzle-orm');

    const [organization] = await db
      .select({
        billingEmail: organizations.billingEmail,
        stripeCustomerId: organizations.stripeCustomerId,
      })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    // Return current billing settings (simplified)
    return NextResponse.json({
      success: true,
      data: {
        billingEmail: organization?.billingEmail || user.email,
        hasPaymentMethod: !!organization?.stripeCustomerId,
        notifications: {
          lowCredits: true,
          transactions: true,
          invoices: true,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching billing settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch billing settings',
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/billing/settings - Update billing settings
 */
async function handlePUT(request: NextRequest) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Check if user has permission to update billing settings
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Only organization owners and admins can update billing settings',
        },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateBillingSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    // Update organization with new billing email if provided
    if (validation.data.billingEmail) {
      const db = await (await getDatabase())();
      const { organizations } = await getSchemas();
      const { eq } = await import('drizzle-orm');

      await db
        .update(organizations)
        .set({
          billingEmail: validation.data.billingEmail,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, user.organizationId));
    }

    // Return updated settings (simplified)
    return NextResponse.json({
      success: true,
      data: {
        billingEmail: validation.data.billingEmail || user.email,
        message: 'Billing settings updated successfully',
      },
    });
  } catch (error) {
    console.error('Error updating billing settings:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Stripe')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Payment service unavailable',
          },
          { status: 503 },
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update billing settings',
      },
      { status: 500 },
    );
  }
}

// Export with security headers and authentication
export const { GET, PUT } = wrapHandlers({ handleGET, handlePUT });
