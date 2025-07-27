// Sharp wrapper for graceful fallback
let sharp;
let sharpAvailable = false;

// Check if we're running in a compiled Bun executable with embedded files
const isCompiledWithEmbeddedSharp =
  typeof Bun !== 'undefined' &&
  Bun.embeddedFiles &&
  Bun.embeddedFiles.some((file) => /sharp-(.*).node$/.test(file.name));

try {
  if (isCompiledWithEmbeddedSharp) {
    console.log('[SHARP] Running in compiled mode with embedded sharp');
  }

  sharp = require('sharp');
  sharpAvailable = true;
  console.log('[SHARP] Sharp module loaded successfully');
} catch (error) {
  console.warn('[SHARP] Sharp module not available, image processing will be limited');
  console.warn('[SHARP] Error:', error.message);

  // Create a mock sharp object with no-op functions
  sharp = new Proxy(
    {},
    {
      get: (target, prop) => {
        if (prop === 'available') {
          return false;
        }
        return () => {
          console.warn(`[SHARP] Sharp method '${prop}' called but sharp is not available`);
          return Promise.reject(new Error('Sharp is not available'));
        };
      },
    }
  );
}

// Add availability check
sharp.available = sharpAvailable;
sharp.isEmbedded = isCompiledWithEmbeddedSharp;

module.exports = sharp;
