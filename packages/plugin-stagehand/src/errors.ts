/**
 * Custom error types for the Stagehand browser plugin
 */

export class StagehandError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly recoverable: boolean = true,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'StagehandError';
  }
}

export class BrowserNavigationError extends StagehandError {
  constructor(url: string, originalError?: Error) {
    super(
      `Failed to navigate to ${url}: ${originalError?.message || 'Unknown error'}`,
      'BROWSER_NAVIGATION_ERROR',
      "I couldn't navigate to the requested page. The URL might be invalid or the site might be down.",
      true,
      { url, originalError: originalError?.message }
    );
  }
}

export class BrowserSessionError extends StagehandError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      'BROWSER_SESSION_ERROR',
      "I'm having trouble with the browser session. Please try again.",
      true,
      details
    );
  }
}

export class BrowserActionError extends StagehandError {
  constructor(action: string, target: string, originalError?: Error) {
    super(
      `Failed to ${action} on "${target}": ${originalError?.message || 'Unknown error'}`,
      'BROWSER_ACTION_ERROR',
      `I couldn't ${action} the element you requested. The page might have changed or the element might not be available.`,
      true,
      { action, target, originalError: originalError?.message }
    );
  }
}

export class BrowserTimeoutError extends StagehandError {
  constructor(action: string, timeoutMs: number) {
    super(
      `Browser action "${action}" timed out after ${timeoutMs}ms`,
      'BROWSER_TIMEOUT_ERROR',
      'The browser operation took too long and timed out. The page might be slow or unresponsive.',
      true,
      { action, timeoutMs }
    );
  }
}

export class BrowserExtractionError extends StagehandError {
  constructor(instruction: string, originalError?: Error) {
    super(
      `Failed to extract data: ${originalError?.message || 'Unknown error'}`,
      'BROWSER_EXTRACTION_ERROR',
      "I couldn't extract the requested information from the page. The content might not be available or the page structure might have changed.",
      true,
      { instruction, originalError: originalError?.message }
    );
  }
}

export class BrowserSecurityError extends StagehandError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      'BROWSER_SECURITY_ERROR',
      'This operation was blocked for security reasons. Please check if the URL is allowed.',
      false,
      details
    );
  }
}

export class BrowserServiceNotAvailableError extends StagehandError {
  constructor() {
    super(
      'Stagehand service is not available',
      'SERVICE_NOT_AVAILABLE',
      'The browser automation service is not currently available. Please try again later.',
      false
    );
  }
}

/**
 * Error handler that ensures proper callback responses
 */
export function handleBrowserError(
  error: unknown,
  callback?: (response: any) => void,
  defaultAction: string = 'perform browser action'
): void {
  let stagehandError: StagehandError;

  if (error instanceof StagehandError) {
    stagehandError = error;
  } else if (error instanceof Error) {
    // Convert generic errors to StagehandError
    if (error.message.includes('timeout')) {
      stagehandError = new BrowserTimeoutError(defaultAction, 30000);
    } else if (error.message.includes('navigate')) {
      stagehandError = new BrowserNavigationError('the page', error);
    } else {
      stagehandError = new StagehandError(
        error.message,
        'UNKNOWN_BROWSER_ERROR',
        `I encountered an error while trying to ${defaultAction}. Please try again.`,
        true,
        { originalError: error.message }
      );
    }
  } else {
    stagehandError = new StagehandError(
      'Unknown error occurred',
      'UNKNOWN_ERROR',
      `Something went wrong while trying to ${defaultAction}. Please try again.`,
      true
    );
  }

  // Send user-friendly error response via callback
  callback?.({
    text: stagehandError.userMessage,
    error: {
      code: stagehandError.code,
      message: stagehandError.message,
      recoverable: stagehandError.recoverable,
      details: stagehandError.details,
    },
  });
}
