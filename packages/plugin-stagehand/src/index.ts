import { Stagehand } from '@browserbasehq/stagehand';
import type { Plugin, UUID } from '@elizaos/core';
import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  type Provider,
  type ProviderResult,
  Service,
  type State,
} from '@elizaos/core';
import { z } from 'zod';
import { CapSolverService, detectCaptchaType, injectCaptchaSolution } from './capsolver';
import {
  BrowserActionError,
  BrowserNavigationError,
  BrowserSecurityError,
  BrowserServiceNotAvailableError,
  BrowserSessionError,
  handleBrowserError,
  StagehandError,
} from './errors';
import { browserRetryConfigs, retryWithBackoff } from './retry';
import { defaultUrlValidator, validateSecureAction } from './security';

/**
 * Configuration schema for the browser automation plugin
 */
const configSchema = z.object({
  BROWSERBASE_API_KEY: z.string().optional(),
  BROWSERBASE_PROJECT_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  BROWSER_HEADLESS: z
    .string()
    .transform((val) => val === 'true')
    .optional()
    .default('true'),
  CAPSOLVER_API_KEY: z.string().optional(),
  TRUTHSOCIAL_USERNAME: z.string().optional(),
  TRUTHSOCIAL_PASSWORD: z.string().optional(),
  TIKTOK_USERNAME: z.string().optional(),
  TIKTOK_PASSWORD: z.string().optional(),
  TIKTOK_TEST_VIDEO_PATH: z.string().optional(),
});

/**
 * Browser session management
 */
export class BrowserSession {
  constructor(
    public id: string,
    public stagehand: Stagehand,
    public createdAt: Date = new Date()
  ) {}

  get page() {
    return this.stagehand.page;
  }

  async destroy() {
    try {
      await this.stagehand.close();
    } catch (error) {
      logger.error('Error destroying browser session:', error);
    }
  }
}

/**
 * Stagehand service for browser automation
 */
export class StagehandService extends Service {
  static serviceType = 'stagehand';
  capabilityDescription = 'Browser automation service using Stagehand for web interactions';

  private sessions: Map<string, BrowserSession> = new Map();
  private currentSessionId: string | null = null;
  private maxSessions = 3;
  private capSolver: CapSolverService | null = null;

  constructor(protected runtime: IAgentRuntime) {
    super(runtime);

    // Initialize CapSolver if API key is available
    const capSolverApiKey = process.env.CAPSOLVER_API_KEY;
    if (capSolverApiKey) {
      this.capSolver = new CapSolverService({ apiKey: capSolverApiKey });
      logger.info('CapSolver service initialized');
    }
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('Starting Stagehand browser automation service');
    const service = new StagehandService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('Stopping Stagehand browser automation service');
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    if (!service) {
      throw new Error('Stagehand service not found');
    }
    await service.stop();
  }

  async stop() {
    logger.info('Cleaning up browser sessions');
    for (const [sessionId, session] of this.sessions) {
      await session.destroy();
      this.sessions.delete(sessionId);
    }
  }

  async createSession(sessionId: string): Promise<BrowserSession> {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      // Remove oldest session
      const oldestSession = Array.from(this.sessions.entries()).sort(
        ([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime()
      )[0];
      if (oldestSession) {
        await this.destroySession(oldestSession[0]);
      }
    }

    const env = process.env.BROWSERBASE_API_KEY ? 'BROWSERBASE' : 'LOCAL';
    const stagehand = new Stagehand({
      env,
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      headless: process.env.BROWSER_HEADLESS !== 'false',
      browserbaseSessionCreateParams:
        env === 'BROWSERBASE'
          ? {
              projectId: process.env.BROWSERBASE_PROJECT_ID!,
              browserSettings: {
                blockAds: true,
                viewport: {
                  width: 1280,
                  height: 720,
                },
              },
            }
          : undefined,
    });

    await stagehand.init();

    const session = new BrowserSession(sessionId, stagehand);
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;

    return session;
  }

  async getSession(sessionId: string): Promise<BrowserSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async getCurrentSession(): Promise<BrowserSession | undefined> {
    if (!this.currentSessionId) {
      return undefined;
    }
    return this.sessions.get(this.currentSessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.destroy();
      this.sessions.delete(sessionId);
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }
    }
  }

  async handleCaptcha(session: BrowserSession): Promise<boolean> {
    if (!this.capSolver) {
      logger.warn('CapSolver not configured, cannot solve captcha');
      return false;
    }

    try {
      const page = session.page;
      const url = page.url();

      // Detect captcha type
      const captchaInfo = await detectCaptchaType(page);

      if (!captchaInfo.type || !captchaInfo.siteKey) {
        logger.info('No captcha detected on page');
        return false;
      }

      logger.info(`Detected ${captchaInfo.type} captcha with sitekey: ${captchaInfo.siteKey}`);

      let solution: string;

      switch (captchaInfo.type) {
        case 'turnstile':
          solution = await this.capSolver.solveTurnstile(url, captchaInfo.siteKey);
          break;

        case 'recaptcha-v2':
          solution = await this.capSolver.solveRecaptchaV2(url, captchaInfo.siteKey);
          break;

        case 'recaptcha-v3':
          solution = await this.capSolver.solveRecaptchaV3(url, captchaInfo.siteKey, 'login');
          break;

        case 'hcaptcha':
          solution = await this.capSolver.solveHCaptcha(url, captchaInfo.siteKey);
          break;

        default:
          logger.error('Unknown captcha type');
          return false;
      }

      // Inject solution
      await injectCaptchaSolution(page, captchaInfo.type, solution);
      logger.info(`${captchaInfo.type} captcha solved and injected`);

      return true;
    } catch (error) {
      logger.error('Error handling captcha:', error);
      return false;
    }
  }
}

/**
 * Helper function to extract URL from text
 */
function extractUrl(text: string): string | null {
  // First try to find a URL in quotes
  const quotedUrlMatch = text.match(/["']([^"']+)["']/);
  if (quotedUrlMatch && (quotedUrlMatch[1].startsWith('http') || quotedUrlMatch[1].includes('.'))) {
    return quotedUrlMatch[1];
  }

  // Then try to find a URL pattern
  const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Try to find domain patterns
  const domainMatch = text.match(
    /(?:go to|navigate to|open|visit)\s+([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,})/i
  );
  if (domainMatch) {
    return `https://${domainMatch[1]}`;
  }

  return null;
}

/**
 * Browser navigation action
 */
