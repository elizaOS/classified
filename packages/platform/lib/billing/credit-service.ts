/**
 * Credit Management Service
 * Handles credit deduction for agent operations and usage tracking
 */

import {
  getCreditBalance,
  deductCredits,
} from '../server/services/billing-service';
import { getDatabase } from '../database/connection';
import { creditTransactions } from '../database/schema';
import { eq, desc, and, gte, lte, sum } from 'drizzle-orm';
import { getBillingConfig } from './config';

export interface UsageContext {
  agentId?: string;
  service: string; // 'openai', 'anthropic', 'storage', etc.
  operation: string; // 'chat', 'inference', 'upload', etc.
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  modelName?: string;
  requestId?: string;
}

export interface CreditUsageResult {
  success: boolean;
  remainingBalance: number;
  deductedAmount: number;
  transactionId?: string;
  error?: string;
}

export class CreditService {
  /**
   * Calculate cost for AI model usage
   */
  static calculateModelCost(context: UsageContext): number {
    const {
      service,
      modelName,
      inputTokens = 0,
      outputTokens = 0,
      tokens = 0,
    } = context;

    // Total tokens if not split
    const totalTokens = inputTokens + outputTokens || tokens;

    // Pricing per 1k tokens (in USD)
    const pricing: Record<
      string,
      Record<string, { input: number; output: number }>
    > = {
      openai: {
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
        'text-embedding-ada-002': { input: 0.0001, output: 0 },
        'whisper-1': { input: 0.006, output: 0 },
        'tts-1': { input: 0.015, output: 0 },
      },
      anthropic: {
        'claude-3-opus': { input: 0.015, output: 0.075 },
        'claude-3-sonnet': { input: 0.003, output: 0.015 },
        'claude-3-haiku': { input: 0.00025, output: 0.00125 },
        'claude-instant': { input: 0.00163, output: 0.00551 },
      },
    };

    const serviceModels = pricing[service.toLowerCase()];
    if (!serviceModels || !modelName) {
      // Default fallback pricing
      return (totalTokens * 0.002) / 1000;
    }

    const modelPricing = serviceModels[modelName.toLowerCase()];
    if (!modelPricing) {
      // Default model pricing for service
      const defaultPricing = Object.values(serviceModels)[0];
      return (totalTokens * defaultPricing.input) / 1000;
    }

    if (inputTokens && outputTokens) {
      return (
        (inputTokens * modelPricing.input +
          outputTokens * modelPricing.output) /
        1000
      );
    } else {
      return (totalTokens * modelPricing.input) / 1000;
    }
  }

  /**
   * Calculate cost for storage operations
   */
  static calculateStorageCost(context: UsageContext): number {
    const { operation, tokens = 0 } = context;

    // Storage pricing (per GB-month or per operation)
    const storagePricing = {
      upload: 0.01, // $0.01 per file upload
      storage: 0.02, // $0.02 per GB-month
      bandwidth: 0.01, // $0.01 per GB transferred
    };

    if (operation === 'upload') {
      return storagePricing.upload;
    }

    // For storage and bandwidth, tokens represent size in KB
    const sizeInGB = tokens / (1024 * 1024);
    return (
      sizeInGB *
      (storagePricing[operation as keyof typeof storagePricing] || 0.02)
    );
  }

  /**
   * Validate usage context inputs
   */
  static validateUsageContext(context: UsageContext): void {
    // Validate service
    if (!context.service || typeof context.service !== 'string') {
      throw new Error('Service is required and must be a string');
    }

    // Validate operation
    if (!context.operation || typeof context.operation !== 'string') {
      throw new Error('Operation is required and must be a string');
    }

    // Sanitize inputs to prevent injection
    if (
      context.service.includes(';') ||
      context.service.includes('--') ||
      context.service.includes('<')
    ) {
      throw new Error('Invalid characters in service name');
    }

    if (
      context.operation.includes(';') ||
      context.operation.includes('--') ||
      context.operation.includes('<')
    ) {
      throw new Error('Invalid characters in operation name');
    }

    // Validate token counts
    if (context.tokens !== undefined) {
      if (
        typeof context.tokens !== 'number' ||
        context.tokens < 0 ||
        !isFinite(context.tokens)
      ) {
        throw new Error('Tokens must be a non-negative finite number');
      }
      if (context.tokens > 1000000) {
        throw new Error('Token count exceeds maximum allowed value');
      }
    }

    if (context.inputTokens !== undefined) {
      if (
        typeof context.inputTokens !== 'number' ||
        context.inputTokens < 0 ||
        !isFinite(context.inputTokens)
      ) {
        throw new Error('Input tokens must be a non-negative finite number');
      }
    }

    if (context.outputTokens !== undefined) {
      if (
        typeof context.outputTokens !== 'number' ||
        context.outputTokens < 0 ||
        !isFinite(context.outputTokens)
      ) {
        throw new Error('Output tokens must be a non-negative finite number');
      }
    }
  }

