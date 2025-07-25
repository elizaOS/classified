/**
 * DOM Polyfills for server-only environment
 * This prevents errors from PDF.js and other browser-dependent libraries
 */

// Mock DOMMatrix for PDF.js compatibility - set on multiple globals
const mockDOMMatrix = class MockDOMMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;

  constructor(init?: any) {
    if (typeof init === 'string') {
      // Parse matrix string if needed
      Object.assign(this, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    }
    return this;
  }

  translate() { return this; }
  scale() { return this; }
  rotate() { return this; }
  multiply() { return this; }
  inverse() { return this; }
  toString() { return 'matrix(1, 0, 0, 1, 0, 0)'; }

  static fromMatrix() { return new mockDOMMatrix(); }
  static fromFloat32Array() { return new mockDOMMatrix(); }
  static fromFloat64Array() { return new mockDOMMatrix(); }
};

// Set on all possible global objects
globalThis.DOMMatrix = mockDOMMatrix as any;
if (typeof global !== 'undefined') {
  (global as any).DOMMatrix = mockDOMMatrix;
}
if (typeof window !== 'undefined') {
  (window as any).DOMMatrix = mockDOMMatrix;
}

// Also create it as a direct global variable
(globalThis as any).DOMMatrix = mockDOMMatrix;

// Mock ImageData for canvas compatibility
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class MockImageData {
    constructor(width: number, height: number) {
      return {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4)
      };
    }
  } as any;
}

// Mock Path2D for canvas compatibility
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class MockPath2D {
    constructor() {
      return {
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        arc: () => {},
        arcTo: () => {},
        bezierCurveTo: () => {},
        quadraticCurveTo: () => {},
        rect: () => {}
      };
    }
  } as any;
}

// Mock HTMLCanvasElement for PDF.js
if (typeof globalThis.HTMLCanvasElement === 'undefined') {
  globalThis.HTMLCanvasElement = class MockHTMLCanvasElement {
    constructor() {
      return {
        width: 0,
        height: 0,
        getContext: () => null,
        toDataURL: () => 'data:image/png;base64,',
        toBlob: () => null
      };
    }
  } as any;
}

// Mock document for libraries that check for browser environment
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({
      getContext: () => null,
      style: {},
      setAttribute: () => {},
      getAttribute: () => null
    }),
    createElementNS: () => ({
      getContext: () => null,
      style: {},
      setAttribute: () => {},
      getAttribute: () => null
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    visibilityState: 'visible',
    hidden: false,
    body: {
      appendChild: () => {},
      removeChild: () => {},
      style: {}
    },
    head: {
      appendChild: () => {},
      removeChild: () => {},
      style: {}
    }
  } as any;
}

// NOTE: We intentionally do NOT define window in server environment
// This ensures axios and other libraries correctly detect Node.js environment
// and don't try to access browser-specific APIs like window.location.href

console.log('[DOM-POLYFILL] Server-only DOM polyfills loaded');
