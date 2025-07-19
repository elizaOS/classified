import { mock } from 'bun:test';

/**
 * Browser mocks for testing
 * Sets up minimal window and document objects for tests
 */

// Only set up mocks if we're not already in a browser environment
if (typeof window === 'undefined') {
  // Create minimal window mock
  const mockWindow = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: mock(),
    removeEventListener: mock(),
    dispatchEvent: mock(),
    location: {
      href: 'http://localhost',
      origin: 'http://localhost',
    },
    navigator: {
      userAgent: 'test',
    },
    document: {},
  };

  (global as any).window = mockWindow;

  // Create minimal document mock
  const mockHead = {
    appendChild: mock(),
    removeChild: mock(),
    style: {},
  };

  (global as any).document = {
    createElement: mock(() => ({
      style: {},
      addEventListener: mock(),
      removeEventListener: mock(),
      appendChild: mock(),
      removeChild: mock(),
      setAttribute: mock(),
      getAttribute: mock(),
      querySelector: mock(),
      querySelectorAll: mock(() => []),
    })),
    createTextNode: mock((text: string) => ({
      nodeValue: text,
      textContent: text,
    })),
    head: mockHead,
    body: {
      appendChild: mock(),
      removeChild: mock(),
      style: {},
    },
    addEventListener: mock(),
    removeEventListener: mock(),
    querySelector: mock(),
    querySelectorAll: mock(() => []),
    getElementsByTagName: mock((tagName: string) => {
      if (tagName === 'head') {
        return [mockHead];
      }
      return [];
    }),
  };

  // Copy to global scope
  // Use Object.defineProperty to avoid setter issues
  Object.defineProperty(global, 'navigator', {
    value: mockWindow.navigator,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(global, 'location', {
    value: mockWindow.location,
    writable: true,
    configurable: true,
  });
}

// Mock ResizeObserver
(global as any).ResizeObserver = mock().mockImplementation(() => ({
  observe: mock(),
  unobserve: mock(),
  disconnect: mock(),
}));

// Mock IntersectionObserver
(global as any).IntersectionObserver = mock().mockImplementation(() => ({
  observe: mock(),
  unobserve: mock(),
  disconnect: mock(),
}));

// Mock requestAnimationFrame
(global as any).requestAnimationFrame = mock((cb) => {
  setTimeout(cb, 0);
  return 0;
});

(global as any).cancelAnimationFrame = mock();

export {};
