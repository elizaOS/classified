/**
 * Mock E2B API for development/build compatibility
 * This is a placeholder implementation for when @e2b/api is not available
 */

export class E2BClient {
  deployments: {
    get: (id: string) => Promise<any>;
    delete: (id: string) => Promise<void>;
  };

  constructor(options?: any) {
    console.warn(
      'Using mock E2B client - container hosting features are disabled',
    );

    this.deployments = {
      get: async (id: string) => {
        return {
          id,
          status: 'running',
          endpoint: 'mock-endpoint',
        };
      },
      delete: async (id: string) => {
        // Mock delete - no-op
        return;
      },
    };
  }

  async createSandbox(options: any) {
    // Return a mock deployment object instead of throwing
    return {
      id: 'mock-deployment-id',
      status: 'running',
      endpoint: 'mock-endpoint',
    };
  }

  async listSandboxes() {
    return [];
  }

  async deleteSandbox(id: string) {
    throw new Error('E2B API not available - container hosting is disabled');
  }

  async getSandbox(id: string) {
    // Return null instead of throwing to allow graceful handling
    return null;
  }
}

export default E2BClient;
