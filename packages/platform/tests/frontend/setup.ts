/**
 * Test setup for frontend tests
 * Configures jsdom environment for React component testing
 */

import React from 'react';
import { JSDOM } from 'jsdom';
import { mock } from 'bun:test';
import { configure } from '@testing-library/react';

// Set up React globals for JSX runtime
(global as any).React = React;

// Setup jsdom environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

// Set global variables
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLButtonElement = dom.window.HTMLButtonElement;

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

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

// Mock fetch
global.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  }),
) as any;

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = 1;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(url: string) {}

  send(data: string) {}
  close() {}
} as any;

// Mock console methods for cleaner test output
console.warn = mock();
console.error = mock();
console.log = mock();

// Add cleanup function for better test isolation
global.beforeEach = global.beforeEach || (() => {});
global.afterEach = global.afterEach || (() => {});

// Clean up DOM between tests
const originalAfterEach = global.afterEach;
global.afterEach = (fn: any) => {
  // Register the user's afterEach function
  if (fn) {
    originalAfterEach(fn);
  }

  // Also register our cleanup function
  originalAfterEach(() => {
    // Clean up any remaining DOM elements
    document.body.innerHTML = '';

    // Clear any pending timers
    if (typeof jest !== 'undefined' && jest.clearAllTimers) {
      jest.clearAllTimers();
    }
  });
};
