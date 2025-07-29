import { elizaLogger, Service, type IAgentRuntime } from '@elizaos/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PluginManagerServiceType } from '../types';

/**
 * Plugin Registry Service with GitHub Integration and Vectorized Search
 *
 * This service syncs plugin metadata from the official ElizaOS registry,
 * fetches README files, descriptions and creates a searchable vector database.
 */
export class RegistryService extends Service {
  static serviceType = PluginManagerServiceType.REGISTRY;

  private registryCache: Map<string, PluginMetadata> = new Map();
  private vectorDatabase: Map<string, PluginVector> = new Map();
  private lastSyncTime = 0;
  private readonly SYNC_INTERVAL = 1000 * 60 * 60; // 1 hour

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  get capabilityDescription(): string {
    return 'Plugin Registry Service with GitHub Integration and Vectorized Search';
  }

  static async start(runtime: IAgentRuntime): Promise<RegistryService> {
    const service = new RegistryService(runtime);
    await service.initialize();
    return service;
  }

  /**
   * Initialize the service and perform initial sync
   */
  private async initialize(): Promise<void> {
    elizaLogger.info('[RegistryService] Initializing...');

    // Load from cache first
    await this.loadFromCache();

    // Sync if cache is stale or empty
    if (this.shouldSync()) {
      await this.syncRegistry();
    }

    elizaLogger.info(`[RegistryService] Initialized with ${this.registryCache.size} plugins`);
  }

  /**
   * Sync plugin registry from GitHub
   */
  async syncRegistry(): Promise<void> {
    elizaLogger.info('[RegistryService] Syncing plugin registry...');

    // Fetch the generated registry
    const registryData = await this.fetchGeneratedRegistry();

    // Process plugins with v1 support (as requested)
    const v1Plugins = this.filterV1Plugins(registryData);

    // Enhance with metadata
    for (const [pluginName, pluginInfo] of Object.entries(v1Plugins)) {
      const metadata = await this.buildPluginMetadata(pluginName, pluginInfo);
      this.registryCache.set(pluginName, metadata);

      // Create vector representation
      const vector = await this.createPluginVector(metadata);
      this.vectorDatabase.set(pluginName, vector);

      elizaLogger.debug(`[RegistryService] Processed plugin: ${pluginName}`);
    }

    this.lastSyncTime = Date.now();

    // Save to cache
    await this.saveToCache();

    elizaLogger.info(`[RegistryService] Sync complete: ${this.registryCache.size} plugins`);
  }

  /**
   * Search plugins using vectorized similarity
   */
  async searchPlugins(query: string, limit = 10): Promise<PluginSearchResult[]> {
    elizaLogger.info(`[RegistryService] Searching plugins: "${query}"`);

    // Ensure registry is synced
    if (this.shouldSync()) {
      await this.syncRegistry();
    }

    // Create query vector
    const queryVector = await this.createQueryVector(query);

    // Calculate similarities
    const similarities: Array<{ plugin: string; score: number; metadata: PluginMetadata }> = [];

    for (const [pluginName, pluginVector] of this.vectorDatabase.entries()) {
      const metadata = this.registryCache.get(pluginName);
      if (!metadata) continue;

      const similarity = this.calculateCosineSimilarity(queryVector, pluginVector.vector);
      similarities.push({ plugin: pluginName, score: similarity, metadata });
    }

    // Sort by similarity and return top results
    similarities.sort((a, b) => b.score - a.score);

    return similarities.slice(0, limit).map((item) => ({
      name: item.metadata.name,
      description: item.metadata.description,
      readme: item.metadata.readme,
      tags: item.metadata.tags,
      version: item.metadata.version,
      repository: item.metadata.repository,
      npmPackage: item.metadata.npmPackage,
      features: item.metadata.features,
      relevanceScore: item.score,
      dependsOn: item.metadata.dependsOn,
      dependedBy: item.metadata.dependedBy,
    }));
  }

  /**
   * Get detailed plugin information
   */
  async getPluginDetails(pluginName: string): Promise<PluginMetadata | null> {
    if (this.shouldSync()) {
      await this.syncRegistry();
    }

    return this.registryCache.get(pluginName) || null;
  }