  /**
   * Deduct credits for usage and track transaction
   */
  static async deductCreditsForUsage(
    organizationId: string,
    userId: string,
    context: UsageContext,
  ): Promise<CreditUsageResult> {
    try {
      // Validate inputs first
      this.validateUsageContext(context);

      // Calculate cost based on usage type
      let cost = 0;

      if (
        ['openai', 'anthropic', 'cohere', 'huggingface'].includes(
          context.service,
        )
      ) {
        cost = this.calculateModelCost(context);
      } else if (context.service === 'storage') {
        cost = this.calculateStorageCost(context);
      } else {
        // Default cost for unknown services
        cost = 0.001;
      }

      // Minimum charge from configuration
      const billingConfig = getBillingConfig();
      cost = Math.max(cost, billingConfig.pricing.minimumCharge);

      // Create description
      const description = this.generateUsageDescription(context);

      try {
        // Deduct credits (balance check is done atomically inside deductCredits)
        const transaction = await deductCredits({
          organizationId,
          userId,
          amount: cost,
          description,
          // Only include agentId if we're sure it references a real agent
          // For now, omit agentId to avoid foreign key constraint issues
          metadata: {
            ...context,
            costCalculation: {
              service: context.service,
              operation: context.operation,
              tokens: context.tokens,
              inputTokens: context.inputTokens,
              outputTokens: context.outputTokens,
              modelName: context.modelName,
              calculatedCost: cost,
            },
          },
        });

        const remainingBalance = await getCreditBalance(organizationId);

        return {
          success: true,
          remainingBalance,
          deductedAmount: cost,
        };
      } catch (deductError) {
        // Handle insufficient balance errors specifically
        if (
          deductError instanceof Error &&
          deductError.message.includes('Insufficient credit balance')
        ) {
          const currentBalance = await getCreditBalance(organizationId);
          return {
            success: false,
            remainingBalance: currentBalance,
            deductedAmount: 0,
            error: 'Insufficient credit balance',
          };
        }
        throw deductError; // Re-throw other errors
      }
    } catch (error) {
      console.error('Failed to deduct credits for usage:', error);
      return {
        success: false,
        remainingBalance: 0,
        deductedAmount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get usage summary for organization
   */
  static async getUsageSummary(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const db = getDatabase();

    try {
      const start =
        startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate || new Date();

      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.organizationId, organizationId),
            eq(creditTransactions.type, 'usage'),
            gte(creditTransactions.createdAt, start),
            lte(creditTransactions.createdAt, end),
          ),
        )
        .orderBy(desc(creditTransactions.createdAt));

      // Aggregate by service
      const serviceUsage = transactions.reduce(
        (acc: Record<string, any>, transaction: any) => {
          const service = transaction.metadata?.service || 'unknown';

          if (!acc[service]) {
            acc[service] = {
              totalCost: 0,
              totalTokens: 0,
              operationCount: 0,
              operations: {},
            };
          }

          acc[service].totalCost += Math.abs(parseFloat(transaction.amount));
          acc[service].totalTokens += transaction.metadata?.tokens || 0;
          acc[service].operationCount += 1;

          const operation = transaction.metadata?.operation || 'unknown';
          acc[service].operations[operation] =
            (acc[service].operations[operation] || 0) + 1;

          return acc;
        },
        {},
      );

      // Calculate totals
      const totalCost = Object.values(serviceUsage).reduce(
        (sum: number, service: any) => sum + service.totalCost,
        0,
      );

      const totalTokens = Object.values(serviceUsage).reduce(
        (sum: number, service: any) => sum + service.totalTokens,
        0,
      );

      return {
        period: { startDate: start, endDate: end },
        totalCost,
        totalTokens,
        operationCount: transactions.length,
        serviceBreakdown: serviceUsage,
        transactions: transactions.slice(0, 10), // Latest 10 transactions
      };
    } catch (error) {
      console.error('Failed to get usage summary:', error);
      throw new Error('Failed to get usage summary');
    }
  }

  /**
   * Check if organization has sufficient credits for operation
   */
  static async checkSufficientCredits(
    organizationId: string,
    estimatedCost: number,
  ): Promise<boolean> {
    try {
      const balance = await getCreditBalance(organizationId);
      return balance >= estimatedCost;
    } catch (error) {
      console.error('Failed to check credit balance:', error);
      return false;
    }
  }

  /**
   * Get low balance organizations for alerts
   */
  static async getLowBalanceOrganizations(threshold: number = 10) {
    const db = getDatabase();

    try {
      // This would require a more complex query to calculate balances
      // For now, we'll return organizations with recent low balance transactions
      const recentTransactions = await db
        .select({
          organizationId: creditTransactions.organizationId,
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.type, 'usage'),
            gte(
              creditTransactions.createdAt,
              new Date(Date.now() - 24 * 60 * 60 * 1000),
            ),
          ),
        );

      const orgIds = Array.from(
        new Set(recentTransactions.map((t: any) => t.organizationId as string)),
      );

      const lowBalanceOrgs = [];
      for (const orgId of orgIds) {
        const balance = await getCreditBalance(orgId as string);
        if (balance < threshold) {
          lowBalanceOrgs.push({
            organizationId: orgId,
            balance,
          });
        }
      }

      return lowBalanceOrgs;
    } catch (error) {
      console.error('Failed to get low balance organizations:', error);
      return [];
    }
  }

  private static generateUsageDescription(context: UsageContext): string {
    const { service, operation, modelName, tokens, inputTokens, outputTokens } =
      context;

    let description = `${service} - ${operation}`;

    if (modelName) {
      description += ` (${modelName})`;
    }

    if (inputTokens && outputTokens) {
      description += ` - ${inputTokens} input + ${outputTokens} output tokens`;
    } else if (tokens) {
      description += ` - ${tokens} tokens`;
    }

    return description;
  }

  /**
   * Estimate cost for planned operation
   */
  static estimateOperationCost(context: UsageContext): number {
    if (
      ['openai', 'anthropic', 'cohere', 'huggingface'].includes(context.service)
    ) {
      return this.calculateModelCost(context);
    } else if (context.service === 'storage') {
      return this.calculateStorageCost(context);
    } else {
      return 0.001; // Default minimum cost
    }
  }
}

export default CreditService;
