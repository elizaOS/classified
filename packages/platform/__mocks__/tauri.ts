// Mock Tauri API for testing
import { mock } from 'bun:test';

export const invoke = mock().mockResolvedValue(undefined);
export const listen = mock().mockResolvedValue(() => {});
export const emit = mock();

const tauriApi = {
  invoke,
  listen,
  emit,
};

export default tauriApi;
