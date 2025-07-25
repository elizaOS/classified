import { spyOn } from 'bun:test';
import { logger } from '@elizaos/core';

/**
 * Mock runtime interface for testing
 */
export interface MockRuntime {
  character: {
    name: string;
    system: string;
    plugins: string[];
    settings: Record<string, unknown>;
  };
  getSetting: (key: string) => unknown;
  models: Record<string, unknown>;
  db: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    getKeys: (pattern: string) => Promise<string[]>;
  };
  getService: (serviceType: string) => unknown;
  registerService: (type: unknown, service?: unknown) => void;
  registerAction?: (action: unknown) => void;
}

/**
 * Create a mock runtime for testing
 */
export function createMockRuntime(overrides: Partial<MockRuntime> = {}): MockRuntime {
  const defaultRuntime: MockRuntime = {
    character: {
      name: 'Test SAM Agent',
      system: 'You are a helpful assistant with retro voice synthesis.',
      plugins: [],
      settings: {},
    },
    getSetting: (_key: string) => {
      // Mock settings
      const settings: Record<string, unknown> = {
        SAM_SPEED: 72,
        SAM_PITCH: 64,
        SAM_THROAT: 128,
        SAM_MOUTH: 128,
        HARDWARE_BRIDGE_URL: 'ws://localhost:8888',
      };
      return settings[key] || null;
    },
    models: {},
    db: {
      get: async (_key: string) => null,
      set: async (_key: string, _value: unknown) => true,
      delete: async (_key: string) => true,
      getKeys: async (_pattern: string) => [],
    },
    getService: (_serviceType: string) => {
      // Default implementation returns null (no service found)
      return null;
    },
    registerService: (_type: unknown, _service?: unknown) => {
      // Default no-op implementation
    },
    registerAction: (_action: unknown) => {
      // Default no-op implementation
    },
  };

  // Apply overrides
  return { ...defaultRuntime, ...overrides };
}

/**
 * Set up logger spies for testing
 */
export function setupLoggerSpies() {
  spyOn(logger, 'info');
  spyOn(logger, 'error');
  spyOn(logger, 'warn');
  spyOn(logger, 'debug');
}

/**
 * Create a mock memory object for testing
 */
export function createMockMemory(overrides: Record<string, unknown> = {}) {
  return {
    id: '12345678-1234-1234-1234-123456789012',
    roomId: '12345678-1234-1234-1234-123456789012',
    entityId: '12345678-1234-1234-1234-123456789012',
    agentId: '12345678-1234-1234-1234-123456789012',
    content: {
      text: 'test message',
      source: 'test',
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock state object for testing
 */
export function createMockState(overrides: Record<string, unknown> = {}) {
  return {
    values: {},
    data: {},
    text: '',
    ...overrides,
  };
}

/**
 * Mock WebSocket for hardware bridge testing
 */
export class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
  }

  send(_data: string | ArrayBuffer | Blob) {
    // Mock send - do nothing
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

/**
 * Mock audio data for testing
 */
export function createMockAudioBuffer(length: number = 1000): Uint8Array {
  const buffer = new Uint8Array(length);
  // Fill with some test data (sine wave-like pattern)
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.floor(128 + 127 * Math.sin((2 * Math.PI * i) / 100));
  }
  return buffer;
}

/**
 * Create a mock WAV buffer with proper header
 */
export function createMockWAVBuffer(audioData: Uint8Array, sampleRate: number = 22050): Uint8Array {
  const wavHeaderSize = 44;
  const wavBuffer = new Uint8Array(wavHeaderSize + audioData.length);

  // WAV header (simplified)
  const view = new DataView(wavBuffer.buffer);

  // RIFF chunk
  wavBuffer.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, 36 + audioData.length, true); // File size - 8
  wavBuffer.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // Format chunk
  wavBuffer.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true); // Format chunk size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, 1, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate, true); // Byte rate
  view.setUint16(32, 1, true); // Block align
  view.setUint16(34, 8, true); // Bits per sample

  // Data chunk
  wavBuffer.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, audioData.length, true); // Data size

  // Audio data
  wavBuffer.set(audioData, wavHeaderSize);

  return wavBuffer;
}

/**
 * Mock SAM synthesizer for testing
 */
export class MockSamJS {
  private speed: number = 72;
  private pitch: number = 64;
  private throat: number = 128;
  private mouth: number = 128;

  constructor(options: { speed?: number; pitch?: number; throat?: number; mouth?: number } = {}) {
    this.speed = options.speed || 72;
    this.pitch = options.pitch || 64;
    this.throat = options.throat || 128;
    this.mouth = options.mouth || 128;
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  setPitch(pitch: number) {
    this.pitch = pitch;
  }

  setThroat(throat: number) {
    this.throat = throat;
  }

  setMouth(mouth: number) {
    this.mouth = mouth;
  }

  buf8(text: string): Uint8Array {
    // Mock audio generation - create buffer based on text length and parameters
    const baseLength = Math.max(100, text.length * 50);
    const speedFactor = this.speed / 72; // Normalize around default speed
    const length = Math.floor(baseLength / speedFactor);

    return createMockAudioBuffer(length);
  }

  buf32(text: string): Uint32Array {
    const buffer8 = this.buf8(text);
    const buffer32 = new Uint32Array(Math.ceil(buffer8.length / 4));
    for (let i = 0; i < buffer32.length; i++) {
      buffer32[i] =
        (buffer8[i * 4] || 0) |
        ((buffer8[i * 4 + 1] || 0) << 8) |
        ((buffer8[i * 4 + 2] || 0) << 16) |
        ((buffer8[i * 4 + 3] || 0) << 24);
    }
    return buffer32;
  }
}

/**
 * Utility to wait for async operations in tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a test environment setup
 */
export async function setupTestEnvironment() {
  setupLoggerSpies();

  // Mock any global objects if needed
  if (typeof global !== 'undefined') {
    // @ts-expect-error - Mocking global WebSocket for testing
    global.WebSocket = MockWebSocket;
  }

  return {
    cleanup: () => {
      // Any cleanup needed
    },
  };
}
