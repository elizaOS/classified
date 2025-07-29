'use client';

import { useState, useEffect } from 'react';
import { Project } from './AutocoderWorkspace';

interface RegistryManagerProps {
  project: Project;
  userId: string;
}

interface PluginRegistry {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  downloads: number;
  rating: number;
  isPublic: boolean;
  githubUrl?: string;
  npmUrl?: string;
  publishedAt: Date;
  lastUpdated: Date;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
}

export function RegistryManager({ project, userId }: RegistryManagerProps) {
  const [registryEntry, setRegistryEntry] = useState<PluginRegistry | null>(
    null,
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishForm, setPublishForm] = useState({
    name: project.name,
    description: project.description,
    version: '1.0.0',
    tags: [] as string[],
    isPublic: false,
    createGitHubRepo: false,
    npmPublish: false,
  });
  const [githubRepos, setGitHubRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    loadRegistryEntry();
    loadGitHubRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const loadRegistryEntry = async () => {
    try {
      const response = await fetch(`/api/registry/plugins/${project.id}`);
      if (response.ok) {
        const entry = await response.json();
        setRegistryEntry(entry);
        if (entry) {
          setPublishForm((prev) => ({
            ...prev,
            name: entry.name,
            description: entry.description,
            version: entry.version,
            tags: entry.tags,
            isPublic: entry.isPublic,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load registry entry:', error);
    }
  };

  const loadGitHubRepos = async () => {
    try {
      setIsLoadingRepos(true);
      const response = await fetch(`/api/github/repos?userId=${userId}`);
      if (response.ok) {
        const repos = await response.json();
        setGitHubRepos(repos);
      }
    } catch (error) {
      console.error('Failed to load GitHub repos:', error);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const publishToRegistry = async () => {
    if (!project.result) {
      console.error('No build result available');
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch('/api/registry/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          userId,
          ...publishForm,
          build: project.result,
        }),
      });

      if (response.ok) {
        const newEntry = await response.json();
        setRegistryEntry(newEntry);

        // If GitHub repo creation was requested
        if (publishForm.createGitHubRepo) {
          await createGitHubRepo();
        }

        // If selected existing repo, push to it
        if (selectedRepo) {
          await pushToGitHub(selectedRepo);
        }
      }
    } catch (error) {
      console.error('Failed to publish to registry:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const createGitHubRepo = async () => {
    try {
      const response = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: publishForm.name,
          description: publishForm.description,
          private: !publishForm.isPublic,
          projectId: project.id,
        }),
      });

      if (response.ok) {
        const repo = await response.json();
        setGitHubRepos((prev) => [repo, ...prev]);
        await loadRegistryEntry(); // Reload to get GitHub URL
      }
    } catch (error) {
      console.error('Failed to create GitHub repo:', error);
    }
  };

  const pushToGitHub = async (repoFullName: string) => {
    try {
      await fetch(
        `/api/github/repos/${encodeURIComponent(repoFullName)}/push`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            commitMessage: `Update ${project.name} v${publishForm.version}`,
          }),
        },
      );
    } catch (error) {
      console.error('Failed to push to GitHub:', error);
    }
  };

  const unpublishFromRegistry = async () => {
    if (!registryEntry) {
      return;
    }

    try {
      await fetch(`/api/registry/plugins/${registryEntry.id}`, {
        method: 'DELETE',
      });
      setRegistryEntry(null);
    } catch (error) {
      console.error('Failed to unpublish:', error);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !publishForm.tags.includes(newTag.trim())) {
      setPublishForm((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setPublishForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const isFormValid = () => {
    return (
      publishForm.name.trim() &&
      publishForm.description.trim() &&
      publishForm.version.trim() &&
      project.result
    );
  };

  if (project.status !== 'completed') {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-4xl">📦</div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            Registry Publishing
          </h3>
          <p className="text-gray-600">
            Complete your plugin build to publish it to the registry and share
            with others.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Plugin Registry
          </h2>
          <p className="text-gray-600">
            Publish your plugin to share it with the community or keep it
            private
          </p>
        </div>

        {/* Current Status */}
        {registryEntry ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-900">
                  {registryEntry.name} v{registryEntry.version}
                </h3>
                <p className="mt-1 text-green-700">
                  {registryEntry.description}
                </p>
                <div className="mt-2 flex items-center space-x-4">
                  <span className="text-sm text-green-600">
                    📥 {registryEntry.downloads} downloads
                  </span>
                  <span className="text-sm text-green-600">
                    ⭐ {registryEntry.rating}/5 rating
                  </span>
                  <span
                    className={`rounded px-2 py-1 text-sm ${
                      registryEntry.isPublic
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {registryEntry.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {registryEntry.githubUrl && (
                  <a
                    href={registryEntry.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md bg-gray-900 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
                  >
                    View on GitHub
                  </a>
                )}
                {registryEntry.npmUrl && (
                  <a
                    href={registryEntry.npmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
                  >
                    View on NPM
                  </a>
                )}
                <button
                  onClick={unpublishFromRegistry}
                  className="block w-full rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
                >
                  Unpublish
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Publish Plugin
            </h3>

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Plugin Name
                  </label>
                  <input
                    type="text"
                    value={publishForm.name}
                    onChange={(e) =>
                      setPublishForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="my-awesome-plugin"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Version
                  </label>
                  <input
                    type="text"
                    value={publishForm.version}
                    onChange={(e) =>
                      setPublishForm((prev) => ({
                        ...prev,
                        version: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="1.0.0"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={publishForm.description}
                  onChange={(e) =>
                    setPublishForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe what your plugin does..."
                />
              </div>

              {/* Tags */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {publishForm.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a tag..."
                  />
                  <button
                    onClick={addTag}
                    className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Publishing Options */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">
                  Publishing Options
                </h4>

                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={publishForm.isPublic}
                      onChange={(e) =>
                        setPublishForm((prev) => ({
                          ...prev,
                          isPublic: e.target.checked,
                        }))
                      }
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-700">
                      Make plugin public (searchable by others)
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={publishForm.createGitHubRepo}
                      onChange={(e) =>
                        setPublishForm((prev) => ({
                          ...prev,
                          createGitHubRepo: e.target.checked,
                        }))
                      }
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-700">
                      Create new GitHub repository
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={publishForm.npmPublish}
                      onChange={(e) =>
                        setPublishForm((prev) => ({
                          ...prev,
                          npmPublish: e.target.checked,
                        }))
                      }
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-700">
                      Publish to NPM (requires NPM token)
                    </span>
                  </label>
                </div>
              </div>

              {/* GitHub Repository Selection */}
              {!publishForm.createGitHubRepo && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Push to Existing GitHub Repository (Optional)
                  </label>
                  <select
                    value={selectedRepo || ''}
                    onChange={(e) => setSelectedRepo(e.target.value || null)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    disabled={isLoadingRepos}
                  >
                    <option value="">Select a repository...</option>
                    {githubRepos.map((repo) => (
                      <option key={repo.full_name} value={repo.full_name}>
                        {repo.full_name}{' '}
                        {repo.private ? '(Private)' : '(Public)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Publish Button */}
              <div className="pt-4">
                <button
                  onClick={publishToRegistry}
                  disabled={!isFormValid() || isPublishing}
                  className="w-full rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isPublishing ? 'Publishing...' : 'Publish Plugin'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Registry Guidelines */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h4 className="mb-3 font-medium text-blue-900">
            Publishing Guidelines
          </h4>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Ensure your plugin follows security best practices</li>
            <li>• Include comprehensive documentation and examples</li>
            <li>• Test your plugin thoroughly before publishing</li>
            <li>• Use semantic versioning (e.g., 1.0.0, 1.1.0, 2.0.0)</li>
            <li>• Add relevant tags to help users discover your plugin</li>
            <li>
              • Consider making your plugin open source for community
              contributions
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