const browserNavigateAction: Action = {
  name: 'BROWSER_NAVIGATE',
  similes: ['GO_TO_URL', 'OPEN_WEBSITE', 'VISIT_PAGE', 'NAVIGATE_TO'],
  description:
    'Navigate the browser to a specified URL. Can be chained with BROWSER_EXTRACT to get content or BROWSER_SCREENSHOT to capture the page',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    // Check if browser capability is enabled in runtime settings
    const browserEnabled = runtime.getSetting('ENABLE_BROWSER') === 'true' || 
                           runtime.getSetting('BROWSER_ENABLED') === 'true';
    
    if (!browserEnabled) {
      logger.debug('Browser capability disabled in settings.');
      return false;
    }

    // Check if stagehand service is available
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    if (!service) {
      logger.debug('Stagehand service not available.');
      return false;
    }

    const url = extractUrl(message.content.text || '');
    return url !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_NAVIGATE action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        const error = new BrowserServiceNotAvailableError();
        handleBrowserError(error, callback, 'navigate to the requested page');
        return {
          text: 'Browser service is not available',
          success: false,
          data: {
            actionName: 'BROWSER_NAVIGATE',
            error: 'service_not_available',
          },
          values: {
            success: false,
            errorType: 'service_not_available',
          },
        };
      }

      const url = extractUrl(message.content.text || '');
      if (!url) {
        const error = new StagehandError(
          'No URL found in message',
          'NO_URL_FOUND',
          "I couldn't find a URL in your request. Please provide a valid URL to navigate to.",
          false
        );
        handleBrowserError(error, callback, 'navigate to a page');
        return {
          text: "I couldn't find a URL in your request. Please provide a valid URL to navigate to.",
          success: false,
          data: {
            actionName: 'BROWSER_NAVIGATE',
            error: 'no_url_found',
          },
          values: {
            success: false,
            errorType: 'no_url_found',
          },
        };
      }

      // Validate URL security
      try {
        validateSecureAction(url, defaultUrlValidator);
      } catch (error) {
        if (error instanceof BrowserSecurityError) {
          handleBrowserError(error, callback);
          return {
        text: 'Security error: Cannot navigate to restricted URL',
        success: false,
            data: {
              actionName: 'BROWSER_NAVIGATE',
              error: 'security_error',
              url,
            },
            values: {
              success: false,
              errorType: 'security_error',
            },
          };
        }
        throw error;
      }

      // Get or create session
      let session = await service.getCurrentSession();
      if (!session) {
        const sessionId = `session-${Date.now()}`;
        session = await service.createSession(sessionId);
      }

      // Navigate to URL with retry logic
      await retryWithBackoff(
        async () => {
          await session.page.goto(url);
          await session.page.waitForLoadState('domcontentloaded');
        },
        browserRetryConfigs.navigation,
        `navigate to ${url}`
      );

      const title = await session.page.title();
      const responseContent: Content = {
        text: `I've navigated to ${url}. The page title is: "${title}"`,
        actions: ['BROWSER_NAVIGATE'],
        source: message.content.source,
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_NAVIGATE',
          url,
          title,
          sessionId: session.id,
        },
        values: {
          success: true,
          url,
          pageTitle: title,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_NAVIGATE action:', error);

      if (error instanceof StagehandError) {
        handleBrowserError(error, callback);
      } else {
        const browserError = new BrowserNavigationError(
          extractUrl(message.content.text || '') || 'the requested page',
          error as Error
        );
        handleBrowserError(browserError, callback);
      }
      return {
        text: 'Failed to navigate to the requested page',
        success: false,
        data: {
          actionName: 'BROWSER_NAVIGATE',
          error: error instanceof Error ? error.message : 'unknown_error',
          url: extractUrl(message.content.text || '') || 'unknown',
        },
        values: {
          success: false,
          errorType: 'navigation_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Navigate then extract
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go to google.com and extract the search button text',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll navigate to Google and then extract the search button text.",
          actions: ['BROWSER_NAVIGATE', 'BROWSER_EXTRACT'],
        },
      },
    ],
    // Multi-action: Navigate then screenshot
    [
      {
        name: '{{user}}',
        content: {
          text: 'Navigate to https://github.com/elizaos/eliza and take a screenshot',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll navigate to the ElizaOS GitHub page and take a screenshot for you.",
          actions: ['BROWSER_NAVIGATE', 'BROWSER_SCREENSHOT'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go to google.com',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ve navigated to https://google.com. The page title is: "Google"',
          actions: ['BROWSER_NAVIGATE'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser back action
 */
const browserBackAction: Action = {
  name: 'BROWSER_BACK',
  similes: ['GO_BACK', 'PREVIOUS_PAGE', 'BACK_BUTTON'],
  description:
    'Navigate back in browser history. Can be chained with BROWSER_EXTRACT to get content from the previous page or BROWSER_FORWARD to return',

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    // Check if browser capability is enabled in runtime settings
    const browserEnabled = runtime.getSetting('ENABLE_BROWSER') === 'true' || 
                           runtime.getSetting('BROWSER_ENABLED') === 'true';
    
    if (!browserEnabled) {
      logger.debug('Browser capability disabled in settings.');
      return false;
    }

    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    if (!service) {
      logger.debug('Stagehand service not available.');
      return false;
    }
    
    const session = await service.getCurrentSession();
    return session !== undefined;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_BACK action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        const error = new BrowserServiceNotAvailableError();
        handleBrowserError(error, callback, 'go back to the previous page');
        return {
        text: 'Browser service is not available',
        success: true,
          data: {
            actionName: 'BROWSER_BACK',
            error: 'service_not_available',
          },
          values: {
            success: false,
            errorType: 'service_not_available',
          },
        };
      }

      const session = await service.getCurrentSession();
      if (!session) {
        const error = new BrowserSessionError('No active browser session');
        handleBrowserError(error, callback, 'go back');
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_BACK',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      await session.page.goBack();
      await session.page.waitForLoadState('domcontentloaded');

      const title = await session.page.title();
      const url = session.page.url();

      const responseContent: Content = {
        text: `I've navigated back. Now on: "${title}" (${url})`,
        actions: ['BROWSER_BACK'],
        source: message.content.source,
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_BACK',
          url,
          title,
        },
        values: {
          success: true,
          url,
          pageTitle: title,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_BACK action:', error);
      const browserError = new BrowserActionError('go back', 'browser history', error as Error);
      handleBrowserError(browserError, callback);
      return {
        text: 'Failed to navigate back',
        success: false,
        data: {
          actionName: 'BROWSER_BACK',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'navigation_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Back then extract
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go back to the previous page and extract the main heading',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll go back and extract the main heading from the previous page.",
          actions: ['BROWSER_BACK', 'BROWSER_EXTRACT'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go back to the previous page',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ve navigated back. Now on: "Previous Page" (https://example.com)',
          actions: ['BROWSER_BACK'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser forward action
 */
const browserForwardAction: Action = {
  name: 'BROWSER_FORWARD',
  similes: ['GO_FORWARD', 'NEXT_PAGE', 'FORWARD_BUTTON'],
  description:
    'Navigate forward in browser history. Can be chained with BROWSER_BACK for navigation or BROWSER_EXTRACT to get content',

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    // Check if browser capability is enabled in runtime settings
    const browserEnabled = runtime.getSetting('ENABLE_BROWSER') === 'true' || 
                           runtime.getSetting('BROWSER_ENABLED') === 'true';
    
    if (!browserEnabled) {
      logger.debug('Browser capability disabled in settings.');
      return false;
    }

    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    if (!service) {
      logger.debug('Stagehand service not available.');
      return false;
    }
    
    const session = await service.getCurrentSession();
    return session !== undefined;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_FORWARD action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        throw new Error('StagehandService not available');
      }
      const session = await service.getCurrentSession();

      if (!session) {
        await callback?.({
          text: 'No active browser session. Please navigate to a page first.',
          actions: ['BROWSER_FORWARD_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_FORWARD',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      await session.page.goForward();
      await session.page.waitForLoadState('domcontentloaded');

      const title = await session.page.title();
      const url = session.page.url();

      const responseContent: Content = {
        text: `I've navigated forward. Now on: "${title}" (${url})`,
        actions: ['BROWSER_FORWARD'],
        source: message.content.source,
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_FORWARD',
          url,
          title,
        },
        values: {
          success: true,
          url,
          pageTitle: title,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_FORWARD action:', error);
      await callback?.({
        text: 'Failed to navigate forward',
        actions: ['BROWSER_FORWARD_ERROR'],
        source: message.content.source,
      });
      return {
        text: 'Failed to navigate forward',
        success: false,
        data: {
          actionName: 'BROWSER_FORWARD',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'navigation_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Back and forward navigation
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go back and then forward again',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll navigate back and then forward again.",
          actions: ['BROWSER_BACK', 'BROWSER_FORWARD'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go forward',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ve navigated forward. Now on: "Next Page" (https://example.com/next)',
          actions: ['BROWSER_FORWARD'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser refresh action
 */
const browserRefreshAction: Action = {
  name: 'BROWSER_REFRESH',
  similes: ['RELOAD_PAGE', 'REFRESH_PAGE', 'RELOAD', 'REFRESH'],
  description:
    'Refresh the current browser page. Can be chained with BROWSER_EXTRACT to get updated content or BROWSER_SCREENSHOT to capture refreshed state',

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    // Check if browser capability is enabled in runtime settings
    const browserEnabled = runtime.getSetting('ENABLE_BROWSER') === 'true' || 
                           runtime.getSetting('BROWSER_ENABLED') === 'true';
    
    if (!browserEnabled) {
      logger.debug('Browser capability disabled in settings.');
      return false;
    }

    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    if (!service) {
      logger.debug('Stagehand service not available.');
      return false;
    }
    
    const session = await service.getCurrentSession();
    return session !== undefined;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_REFRESH action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        throw new Error('StagehandService not available');
      }
      const session = await service.getCurrentSession();

      if (!session) {
        await callback?.({
          text: 'No active browser session. Please navigate to a page first.',
          actions: ['BROWSER_REFRESH_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_REFRESH',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      await session.page.reload();
      await session.page.waitForLoadState('domcontentloaded');

      const title = await session.page.title();
      const url = session.page.url();

      const responseContent: Content = {
        text: `I've refreshed the page. Still on: "${title}" (${url})`,
        actions: ['BROWSER_REFRESH'],
        source: message.content.source,
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_REFRESH',
          url,
          title,
        },
        values: {
          success: true,
          url,
          pageTitle: title,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_REFRESH action:', error);
      await callback?.({
        text: 'Failed to refresh the page',
        actions: ['BROWSER_REFRESH_ERROR'],
        source: message.content.source,
      });
      return {
        text: 'Failed to refresh the page',
        success: false,
        data: {
          actionName: 'BROWSER_REFRESH',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'refresh_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Refresh then extract
    [
      {
        name: '{{user}}',
        content: {
          text: 'Refresh the page and extract any new notifications',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll refresh the page and check for new notifications.",
          actions: ['BROWSER_REFRESH', 'BROWSER_EXTRACT'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Refresh the page',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ve refreshed the page. Still on: "Example Page" (https://example.com)',
          actions: ['BROWSER_REFRESH'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser click action
 */
const browserClickAction: Action = {
  name: 'BROWSER_CLICK',
  similes: ['CLICK_ELEMENT', 'CLICK_BUTTON', 'CLICK_LINK', 'CLICK_ON'],
  description:
    'Click on an element in the browser using natural language description. Can be chained with BROWSER_TYPE to fill forms or BROWSER_EXTRACT to get results after clicking',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    const session = await service?.getCurrentSession();
    if (!session) {
      return false;
    }

    // Check if message contains click intent
    const text = message.content.text?.toLowerCase() || '';
    return text.includes('click') || text.includes('tap') || text.includes('press');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_CLICK action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        throw new Error('StagehandService not available');
      }
      const session = await service.getCurrentSession();

      if (!session) {
        await callback?.({
          text: 'No active browser session. Please navigate to a page first.',
          actions: ['BROWSER_CLICK_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_CLICK',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      // Extract what to click from the message
      const text = message.content.text || '';
      const elementDescription = text.replace(/^(click|tap|press)\s+(on\s+)?/i, '').trim();

      // Use Stagehand's AI-powered click
      await session.stagehand.act({
        action: `click on ${elementDescription}`,
      });

      const responseContent: Content = {
        text: `I've clicked on "${elementDescription}"`,
        actions: ['BROWSER_CLICK'],
        source: message.content.source,
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_CLICK',
          element: elementDescription,
        },
        values: {
          success: true,
          clickedElement: elementDescription,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_CLICK action:', error);
      await callback?.({
        text: 'Failed to click on the requested element',
        actions: ['BROWSER_CLICK_ERROR'],
        source: message.content.source,
      });
      return {
        text: 'Failed to click on the requested element',
        success: false,
        data: {
          actionName: 'BROWSER_CLICK',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'click_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Click then extract results
    [
      {
        name: '{{user}}',
        content: {
          text: 'Click on the search button and extract the results',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll click the search button and extract the results.",
          actions: ['BROWSER_CLICK', 'BROWSER_EXTRACT'],
        },
      },
    ],
    // Multi-action: Fill form workflow
    [
      {
        name: '{{user}}',
        content: {
          text: 'Click on the username field and type my email',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll click on the username field and then type your email.",
          actions: ['BROWSER_CLICK', 'BROWSER_TYPE'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Click on the search button',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ve clicked on "the search button"',
          actions: ['BROWSER_CLICK'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser type action
 */
const browserTypeAction: Action = {
  name: 'BROWSER_TYPE',
  similes: ['TYPE_TEXT', 'ENTER_TEXT', 'FILL_FIELD', 'INPUT_TEXT'],
  description:
    'Type text into an input field or element. Can be chained with BROWSER_CLICK to select fields or BROWSER_SELECT to complete forms',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    const session = await service?.getCurrentSession();
    if (!session) {
      return false;
    }

    const text = message.content.text?.toLowerCase() || '';
    return (
      text.includes('type') ||
      text.includes('enter') ||
      text.includes('fill') ||
      text.includes('input')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_TYPE action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        throw new Error('StagehandService not available');
      }
      const session = await service.getCurrentSession();

      if (!session) {
        await callback?.({
          text: 'No active browser session. Please navigate to a page first.',
          actions: ['BROWSER_TYPE_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_TYPE',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      // Parse the message to extract what to type and where
      const text = message.content.text || '';
      const match =
        text.match(/(?:type|enter|fill|input)\s+["']([^"']+)["']\s+(?:in|into|to)?\s+(.+)/i) ||
        text.match(/(?:type|enter|fill|input)\s+(.+?)\s+(?:in|into|to)\s+(.+)/i);

      if (!match) {
        await callback?.({
          text: 'Could not understand the type command. Please use format: "type \'text\' in field"',
          actions: ['BROWSER_TYPE_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'Could not understand the type command. Please use format: "type \'text\' in field"',
        success: false,
          data: {
            actionName: 'BROWSER_TYPE',
            error: 'parse_error',
          },
          values: {
            success: false,
            errorType: 'parse_error',
          },
        };
      }

      const [, textToType, fieldDescription] = match;

      // Use Stagehand's AI-powered type
      await session.stagehand.act({
        action: `type "${textToType}" into ${fieldDescription}`,
      });

      const responseContent: Content = {
        text: `I've typed "${textToType}" into ${fieldDescription}`,
        actions: ['BROWSER_TYPE'],
        source: message.content.source,
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_TYPE',
          typedText: textToType,
          targetField: fieldDescription,
        },
        values: {
          success: true,
          text: textToType,
          field: fieldDescription,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_TYPE action:', error);
      await callback?.({
        text: 'Failed to type in the requested field',
        actions: ['BROWSER_TYPE_ERROR'],
        source: message.content.source,
      });
      return {
        text: 'Failed to type in the requested field',
        success: false,
        data: {
          actionName: 'BROWSER_TYPE',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'type_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Type and click submit
    [
      {
        name: '{{user}}',
        content: {
          text: 'Type "ElizaOS" in the search box and click search',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ll type "ElizaOS" in the search box and then click search.',
          actions: ['BROWSER_TYPE', 'BROWSER_CLICK'],
        },
      },
    ],
    // Multi-action: Fill multiple fields
    [
      {
        name: '{{user}}',
        content: {
          text: 'Type my email in the username field then type password in the password field',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll type your email and password in the respective fields.",
          actions: ['BROWSER_TYPE', 'BROWSER_TYPE'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Type "ElizaOS" in the search box',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ve typed "ElizaOS" into the search box',
          actions: ['BROWSER_TYPE'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser select action
 */
const browserSelectAction: Action = {
  name: 'BROWSER_SELECT',
  similes: ['SELECT_OPTION', 'CHOOSE_FROM_DROPDOWN', 'PICK_OPTION'],
  description:
    'Select an option from a dropdown or select element. Can be chained with BROWSER_TYPE for form filling or BROWSER_CLICK to submit forms',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    const session = await service?.getCurrentSession();
    if (!session) {
      return false;
    }

    const text = message.content.text?.toLowerCase() || '';
    return text.includes('select') || text.includes('choose') || text.includes('pick');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_SELECT action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        throw new Error('StagehandService not available');
      }
      const session = await service.getCurrentSession();

      if (!session) {
        await callback?.({
          text: 'No active browser session. Please navigate to a page first.',
          actions: ['BROWSER_SELECT_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_SELECT',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      const text = message.content.text || '';
      const match =
        text.match(/(?:select|choose|pick)\s+["']([^"']+)["']\s+(?:from|in)?\s+(.+)/i) ||
        text.match(/(?:select|choose|pick)\s+(.+?)\s+(?:from|in)\s+(.+)/i);

      if (!match) {
        await callback?.({
          text: 'Could not understand the select command. Please use format: "select \'option\' from dropdown"',
          actions: ['BROWSER_SELECT_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'Could not understand the select command. Please use format: "select \'option\' from dropdown"',
        success: false,
          data: {
            actionName: 'BROWSER_SELECT',
            error: 'parse_error',
          },
          values: {
            success: false,
            errorType: 'parse_error',
          },
        };
      }

      const [, optionToSelect, dropdownDescription] = match;

      // Use Stagehand's AI-powered select
      await session.stagehand.act({
        action: `select "${optionToSelect}" from ${dropdownDescription}`,
      });

      const responseContent: Content = {
        text: `I've selected "${optionToSelect}" from ${dropdownDescription}`,
        actions: ['BROWSER_SELECT'],
        source: message.content.source,
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_SELECT',
          selectedOption: optionToSelect,
          dropdown: dropdownDescription,
        },
        values: {
          success: true,
          option: optionToSelect,
          dropdown: dropdownDescription,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_SELECT action:', error);
      await callback?.({
        text: 'Failed to select from the dropdown',
        actions: ['BROWSER_SELECT_ERROR'],
        source: message.content.source,
      });
      return {
        text: 'Failed to select from the dropdown',
        success: false,
        data: {
          actionName: 'BROWSER_SELECT',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'select_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Select multiple options
    [
      {
        name: '{{user}}',
        content: {
          text: 'Select "United States" from country dropdown and "California" from state dropdown',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll select the country and state for you.",
          actions: ['BROWSER_SELECT', 'BROWSER_SELECT'],
        },
      },
    ],
    // Multi-action: Complete form workflow
    [
      {
        name: '{{user}}',
        content: {
          text: 'Select "Premium" from the plan dropdown and click subscribe',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll select the Premium plan and click subscribe.",
          actions: ['BROWSER_SELECT', 'BROWSER_CLICK'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Select "United States" from the country dropdown',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've selected 'United States' from the country dropdown",
          actions: ['BROWSER_SELECT'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser extract action
 */
const browserExtractAction: Action = {
  name: 'BROWSER_EXTRACT',
  similes: ['GET_TEXT', 'EXTRACT_DATA', 'READ_CONTENT', 'SCRAPE_TEXT'],
  description:
    'Extract text or data from the current page. Can be chained with BROWSER_NAVIGATE to visit pages first or BROWSER_CLICK to extract after interactions',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    const session = await service?.getCurrentSession();
    if (!session) {
      return false;
    }

    const text = message.content.text?.toLowerCase() || '';
    return (
      text.includes('extract') ||
      text.includes('get') ||
      text.includes('read') ||
      text.includes('find')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_EXTRACT action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        throw new Error('StagehandService not available');
      }
      const session = await service.getCurrentSession();

      if (!session) {
        await callback?.({
          text: 'No active browser session. Please navigate to a page first.',
          actions: ['BROWSER_EXTRACT_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_EXTRACT',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      const text = message.content.text || '';
      const instruction = text.replace(/^(extract|get|read|find)\s+/i, '').trim();

      // Use Stagehand's extract method
      const extractedData = await session.stagehand.extract({
        instruction,
        schema: z.object({
          data: z.string().describe('The extracted data'),
          found: z.boolean().describe('Whether the requested data was found'),
        }) as any,
      });

      const responseContent: Content = {
        text: extractedData.found
          ? `I found the following: "${extractedData.data}"`
          : 'I could not find the requested information on this page',
        actions: ['BROWSER_EXTRACT'],
        source: message.content.source,
        data: extractedData,
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_EXTRACT',
          extracted: extractedData.data,
          found: extractedData.found,
          instruction,
        },
        values: {
          success: extractedData.found,
          extractedText: extractedData.data,
          dataFound: extractedData.found,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_EXTRACT action:', error);
      await callback?.({
        text: 'Failed to extract data from the page',
        actions: ['BROWSER_EXTRACT_ERROR'],
        source: message.content.source,
      });
      return {
        text: 'Failed to extract data from the page',
        success: false,
        data: {
          actionName: 'BROWSER_EXTRACT',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'extract_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Navigate and extract
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go to the news website and extract the top headlines',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll navigate to the news website and extract the top headlines.",
          actions: ['BROWSER_NAVIGATE', 'BROWSER_EXTRACT'],
        },
      },
    ],
    // Multi-action: Click and extract
    [
      {
        name: '{{user}}',
        content: {
          text: 'Click on "Show More" and extract the additional content',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ll click "Show More" and extract the additional content.',
          actions: ['BROWSER_CLICK', 'BROWSER_EXTRACT'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Extract the main heading from the page',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I found the following: "Welcome to ElizaOS"',
          actions: ['BROWSER_EXTRACT'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser screenshot action
 */
const browserScreenshotAction: Action = {
  name: 'BROWSER_SCREENSHOT',
  similes: ['TAKE_SCREENSHOT', 'CAPTURE_PAGE', 'SCREENSHOT_PAGE'],
  description:
    'Take a screenshot of the current page. Can be chained with BROWSER_NAVIGATE to capture specific pages or BROWSER_CLICK to capture after interactions',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    const session = await service?.getCurrentSession();
    if (!session) {
      return false;
    }

    const text = message.content.text?.toLowerCase() || '';
    return text.includes('screenshot') || text.includes('capture') || text.includes('snapshot');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_SCREENSHOT action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        throw new Error('StagehandService not available');
      }
      const session = await service.getCurrentSession();

      if (!session) {
        await callback?.({
          text: 'No active browser session. Please navigate to a page first.',
          actions: ['BROWSER_SCREENSHOT_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_SCREENSHOT',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      // Take screenshot
      const screenshot = await session.page.screenshot({
        type: 'png',
        fullPage: true,
      });

      // Convert to base64
      const base64Screenshot = screenshot.toString('base64');
      const url = session.page.url();
      const title = await session.page.title();

      const responseContent: Content = {
        text: "I've taken a screenshot of the current page",
        actions: ['BROWSER_SCREENSHOT'],
        source: message.content.source,
        data: {
          screenshot: base64Screenshot,
          mimeType: 'image/png',
        },
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_SCREENSHOT',
          screenshot: base64Screenshot,
          mimeType: 'image/png',
          url,
          title,
        },
        values: {
          success: true,
          hasScreenshot: true,
          pageUrl: url,
          pageTitle: title,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_SCREENSHOT action:', error);
      await callback?.({
        text: 'Failed to take screenshot',
        actions: ['BROWSER_SCREENSHOT_ERROR'],
        source: message.content.source,
      });
      return {
        text: 'Failed to take screenshot',
        success: false,
        data: {
          actionName: 'BROWSER_SCREENSHOT',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'screenshot_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Navigate and screenshot
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go to the ElizaOS homepage and take a screenshot',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll navigate to the ElizaOS homepage and take a screenshot.",
          actions: ['BROWSER_NAVIGATE', 'BROWSER_SCREENSHOT'],
        },
      },
    ],
    // Multi-action: Click and screenshot
    [
      {
        name: '{{user}}',
        content: {
          text: 'Click on the menu button and take a screenshot of the expanded menu',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll click the menu button and capture the expanded menu.",
          actions: ['BROWSER_CLICK', 'BROWSER_SCREENSHOT'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Take a screenshot of the page',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've taken a screenshot of the current page",
          actions: ['BROWSER_SCREENSHOT'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser solve captcha action
 */
const browserSolveCaptchaAction: Action = {
  name: 'BROWSER_SOLVE_CAPTCHA',
  similes: ['SOLVE_CAPTCHA', 'HANDLE_CAPTCHA', 'BYPASS_CAPTCHA'],
  description:
    'Detect and solve CAPTCHA on the current page. Can be chained with BROWSER_NAVIGATE to handle protected pages or BROWSER_CLICK to proceed after solving',

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    const session = await service?.getCurrentSession();
    if (!session) {
      return false;
    }

    // Check if CapSolver is configured
    return !!process.env.CAPSOLVER_API_KEY;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling BROWSER_SOLVE_CAPTCHA action');

      const service = runtime.getService<StagehandService>(StagehandService.serviceType);
      if (!service) {
        throw new Error('StagehandService not available');
      }
      const session = await service.getCurrentSession();

      if (!session) {
        await callback?.({
          text: 'No active browser session. Please navigate to a page first.',
          actions: ['BROWSER_SOLVE_CAPTCHA_ERROR'],
          source: message.content.source,
        });
        return {
        text: 'No active browser session. Please navigate to a page first.',
        success: false,
          data: {
            actionName: 'BROWSER_SOLVE_CAPTCHA',
            error: 'no_session',
          },
          values: {
            success: false,
            errorType: 'no_session',
          },
        };
      }

      // Use the service's handleCaptcha method
      const solved = await (service as any).handleCaptcha(session);

      const responseContent: Content = {
        text: solved
          ? "I've successfully solved the CAPTCHA on this page"
          : 'No CAPTCHA was detected on this page',
        actions: ['BROWSER_SOLVE_CAPTCHA'],
        source: message.content.source,
        data: { solved },
      };

      await callback?.(responseContent);
      return {
        text: responseContent.text,
        success: true,
        data: {
          actionName: 'BROWSER_SOLVE_CAPTCHA',
          captchaSolved: solved,
          url: session.page.url(),
        },
        values: {
          success: true,
          captchaFound: solved,
          captchaSolved: solved,
        },
      };
    } catch (error) {
      logger.error('Error in BROWSER_SOLVE_CAPTCHA action:', error);
      await callback?.({
        text: 'Failed to solve CAPTCHA',
        actions: ['BROWSER_SOLVE_CAPTCHA_ERROR'],
        source: message.content.source,
      });
      return {
        text: 'Failed to solve CAPTCHA',
        success: false,
        data: {
          actionName: 'BROWSER_SOLVE_CAPTCHA',
          error: error instanceof Error ? error.message : 'unknown_error',
        },
        values: {
          success: false,
          errorType: 'captcha_error',
        },
      };
    }
  },

  /* v8 ignore start */
  examples: [
    // Multi-action: Navigate to protected page and solve captcha
    [
      {
        name: '{{user}}',
        content: {
          text: 'Go to the login page and solve any captcha if present',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll navigate to the login page and handle any captcha.",
          actions: ['BROWSER_NAVIGATE', 'BROWSER_SOLVE_CAPTCHA'],
        },
      },
    ],
    // Multi-action: Solve captcha and proceed
    [
      {
        name: '{{user}}',
        content: {
          text: 'Solve the captcha and click the submit button',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll solve the captcha and then submit the form.",
          actions: ['BROWSER_SOLVE_CAPTCHA', 'BROWSER_CLICK'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Solve the captcha on this page',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've successfully solved the CAPTCHA on this page",
          actions: ['BROWSER_SOLVE_CAPTCHA'],
        },
      },
    ],
  ],
  /* v8 ignore stop */
};

/**
 * Browser state provider
 */
const browserStateProvider: Provider = {
  name: 'BROWSER_STATE',
  description:
    'Provides current browser state information including active session status, current page URL, and page title. Useful for checking browser context before performing actions',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<ProviderResult> => {
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    const session = await service?.getCurrentSession();

    if (!session) {
      return {
        text: 'No active browser session',
        values: {
          hasSession: false,
        },
        data: {},
      };
    }

    try {
      const url = session.page.url();
      const title = await session.page.title();

      return {
        text: `Current browser page: "${title}" at ${url}`,
        values: {
          hasSession: true,
          url,
          title,
        },
        data: {
          sessionId: session.id,
          createdAt: session.createdAt,
        },
      };
    } catch (error) {
      logger.error('Error getting browser state:', error);
      return {
        text: 'Error getting browser state',
        values: {
          hasSession: true,
          error: true,
        },
        data: {},
      };
    }
  },
};

/**
 * Stagehand browser automation plugin for ElizaOS
 */
/**
 * E2E Test Suite for Stagehand Plugin
 */
const stagehandE2ETestSuite = {
  name: 'stagehand_plugin_e2e_tests',
  description: 'E2E tests for the Stagehand browser automation plugin',
  tests: [
    {
      name: 'should_navigate_to_url',
      fn: async (runtime: IAgentRuntime) => {
        const service = runtime.getService<StagehandService>(StagehandService.serviceType);
        if (!service) {
          throw new Error('StagehandService not available');
        }

        // Create a session
        const session = await service.createSession('test-navigation-session');

        // Navigate to a URL
        await session.page.goto('https://example.com');
        await session.page.waitForLoadState('domcontentloaded');

        // Verify we're on the right page
        const url = session.page.url();
        const title = await session.page.title();

        if (!url.includes('example.com')) {
          throw new Error(`Expected URL to contain example.com, got ${url}`);
        }

        if (!title) {
          throw new Error('Expected page to have a title');
        }

        // Clean up
        await service.destroySession('test-navigation-session');
      },
    },
    {
      name: 'should_detect_and_handle_captcha',
      fn: async (runtime: IAgentRuntime) => {
        const service = runtime.getService<StagehandService>(StagehandService.serviceType);
        if (!service) {
          throw new Error('StagehandService not available');
        }

        const capSolverKey = runtime.getSetting('CAPSOLVER_API_KEY');
        if (!capSolverKey) {
          logger.warn('Skipping CAPTCHA test - CAPSOLVER_API_KEY not configured');
          return;
        }

        // Create a session
        const session = await service.createSession('test-captcha-session');

        // Navigate to a demo page with CAPTCHA
        await session.page.goto('https://2captcha.com/demo/cloudflare-turnstile');
        await session.page.waitForLoadState('networkidle');

        // Detect CAPTCHA
        const captchaInfo = await detectCaptchaType(session.page);

        if (!captchaInfo.type) {
          throw new Error('Expected to detect a CAPTCHA on the demo page');
        }

        logger.info(`Detected ${captchaInfo.type} CAPTCHA`);

        // Clean up
        await service.destroySession('test-captcha-session');
      },
    },
    {
      name: 'truthsocial_login_flow',
      fn: async (runtime: IAgentRuntime) => {
        const username = runtime.getSetting('TRUTHSOCIAL_USERNAME');
        const password = runtime.getSetting('TRUTHSOCIAL_PASSWORD');
        const capSolverKey = runtime.getSetting('CAPSOLVER_API_KEY');

        if (!username || !password) {
          logger.warn('Skipping Truth Social test - credentials not configured');
          return;
        }

        const service = runtime.getService<StagehandService>(StagehandService.serviceType);
        if (!service) {
          throw new Error('StagehandService not available');
        }

        const session = await service.createSession('test-truthsocial-session');

        try {
          // Navigate to Truth Social login
          await session.page.goto('https://truthsocial.com/login');
          await session.page.waitForLoadState('networkidle');

          // Type username
          await session.stagehand.act({
            action: `type "${username}" into the username field`,
          });

          // Type password
          await session.stagehand.act({
            action: `type "${password}" into the password field`,
          });

          // Click login
          await session.stagehand.act({
            action: 'click on the login button',
          });

          // Wait for potential CAPTCHA
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Check for CAPTCHA and solve if present
          if (capSolverKey) {
            const handled = await (service as any).handleCaptcha(session);
            if (handled) {
              logger.info('CAPTCHA was solved successfully');
            }
          }

          // Wait for login to complete
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Try to extract user info to verify login
          const userInfo = await session.stagehand.extract({
            instruction: 'Extract the username or profile name',
            schema: z.object({
              username: z.string().optional(),
              found: z.boolean(),
            }) as any,
          });

          if (userInfo.found && userInfo.username) {
            logger.info(`Login successful! Found user: ${userInfo.username}`);
          } else {
            logger.warn('Could not verify login success');
          }

          // Extract bearer token from localStorage or sessionStorage
          let bearerToken: string | null = null;
          try {
            bearerToken = await session.page.evaluate(() => {
              // Check localStorage
              const localToken = window.localStorage.getItem('access_token');
              if (localToken) {
                return localToken;
              }

              // Check sessionStorage
              const sessionToken = window.sessionStorage.getItem('access_token');
              if (sessionToken) {
                return sessionToken;
              }

              // Check for token in various common keys
              const keys = ['auth_token', 'authToken', 'bearer', 'token', 'jwt'];
              for (const key of keys) {
                const local = window.localStorage.getItem(key);
                if (local) {
                  return local;
                }
                const session = window.sessionStorage.getItem(key);
                if (session) {
                  return session;
                }
              }

              // Try to get from window object
              if ((globalThis as any).authToken) {
                return (globalThis as any).authToken;
              }
              if ((globalThis as any).bearerToken) {
                return (globalThis as any).bearerToken;
              }

              return null;
            });

            if (bearerToken) {
              logger.info(
                `Successfully retrieved bearer token: ${bearerToken.substring(0, 20)}...`
              );
            } else {
              logger.warn('Bearer token not found in storage');

              // Try to intercept network requests to get the token
              const cdp = await session.page.context().newCDPSession(session.page);
              await cdp.send('Network.enable');

              // Set up request interception
              await new Promise<void>((resolve) => {
                cdp.on('Network.responseReceived', (event: any) => {
                  const headers = event.response.headers;
                  if (headers.authorization) {
                    bearerToken = headers.authorization.replace('Bearer ', '');
                    logger.info(
                      `Intercepted bearer token from network: ${bearerToken?.substring(0, 20)}...`
                    );
                    resolve();
                  }
                });

                // Wait max 5 seconds for token
                setTimeout(() => resolve(), 5000);
              });
            }
          } catch (error) {
            logger.error('Error retrieving bearer token:', error);
          }

          // Log test results
          logger.info('Truth Social login test results:', {
            loginSuccess: userInfo.found && !!userInfo.username,
            username: userInfo.username,
            bearerToken: bearerToken ? `${bearerToken.substring(0, 20)}...` : null,
          });
        } finally {
          // Clean up
          await service.destroySession('test-truthsocial-session');
        }
      },
    },
    {
      name: 'truthsocial_compose_post',
      fn: async (runtime: IAgentRuntime) => {
        const username = runtime.getSetting('TRUTHSOCIAL_USERNAME');
        const password = runtime.getSetting('TRUTHSOCIAL_PASSWORD');

        if (!username || !password) {
          logger.warn('Skipping Truth Social compose test - credentials not configured');
          return;
        }

        const service = runtime.getService<StagehandService>(StagehandService.serviceType);
        if (!service) {
          throw new Error('StagehandService not available');
        }

        const session = await service.createSession('test-compose-session');

        try {
          // Navigate to Truth Social
          await session.page.goto('https://truthsocial.com/');
          await session.page.waitForTimeout(2000);

          // Click Sign In
          await session.page.click('button:has-text("Sign In")');
          await session.page.waitForTimeout(2000);

          // Login
          await session.page.fill('input[type="text"]', username);
          await session.page.fill('input[type="password"]', password);
          await session.page.click('button[type="submit"]');

          // Wait for login and check for CAPTCHA
          await session.page.waitForTimeout(3000);
          const handled = await (service as any).handleCaptcha(session);
          if (handled) {
            logger.info('CAPTCHA was solved');
          }

          // Wait for redirect to home
          await session.page.waitForTimeout(5000);

          // Extract bearer token after login
          let bearerToken: string | null = null;
          try {
            bearerToken = await session.page.evaluate(() => {
              // Check common storage locations
              const keys = ['access_token', 'auth_token', 'authToken', 'bearer', 'token', 'jwt'];
              for (const key of keys) {
                const local = window.localStorage.getItem(key);
                if (local) {
                  return local;
                }
                const session = window.sessionStorage.getItem(key);
                if (session) {
                  return session;
                }
              }
              return null;
            });

            if (bearerToken) {
              logger.info(
                `Bearer token retrieved in compose test: ${bearerToken.substring(0, 20)}...`
              );
            }
          } catch (error) {
            logger.warn('Could not retrieve bearer token:', error);
          }

          // Click the Compose button on the left sidebar
          const composeButton = await session.page.waitForSelector('button:has-text("Compose")', {
            timeout: 10000,
          });
          await composeButton.click();
          logger.info('Clicked Compose button');

          // Wait for compose modal
          await session.page.waitForTimeout(2000);

          // Type post content
          const timestamp = new Date().toISOString();
          const postContent = `🤖 E2E test post from ElizaOS browser plugin - ${timestamp}`;
          await session.page.keyboard.type(postContent);
          logger.info('Typed post content');

          // Submit post
          await session.page.click('button:has-text("Truth")');
          logger.info('Submitted post');

          await session.page.waitForTimeout(3000);
          logger.info('Post created successfully!');
        } finally {
          await service.destroySession('test-compose-session');
        }
      },
    },
    {
      name: 'tiktok_login_and_upload',
      fn: async (runtime: IAgentRuntime) => {
        const username = runtime.getSetting('TIKTOK_USERNAME');
        const password = runtime.getSetting('TIKTOK_PASSWORD');
        const videoPath = runtime.getSetting('TIKTOK_TEST_VIDEO_PATH');

        if (!username || !password) {
          logger.warn('Skipping TikTok test - credentials not configured');
          return;
        }

        if (!videoPath) {
          logger.warn('Skipping TikTok test - TIKTOK_TEST_VIDEO_PATH not configured');
          return;
        }

        const service = runtime.getService<StagehandService>(StagehandService.serviceType);
        if (!service) {
          throw new Error('StagehandService not available');
        }

        const session = await service.createSession('test-tiktok-session');

        try {
          // Navigate to TikTok
          await session.page.goto('https://www.tiktok.com/login');
          await session.page.waitForLoadState('networkidle');

          // Click on "Use phone / email / username"
          await session.stagehand.act({
            action: 'click on "Use phone / email / username" option',
          });

          await session.page.waitForTimeout(2000);

          // Click on "Log in with email or username"
          await session.stagehand.act({
            action: 'click on "Log in with email or username"',
          });

          await session.page.waitForTimeout(2000);

          // Enter username
          await session.stagehand.act({
            action: `type "${username}" into the email or username field`,
          });

          // Enter password
          await session.stagehand.act({
            action: `type "${password}" into the password field`,
          });

          // Click login button
          await session.stagehand.act({
            action: 'click the Log in button',
          });

          // Wait for potential CAPTCHA
          await session.page.waitForTimeout(3000);

          // Check for CAPTCHA and solve if present
          const capSolverKey = runtime.getSetting('CAPSOLVER_API_KEY');
          if (capSolverKey) {
            const handled = await (service as any).handleCaptcha(session);
            if (handled) {
              logger.info('TikTok CAPTCHA was solved successfully');
            }
          }

          // Wait for login to complete
          await session.page.waitForTimeout(5000);

          // Extract auth token/session info
          let authToken: string | null = null;
          try {
            authToken = await session.page.evaluate(() => {
              // Check common TikTok token storage locations
              const keys = ['sessionid', 'tt_webid', 'tt_csrf_token', 'access_token', 'auth_token'];
              for (const key of keys) {
                const cookie = (globalThis as any).document?.cookie
                  ?.split('; ')
                  .find((row: string) => row.startsWith(key));
                if (cookie) {
                  return cookie.split('=')[1];
                }

                const local = window.localStorage.getItem(key);
                if (local) {
                  return local;
                }

                const session = window.sessionStorage.getItem(key);
                if (session) {
                  return session;
                }
              }
              return null;
            });

            if (authToken) {
              logger.info(`TikTok auth token retrieved: ${authToken.substring(0, 20)}...`);
            }
          } catch (error) {
            logger.warn('Could not retrieve TikTok auth token:', error);
          }

          // Navigate to upload page
          await session.page.goto('https://www.tiktok.com/upload');
          await session.page.waitForTimeout(3000);

          // Upload video file
          const fileInput = await session.page.waitForSelector('input[type="file"]', {
            timeout: 10000,
          });
          await fileInput.setInputFiles(videoPath);
          logger.info(`Uploaded video file: ${videoPath}`);

          // Wait for upload to process
          await session.page.waitForTimeout(5000);

          // Add caption
          const caption = `🤖 Test upload from ElizaOS browser plugin - ${new Date().toISOString()}`;
          await session.stagehand.act({
            action: `type "${caption}" into the caption/description field`,
          });

          logger.info('Added video caption');

          // Optional: Add hashtags
          await session.stagehand.act({
            action: 'click in the caption field and add #test #automation #elizaos at the end',
          });

          // Set privacy settings (optional)
          try {
            await session.stagehand.act({
              action: 'click on "Who can view this video" and select "Private" option',
            });
            logger.info('Set video to private for testing');
          } catch (error) {
            logger.warn('Could not set privacy settings, continuing with defaults', error);
          }

          // Click Post button
          await session.stagehand.act({
            action: 'click the Post or Publish button',
          });

          logger.info('Clicked post button, waiting for upload confirmation');

          // Wait for upload confirmation
          await session.page.waitForTimeout(10000);

          // Try to extract upload result
          const uploadResult = await session.stagehand.extract({
            instruction: 'Extract any success message or video URL after upload',
            schema: z.object({
              success: z.boolean(),
              message: z.string().optional(),
              videoUrl: z.string().optional(),
            }) as any,
          });

          if (uploadResult.success) {
            logger.info('TikTok video uploaded successfully!', uploadResult);
          } else {
            logger.warn('Could not confirm upload success', uploadResult);
          }

          // Log final results
          logger.info('TikTok test completed', {
            loginSuccess: !!authToken,
            uploadAttempted: true,
            authToken: authToken ? `${authToken.substring(0, 20)}...` : null,
            uploadResult,
          });
        } catch (error) {
          logger.error('Error in TikTok test:', error);
          throw error;
        } finally {
          // Clean up
          await service.destroySession('test-tiktok-session');
        }
      },
    },
    {
      name: 'browser_actions_integration',
      fn: async (runtime: IAgentRuntime) => {
        const service = runtime.getService<StagehandService>(StagehandService.serviceType);
        if (!service) {
          throw new Error('StagehandService not available');
        }

        // Test navigation action validation
        const testMessage = {
          id: 'test-msg-1' as UUID,
          entityId: 'test-entity-1' as UUID,
          content: { text: 'Navigate to https://elizaos.github.io/eliza/', source: 'test' },
          userId: 'test-user' as UUID,
          roomId: 'test-room' as UUID,
          createdAt: Date.now(),
        } as Memory;

        // Validate the navigate action exists
        const actions = [
          browserNavigateAction,
          browserBackAction,
          browserForwardAction,
          browserRefreshAction,
          browserClickAction,
          browserTypeAction,
          browserSelectAction,
          browserExtractAction,
          browserScreenshotAction,
          browserSolveCaptchaAction,
        ];
        const navigateAction = actions.find((a) => a.name === 'BROWSER_NAVIGATE');

        if (!navigateAction) {
          throw new Error('Navigate action not found');
        }

        const canNavigate = await navigateAction.validate(runtime, testMessage, {} as State);
        if (!canNavigate) {
          throw new Error('Navigation action validation failed');
        }

        // Test state provider
        const stateProvider = browserStateProvider;
        const state = await stateProvider.get(runtime, testMessage, {} as State);
        logger.info('Browser state:', state.text);
      },
    },
  ],
};

export const stagehandPlugin: Plugin = {
  name: 'plugin-stagehand',
  description:
    'Browser automation plugin using Stagehand - stagehand is goated for web interactions',
  config: {
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    BROWSER_HEADLESS: process.env.BROWSER_HEADLESS,
    CAPSOLVER_API_KEY: process.env.CAPSOLVER_API_KEY,
    TRUTHSOCIAL_USERNAME: process.env.TRUTHSOCIAL_USERNAME,
    TRUTHSOCIAL_PASSWORD: process.env.TRUTHSOCIAL_PASSWORD,
    TIKTOK_USERNAME: process.env.TIKTOK_USERNAME,
    TIKTOK_PASSWORD: process.env.TIKTOK_PASSWORD,
    TIKTOK_TEST_VIDEO_PATH: process.env.TIKTOK_TEST_VIDEO_PATH,
  },
  async init(config: Record<string, string>) {
    logger.info('Initializing Stagehand browser automation plugin');
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set environment variables
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value !== undefined) {
          process.env[key] = String(value);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      /* v8 ignore next 2 */
      throw error;
    }
  },
  services: [StagehandService],
  tests: [stagehandE2ETestSuite],
  actions: [
    browserNavigateAction,
    browserBackAction,
    browserForwardAction,
    browserRefreshAction,
    browserClickAction,
    browserTypeAction,
    browserSelectAction,
    browserExtractAction,
    browserScreenshotAction,
    browserSolveCaptchaAction,
  ],
  providers: [browserStateProvider],
  events: {
    BROWSER_PAGE_LOADED: [
      async (payload: any) => {
        logger.debug('BROWSER_PAGE_LOADED event', payload);
      },
    ],
    BROWSER_ERROR: [
      async (payload: any) => {
        logger.error('BROWSER_ERROR event', payload);
      },
    ],
  },
};

// Export CapSolver utilities for direct usage
export { CapSolverService, detectCaptchaType, injectCaptchaSolution } from './capsolver';

export default stagehandPlugin;
