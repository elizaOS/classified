import DOMMatrix from '@thednp/dommatrix';

(function setupDOMPolyfills() {
  console.log('[DOM-POLYFILL] Setting up comprehensive DOM polyfills with professional DOMMatrix');
  
  // Collect all available global contexts safely
  const contexts: any = [];
  try { if (typeof globalThis !== 'undefined') contexts.push(globalThis); } catch (e) {}
  try { if (typeof global !== 'undefined') contexts.push(global); } catch (e) {}
  try { if (typeof window !== 'undefined') contexts.push(window); } catch (e) {}
  try { if (typeof self !== 'undefined') contexts.push(self); } catch (e) {}
  
  // Professional DOMMatrix implementation
  for (const ctx of contexts) {
    if (ctx && typeof ctx === 'object') {
      ctx.DOMMatrix = DOMMatrix;
      ctx.CSSMatrix = DOMMatrix;
      ctx.WebKitCSSMatrix = DOMMatrix;
    }
  }
  
  // Additional DOM API polyfills
  class ImageDataPolyfill {
    data: Uint8ClampedArray<ArrayBufferLike>;
    width: any;
    height: any;
    colorSpace: string;
    constructor(dataOrWidth, height, width) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = height;
        this.height = width || height;
      } else {
        this.width = dataOrWidth || 0;
        this.height = height || 0;
        this.data = new Uint8ClampedArray((dataOrWidth || 0) * (height || 0) * 4);
      }
      this.colorSpace = 'srgb';
    }
  }
  
  class Path2DPolyfill {
    path: any;
    constructor(path) { this.path = path || ''; }
    addPath() {} arc() {} arcTo() {} bezierCurveTo() {} closePath() {}
    ellipse() {} lineTo() {} moveTo() {} quadraticCurveTo() {} rect() {}
  }
  
  class HTMLCanvasElementPolyfill {
    width: number;
    height: number;
    constructor() { 
      this.width = 300; 
      this.height = 150; 
    }
    
    getContext(type) {
      if (type === '2d') {
        return {
          arc: () => {}, beginPath: () => {}, clearRect: () => {}, closePath: () => {},
          createImageData: (w, h, colorSpace) => new ImageDataPolyfill(w, h, colorSpace),
          drawImage: () => {}, fill: () => {}, fillRect: () => {},
          getImageData: (x, y, w, h, colorSpace) => new ImageDataPolyfill(w, h, colorSpace),
          lineTo: () => {}, moveTo: () => {}, putImageData: () => {},
          restore: () => {}, save: () => {}, scale: () => {}, stroke: () => {},
          translate: () => {}, transform: () => {}, setTransform: () => {},
          canvas: this, fillStyle: '#000000', strokeStyle: '#000000',
          globalAlpha: 1.0, lineWidth: 1.0, font: '10px sans-serif'
        };
      }
      return null;
    }
    
    toDataURL() { 
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; 
    }
  }
  
  // Apply polyfills to all contexts if not already defined
  for (const ctx of contexts) {
    if (ctx && typeof ctx === 'object') {
      if (!ctx.ImageData) ctx.ImageData = ImageDataPolyfill;
      if (!ctx.Path2D) ctx.Path2D = Path2DPolyfill;
      if (!ctx.HTMLCanvasElement) ctx.HTMLCanvasElement = HTMLCanvasElementPolyfill;
      
      // Basic document polyfill if needed
      if (!ctx.document) {
        ctx.document = {
          createElement: (tagName) => {
            if (tagName.toLowerCase() === 'canvas') {
              return new HTMLCanvasElementPolyfill();
            }
            return { tagName, setAttribute: () => {}, getAttribute: () => null };
          },
          querySelector: () => null,
          querySelectorAll: () => [],
          addEventListener: () => {},
          removeEventListener: () => {},
          visibilityState: 'visible'
        };
      }
    }
  }
  
  console.log('[DOM-POLYFILL] ✅ All DOM polyfills loaded successfully');
  console.log('[DOM-POLYFILL] - Professional DOMMatrix from @thednp/dommatrix');
  console.log('[DOM-POLYFILL] - ImageData, Path2D, HTMLCanvasElement polyfills');
  console.log('[DOM-POLYFILL] - Basic document polyfill');
})();

// Mock window object for browser dependencies (only minimal ones needed)
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { 
      href: 'http://localhost:3000/',
      search: '',
      origin: 'http://localhost:3000',
      pathname: '/',
      hash: '',
      host: 'localhost:3000',
      hostname: 'localhost',
      protocol: 'http:',
      port: '3000'
    },
    document: { 
      createElement: () => ({
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        removeChild: () => {},
        style: {},
        innerHTML: '',
        textContent: ''
      }),
      getElementsByTagName: () => ([]),
      querySelector: () => null,
      querySelectorAll: () => ([]),
      body: { appendChild: () => {} },
      head: { appendChild: () => {} },
      addEventListener: () => {},
      removeEventListener: () => {},
      visibilityState: 'visible'
    },
    navigator: { userAgent: 'Node.js' },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {}
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {}
    },
    XMLHttpRequest: class MockXMLHttpRequest {
      open() {}
      send() {}
      setRequestHeader() {}
    },
    fetch: typeof fetch !== 'undefined' ? fetch : () => Promise.reject(new Error('fetch not available'))
  } as any;
}

// Mock additional DOM APIs that plugins might need
if (typeof globalThis.document === 'undefined') {
  globalThis.document = globalThis.window.document;
}

// Also set globalThis.location directly for URLSearchParams compatibility
if (typeof globalThis.location === 'undefined') {
  globalThis.location = {
    href: 'http://localhost:3000/',
    search: '',
    origin: 'http://localhost:3000',
    pathname: '/',
    hash: '',
    host: 'localhost:3000',
    hostname: 'localhost',
    protocol: 'http:',
    port: '3000'
  } as any;
}

// Ensure self.location exists if self is defined
if (typeof globalThis.self !== 'undefined' && typeof globalThis.self.location === 'undefined') {
  (globalThis.self as any).location = globalThis.location;
}