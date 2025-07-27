// Canvas wrapper for graceful fallback
let canvasModule;
let canvasAvailable = false;

try {
  // Try @napi-rs/canvas first
  canvasModule = require('@napi-rs/canvas');
  canvasAvailable = true;
  console.log('[CANVAS] @napi-rs/canvas loaded successfully');
} catch (_error1) {
  // @ts-expect-error - _error1 is an error
  try {
    // Fallback to regular canvas
    canvasModule = require('canvas');
    canvasAvailable = true;
    console.log('[CANVAS] canvas module loaded successfully');
  } catch (_error2) {
    console.warn('[CANVAS] No canvas module available');

    // Create mock canvas
    canvasModule = {
      createCanvas: (width, height) => {
        console.warn('[CANVAS] Using mock canvas');
        return {
          width,
          height,
          getContext: () => ({
            drawImage: () => {},
            fillRect: () => {},
            clearRect: () => {},
            save: () => {},
            restore: () => {},
            scale: () => {},
            translate: () => {},
            rotate: () => {},
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            font: '10px sans-serif',
          }),
          toBuffer: () => Promise.resolve(Buffer.from('')),
          toDataURL: () => 'data:image/png;base64,',
        };
      },
      loadImage: () => Promise.reject(new Error('Canvas not available')),
      Image: class MockImage {
        constructor() {
          this.width = 0;
          this.height = 0;
          this.src = '';
        }
      },
    };
  }
}

canvasModule.available = canvasAvailable;
module.exports = canvasModule;
