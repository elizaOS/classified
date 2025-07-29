/**
 * Permission management for role-based access control
 */

import type { User } from '@/lib/database/schema';

export type UserRole = 'owner' | 'admin' | 'member' | 'guest';

export interface Permission {
  resource: string;
  actions: string[];
}

// Define permissions for each role
const rolePermissions: Record<UserRole, Permission[]> = {
  owner: [
    {
      resource: 'organization',
      actions: ['create', 'read', 'update', 'delete'],
    },
    { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'api_keys', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'agents', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'billing', actions: ['read', 'update'] },
    { resource: 'settings', actions: ['read', 'update'] },
  ],
  admin: [
    { resource: 'organization', actions: ['read', 'update'] },
    { resource: 'users', actions: ['create', 'read', 'update'] },
    { resource: 'api_keys', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'agents', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'billing', actions: ['read'] },
    { resource: 'settings', actions: ['read', 'update'] },
  ],
  member: [
    { resource: 'organization', actions: ['read'] },
    { resource: 'users', actions: ['read'] },
    { resource: 'api_keys', actions: ['create', 'read', 'update'] },
    { resource: 'agents', actions: ['create', 'read', 'update'] },
    { resource: 'billing', actions: [] },
    { resource: 'settings', actions: ['read'] },
  ],
  guest: [
    { resource: 'organization', actions: ['read'] },
    { resource: 'users', actions: ['read'] },
    { resource: 'api_keys', actions: [] },
    { resource: 'agents', actions: ['read'] },
    { resource: 'billing', actions: [] },
    { resource: 'settings', actions: [] },
  ],
};

/**
 * Check if a user has permission to perform an action on a resource
 */
export function hasPermission(
  userRole: UserRole | undefined,
  resource: string,
  action: string,
): boolean {
  if (!userRole) {
    return false;
  }

  const permissions = rolePermissions[userRole];
  const permission = permissions.find((p) => p.resource === resource);

  return permission ? permission.actions.includes(action) : false;
}

/**
 * Get all permissions for a user role
 */
export function getPermissions(userRole: UserRole): Permission[] {
  return rolePermissions[userRole] || [];
}

/**
 * Check if user can manage API keys
 */
export function canManageApiKeys(userRole: UserRole | undefined): boolean {
  return hasPermission(userRole, 'api_keys', 'create');
}

/**
 * Check if user can delete API keys
 */
export function canDeleteApiKeys(userRole: UserRole | undefined): boolean {
  return hasPermission(userRole, 'api_keys', 'delete');
}

/**
 * Check if user can manage users
 */
export function canManageUsers(userRole: UserRole | undefined): boolean {
  return hasPermission(userRole, 'users', 'create');
}

/**
 * Check if user can manage billing
 */
export function canManageBilling(userRole: UserRole | undefined): boolean {
  return hasPermission(userRole, 'billing', 'update');
}

/**
 * Check if user can manage organization settings
 */
export function canManageOrganization(userRole: UserRole | undefined): boolean {
  return hasPermission(userRole, 'organization', 'update');
}

/**
 * Ensure user has required permission or throw
 */
export function requirePermission(
  userRole: UserRole | undefined,
  resource: string,
  action: string,
): void {
  if (!hasPermission(userRole, resource, action)) {
    throw new Error(`Insufficient permissions: Cannot ${action} ${resource}`);
  }
}

/**
 * Get user role from user object
 */
export function getUserRole(
  user: Pick<User, 'role'> | null | undefined,
): UserRole | undefined {
  return user?.role as UserRole | undefined;
}
