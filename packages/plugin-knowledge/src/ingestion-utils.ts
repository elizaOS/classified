import { Buffer as _Buffer } from 'node:buffer';
import { logger, stringToUuid, UUID } from '@elizaos/core';
import type {
  GitHubIngestionOptions,
  GitHubIngestionResult,
  WebPageIngestionOptions,
  WebPageIngestionResult,
  KnowledgeSourceType as _KnowledgeSourceType,
  KnowledgeSourceMetadata,
} from './types';

// JSDOM for server-side DOM parsing
let JSDOM: any;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (_error) {
  logger.warn('JSDOM not available - web page parsing will be limited');
}

/**
 * Default file extensions to include for GitHub repository ingestion
 */
const DEFAULT_ALLOWED_EXTENSIONS = [
  // Documentation
  '.md',
  '.txt',
  '.rst',
  '.adoc',
  '.org',
  // Code files
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.php',
  '.rb',
  '.go',
  '.rs',
  '.swift',
  '.kt',
  '.scala',
  '.clj',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.ps1',
  '.bat',
  '.cmd',
  // Config files
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.xml',
  '.env',
  '.properties',
  '.gradle',
  '.sbt',
  '.pom',
  // Web files
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  // Data files
  '.csv',
  '.tsv',
  '.sql',
  // Other text files
  '.log',
  '.dockerfile',
  '.makefile',
  '.gitignore',
  '.editorconfig',
];

/**
 * Default patterns to exclude from GitHub repository ingestion
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.github',
  'dist',
  'build',
  'target',
  'bin',
  'obj',
  '.vscode',
  '.idea',
  '__pycache__',
  '.pytest_cache',
  'coverage',
  '.nyc_output',
  '.next',
  '.nuxt',
  'vendor',
  'packages',
  'bower_components',
  'jspm_packages',
  'web_modules',
  'bundle',
  'bundles',
  'assets/vendor',
  'public/vendor',
  'static/vendor',
];

/**
 * Fetches and processes a GitHub repository
 */
export async function ingestGitHubRepository(
  options: GitHubIngestionOptions
): Promise<GitHubIngestionResult> {
  const startTime = Date.now();
  logger.info(`Starting GitHub repository ingestion: ${options.repoUrl}`);

  try {
    // Parse GitHub URL to extract owner and repo
    const { owner, repo, branch } = parseGitHubUrl(options.repoUrl, options.branch);

    // Fetch repository contents
    const files = await fetchGitHubRepositoryContents(owner, repo, branch, options.subdirectories);

    // Filter files based on options
    const filteredFiles = filterGitHubFiles(files, {
      maxFileSize: options.maxFileSize || 5 * 1024 * 1024, // 5MB default
      allowedExtensions: options.allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS,
      excludePatterns: options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS,
    });

    const result: GitHubIngestionResult = {
      totalFiles: files.length,
      processedFiles: 0,
      skippedFiles: 0,
      errors: [],
      documents: [],
    };

    // Process each file
    for (const file of filteredFiles) {
      try {
        // Download file content
        const content = await fetchGitHubFileContent(file.download_url);

        // Create source metadata
        const sourceMetadata: KnowledgeSourceMetadata = {
          sourceType: 'github_repo' as const,
          repositoryUrl: options.repoUrl,
          branch,
          filePath: file.path,
          subdirectory: getSubdirectoryFromPath(file.path, options.subdirectories),
          extractionMethod: 'github_api',
          ingestionTimestamp: Date.now(),
          processingDuration: Date.now() - startTime,
          ...(options.metadata || {}),
        };

        // Add file content and metadata to results
        result.documents.push({
          id: generateFileId(owner, repo, file.path),
          filename: file.name,
          path: file.path,
          content, // Include the actual file content
          fragmentCount: 0, // Would be set by actual processing
          sourceMetadata,
        });

        result.processedFiles++;
        logger.debug(`Processed GitHub file: ${file.path}`);
      } catch (error: any) {
        result.errors.push({
          file: file.path,
          error: error.message,
        });
        result.skippedFiles++;
        logger.warn(`Failed to process GitHub file ${file.path}: ${error.message}`);
      }
    }

    result.skippedFiles += files.length - filteredFiles.length;

    logger.info(
      `GitHub repository ingestion completed: processed ${result.processedFiles}, skipped ${result.skippedFiles}, errors: ${result.errors.length}`
    );
    return result;
  } catch (error: any) {
    logger.error(`GitHub repository ingestion failed: ${error.message}`);
    throw new Error(`Failed to ingest GitHub repository: ${error.message}`);
  }
}

