import { logger } from '@elizaos/core';

export class StagehandError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'StagehandError';
  }
}

export class BrowserServiceNotAvailableError extends StagehandError {
  constructor() {
    super(
      'Browser service is not available',
      'SERVICE_NOT_AVAILABLE',
      'The browser automation service is not available. Please ensure the Stagehand plugin is properly configured.',
      false
    );
  }
}

export class BrowserSessionError extends StagehandError {
  constructor(message: string) {
    super(
      message,
      'SESSION_ERROR',
      'There was an error with the browser session. Please try again.',
      true
    );
  }
}

export class BrowserNavigationError extends StagehandError {
  constructor(url: string, originalError: Error) {
    super(
      `Failed to navigate to ${url}: ${originalError.message}`,
      'NAVIGATION_ERROR',
      `I couldn't navigate to the requested page. Please check the URL and try again.`,
      true
    );
  }
}

export class BrowserActionError extends StagehandError {
  constructor(action: string, target: string, originalError: Error) {
    super(
      `Failed to ${action} on ${target}: ${originalError.message}`,
      'ACTION_ERROR',
      `I couldn't ${action} on the requested element. Please check if the element exists and try again.`,
      true
    );
  }
}

export class BrowserSecurityError extends StagehandError {
  constructor(message: string) {
    super(
      message,
      'SECURITY_ERROR',
      'This action was blocked for security reasons.',
      false
    );
  }
}

export function handleBrowserError(
  error: Error,
  callback?: any,
  action?: string
): void {
  if (error instanceof StagehandError) {
    logger.error(`Stagehand error [${error.code}]:`, error.message);
    callback?.({
      text: error.userMessage,
      error: true,
    });
  } else {
    logger.error('Unexpected browser error:', error);
    callback?.({
      text: action 
        ? `I encountered an error while trying to ${action}. Please try again.`
        : 'I encountered an unexpected error. Please try again.',
      error: true,
    });
  }
}
