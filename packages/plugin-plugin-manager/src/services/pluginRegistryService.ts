import { elizaLogger } from '@elizaos/core';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface PluginSearchResult {
  name: string;
  description: string;
  relevantSection?: string;
  tags?: string[];
  repository?: string;
  version?: string;
}

export interface CloneResult {
  success: boolean;
  pluginName?: string;
  localPath?: string;
  repository?: string;
  hasTests?: boolean;
  dependencies?: Record<string, string>;
  error?: string;
}

export interface PluginKnowledge {
  name: string;
  description: string;
  tags?: string[];
  features?: string[];
}

export interface PublishResult {
  success: boolean;
  packageName?: string;
  version?: string;
  npmUrl?: string;
  registryPR?: string;
  error?: string;
}

interface PluginMetadata {
  name: string;
  description: string;
  readme?: string;
  tags?: string[];
  version?: string;
  repository?: string;
}

// Cache for plugin metadata to avoid repeated fetches
const metadataCache = new Map<string, PluginMetadata>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const cacheTimestamps = new Map<string, number>();

/**
 * Search plugins by content in their READMEs and descriptions
 */
export async function searchPluginsByContent(query: string): Promise<PluginSearchResult[]> {
  elizaLogger.info(`[pluginRegistryService] Searching for plugins matching: ${query}`);

  // Fetch registry data
  const registryData = await fetchRegistryWithMetadata();

  // Search through plugins
  const results: PluginSearchResult[] = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  for (const [pluginName, metadata] of registryData.entries()) {
    let score = 0;
    let relevantSection: string | undefined;

    // Check name
    if (metadata.name.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Check description
    if (metadata.description.toLowerCase().includes(queryLower)) {
      score += 8;
      relevantSection = metadata.description;
    }

    // Check individual words in description
    queryWords.forEach((word) => {
      if (metadata.description.toLowerCase().includes(word)) {
        score += 2;
      }
    });

    // Check README content
    if (metadata.readme) {
      const readmeLower = metadata.readme.toLowerCase();
      if (readmeLower.includes(queryLower)) {
        score += 5;
        // Extract relevant section
        const index = readmeLower.indexOf(queryLower);
        const start = Math.max(0, index - 50);
        const end = Math.min(metadata.readme.length, index + queryLower.length + 100);
        relevantSection = metadata.readme.substring(start, end).trim();
      }

      // Check individual words in README
      queryWords.forEach((word) => {
        if (readmeLower.includes(word)) {
          score += 1;
        }
      });
    }

    // Check tags
    if (metadata.tags) {
      metadata.tags.forEach((tag) => {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 6;
        }
        queryWords.forEach((word) => {
          if (tag.toLowerCase().includes(word)) {
            score += 2;
          }
        });
      });
    }

    if (score > 0) {
      results.push({
        name: metadata.name,
        description: metadata.description,
        relevantSection,
        tags: metadata.tags,
        repository: metadata.repository,
        version: metadata.version,
      });
    }
  }

  // Sort by relevance (score)
  results.sort((a, b) => {
    // Prioritize exact matches in name
    const aNameMatch = a.name.toLowerCase().includes(queryLower) ? 1 : 0;
    const bNameMatch = b.name.toLowerCase().includes(queryLower) ? 1 : 0;
    return bNameMatch - aNameMatch;
  });

  return results.slice(0, 10); // Return top 10 results
}

/**
 * Clone a plugin repository for local development
 */
