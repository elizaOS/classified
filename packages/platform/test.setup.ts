// Setup React for JSX
import React from 'react';
globalThis.React = React;

import { expect, afterEach, mock } from 'bun:test';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { JSDOM } from 'jsdom';

// Setup jsdom environment for React testing
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

// Set global variables for React testing
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLButtonElement = dom.window.HTMLButtonElement;

// Mock sessionStorage and localStorage
const storage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {},
  length: 0,
  key: (index: number) => null,
};

global.sessionStorage = storage as Storage;
global.localStorage = storage as Storage;

// Mock auth at the global level
const mockSession = {
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
  },
};

// Mock getServerSession
mock.module('next-auth/next', () => ({
  getServerSession: mock().mockResolvedValue(mockSession),
}));

// Mock auth config
mock.module('@/lib/auth/auth-config', () => ({
  authOptions: {},
  getServerSession: mock().mockResolvedValue(mockSession),
}));

// Extend Bun test's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test case
afterEach(() => {
  cleanup();
  // Clean up any remaining DOM elements
  document.body.innerHTML = '';
});
