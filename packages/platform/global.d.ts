/// <reference types="@testing-library/jest-dom" />
/// <reference types="bun-types" />

declare global {
  namespace NodeJS {
    interface Global {
      window: Window & typeof globalThis;
      document: Document;
      navigator: Navigator;
      HTMLElement: typeof HTMLElement;
      HTMLInputElement: typeof HTMLInputElement;
      HTMLButtonElement: typeof HTMLButtonElement;
      sessionStorage: Storage;
      localStorage: Storage;
    }
  }

  // Bun test globals
  var mock: typeof import('bun:test').mock;
  var vi: typeof import('bun:test').vi;
}

export {};
