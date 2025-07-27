/**
 * Pure JavaScript image processing alternative using Jimp
 * This is a Bun-friendly alternative that doesn't require native modules
 */

// @ts-expect-error - jimp is an optional alternative processor
import Jimp from 'jimp';

export interface ImageProcessor {
  resize(width: number, height?: number): Promise<Buffer>;
  crop(x: number, y: number, width: number, height: number): Promise<Buffer>;
  toBuffer(): Promise<Buffer>;
  metadata(): Promise<{ width: number; height: number; format: string }>;
}

class JimpProcessor implements ImageProcessor {
  private jimp: Jimp;

  constructor(jimp: Jimp) {
    this.jimp = jimp;
  }

  async resize(width: number, height?: number): Promise<Buffer> {
    const resized = this.jimp.resize(width, height || Jimp.AUTO);
    return resized.getBufferAsync(Jimp.MIME_PNG);
  }

  async crop(x: number, y: number, width: number, height: number): Promise<Buffer> {
    const cropped = this.jimp.crop(x, y, width, height);
    return cropped.getBufferAsync(Jimp.MIME_PNG);
  }

  async toBuffer(): Promise<Buffer> {
    return this.jimp.getBufferAsync(Jimp.MIME_PNG);
  }

  async metadata(): Promise<{ width: number; height: number; format: string }> {
    return {
      width: this.jimp.bitmap.width,
      height: this.jimp.bitmap.height,
      format: this.jimp.getMIME(),
    };
  }
}

/**
 * Create a sharp-compatible API using Jimp
 */
export const createJimpSharp = () => {
  const jimpSharp = (input?: string | Buffer) => {
    const processor = {
      _loadPromise: null as Promise<JimpProcessor> | null,

      async _load(): Promise<JimpProcessor> {
        if (!this._loadPromise) {
          this._loadPromise = (async () => {
            let jimp: Jimp;
            if (typeof input === 'string') {
              jimp = await Jimp.read(input);
            } else if (Buffer.isBuffer(input)) {
              jimp = await Jimp.read(input);
            } else {
              throw new Error('Input must be a string path or Buffer');
            }
            return new JimpProcessor(jimp);
          })();
        }
        return this._loadPromise;
      },

      async resize(width: number, height?: number) {
        const proc = await this._load();
        await proc.resize(width, height);
        return this;
      },

      async crop(options: { left: number; top: number; width: number; height: number }) {
        const proc = await this._load();
        await proc.crop(options.left, options.top, options.width, options.height);
        return this;
      },

      async toBuffer(): Promise<Buffer> {
        const proc = await this._load();
        return proc.toBuffer();
      },

      async metadata() {
        const proc = await this._load();
        return proc.metadata();
      },
    };

    return processor;
  };

  // Add static methods for compatibility
  jimpSharp.available = true;
  jimpSharp.isJimpBased = true;

  return jimpSharp;
};

/**
 * Export a singleton instance
 */
export const jimpSharp = createJimpSharp();
