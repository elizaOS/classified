// CRITICAL DOM POLYFILL PREAMBLE - INJECTED AT BUILD TIME
// This gets injected at the very top of the Bun bundle before ANY other code
(function() {
  console.log('[PREAMBLE-POLYFILL] Injecting critical DOM polyfills at bundle top level');
  
  // Immediately define DOMMatrix on ALL possible global contexts
  const DOMMatrixPolyfill = class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
      this.is2D = true;
      this.isIdentity = true;
      
      if (init) {
        if (typeof init === 'string') {
          // Basic matrix string parsing
          const match = init.match(/matrix\(([^)]+)\)/);
          if (match) {
            const values = match[1].split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 6) {
              this.a = values[0]; this.b = values[1]; this.c = values[2];
              this.d = values[3]; this.e = values[4]; this.f = values[5];
            }
          }
        } else if (typeof init === 'object' && init !== null) {
          Object.assign(this, init);
        }
      }
    }
    
    // Transform methods
    translate(x = 0, y = 0) { 
      this.e += x; this.f += y; 
      return this; 
    }
    scale(x = 1, y = x) { 
      this.a *= x; this.d *= y; 
      return this; 
    }
    rotate(angle = 0) { 
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const newA = this.a * cos + this.c * sin;
      const newB = this.b * cos + this.d * sin;
      const newC = this.c * cos - this.a * sin;
      const newD = this.d * cos - this.b * sin;
      this.a = newA; this.b = newB; this.c = newC; this.d = newD;
      return this; 
    }
    skewX(angle = 0) { return this; }
    skewY(angle = 0) { return this; }
    multiply(matrix) { return this; }
    inverse() { return this; }
    flipX() { return this; }
    flipY() { return this; }
    
    toString() { 
      return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; 
    }
    
    // Static methods
    static fromMatrix(matrix) { return new DOMMatrixPolyfill(matrix); }
    static fromFloat32Array(array) { return new DOMMatrixPolyfill(); }
    static fromFloat64Array(array) { return new DOMMatrixPolyfill(); }
  };
  
  // ImageData polyfill
  const ImageDataPolyfill = class ImageData {
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
  };
  
  // Path2D polyfill
  const Path2DPolyfill = class Path2D {
    constructor(path) {
      this.path = path || '';
    }
    arc() {} lineTo() {} moveTo() {} rect() {} closePath() {}
    addPath() {} arcTo() {} bezierCurveTo() {} ellipse() {} quadraticCurveTo() {}
  };
  
  // FORCE SET ON ALL POSSIBLE GLOBAL CONTEXTS IMMEDIATELY
  const contexts = [];
  
  // Try to get all global contexts safely
  if (typeof globalThis !== 'undefined') contexts.push(globalThis);
  if (typeof global !== 'undefined') contexts.push(global);
  if (typeof window !== 'undefined') contexts.push(window);
  if (typeof self !== 'undefined') contexts.push(self);
  
  // Also try common Node.js globals
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    contexts.push(global || globalThis);
  }
  
  // Force set on every context
  for (const ctx of contexts) {
    if (ctx && typeof ctx === 'object') {
      try {
        // Define with descriptor to prevent overwriting
        Object.defineProperty(ctx, 'DOMMatrix', {
          value: DOMMatrixPolyfill,
          writable: false,
          enumerable: false,
          configurable: false
        });
        Object.defineProperty(ctx, 'CSSMatrix', {
          value: DOMMatrixPolyfill,
          writable: false,
          enumerable: false,
          configurable: false
        });
        Object.defineProperty(ctx, 'WebKitCSSMatrix', {
          value: DOMMatrixPolyfill,
          writable: false,
          enumerable: false,
          configurable: false
        });
        Object.defineProperty(ctx, 'ImageData', {
          value: ImageDataPolyfill,
          writable: false,
          enumerable: false,
          configurable: false
        });
        Object.defineProperty(ctx, 'Path2D', {
          value: Path2DPolyfill,
          writable: false,
          enumerable: false,
          configurable: false
        });
      } catch (e) {
        // Fallback to direct assignment
        ctx.DOMMatrix = DOMMatrixPolyfill;
        ctx.CSSMatrix = DOMMatrixPolyfill;
        ctx.WebKitCSSMatrix = DOMMatrixPolyfill;
        ctx.ImageData = ImageDataPolyfill;
        ctx.Path2D = Path2DPolyfill;
      }
    }
  }
  
  console.log('[PREAMBLE-POLYFILL] ✅ Critical DOM polyfills injected successfully');
  console.log('[PREAMBLE-POLYFILL] DOMMatrix available:', typeof globalThis.DOMMatrix !== 'undefined');
})();