export async function clonePlugin(pluginName: string): Promise<CloneResult> {
  elizaLogger.info(`[pluginRegistryService] Cloning plugin: ${pluginName}`);

  // Normalize plugin name
  let normalizedName = pluginName;
  if (!pluginName.startsWith('@elizaos/')) {
    if (!pluginName.startsWith('plugin-')) {
      normalizedName = `plugin-${pluginName}`;
    }
    normalizedName = `@elizaos/${normalizedName}`;
  }

  // Get plugin metadata
  const metadata = await getPluginMetadata(normalizedName);
  if (!metadata || !metadata.repository) {
    return {
      success: false,
      error: `Plugin ${pluginName} not found in registry or has no repository information`,
    };
  }

  // Determine clone directory
  const cloneDir = path.join(process.cwd(), 'cloned-plugins');
  await fs.mkdir(cloneDir, { recursive: true });

  const pluginDir = path.join(cloneDir, path.basename(normalizedName));

  // Check if already cloned
  const dirExists = await fs
    .access(pluginDir)
    .then(() => true)
    .catch(() => false);
  if (dirExists) {
    return {
      success: false,
      error: `Plugin already cloned at ${pluginDir}. Remove it first to clone again.`,
    };
  }

  // Clone the repository
  const gitUrl = metadata.repository.replace('github:', 'https://github.com/') + '.git';
  elizaLogger.info(`[pluginRegistryService] Cloning from: ${gitUrl}`);

  await execAsync(`git clone ${gitUrl} ${pluginDir}`);

  // Check for package.json
  const packageJsonPath = path.join(pluginDir, 'package.json');
  let hasTests = false;
  let dependencies: Record<string, string> = {};

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  hasTests = !!(
    packageJson.scripts &&
    (packageJson.scripts.test || packageJson.scripts['test:unit'])
  );
  dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.peerDependencies || {}),
  };

  return {
    success: true,
    pluginName: normalizedName,
    localPath: pluginDir,
    repository: metadata.repository,
    hasTests,
    dependencies,
  };
}

/**
 * Fetch registry data with metadata (including READMEs)
 */
