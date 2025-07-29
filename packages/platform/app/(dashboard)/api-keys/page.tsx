'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  CopyIcon,
  EyeOpenIcon,
  EyeNoneIcon,
  Pencil1Icon,
  TrashIcon,
  ActivityLogIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import toast from '@/lib/toast';

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  totalUsage: number;
}

interface CreateApiKeyData {
  name: string;
  description: string;
  permissions: string[];
  rateLimit: number;
  expiresAt?: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateApiKeyData>({
    name: '',
    description: '',
    permissions: [],
    rateLimit: 100,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load API keys and data
  useEffect(() => {
    loadApiKeys();
  }, []);

  async function loadApiKeys() {
    try {
      const response = await fetch('/api/api-keys');
      const data = await response.json();

      if (data.success) {
        setApiKeys(data.data.apiKeys);
        setStats(data.data.stats);
        setAvailablePermissions(data.data.availablePermissions);
      } else {
        throw new Error(data.error?.message || 'Failed to load API keys');
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
      toast({
        message: 'Failed to load API keys',
        mode: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function createApiKey() {
    try {
      // Validate form
      const errors: Record<string, string> = {};
      if (!formData.name.trim()) {
        errors.name = 'Name is required';
      }
      if (formData.permissions.length === 0) {
        errors.permissions = 'At least one permission is required';
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setNewKey(data.data.key);
        setApiKeys((prev) => [data.data.apiKey, ...prev]);

        // Update stats
        if (stats) {
          setStats({
            ...stats,
            totalKeys: stats.totalKeys + 1,
            activeKeys: stats.activeKeys + 1,
          });
        }

        toast({
          message: 'API key created successfully',
          mode: 'success',
        });

        // Reset form
        setFormData({
          name: '',
          description: '',
          permissions: [],
          rateLimit: 100,
        });
        setFormErrors({});
      } else {
        throw new Error(data.error?.message || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      toast({
        message: 'Failed to create API key',
        mode: 'error',
      });
    }
  }

  async function updateApiKey(
    keyId: string,
    updateData: Partial<CreateApiKeyData>,
  ) {
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        setApiKeys((prev) =>
          prev.map((key) => (key.id === keyId ? data.data.apiKey : key)),
        );

        toast({
          message: 'API key updated successfully',
          mode: 'success',
        });

        setShowEditModal(false);
        setSelectedKey(null);
      } else {
        throw new Error(data.error?.message || 'Failed to update API key');
      }
    } catch (error) {
      console.error('Failed to update API key:', error);
      toast({
        message: 'Failed to update API key',
        mode: 'error',
      });
    }
  }

  async function regenerateApiKey(keyId: string) {
    try {
      const response = await fetch(`/api/api-keys/${keyId}/regenerate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setNewKey(data.data.key);
        setApiKeys((prev) =>
          prev.map((key) => (key.id === keyId ? data.data.apiKey : key)),
        );

        toast({
          message: 'API key regenerated successfully',
          mode: 'success',
        });

        setShowRegenerateModal(false);
        setShowCreateModal(true); // Show the key display modal
        setSelectedKey(null);
      } else {
        throw new Error(data.error?.message || 'Failed to regenerate API key');
      }
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
      toast({
        message: 'Failed to regenerate API key',
        mode: 'error',
      });
    }
  }

  async function deleteApiKey(keyId: string) {
    try {
      const response = await fetch(`/api/api-keys?id=${keyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setApiKeys((prev) => prev.filter((key) => key.id !== keyId));

        // Update stats
        if (stats) {
          setStats({
            ...stats,
            totalKeys: stats.totalKeys - 1,
            activeKeys: stats.activeKeys - 1,
          });
        }

        toast({
          message: 'API key deleted successfully',
          mode: 'success',
        });

        setShowDeleteModal(false);
        setSelectedKey(null);
      } else {
        throw new Error(data.error?.message || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast({
        message: 'Failed to delete API key',
        mode: 'error',
      });
    }
  }

  function copyToClipboard(text: string, keyId?: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (keyId) {
          setCopySuccess(keyId);
          setTimeout(() => setCopySuccess(null), 2000);
        }
        toast({
          message: 'Copied to clipboard',
          mode: 'success',
        });
      })
      .catch(() => {
        toast({
          message: 'Failed to copy to clipboard',
          mode: 'error',
        });
      });
  }

  function toggleKeyVisibility(keyId: string) {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getPermissionColor(permission: string) {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      'agents:write': 'bg-blue-100 text-blue-800',
      'agents:delete': 'bg-orange-100 text-orange-800',
      'memory:write': 'bg-green-100 text-green-800',
      'messaging:write': 'bg-purple-100 text-purple-800',
      'audio:write': 'bg-yellow-100 text-yellow-800',
      'media:write': 'bg-indigo-100 text-indigo-800',
    };

    return colors[permission] || 'bg-gray-100 text-gray-800';
  }

  function displayApiKey(apiKey: ApiKey) {
    if (visibleKeys.has(apiKey.id)) {
      // When visible, show a longer masked version to indicate it's "revealed"
      return `${apiKey.keyPrefix}${'•'.repeat(40)}`;
    }
    return `${apiKey.keyPrefix}${'•'.repeat(40)}`;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-6 h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded bg-gray-200"></div>
            ))}
          </div>
          <div className="h-96 rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-cy="api-keys-page">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-gray-900"
            data-cy="api-keys-title"
          >
            API Keys
          </h1>
          <p className="mt-2 text-gray-600" data-cy="api-keys-subtitle">
            Manage API keys for programmatic access to your agents and data.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadApiKeys}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Refresh"
          >
            <ReloadIcon className="h-4 w-4" />
          </button>
          <Button
            handleClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2"
            data-cy="create-api-key-button"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Create API Key</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Keys</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalKeys}
                </p>
              </div>
              <ActivityLogIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Keys</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.activeKeys}
                </p>
              </div>
              <CheckIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Expired Keys
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.expiredKeys}
                </p>
              </div>
              <ExclamationTriangleIcon className="h-8 w-8 text-orange-500" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Usage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalUsage.toLocaleString()}
                </p>
              </div>
              <ActivityLogIcon className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* API Keys List */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        </div>

        {apiKeys.length === 0 ? (
          <div className="p-8 text-center">
            <ActivityLogIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              No API keys
            </h3>
            <p className="mb-4 text-gray-600">
              Create your first API key to start using the platform
              programmatically.
            </p>
            <Button
              handleClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2"
              data-cy="create-api-key"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create API Key</span>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="p-6" data-cy="api-key-row">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {apiKey.name}
                      </h3>
                      {!apiKey.isActive && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Inactive
                        </span>
                      )}
                      {apiKey.expiresAt &&
                        new Date(apiKey.expiresAt) < new Date() && (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                            Expired
                          </span>
                        )}
                    </div>

                    {apiKey.description && (
                      <p className="mb-3 text-gray-600">{apiKey.description}</p>
                    )}

                    {/* Key Display */}
                    <div className="mb-3 rounded-lg bg-gray-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-1 items-center space-x-2">
                          <code className="flex-1 font-mono text-sm text-gray-900">
                            {displayApiKey(apiKey)}
                          </code>
                          <button
                            onClick={() => toggleKeyVisibility(apiKey.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title={
                              visibleKeys.has(apiKey.id)
                                ? 'Hide key'
                                : 'Show key'
                            }
                          >
                            {visibleKeys.has(apiKey.id) ? (
                              <EyeNoneIcon className="h-4 w-4" />
                            ) : (
                              <EyeOpenIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard(displayApiKey(apiKey), apiKey.id)
                          }
                          className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                          title="Copy to clipboard"
                        >
                          {copySuccess === apiKey.id ? (
                            <CheckIcon className="h-4 w-4 text-green-600" />
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Permissions */}
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-medium text-gray-500">
                        PERMISSIONS
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {apiKey.permissions.map((permission) => (
                          <span
                            key={permission}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPermissionColor(permission)}`}
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 md:grid-cols-4">
                      <div>
                        <span className="font-medium">Rate Limit:</span>{' '}
                        {apiKey.rateLimit}/min
                      </div>
                      <div>
                        <span className="font-medium">Usage:</span>{' '}
                        {apiKey.usageCount.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span>{' '}
                        {formatDate(apiKey.createdAt)}
                      </div>
                      <div>
                        <span className="font-medium">Last Used:</span>{' '}
                        {apiKey.lastUsedAt
                          ? formatDate(apiKey.lastUsedAt)
                          : 'Never'}
                      </div>
                    </div>

                    {apiKey.expiresAt && (
                      <div className="mt-2 flex items-center text-xs text-orange-600">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        Expires: {formatDate(apiKey.expiresAt)}
                      </div>
                    )}
                  </div>

                  <div
                    className="ml-4 flex items-center space-x-2"
                    data-cy="api-key-actions"
                  >
                    <button
                      onClick={() => {
                        setSelectedKey(apiKey);
                        setFormData({
                          name: apiKey.name,
                          description: apiKey.description || '',
                          permissions: apiKey.permissions,
                          rateLimit: apiKey.rateLimit,
                        });
                        setShowEditModal(true);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                      data-cy="edit-key"
                      title="Edit API key"
                    >
                      <Pencil1Icon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedKey(apiKey);
                        setShowRegenerateModal(true);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-yellow-600"
                      data-cy="regenerate-key"
                      title="Regenerate API key"
                    >
                      <ReloadIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedKey(apiKey);
                        setShowDeleteModal(true);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      data-cy="delete-key"
                      title="Delete API key"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create API Key Modal */}
      <Modal
        title="Create API Key"
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewKey(null);
          setFormData({
            name: '',
            description: '',
            permissions: [],
            rateLimit: 100,
          });
          setFormErrors({});
        }}
        data-cy="api-key-modal"
      >
        {newKey ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="mb-2 flex items-center">
                <CheckIcon className="mr-2 h-5 w-5 text-green-600" />
                <h3 className="font-medium text-green-800">
                  API Key Created Successfully
                </h3>
              </div>
              <p className="mb-3 text-sm text-green-700">
                Copy this key now. For security reasons, it won't be shown
                again.
              </p>
              <div className="rounded border bg-white p-3">
                <div className="flex items-center justify-between">
                  <code
                    className="break-all font-mono text-sm text-gray-900"
                    data-cy="api-key-value"
                  >
                    {newKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newKey)}
                    className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                    data-cy="copy-api-key"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                handleClick={() => {
                  setShowCreateModal(false);
                  setNewKey(null);
                }}
                data-cy="close-modal"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="My API Key"
                data-cy="api-key-name"
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Optional description"
                data-cy="api-key-description"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Permissions *
              </label>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-gray-300 p-3">
                {availablePermissions.map((permission) => (
                  <label
                    key={permission}
                    className="flex items-center space-x-2"
                  >
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(permission)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData((prev) => ({
                            ...prev,
                            permissions: [...prev.permissions, permission],
                          }));
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            permissions: prev.permissions.filter(
                              (p) => p !== permission,
                            ),
                          }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      data-cy={`permission-${permission.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                    />
                    <span className="text-sm text-gray-700">{permission}</span>
                  </label>
                ))}
              </div>
              {formErrors.permissions && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.permissions}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Rate Limit (requests per minute)
              </label>
              <input
                type="number"
                value={formData.rateLimit}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    rateLimit: parseInt(e.target.value, 10) || 100,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10000"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <Button handleClick={createApiKey} data-cy="create-key-submit">
                Create API Key
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete API Key"
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedKey(null);
        }}
      >
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-gray-900">
                Are you sure you want to delete the API key{' '}
                <strong>"{selectedKey?.name}"</strong>?
              </p>
              <p className="mt-1 text-sm text-gray-600">
                This action cannot be undone. Applications using this key will
                no longer be able to access the API.
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <Button
              handleClick={() => selectedKey && deleteApiKey(selectedKey.id)}
              className="bg-red-600 hover:bg-red-700"
              data-cy="confirm-delete"
            >
              Delete API Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit API Key Modal */}
      <Modal
        title="Edit API Key"
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedKey(null);
          setFormErrors({});
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="My API Key"
            />
            {formErrors.name && (
              <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Permissions *
            </label>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-gray-300 p-3">
              {availablePermissions.map((permission) => (
                <label key={permission} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(permission)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData((prev) => ({
                          ...prev,
                          permissions: [...prev.permissions, permission],
                        }));
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          permissions: prev.permissions.filter(
                            (p) => p !== permission,
                          ),
                        }));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{permission}</span>
                </label>
              ))}
            </div>
            {formErrors.permissions && (
              <p className="mt-1 text-sm text-red-600">
                {formErrors.permissions}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Rate Limit (requests per minute)
            </label>
            <input
              type="number"
              value={formData.rateLimit}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  rateLimit: parseInt(e.target.value, 10) || 100,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              min="1"
              max="10000"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setShowEditModal(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <Button
              handleClick={() => {
                if (selectedKey) {
                  updateApiKey(selectedKey.id, formData);
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Regenerate API Key Confirmation Modal */}
      <Modal
        title="Regenerate API Key"
        open={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          setSelectedKey(null);
        }}
      >
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-900">
                Are you sure you want to regenerate the API key{' '}
                <strong>"{selectedKey?.name}"</strong>?
              </p>
              <p className="mt-1 text-sm text-gray-600">
                This will generate a new API key and invalidate the old one.
                Applications using the old key will no longer be able to access
                the API.
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setShowRegenerateModal(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <Button
              handleClick={() =>
                selectedKey && regenerateApiKey(selectedKey.id)
              }
              className="bg-yellow-600 hover:bg-yellow-700"
              data-cy="confirm-regenerate"
            >
              Regenerate Key
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
