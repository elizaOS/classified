import {
  type Action,
  type ActionResult,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
  type ActionExample,
  ModelType as _ModelType,
  createUniqueUuid,
} from '@elizaos/core';
import puppeteer, { type Browser, type Page } from 'puppeteer';

// Security utilities
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// PII patterns for detection and sanitization
const PII_PATTERNS = [
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { type: 'phone', pattern: /\b\d{3}-\d{3}-\d{4}\b/g },
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'credit_card', pattern: /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g },
  { type: 'api_key', pattern: /\b(sk-[a-zA-Z0-9]{32,}|[A-Za-z0-9]{32,})\b/g },
];

// Blocked domains and IPs for security
const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '10.',
  '172.16.',
  '192.168.',
  'malware.com',
  'phishing.net',
];
const BLOCKED_IPS =
  /^(127\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[0-1]\.|192\.168\.|169\.254\.|::1$|localhost$)/i;

// Additional patterns for localhost detection
const LOCALHOST_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '192.168.',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '169.254.', // Link-local addresses
];

function sanitizeInput(input: string): string {
  // Remove potential XSS and injection attempts
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '[SCRIPT_REMOVED]')
    .replace(/javascript:/gi, 'javascript_removed:')
    .replace(/on\w+\s*=/gi, 'on_event_removed=')
    .replace(/\${.*?}/g, '[TEMPLATE_REMOVED]')
    .replace(/`[^`]*`/g, '[BACKTICK_REMOVED]')
    .trim();
}

function sanitizeForLogging(input: string): string {
  let sanitized = input;

  // Remove PII from logs
  PII_PATTERNS.forEach(({ pattern }) => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
}

function sanitizeError(error: unknown): string {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return sanitizeForLogging(errorMsg);
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Block internal/private IPs and localhost with enhanced detection
    const hostname = parsedUrl.hostname.toLowerCase();

    // Check against localhost patterns
    for (const pattern of LOCALHOST_PATTERNS) {
      if (hostname === pattern || hostname.startsWith(pattern)) {
        return false;
      }
    }

    // Check with regex pattern
    if (BLOCKED_IPS.test(hostname)) {
      return false;
    }

    // Block known malicious domains
    if (BLOCKED_DOMAINS.some((blocked) => hostname.includes(blocked))) {
      return false;
    }

    // Block non-standard ports for security
    const port = parsedUrl.port;
    if (port && !['80', '443', '8080', '8443'].includes(port)) {
      return false;
    }

    // Additional checks for metadata endpoints
    if (hostname.includes('metadata') || hostname.includes('169.254.169.254')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

interface BrowseResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  images: string[];
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
  };
}

/**
 * Real Web Browser utility class
 */
class WebBrowser {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      });
      this.page = await this.browser.newPage();

      // Set user agent to avoid bot detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      // Set viewport
      await this.page.setViewport({ width: 1280, height: 720 });

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async browse(url: string): Promise<BrowseResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    try {
      // Navigate to the URL with timeout
      await this.page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Extract page information
      const result = await this.page.evaluate(() => {
        // Get page title
        const title = document.title || '';

        // Get meta description
        const descriptionMeta = document.querySelector('meta[name="description"]');
        const description = descriptionMeta ? descriptionMeta.getAttribute('content') || '' : '';

        // Get meta keywords
        const keywordsMeta = document.querySelector('meta[name="keywords"]');
        const keywords = keywordsMeta ? keywordsMeta.getAttribute('content') || '' : '';

        // Get author
        const authorMeta = document.querySelector('meta[name="author"]');
        const author = authorMeta ? authorMeta.getAttribute('content') || '' : '';

        // Get main content (try to avoid navigation, ads, etc.)
        let content = '';
        const contentSelectors = [
          'main',
          'article',
          '.content',
          '#content',
          '.post-content',
          '.entry-content',
          'body',
        ];

        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            content = (element as HTMLElement).innerText || element.textContent || '';
            break;
          }
        }

        // Fallback to body if no content found
        if (!content) {
          content = document.body ? document.body.innerText || document.body.textContent || '' : '';
        }

        // Clean up content (remove excessive whitespace)
        content = content.replace(/\s+/g, ' ').trim();

        // Limit content length to prevent overwhelming the context
        if (content.length > 5000) {
          content = `${content.substring(0, 5000)}...`;
        }

        // Get links
        const linkElements = Array.from(document.querySelectorAll('a[href]'));
        const links = linkElements
          .map((link) => link.getAttribute('href'))
          .filter((href): href is string => href !== null && href.startsWith('http'))
          .slice(0, 20); // Limit to first 20 links

        // Get images
        const imageElements = Array.from(document.querySelectorAll('img[src]'));
        const images = imageElements
          .map((img) => img.getAttribute('src'))
          .filter((src): src is string => src !== null && src.startsWith('http'))
          .slice(0, 10); // Limit to first 10 images

        return {
          title,
          content,
          links,
          images,
          metadata: {
            description,
            keywords,
            author,
          },
        };
      });

      return {
        url,
        ...result,
      };
    } catch (error) {
      logger.error(`Failed to browse ${url}:`, error);
      throw error;
    }
  }

  async searchDuckDuckGo(query: string): Promise<BrowseResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    try {
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait for results to load
      await this.page.waitForSelector('[data-testid="result"]', { timeout: 10000 });

      // Extract search results
      const results = await this.page.evaluate(() => {
        const resultElements = Array.from(document.querySelectorAll('[data-testid="result"]'));
        return resultElements
          .slice(0, 5)
          .map((element) => {
            const titleElement = element.querySelector('h2 a, h3 a');
            const snippetElement = element.querySelector('[data-result="snippet"]');
            const urlElement = element.querySelector('a[href]');

            const title = titleElement ? titleElement.textContent || '' : '';
            const snippet = snippetElement ? snippetElement.textContent || '' : '';
            const url = urlElement ? urlElement.getAttribute('href') || '' : '';

            return {
              title: title.trim(),
              content: snippet.trim(),
              url: url.trim(),
              links: [],
              images: [],
              metadata: {},
            };
          })
          .filter((result) => result.url && result.title);
      });

      return results;
    } catch (error) {
      logger.error(`Failed to search for "${query}":`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
      }
    } catch (error) {
      logger.error('Failed to close browser:', error);
    }
  }
}

// Global browser instance for reuse
let globalBrowser: WebBrowser | null = null;

async function getBrowserInstance(): Promise<WebBrowser> {
  if (!globalBrowser) {
    globalBrowser = new WebBrowser();
  }
  return globalBrowser;
}

/**
 * Browser Action - Actually browses and extracts information from web pages
 * This replaces the fake "I'll browse..." responses with real web searching
 */
export const browseWebAction: Action = {
  name: 'BROWSE_WEB',
  similes: ['SEARCH_WEB', 'VISIT_WEBSITE', 'READ_WEBPAGE', 'EXTRACT_INFO'],
  description:
    'Browses web pages and extracts information. Can be chained with file operations to save research findings or with analysis actions to process web content',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    // Basic action validation
    const hasKeywords =
      text.includes('browse') ||
      text.includes('visit') ||
      text.includes('search') ||
      (text.includes('read') &&
        (text.includes('website') || text.includes('webpage') || text.includes('http')));

    if (!hasKeywords) {
      return false;
    }

    // Security validation: Check for blocked domains/URLs
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const url = urlMatch[0];
      return isValidUrl(url);
    }

    // Security validation: Check for localhost patterns in text
    for (const pattern of LOCALHOST_PATTERNS) {
      if (text.includes(pattern)) {
        return false;
      }
    }

    // Security validation: Check blocked domains settings
    const blockedDomains = runtime.getSetting('BLOCKED_DOMAINS');
    if (blockedDomains) {
      try {
        const blocked = JSON.parse(blockedDomains as string);
        for (const domain of blocked) {
          if (text.includes(domain)) {
            return false;
          }
        }
      } catch {
        // Invalid JSON, continue
      }
    }

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    if (!callback) {
      return {
        data: {
          actionName: 'BROWSE_WEB',
          error: 'No callback provided',
        },
        values: {
          success: false,
          error: 'No callback provided',
        },
      };
    }

    // Security: Input sanitization and validation
    const text = sanitizeInput(message.content.text || '');

    // Security: Rate limiting check
    const rateLimitKey = `browse_${runtime.agentId}`;
    if (!(await checkRateLimit(rateLimitKey, 10, 60000))) {
      // 10 requests per minute
      await callback({
        text: 'Request rate limit exceeded. Please wait before making more web requests.',
        actions: ['BROWSE_WEB_RATE_LIMITED'],
        source: message.content.source,
      });
      return {
        data: {
          actionName: 'BROWSE_WEB',
          rateLimited: true,
          error: 'Rate limit exceeded',
        },
        values: {
          success: false,
          rateLimited: true,
          error: 'Rate limit exceeded',
        },
      };
    }

    const browser = await getBrowserInstance();

    try {
      // Extract search terms or URL from the message
      let searchTerm = '';
      let targetUrl = '';
      let browseResults: BrowseResult[] = [];

      // Check for direct URL
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        targetUrl = urlMatch[0];

        // Security: URL validation
        if (!isValidUrl(targetUrl)) {
          throw new Error('Invalid or blocked URL');
        }

        logger.info(`Browsing validated URL: ${sanitizeForLogging(targetUrl)}`);

        try {
          const result = await browser.browse(targetUrl);
          browseResults = [result];
          searchTerm = `Direct visit to ${new URL(targetUrl).hostname}`;
        } catch (error) {
          logger.error('Failed to browse URL:', { error: sanitizeError(error) });
          throw new Error('Failed to access the requested URL: Network or security restriction');
        }
      } else {
        // Extract search terms
        const searchMatch = text.match(
          /(?:browse|search|visit|read)\s+(?:for\s+)?(.+?)(?:\s+on\s+the\s+web)?$/i
        );
        searchTerm =
          searchMatch?.[1] || text.replace(/(?:browse|search|visit|read)\s*/i, '').trim();

        if (!searchTerm) {
          throw new Error('Could not extract search terms from the message');
        }

        // Security: Sanitize search terms
        searchTerm = sanitizeInput(searchTerm);

        logger.info(`Searching web for: ${sanitizeForLogging(searchTerm)}`);

        try {
          browseResults = await browser.searchDuckDuckGo(searchTerm);

          if (browseResults.length === 0) {
            throw new Error('No search results found');
          }
        } catch (error) {
          logger.error('Failed to search:', { error: sanitizeError(error) });
          throw new Error('Failed to search: Network or security restriction');
        }
      }

      // Format results for response with sanitization
      let resultsText = '';
      if (targetUrl) {
        const result = browseResults[0];
        resultsText = `**${sanitizeForLogging(result.title)}**
