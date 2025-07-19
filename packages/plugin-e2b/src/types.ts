import type { ServiceTypeName } from '@elizaos/core';

// Extend ServiceTypeName for E2B service
declare module '@elizaos/core' {
  interface ServiceType extends Record<ServiceTypeName, unknown> {
    e2b: E2BServiceType;
  }
}

export interface E2BServiceType {
  executeCode: (code: string, language?: string) => Promise<E2BExecutionResult>;
  createSandbox: (opts?: E2BSandboxOptions) => Promise<string>;
  killSandbox: (sandboxId: string) => Promise<void>;
  getSandbox: (sandboxId: string) => E2BSandboxHandle | null;
  listSandboxes: () => E2BSandboxHandle[];
}

export interface E2BSandboxOptions {
  template?: string;
  timeoutMs?: number;
  metadata?: Record<string, string>;
  envs?: Record<string, string>;
}

export interface E2BExecutionResult {
  text?: string;
  results: any[];
  logs: {
    stdout: string[];
    stderr: string[];
  };
  error?: {
    name: string;
    value: string;
    traceback: string;
  };
  executionCount?: number;
  executionTime?: number;
  sandboxId?: string;
  language?: string;
}

export interface E2BSandboxHandle {
  sandboxId: string;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, string>;
  template: string;
}
