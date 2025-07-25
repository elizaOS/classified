/**
 * CRITICAL DOM polyfills using proper libraries
 * This must be the FIRST thing executed in the binary to prevent DOM errors
 */

// Import the proper DOMMatrix polyfill
import DOMMatrix from '@thednp/dommatrix';

// Force-set DOM polyfills globally IMMEDIATELY in an IIFE
(function() {
  console.log('[POLYFILL-INIT] Loading professional-grade DOM polyfills...');
  
  // Set the proper DOMMatrix polyfill on all global contexts
  const contexts = [];
  
  // Collect all available global contexts
  try { if (typeof globalThis !== 'undefined') contexts.push(globalThis); } catch (e) {}
  try { if (typeof global !== 'undefined') contexts.push(global); } catch (e) {}
  try { if (typeof window !== 'undefined') contexts.push(window); } catch (e) {}
  try { if (typeof self !== 'undefined') contexts.push(self); } catch (e) {}

  // Apply the professional DOMMatrix polyfill to all contexts
  for (const ctx of contexts) {
    try {
      if (ctx && typeof ctx === 'object') {
        // Use the proper DOMMatrix implementation
        ctx.DOMMatrix = DOMMatrix;
        ctx.CSSMatrix = DOMMatrix; // Some libraries expect CSSMatrix
        ctx.WebKitCSSMatrix = DOMMatrix; // Webkit compatibility
        
        console.log('[POLYFILL-INIT] Set DOMMatrix on context:', ctx === globalThis ? 'globalThis' : ctx === global ? 'global' : ctx === window ? 'window' : 'other');
      }
    } catch (e) {
      console.warn('[POLYFILL-INIT] Failed to set DOMMatrix on context:', e.message);
    }
  }

  // ImageData polyfill for canvas pixel operations
  const mockImageData = class MockImageData {
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

  // Path2D polyfill for canvas path operations
  const mockPath2D = class MockPath2D {
    constructor(path) {
      this.path = path || '';
    }
    
    addPath(path, transform) {}
    arc(x, y, radius, startAngle, endAngle, counterclockwise) {}
    arcTo(x1, y1, x2, y2, radius) {}
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {}
    closePath() {}
    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {}
    lineTo(x, y) {}
    moveTo(x, y) {}
    quadraticCurveTo(cpx, cpy, x, y) {}
    rect(x, y, width, height) {}
    roundRect(x, y, width, height, radii) {}
  };

  // HTMLCanvasElement polyfill for canvas operations  
  const mockHTMLCanvasElement = class MockHTMLCanvasElement {
    constructor() {
      this.width = 300;
      this.height = 150;
    }
    
    getContext(contextType, options) {
      if (contextType === '2d') {
        return {
          // Canvas 2D Context methods
          arc: () => {}, arcTo: () => {}, beginPath: () => {}, bezierCurveTo: () => {},
          clearRect: () => {}, clip: () => {}, closePath: () => {}, createImageData: () => new mockImageData(1, 1),
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createPattern: () => ({}), createRadialGradient: () => ({ addColorStop: () => {} }),
          drawImage: () => {}, ellipse: () => {}, fill: () => {}, fillRect: () => {},
          fillText: () => {}, getImageData: () => new mockImageData(1, 1),
          getLineDash: () => [], isPointInPath: () => false, isPointInStroke: () => false,
          lineTo: () => {}, measureText: () => ({ width: 0 }),
          moveTo: () => {}, putImageData: () => {}, quadraticCurveTo: () => {},
          rect: () => {}, restore: () => {}, rotate: () => {}, save: () => {},
          scale: () => {}, setLineDash: () => {}, setTransform: () => {},
          stroke: () => {}, strokeRect: () => {}, strokeText: () => {},
          transform: () => {}, translate: () => {},
          
          // Properties
          canvas: this,
          fillStyle: '#000000', strokeStyle: '#000000', globalAlpha: 1.0,
          lineWidth: 1.0, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10.0,
          font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic'
        };
      }
      return null;
    }
    
    toDataURL(type = 'image/png', quality) {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    }
    
    toBlob(callback, type = 'image/png', quality) {
      const blob = { type, size: 0 };
      if (callback) callback(blob);
    }
  };

  // Apply other polyfills to all contexts
  for (const ctx of contexts) {
    try {
      if (ctx && typeof ctx === 'object') {
        // Only set if not already defined
        if (!ctx.ImageData) ctx.ImageData = mockImageData;
        if (!ctx.Path2D) ctx.Path2D = mockPath2D;
        if (!ctx.HTMLCanvasElement) ctx.HTMLCanvasElement = mockHTMLCanvasElement;
        
        // Document polyfill (minimal)
        if (!ctx.document) {
          ctx.document = {
            createElement(tagName) {
              const element = {
                tagName: tagName.toUpperCase(),
                setAttribute: () => {}, getAttribute: () => null,
                appendChild: () => {}, removeChild: () => {},
                style: {}, innerHTML: '', textContent: ''
              };
              
              if (tagName.toLowerCase() === 'canvas') {
                Object.assign(element, {
                  width: 300, height: 150,
                  getContext: (contextType) => (new mockHTMLCanvasElement()).getContext(contextType)
                });
              }
              
              return element;
            },
            querySelector: () => null,
            querySelectorAll: () => [],
            body: { appendChild: () => {}, style: {} },
            head: { appendChild: () => {}, style: {} }
          };
        }
        
        // Basic window location if needed
        if (!ctx.location) {
          ctx.location = {
            href: '', search: '', origin: '', pathname: '/',
            hash: '', host: '', hostname: '', protocol: 'http:', port: ''
          };
        }
      }
    } catch (e) {
      // Silently continue if we can't set on this context
    }
  }

  console.log('[POLYFILL-INIT] ✅ Professional-grade DOM polyfills loaded successfully');
  console.log('[POLYFILL-INIT] Using @thednp/dommatrix for DOMMatrix polyfill');
})();