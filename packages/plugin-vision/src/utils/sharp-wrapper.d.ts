// Type definitions for sharp wrapper
import type * as Sharp from 'sharp';

declare module './sharp-wrapper' {
  interface SharpWrapper {
    (input?: string | Buffer): Sharp.Sharp;
    (input: Buffer | Uint8Array, options: Sharp.SharpOptions): Sharp.Sharp;
    available: boolean;
    isEmbedded?: boolean;
  }

  const sharpWrapper: SharpWrapper & typeof Sharp;
  export = sharpWrapper;
}
