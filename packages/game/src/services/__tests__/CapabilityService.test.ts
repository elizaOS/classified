/**
 * Unit tests for CapabilityService
 * Tests the IPC routing and fallback behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CapabilityService } from '../CapabilityService';

// Mock Tauri invoke function
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Mock fetch for fallback HTTP requests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CapabilityService', () => {
  let service: CapabilityService;

  beforeEach(() => {
    service = CapabilityService.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tauri Environment Detection', () => {
    it('should detect Tauri environment correctly', () => {
      // Mock Tauri environment
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        configurable: true,
      });

      expect(service['isTauri']()).toBe(true);

      // Clean up
      delete (window as any).__TAURI_INTERNALS__;
    });

    it('should detect non-Tauri environment correctly', () => {
      expect(service['isTauri']()).toBe(false);
    });
  });

  describe('Autonomy Management', () => {
    describe('In Tauri Environment', () => {
      beforeEach(() => {
        Object.defineProperty(window, '__TAURI_INTERNALS__', {
          value: {},
          configurable: true,
        });
      });

      afterEach(() => {
        delete (window as any).__TAURI_INTERNALS__;
      });

      it('should toggle autonomy via Tauri IPC', async () => {
        const mockResponse = { success: true, data: { enabled: true } };
        mockInvoke.mockResolvedValue(mockResponse);

        const result = await service.toggleAutonomy(true);

        expect(mockInvoke).toHaveBeenCalledWith('toggle_autonomy', { enable: true });
        expect(result).toEqual(mockResponse);
      });

      it('should get autonomy status via Tauri IPC', async () => {
        const mockResponse = { success: true, data: { enabled: false, running: false } };
        mockInvoke.mockResolvedValue(mockResponse);

        const result = await service.getAutonomyStatus();

        expect(mockInvoke).toHaveBeenCalledWith('get_autonomy_status');
        expect(result).toEqual(mockResponse);
      });

      it('should handle Tauri IPC errors gracefully', async () => {
        const error = new Error('IPC communication failed');
        mockInvoke.mockRejectedValue(error);

        await expect(service.toggleAutonomy(true)).rejects.toThrow('IPC communication failed');
      });
    });

    describe('In Non-Tauri Environment (Fallback)', () => {
      it('should toggle autonomy via HTTP fallback', async () => {
        const mockResponse = { success: true, data: { enabled: true } };
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockResponse),
        });

        const result = await service.toggleAutonomy(true);

        expect(mockFetch).toHaveBeenCalledWith('http://localhost:7777/autonomy/enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        expect(result).toEqual(mockResponse);
      });

      it('should get autonomy status via HTTP fallback', async () => {
        const mockResponse = { success: true, data: { enabled: false } };
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockResponse),
        });

        const result = await service.getAutonomyStatus();

        expect(mockFetch).toHaveBeenCalledWith('http://localhost:7777/autonomy/status');
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('Generic Capability Management', () => {
    describe('In Tauri Environment', () => {
      beforeEach(() => {
        Object.defineProperty(window, '__TAURI_INTERNALS__', {
          value: {},
          configurable: true,
        });
      });

      afterEach(() => {
        delete (window as any).__TAURI_INTERNALS__;
      });

      it('should toggle shell capability via Tauri IPC', async () => {
        const mockResponse = { success: true, data: { enabled: true } };
        mockInvoke.mockResolvedValue(mockResponse);

        const result = await service.toggleCapability('shell');

        expect(mockInvoke).toHaveBeenCalledWith('toggle_capability', { capability: 'shell' });
        expect(result).toEqual(mockResponse);
      });

      it('should get browser capability status via Tauri IPC', async () => {
        const mockResponse = { success: true, data: { enabled: false } };
        mockInvoke.mockResolvedValue(mockResponse);

        const result = await service.getCapabilityStatus('browser');

        expect(mockInvoke).toHaveBeenCalledWith('get_capability_status', { capability: 'browser' });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('In Non-Tauri Environment (Fallback)', () => {
      it('should toggle capability via HTTP fallback', async () => {
        const mockResponse = { success: true, data: { enabled: true } };
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve(mockResponse),
        });

        const result = await service.toggleCapability('shell');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:7777/api/agents/default/capabilities/shell/toggle',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('Agent Settings Management', () => {
    describe('In Tauri Environment', () => {
      beforeEach(() => {
        Object.defineProperty(window, '__TAURI_INTERNALS__', {
          value: {},
          configurable: true,
        });
      });

      afterEach(() => {
        delete (window as any).__TAURI_INTERNALS__;
      });

      it('should update agent setting via Tauri IPC', async () => {
        const mockResponse = { success: true };
        mockInvoke.mockResolvedValue(mockResponse);

        const result = await service.updateAgentSetting('ENABLE_CAMERA', true);

        expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
          key: 'ENABLE_CAMERA',
          value: true,
        });
        expect(result).toEqual(mockResponse);
      });

      it('should get vision settings via Tauri IPC', async () => {
        const mockResponse = {
          success: true,
          data: {
            ENABLE_CAMERA: 'true',
            ENABLE_SCREEN_CAPTURE: 'false',
          },
        };
        mockInvoke.mockResolvedValue(mockResponse);

        const result = await service.getVisionSettings();

        expect(mockInvoke).toHaveBeenCalledWith('get_vision_settings');
        expect(result).toEqual(mockResponse);
      });

      it('should refresh vision service via Tauri IPC', async () => {
        const mockResponse = { success: true };
        mockInvoke.mockResolvedValue(mockResponse);

        const result = await service.refreshVisionService();

        expect(mockInvoke).toHaveBeenCalledWith('refresh_vision_service');
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('Vision Capability Helpers', () => {
    beforeEach(() => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        configurable: true,
      });
    });

    afterEach(() => {
      delete (window as any).__TAURI_INTERNALS__;
    });

    it('should toggle camera with proper setting updates', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      await service.toggleCamera(true);

      expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
        key: 'ENABLE_CAMERA',
        value: true,
      });
      expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
        key: 'VISION_CAMERA_ENABLED',
        value: true,
      });
      expect(mockInvoke).toHaveBeenCalledWith('refresh_vision_service');
    });

    it('should toggle screen capture with proper setting updates', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      await service.toggleScreenCapture(false);

      expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
        key: 'ENABLE_SCREEN_CAPTURE',
        value: false,
      });
      expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
        key: 'VISION_SCREEN_ENABLED',
        value: false,
      });
      expect(mockInvoke).toHaveBeenCalledWith('refresh_vision_service');
    });

    it('should toggle microphone with proper setting updates', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      await service.toggleMicrophone(true);

      expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
        key: 'ENABLE_MICROPHONE',
        value: true,
      });
      expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
        key: 'VISION_MICROPHONE_ENABLED',
        value: true,
      });
      expect(mockInvoke).toHaveBeenCalledWith('refresh_vision_service');
    });

    it('should toggle speakers with proper setting updates', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      await service.toggleSpeakers(false);

      expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
        key: 'ENABLE_SPEAKER',
        value: false,
      });
      expect(mockInvoke).toHaveBeenCalledWith('update_agent_setting', {
        key: 'VISION_SPEAKER_ENABLED',
        value: false,
      });
      expect(mockInvoke).toHaveBeenCalledWith('refresh_vision_service');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        configurable: true,
      });
    });

    afterEach(() => {
      delete (window as any).__TAURI_INTERNALS__;
    });

    it('should fetch all capability statuses in parallel', async () => {
      const mockResponses = [
        { success: true, data: { enabled: true, running: true } }, // autonomy
        { success: true, data: { enabled: false } }, // shell
        { success: true, data: { enabled: true } }, // browser
        { success: true, data: { ENABLE_CAMERA: 'true' } }, // vision
      ];

      mockInvoke
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2])
        .mockResolvedValueOnce(mockResponses[3]);

      const result = await service.getAllCapabilityStatuses();

      expect(mockInvoke).toHaveBeenCalledWith('get_autonomy_status');
      expect(mockInvoke).toHaveBeenCalledWith('get_capability_status', { capability: 'shell' });
      expect(mockInvoke).toHaveBeenCalledWith('get_capability_status', { capability: 'browser' });
      expect(mockInvoke).toHaveBeenCalledWith('get_vision_settings');

      expect(result).toEqual({
        autonomy: mockResponses[0],
        shell: mockResponses[1],
        browser: mockResponses[2],
        vision: mockResponses[3],
      });
    });

    it('should handle partial failures in batch operations', async () => {
      mockInvoke
        .mockResolvedValueOnce({ success: true, data: { enabled: true } })
        .mockRejectedValueOnce(new Error('Shell not available'))
        .mockResolvedValueOnce({ success: true, data: { enabled: false } })
        .mockResolvedValueOnce({ success: true, data: {} });

      const result = await service.getAllCapabilityStatuses();

      expect(result.autonomy.success).toBe(true);
      expect(result.shell).toEqual({ enabled: false, service_available: false });
      expect(result.browser.success).toBe(true);
      expect(result.vision.success).toBe(true);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CapabilityService.getInstance();
      const instance2 = CapabilityService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
