/**
 * Credit Deduction Middleware
 * Automatically deducts credits for API usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { CreditService, UsageContext } from './credit-service';
import { sessionService } from '../auth/session';

export interface CreditDeductionConfig {
  service: string;
  operation: string;
  estimatedCost?: number;
  costCalculator?: (requestData: any) => number;
  usageExtractor?: (
    requestData: any,
    responseData: any,
  ) => Partial<UsageContext>;
}

/**
 * Middleware to check credit balance before processing request
 */
export async function withCreditCheck(
  request: NextRequest,
  config: CreditDeductionConfig,
  handler: (req: NextRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    // Get user session
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request data for cost estimation
    const requestData = await getRequestData(request);

    // Calculate estimated cost
    let estimatedCost = config.estimatedCost || 0;
    if (config.costCalculator) {
      estimatedCost = config.costCalculator(requestData);
    }

    // Check if organization has sufficient credits
    const hasSufficientCredits = await CreditService.checkSufficientCredits(
      session.organizationId,
      estimatedCost,
    );

    if (!hasSufficientCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          message:
            'Your organization has insufficient credits to perform this operation.',
          estimatedCost,
        },
        { status: 402 }, // Payment Required
      );
    }

    // Process the request
    const response = await handler(request);

    // If request was successful, deduct credits
    if (response.ok) {
      const responseData = await getResponseData(response);

      // Extract usage information
      let usageContext: UsageContext = {
        service: config.service,
        operation: config.operation,
      };

      if (config.usageExtractor) {
        const extractedUsage = config.usageExtractor(requestData, responseData);
        usageContext = { ...usageContext, ...extractedUsage };
      }

      // Deduct credits asynchronously
      CreditService.deductCreditsForUsage(
        session.organizationId,
        session.userId,
        usageContext,
      ).catch((error) => {
        console.error('Failed to deduct credits:', error);
        // TODO: Add to retry queue or alert system
      });
    }

    return response;
  } catch (error) {
    console.error('Credit middleware error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Middleware specifically for AI model usage
 */
export async function withModelUsageTracking(
  request: NextRequest,
  modelConfig: {
    service: 'openai' | 'anthropic' | 'cohere';
    modelName: string;
    operation: string;
  },
  handler: (req: NextRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  const config: CreditDeductionConfig = {
    service: modelConfig.service,
    operation: modelConfig.operation,
    usageExtractor: (requestData, responseData) => {
      // Extract token usage from AI model response
      const usage = responseData?.usage || {};

      return {
        modelName: modelConfig.modelName,
        inputTokens: usage.prompt_tokens || usage.input_tokens,
        outputTokens: usage.completion_tokens || usage.output_tokens,
        tokens: usage.total_tokens,
        requestId: responseData?.id,
      };
    },
    costCalculator: (requestData) => {
      // Estimate cost based on request
      const messages = requestData?.messages || [];
      const estimatedInputTokens = messages.reduce(
        (total: number, msg: any) => {
          return total + (msg.content?.length || 0) / 4; // Rough estimation
        },
        0,
      );

      return CreditService.calculateModelCost({
        service: modelConfig.service,
        operation: modelConfig.operation,
        modelName: modelConfig.modelName,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedInputTokens * 0.5, // Estimate output
      });
    },
  };

  return withCreditCheck(request, config, handler);
}

/**
 * Middleware for storage operations
 */
export async function withStorageUsageTracking(
  request: NextRequest,
  operation: 'upload' | 'storage' | 'bandwidth',
  handler: (req: NextRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  const config: CreditDeductionConfig = {
    service: 'storage',
    operation,
    usageExtractor: (requestData, responseData) => {
      // Extract file size or storage information
      const fileSize = requestData?.size || responseData?.size || 0;

      return {
        tokens: fileSize, // Use tokens field to represent bytes
      };
    },
    costCalculator: (requestData) => {
      const size = requestData?.size || 1024; // Default 1KB
      return CreditService.calculateStorageCost({
        service: 'storage',
        operation,
        tokens: size,
      });
    },
  };

  return withCreditCheck(request, config, handler);
}

/**
 * Helper to extract request data
 */
async function getRequestData(request: NextRequest): Promise<any> {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      return Object.fromEntries(url.searchParams.entries());
    } else {
      // Clone request to avoid consuming the stream
      const clonedRequest = request.clone();
      return await clonedRequest.json();
    }
  } catch (error) {
    return {};
  }
}

/**
 * Helper to extract response data
 */
async function getResponseData(response: NextResponse): Promise<any> {
  try {
    // Clone response to avoid consuming the stream
    const clonedResponse = response.clone();
    return await clonedResponse.json();
  } catch (error) {
    return {};
  }
}

/**
 * Create a usage tracking decorator for API routes
 */
export function trackUsage(config: CreditDeductionConfig) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<Function>,
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (request: NextRequest) {
      return withCreditCheck(request, config, method.bind(this));
    };
  };
}

/**
 * Track model usage decorator
 */
export function trackModelUsage(
  service: 'openai' | 'anthropic' | 'cohere',
  modelName: string,
  operation: string,
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<Function>,
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (request: NextRequest) {
      return withModelUsageTracking(
        request,
        { service, modelName, operation },
        method.bind(this),
      );
    };
  };
}