/**
 * Extracts content from a web page with filtering
 */
export async function ingestWebPage(
  options: WebPageIngestionOptions
): Promise<WebPageIngestionResult> {
  const startTime = Date.now();
  logger.info(`Starting web page ingestion: ${options.url}`);

  try {
    // Fetch the web page
    const response = await fetchWebPage(options.url);

    if (!JSDOM) {
      throw new Error('JSDOM not available - cannot parse web page content');
    }

    // Parse HTML content
    const dom = new JSDOM(response.html);
    const document = dom.window.document;

    // Extract title
    const title = document.title || extractTitleFromUrl(options.url);

    // Extract and filter content
    const extractedText = extractWebPageContent(document, {
      minTextLength: options.minTextLength || 30,
      excludeSelectors: options.excludeSelectors || [
        'script',
        'style',
        'nav',
        'header',
        'footer',
        '.advertisement',
        '.sidebar',
        '.menu',
        '.cookie-banner',
      ],
      includeSelectors: options.includeSelectors,
    });

    const result: WebPageIngestionResult = {
      url: options.url,
      title,
      extractedText,
      textLength: extractedText.length,
    };

    // Create source metadata
    const _sourceMetadata: KnowledgeSourceMetadata = {
      sourceType: 'web_page' as const,
      originalUrl: options.url,
      extractionMethod: 'jsdom_parser',
      ingestionTimestamp: Date.now(),
      processingDuration: Date.now() - startTime,
      userAgent: 'Eliza-Knowledge-Plugin/1.0',
      ...(options.metadata || {}),
    };

    logger.info(
      `Web page ingestion completed: extracted ${extractedText.length} characters from ${options.url}`
    );
    return result;
  } catch (error: any) {
    logger.error(`Web page ingestion failed: ${error.message}`);
    return {
      url: options.url,
      extractedText: '',
      textLength: 0,
      error: error.message,
    };
  }
}

/**
 * Parses a GitHub URL to extract owner, repo, and branch
 */
function parseGitHubUrl(
  repoUrl: string,
  defaultBranch?: string
): { owner: string; repo: string; branch: string } {
  // Support different GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)$/,
    /github\.com\/([^\/]+)\/([^\/]+)\.git$/,
    /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)/,
  ];

  let owner: string = '';
  let repo: string = '';
  let branch: string = defaultBranch || 'main';

  for (const pattern of patterns) {
    const match = repoUrl.match(pattern);
    if (match) {
      owner = match[1];
      repo = match[2];
      if (match[3]) {
        branch = match[3];
      }
      break;
    }
  }

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub URL format: ${repoUrl}`);
  }

  return { owner, repo, branch };
}

/**
 * Fetches repository contents from GitHub API
 */
async function fetchGitHubRepositoryContents(
  owner: string,
  repo: string,
  branch: string,
  subdirectories?: string[]
): Promise<any[]> {
  const files: any[] = [];
  const pathsToProcess = subdirectories && subdirectories.length > 0 ? subdirectories : [''];

  for (const path of pathsToProcess) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Eliza-Knowledge-Plugin/1.0',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn(`Path not found in repository: ${path}`);
          continue;
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const contents = await response.json();
      const dirFiles = Array.isArray(contents) ? contents : [contents];

      // Recursively process directories
      for (const item of dirFiles) {
        if (item.type === 'file') {
          files.push(item);
        } else if (item.type === 'dir') {
          const subFiles = await fetchGitHubRepositoryContents(owner, repo, branch, [item.path]);
          files.push(...subFiles);
        }
      }
    } catch (error: any) {
      logger.error(`Failed to fetch GitHub directory ${path}: ${error.message}`);
    }
  }

  return files;
}

/**
 * Filters GitHub files based on criteria
 */
function filterGitHubFiles(
  files: any[],
  options: {
    maxFileSize: number;
    allowedExtensions: string[];
    excludePatterns: string[];
  }
): any[] {
  return files.filter((file) => {
    // Check file size
    if (file.size > options.maxFileSize) {
      logger.debug(`Skipping large file: ${file.path} (${file.size} bytes)`);
      return false;
    }

    // Check file extension
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!options.allowedExtensions.includes(extension)) {
      logger.debug(`Skipping file with unsupported extension: ${file.path}`);
      return false;
    }

    // Check exclude patterns
    for (const pattern of options.excludePatterns) {
      if (file.path.includes(pattern)) {
        logger.debug(`Skipping excluded file: ${file.path} (matches pattern: ${pattern})`);
        return false;
      }
    }

    return true;
  });
}

/**
 * Fetches file content from GitHub
 */
async function fetchGitHubFileContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Eliza-Knowledge-Plugin/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Fetches a web page with proper headers
 */
async function fetchWebPage(url: string): Promise<{ html: string; contentType: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Eliza-Knowledge-Plugin/1.0; +https://eliza.how)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'text/html';

    // Check if it's actually HTML
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Not an HTML page: content-type is ${contentType}`);
    }

    const html = await response.text();
    return { html, contentType };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: page took too long to respond');
    }
    throw error;
  }
}