URL: ${result.url}

${sanitizeForLogging(result.content)}

${result.metadata.description ? `Description: ${sanitizeForLogging(result.metadata.description)}\n` : ''}${
          result.links.length > 0
            ? `\nRelated Links:\n${result.links
                .slice(0, 5)
                .map((link) => `- ${link}`)
                .join('\n')}`
            : ''
        }`;
      } else {
        resultsText = browseResults
          .map(
            (result, index) =>
              `${index + 1}. **${sanitizeForLogging(result.title)}**
   URL: ${result.url}
   ${sanitizeForLogging(result.content.substring(0, 200))}${result.content.length > 200 ? '...' : ''}`
          )
          .join('\n\n');
      }

      // Create a memory of what we found (with sanitized content)
      await runtime.createMemory(
        {
          id: createUniqueUuid(runtime, 'browse-result'),
          content: {
            text: `Real web browsing results for: ${sanitizeForLogging(searchTerm)}`,
            data: {
              searchTerm: sanitizeForLogging(searchTerm),
              targetUrl: targetUrl ? sanitizeForLogging(targetUrl) : '',
              results: browseResults.map((result) => ({
                ...result,
                title: sanitizeForLogging(result.title),
                content: sanitizeForLogging(result.content),
                metadata: {
                  ...result.metadata,
                  description: result.metadata.description
                    ? sanitizeForLogging(result.metadata.description)
                    : undefined,
                },
              })),
              timestamp: new Date().toISOString(),
              method: targetUrl ? 'direct_browse' : 'search',
              resultsCount: browseResults.length,
            },
          },
          roomId: message.roomId,
          worldId: message.worldId,
          agentId: runtime.agentId,
          entityId: runtime.agentId,
          createdAt: Date.now(),
        },
        'knowledge'
      );

      // Provide the actual results (sanitized)
      const thought = targetUrl
        ? 'I browsed a website and extracted the content.'
        : `I searched the web for "${sanitizeForLogging(searchTerm)}" and found ${browseResults.length} relevant results.`;

      const responseText = targetUrl
        ? `I browsed the requested website and extracted the following information:

${resultsText}

This information has been saved to my knowledge base for future reference.`
        : `I searched the web and found the following results:

${resultsText}

This information has been saved to my knowledge base for future reference.`;

      await callback({
        text: responseText,
        thought,
        actions: ['BROWSE_WEB'],
        source: message.content.source,
        data: {
          searchTerm: sanitizeForLogging(searchTerm),
          targetUrl: targetUrl ? sanitizeForLogging(targetUrl) : '',
          resultsStored: true,
          resultsCount: browseResults.length,
          method: targetUrl ? 'direct_browse' : 'search',
        },
      });

      return {
        data: {
          actionName: 'BROWSE_WEB',
          searchTerm,
          targetUrl,
          results: browseResults,
          resultsCount: browseResults.length,
          method: targetUrl ? 'direct_browse' : 'search',
        },
        values: {
          success: true,
          browseMethod: targetUrl ? 'direct' : 'search',
          resultsFound: browseResults.length,
          urls: browseResults.map((r) => r.url),
        },
      };
    } catch (error) {
      logger.error('Error in browseWeb handler:', { error: sanitizeError(error) });
      await callback({
        text: 'I encountered an error while browsing. This may be due to network issues, website blocking, or the site being temporarily unavailable.',
        actions: ['BROWSE_WEB_ERROR'],
        source: message.content.source,
        data: {
          error: 'Network or security restriction',
        },
      });

      return {
        data: {
          actionName: 'BROWSE_WEB',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        values: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Browse the ElizaOS documentation website',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I browsed the web and found the following:\n\n[Actual search results would appear here]\n\nThis information has been saved to my knowledge base for future reference.',
          actions: ['BROWSE_WEB'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Search for information about React hooks and save the findings to a file',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll search for information about React hooks and save the research findings to a file for you.",
          actions: ['BROWSE_WEB', 'FILE_OPERATION'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Browse the project documentation and analyze the architecture',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll browse the project documentation website and then analyze the architecture details I find.",
          actions: ['BROWSE_WEB', 'ANALYZE_DATA'],
        },
      },
    ],
  ] as ActionExample[][],
};

// Cleanup function to close browser when shutting down
export async function cleanupBrowser(): Promise<void> {
  if (globalBrowser) {
    await globalBrowser.close();
    globalBrowser = null;
  }
}
