// Test mocks for platform package

export const mockWebSocketConnection = {
  isConnected: true,
  messages: [],
  sendMessage: () => {},
  subscribe: () => {},
  unsubscribe: () => {},
  projectUpdates: [],
  buildLogs: [],
  clearMessages: () => {},
};

export const mockAuth = {
  isAuthenticated: false,
  user: null,
  platform: 'web' as const,
  waitForInit: async () => {},
  signInWithOAuth: () => {},
  signOut: () => {},
  refreshToken: () => {},
  getOAuthProviders: () => [],
  isLoading: false,
  error: null,
};

export const mockRouter = {
  push: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
  replace: () => {},
  prefetch: () => {},
};