/**
 * Extracts meaningful text content from a DOM document
 */
function extractWebPageContent(
  document: Document,
  options: {
    minTextLength: number;
    excludeSelectors: string[];
    includeSelectors?: string[];
  }
): string {
  // Remove unwanted elements
  options.excludeSelectors.forEach((selector) => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    } catch (_error) {
      logger.debug(`Invalid selector: ${selector}`);
    }
  });

  let contentElements: Element[];

  // Use specific selectors if provided
  if (options.includeSelectors && options.includeSelectors.length > 0) {
    contentElements = [];
    options.includeSelectors.forEach((selector) => {
      try {
        const elements = Array.from(document.querySelectorAll(selector));
        contentElements.push(...elements);
      } catch (_error) {
        logger.debug(`Invalid include selector: ${selector}`);
      }
    });
  } else {
    // Default content extraction - focus on main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.page-content',
      '.article-content',
      '.post-body',
    ];

    contentElements = [];
    for (const selector of contentSelectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      if (elements.length > 0) {
        contentElements.push(...elements);
        break; // Use the first matching content area
      }
    }

    // Fallback to body if no content areas found
    if (contentElements.length === 0) {
      const body = document.querySelector('body');
      if (body) {
        contentElements = [body];
      }
    }
  }

  // Extract text from elements
  const textParts: string[] = [];

  contentElements.forEach((element) => {
    const text = extractTextFromElement(element, options.minTextLength);
    if (text.trim()) {
      textParts.push(text.trim());
    }
  });

  return textParts.join('\n\n');
}

/**
 * Recursively extracts text from an element, filtering by text length
 */
function extractTextFromElement(element: Element, minTextLength: number): string {
  const textParts: string[] = [];

  // Process child nodes
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) {
      // Text node
      const text = node.textContent?.trim();
      if (text && text.length >= minTextLength) {
        textParts.push(text);
      }
    } else if (node.nodeType === 1) {
      // Element node
      const childElement = node as Element;

      // Skip certain elements that are unlikely to contain meaningful content
      const skipTags = ['script', 'style', 'svg', 'canvas', 'iframe'];
      if (skipTags.includes(childElement.tagName.toLowerCase())) {
        continue;
      }

      // For certain block elements, add spacing
      const blockTags = [
        'p',
        'div',
        'section',
        'article',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'li',
      ];
      const isBlock = blockTags.includes(childElement.tagName.toLowerCase());

      const childText = extractTextFromElement(childElement, minTextLength);
      if (childText.trim()) {
        if (isBlock && textParts.length > 0) {
          textParts.push(`\n${childText.trim()}`);
        } else {
          textParts.push(childText.trim());
        }
      }
    }
  }

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Helper functions
 */
function getSubdirectoryFromPath(filePath: string, subdirectories?: string[]): string | undefined {
  if (!subdirectories) {
    return undefined;
  }

  for (const subdir of subdirectories) {
    if (filePath.startsWith(subdir)) {
      return subdir;
    }
  }
  return undefined;
}

function generateFileId(owner: string, repo: string, filePath: string): UUID {
  // Create a deterministic ID based on repo and file path
  const seed = `github_${owner}_${repo}_${filePath}`;
  return stringToUuid(seed) as UUID;
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/').filter((s) => s);
    return segments.length > 0 ? segments[segments.length - 1] : urlObj.hostname;
  } catch {
    return url;
  }
}
