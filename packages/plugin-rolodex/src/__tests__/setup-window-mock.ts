// Mock window object for PGLite in Node environment
if (typeof window === 'undefined') {
  // Create a basic DOM mock
  (global as any).document = {
    body: {
      appendChild: () => {},
      removeChild: () => {},
      children: [],
    },
    head: {
      appendChild: () => {},
      removeChild: () => {},
      children: [],
    },
    createElement: (tag: string) => ({
      tagName: tag,
      appendChild: () => {},
      removeChild: () => {},
      children: [],
      setAttribute: () => {},
      getAttribute: () => null,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    createTextNode: (text: string) => ({ textContent: text }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  (global as any).window = {
    document: (global as any).document,
    location: {
      pathname: '/',
      href: 'http://localhost',
      origin: 'http://localhost',
      hostname: 'localhost',
      protocol: 'http:',
      search: '',
      hash: '',
    },
    encodeURIComponent: (str: string) => encodeURIComponent(str),
    decodeURIComponent: (str: string) => decodeURIComponent(str),
    encodeURI: (str: string) => encodeURI(str),
    decodeURI: (str: string) => decodeURI(str),
    btoa: (str: string) => Buffer.from(str).toString('base64'),
    atob: (str: string) => Buffer.from(str, 'base64').toString(),
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {},
    getComputedStyle: () => ({}),
  };
}