async function fetchRegistryWithMetadata(): Promise<Map<string, PluginMetadata>> {
  // For now, we'll use a mock implementation
  // In production, this would fetch from the actual registry
  const registryUrl =
    'https://raw.githubusercontent.com/elizaos-plugins/registry/main/plugins.json';

  // Check cache first
  const cachedData = await loadCachedRegistry();
  if (cachedData.size > 0) {
    return cachedData;
  }

  // Fetch fresh data
  const response = await fetch(registryUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.statusText}`);
  }

  const data = await response.json();
  const metadataMap = new Map<string, PluginMetadata>();

  // Process each plugin
  for (const [name, info] of Object.entries(data as Record<string, any>)) {
    const pluginInfo = info as {
      description?: string;
      tags?: string[];
      version?: string;
      repository?: string;
      readmeUrl?: string;
    };

    const metadata: PluginMetadata = {
      name,
      description: pluginInfo.description || '',
      tags: pluginInfo.tags || [],
      version: pluginInfo.version || '',
      repository: pluginInfo.repository || '',
    };

    // Fetch README if available
    if (pluginInfo.readmeUrl) {
      const readmeResponse = await fetch(pluginInfo.readmeUrl);
      if (readmeResponse.ok) {
        metadata.readme = await readmeResponse.text();
      }
    }

    metadataMap.set(name, metadata);
    metadataCache.set(name, metadata);
    cacheTimestamps.set(name, Date.now());
  }

  // Save to cache
  await saveCachedRegistry(metadataMap);

  return metadataMap;
}

/**
 * Get metadata for a specific plugin
 */
async function getPluginMetadata(pluginName: string): Promise<PluginMetadata | null> {
  // Check cache first
  if (metadataCache.has(pluginName)) {
    const timestamp = cacheTimestamps.get(pluginName);
    if (timestamp && Date.now() - timestamp < CACHE_TTL) {
      return metadataCache.get(pluginName)!;
    }
  }

  const registry = await fetchRegistryWithMetadata();
  return registry.get(pluginName) || null;
}

/**
 * Load cached registry data
 */
async function loadCachedRegistry(): Promise<Map<string, PluginMetadata>> {
  const cacheFile = path.join(process.cwd(), '.eliza', 'plugin-registry-cache.json');

  const data = await fs.readFile(cacheFile, 'utf-8').catch(() => null);
  if (!data) {
    return new Map();
  }

  const parsed = JSON.parse(data);

  // Check if cache is still valid
  if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL) {
    const map = new Map<string, PluginMetadata>();
    for (const [name, metadata] of Object.entries(parsed.plugins)) {
      map.set(name, metadata as PluginMetadata);
    }
    return map;
  }

  return new Map();
}

/**
 * Save registry data to cache
 */
async function saveCachedRegistry(data: Map<string, PluginMetadata>): Promise<void> {
  const cacheDir = path.join(process.cwd(), '.eliza');
  const cacheFile = path.join(cacheDir, 'plugin-registry-cache.json');

  await fs.mkdir(cacheDir, { recursive: true });

  const cacheData = {
    timestamp: Date.now(),
    plugins: Object.fromEntries(data),
  };

  await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
}

/**
 * Get mock registry data for testing
 */
function getMockRegistry(): Map<string, PluginMetadata> {
  const mockData = new Map<string, PluginMetadata>();

  mockData.set('@elizaos/plugin-weather', {
    name: '@elizaos/plugin-weather',
    description: 'Weather information and forecasting plugin',
    readme:
      '# Weather Plugin\n\nProvides weather data and forecasts for any location.\n\n## Features\n- Current weather conditions\n- 7-day forecasts\n- Weather alerts\n- Historical weather data',
    tags: ['weather', 'forecast', 'climate', 'api'],
    version: '1.0.0',
    repository: 'github:elizaos-plugins/plugin-weather',
  });

  mockData.set('@elizaos/plugin-sql', {
    name: '@elizaos/plugin-sql',
    description: 'SQL database operations and queries',
    readme:
      '# SQL Plugin\n\nExecute SQL queries and manage database connections.\n\n## Supported Databases\n- PostgreSQL\n- MySQL\n- SQLite\n- MariaDB',
    tags: ['database', 'sql', 'postgres', 'mysql', 'sqlite'],
    version: '1.0.0',
    repository: 'github:elizaos-plugins/plugin-sql',
  });

  mockData.set('@elizaos/plugin-browser', {
    name: '@elizaos/plugin-browser',
    description: 'Web browser automation and scraping',
    readme:
      '# Browser Plugin\n\nAutomate web browsers and scrape web content.\n\n## Features\n- Browser automation\n- Web scraping\n- Screenshot capture\n- Form filling',
    tags: ['browser', 'automation', 'scraping', 'puppeteer'],
    version: '1.0.0',
    repository: 'github:elizaos-plugins/plugin-browser',
  });

  return mockData;
}

/**
 * Fetch plugin knowledge for the knowledge provider
 */
export async function fetchPluginKnowledge(): Promise<Map<string, PluginKnowledge>> {
  const registryData = await fetchRegistryWithMetadata();
  const knowledgeMap = new Map<string, PluginKnowledge>();

  for (const [pluginName, metadata] of registryData.entries()) {
    const knowledge: PluginKnowledge = {
      name: metadata.name,
      description: metadata.description,
      tags: metadata.tags,
      features: [],
    };

    // Extract features from README
    if (metadata.readme) {
      const featuresMatch = metadata.readme.match(/## Features[\s\S]*?(?=##|$)/i);
      if (featuresMatch) {
        const featuresText = featuresMatch[0];
        const featureLines = featuresText
          .split('\n')
          .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('*'));
        knowledge.features = featureLines.map((line) => line.replace(/^[\s-*]+/, '').trim());
      }
    }

    knowledgeMap.set(pluginName, knowledge);
  }

  return knowledgeMap;
}

/**
 * Publish a plugin to npm and optionally create a registry PR
 */
export async function publishPlugin(pluginPath: string): Promise<PublishResult> {
  elizaLogger.info(`[pluginRegistryService] Publishing plugin from: ${pluginPath}`);

  // Read package.json
  const packageJsonPath = path.join(pluginPath, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  const packageName = packageJson.name;
  const version = packageJson.version;

  // Run tests first
  elizaLogger.info('[pluginRegistryService] Running tests...');
  await execAsync('npm test', { cwd: pluginPath }).catch(() => {
    throw new Error('Tests failed. Please fix the tests before publishing.');
  });

  // Build the plugin
  elizaLogger.info('[pluginRegistryService] Building plugin...');
  await execAsync('npm run build', { cwd: pluginPath }).catch(() => {
    throw new Error('Build failed. Please fix the build errors before publishing.');
  });

  // Publish to npm
  elizaLogger.info('[pluginRegistryService] Publishing to npm...');

  // Check if already published
  const versionExists = await execAsync(`npm view ${packageName}@${version}`, { cwd: pluginPath })
    .then(() => true)
    .catch(() => false);

  if (versionExists) {
    return {
      success: false,
      error: `Version ${version} is already published. Please update the version in package.json.`,
    };
  }

  // Publish
  await execAsync('npm publish --access public', { cwd: pluginPath });

  const npmUrl = `https://www.npmjs.com/package/${packageName}`;

  // TODO: Create PR to add to registry
  // This would involve:
  // 1. Forking the registry repo
  // 2. Adding the plugin metadata
  // 3. Creating a pull request

  return {
    success: true,
    packageName,
    version,
    npmUrl,
  };
}