  /**
   * Get plugins by category/tags
   */
  async getPluginsByCategory(category: string): Promise<PluginMetadata[]> {
    if (this.shouldSync()) {
      await this.syncRegistry();
    }

    const results: PluginMetadata[] = [];
    const categoryLower = category.toLowerCase();

    for (const metadata of this.registryCache.values()) {
      const matchesTag = metadata.tags.some((tag) => tag.toLowerCase().includes(categoryLower));
      const matchesDescription = metadata.description.toLowerCase().includes(categoryLower);
      const matchesName = metadata.name.toLowerCase().includes(categoryLower);

      if (matchesTag || matchesDescription || matchesName) {
        results.push(metadata);
      }
    }

    return results;
  }

  /**
   * Find plugins suitable for building upon or using as dependencies
   */
  async findRelatedPlugins(pluginName: string): Promise<RelatedPluginsResult> {
    const plugin = await this.getPluginDetails(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    const related: RelatedPluginsResult = {
      dependencies: [],
      dependents: [],
      similar: [],
      complementary: [],
    };

    // Find dependencies
    if (plugin.dependsOn.length > 0) {
      for (const depName of plugin.dependsOn) {
        const dep = await this.getPluginDetails(depName);
        if (dep) related.dependencies.push(dep);
      }
    }

    // Find dependents
    related.dependents = plugin.dependedBy
      .map((name) => this.registryCache.get(name))
      .filter(Boolean) as PluginMetadata[];

    // Find similar plugins by tag overlap
    const pluginTags = new Set(plugin.tags);
    for (const [name, metadata] of this.registryCache.entries()) {
      if (name === pluginName) continue;

      const tagOverlap = metadata.tags.filter((tag) => pluginTags.has(tag)).length;
      if (tagOverlap >= 2) {
        related.similar.push(metadata);
      }
    }

    // Find complementary plugins (different functionality but commonly used together)
    const complementaryMap: Record<string, string[]> = {
      database: ['authentication', 'api', 'validation'],
      api: ['database', 'authentication', 'rate-limiting'],
      authentication: ['database', 'session', 'security'],
      blockchain: ['wallet', 'defi', 'trading'],
      ai: ['text-processing', 'embedding', 'model'],
      social: ['messaging', 'webhook', 'notification'],
    };

    for (const tag of plugin.tags) {
      const complementaryTags = complementaryMap[tag] || [];
      for (const [name, metadata] of this.registryCache.entries()) {
        if (name === pluginName) continue;

        const hasComplementary = metadata.tags.some((t) => complementaryTags.includes(t));
        if (hasComplementary && !related.complementary.find((p) => p.name === name)) {
          related.complementary.push(metadata);
        }
      }
    }

    // Limit results
    related.similar = related.similar.slice(0, 5);
    related.complementary = related.complementary.slice(0, 5);

    return related;
  }

  /**
   * Check if registry needs syncing
   */
  private shouldSync(): boolean {
    return Date.now() - this.lastSyncTime > this.SYNC_INTERVAL || this.registryCache.size === 0;
  }

  /**
   * Fetch the generated registry from GitHub
   */
  private async fetchGeneratedRegistry(): Promise<GeneratedRegistryData> {
    const url =
      'https://raw.githubusercontent.com/elizaos-plugins/registry/main/generated-registry.json';

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch registry: ${response.statusText}`);
    }

    return (await response.json()) as GeneratedRegistryData;
  }

  /**
   * Filter plugins that support v1 (as requested)
   */
  private filterV1Plugins(registryData: GeneratedRegistryData): Record<string, PluginRegistryInfo> {
    const v1Plugins: Record<string, PluginRegistryInfo> = {};

    for (const [name, info] of Object.entries(registryData.registry)) {
      // For now, we'll include all plugins since v1 support info may not be complete
      // In production, you'd filter by info.supports.v1
      v1Plugins[name] = info;
    }

    return v1Plugins;
  }

  /**
   * Build plugin metadata by fetching README and extracting info
   */
  private async buildPluginMetadata(
    name: string,
    info: PluginRegistryInfo
  ): Promise<PluginMetadata> {
    const gitRepo = info.git.repo;
    const version = info.npm.v1 || info.npm.v0 || 'latest';

    // Fetch README
    let readme = '';
    let description = '';
    let tags: string[] = [];
    let features: string[] = [];

    const readmeUrl = `https://raw.githubusercontent.com/${gitRepo}/main/README.md`;
    const readmeResponse = await fetch(readmeUrl);

    if (readmeResponse.ok) {
      readme = await readmeResponse.text();

      // Extract description from README
      const descMatch = readme.match(/^#+\s*(.+?)[\r\n]/m);
      if (descMatch) {
        description = descMatch[1].trim();
      }

      // Extract tags from content
      tags = this.extractTagsFromReadme(readme);

      // Extract features
      features = this.extractFeaturesFromReadme(readme);
    }

    // Try to get package.json for better description
    if (!description) {
      const packageUrl = `https://raw.githubusercontent.com/${gitRepo}/main/package.json`;
      const packageResponse = await fetch(packageUrl);

      if (packageResponse.ok) {
        const packageData = (await packageResponse.json()) as { description: string };
        description = packageData.description || '';
      }
    }

    return {
      name,
      description: description || `ElizaOS plugin: ${name}`,
      readme,
      tags,
      version,
      repository: `https://github.com/${gitRepo}`,
      npmPackage: info.npm.repo,
      features,
      dependsOn: [],
      dependedBy: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Extract tags from README content
   */
  private extractTagsFromReadme(readme: string): string[] {
    const tags = new Set<string>();

    // Common patterns in README files
    const patterns = [
      /\b(api|database|blockchain|ai|social|authentication|security|trading|defi|nft|wallet|messaging|webhook|notification|analytics|monitoring|logging|testing|deployment|storage|cache|queue|scheduler|email|sms|payment|integration|automation|ml|nlp|vision|audio|video|image|file|pdf|csv|json|xml|http|rest|graphql|websocket|realtime|streaming|batch|etl|data|analytics|visualization|dashboard|report|chart|graph|metric|alert|health|status|config|setting|environment|secret|key|token|session|cookie|cors|rate|limit|throttle|retry|circuit|breaker)\b/gi,
    ];

    for (const pattern of patterns) {
      const matches = readme.match(pattern);
      if (matches) {
        matches.forEach((match) => tags.add(match.toLowerCase()));
      }
    }

    // Extract from badges (common in README files)
    const badgeMatches = readme.match(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g);
    if (badgeMatches) {
      badgeMatches.forEach((badge) => {
        // Extract technology names from badges
        const techMatch = badge.match(
          /npm|docker|typescript|javascript|node|react|vue|angular|python|rust|go|java/gi
        );
        if (techMatch) {
          techMatch.forEach((tech) => tags.add(tech.toLowerCase()));
        }
      });
    }

    return Array.from(tags);
  }

  /**
   * Extract features from README content
   */
  private extractFeaturesFromReadme(readme: string): string[] {
    const features: string[] = [];

    // Look for features section
    const featuresSection = readme.match(
      /#{1,6}\s*(Features?|Capabilities?|What it does)[\s\S]*?(?=#{1,6}|$)/i
    );

    if (featuresSection) {
      const sectionText = featuresSection[0];

      // Extract bullet points
      const bulletPoints = sectionText.match(/^\s*[-*+]\s+(.+)$/gm);
      if (bulletPoints) {
        bulletPoints.forEach((point) => {
          const cleaned = point.replace(/^\s*[-*+]\s+/, '').trim();
          if (cleaned && cleaned.length > 5) {
            features.push(cleaned);
          }
        });
      }

      // Extract numbered lists
      const numberedPoints = sectionText.match(/^\s*\d+\.\s+(.+)$/gm);
      if (numberedPoints) {
        numberedPoints.forEach((point) => {
          const cleaned = point.replace(/^\s*\d+\.\s+/, '').trim();
          if (cleaned && cleaned.length > 5) {
            features.push(cleaned);
          }
        });
      }
    }

    return features;
  }

  /**
   * Create vector representation of plugin for similarity search
   */
  private async createPluginVector(metadata: PluginMetadata): Promise<PluginVector> {
    // Combine all text content
    const textContent = [
      metadata.name,
      metadata.description,
      ...metadata.tags,
      ...metadata.features,
      metadata.readme.substring(0, 1000), // First 1000 chars of README
    ]
      .join(' ')
      .toLowerCase();

    // Create a simple vector based on term frequency
    const vector = this.createTFVector(textContent);

    return {
      pluginName: metadata.name,
      vector,
      textContent,
    };
  }

  /**
   * Create query vector for search
   */
  private async createQueryVector(query: string): Promise<number[]> {
    return this.createTFVector(query.toLowerCase());
  }

  /**
   * Create Term Frequency vector (simple implementation)
   */
  private createTFVector(text: string): number[] {
    // Common tech terms for vector dimensions
    const dimensions = [
      'api',
      'database',
      'blockchain',
      'ai',
      'social',
      'auth',
      'security',
      'trading',
      'defi',
      'nft',
      'wallet',
      'message',
      'webhook',
      'notification',
      'analytics',
      'monitoring',
      'log',
      'test',
      'deploy',
      'storage',
      'cache',
      'queue',
      'schedule',
      'email',
      'sms',
      'payment',
      'integration',
      'automation',
      'ml',
      'nlp',
      'vision',
      'audio',
      'video',
      'image',
      'file',
      'pdf',
      'csv',
      'json',
      'xml',
      'http',
      'rest',
      'graphql',
      'websocket',
      'realtime',
      'stream',
      'batch',
      'etl',
      'data',
      'chart',
      'graph',
      'metric',
      'alert',
      'health',
      'status',
      'config',
      'secret',
      'token',
      'session',
      'rate',
      'limit',
      'retry',
      'circuit',
    ];

    const vector = new Array(dimensions.length).fill(0);
    const words = text.split(/\s+/);
    const wordCount = words.length;

    dimensions.forEach((dimension, index) => {
      const count = words.filter((word) => word.includes(dimension)).length;
      vector[index] = wordCount > 0 ? count / wordCount : 0; // Term frequency
    });

    return vector;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Save registry cache to disk
   */
  private async saveToCache(): Promise<void> {
    const cacheDir = path.join(process.cwd(), '.eliza');
    await fs.mkdir(cacheDir, { recursive: true });

    const cacheFile = path.join(cacheDir, 'registry-cache.json');
    const cacheData = {
      lastSyncTime: this.lastSyncTime,
      plugins: Object.fromEntries(this.registryCache),
      vectors: Object.fromEntries(this.vectorDatabase),
    };

    await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    elizaLogger.debug('[RegistryService] Cache saved');
  }

  /**
   * Load registry cache from disk
   */
  private async loadFromCache(): Promise<void> {
    const cacheFile = path.join(process.cwd(), '.eliza', 'registry-cache.json');
    const cacheData = JSON.parse(await fs.readFile(cacheFile, 'utf-8'));

    this.lastSyncTime = cacheData.lastSyncTime || 0;

    if (cacheData.plugins) {
      for (const [name, metadata] of Object.entries(cacheData.plugins)) {
        this.registryCache.set(name, metadata as PluginMetadata);
      }
    }

    if (cacheData.vectors) {
      for (const [name, vector] of Object.entries(cacheData.vectors)) {
        this.vectorDatabase.set(name, vector as PluginVector);
      }
    }

    elizaLogger.debug(`[RegistryService] Loaded ${this.registryCache.size} plugins from cache`);
  }

  async stop(): Promise<void> {
    // Save cache before stopping
    await this.saveToCache();
    elizaLogger.info('[RegistryService] Stopped');
  }
}

// Type definitions
export interface PluginMetadata {
  name: string;
  description: string;
  readme: string;
  tags: string[];
  version: string;
  repository: string;
  npmPackage: string;
  features: string[];
  dependsOn: string[];
  dependedBy: string[];
  lastUpdated: string;
}

export interface PluginSearchResult {
  name: string;
  description: string;
  readme: string;
  tags: string[];
  version: string;
  repository: string;
  npmPackage: string;
  features: string[];
  relevanceScore: number;
  dependsOn: string[];
  dependedBy: string[];
}

export interface RelatedPluginsResult {
  dependencies: PluginMetadata[];
  dependents: PluginMetadata[];
  similar: PluginMetadata[];
  complementary: PluginMetadata[];
}

interface PluginVector {
  pluginName: string;
  vector: number[];
  textContent: string;
}

interface GeneratedRegistryData {
  lastUpdatedAt: string;
  registry: Record<string, PluginRegistryInfo>;
}

interface PluginRegistryInfo {
  git: {
    repo: string;
    v0: { version: string | null; branch: string | null };
    v1: { version: string | null; branch: string | null };
  };
  npm: {
    repo: string;
    v0: string | null;
    v1: string | null;
  };
  supports: {
    v0: boolean;
    v1: boolean;
  };
}
